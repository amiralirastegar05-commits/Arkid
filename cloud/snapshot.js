import { SUPABASE_URL } from "./config.js";
// Whole snapshots, never arithmetic merges: local balances and claim flags are coupled.
const HUB_KEYS = new Set(`arcade_profile arcade_points arcade_points_history arcade_earn_claimed arcade_daily_streak_hub arcade_inventory arcade_equipped arcade_xp_boost arcade_streak_freezes arcade_secret_unlocks arcade_quests arcade_weekly_bosses arcade_tournament_active arcade_tournaments arcade_plays arcade_last arcade_stats arcade_achievements arcade_sound arcade_streak7_given arcade_streak30_given arcade_streak7_points_given arcade_streak30_points_given arcade_last_daily_visit arcade_crt_enabled arcade_settings arcade_theme arcade_rotating arcade_last_spin arcade_favorites arcade_challenges arcade_pet arcade_showcase arcade_shortcuts arcade_onboarded arcade_notification_seen arcade_event_active arcade_weekly_rare arcade_gamepad_config arcade_lb_ arcade_points_feedback arcade_xp_feedback arcade_pending_level arcade_reward_pending arcade_tournament_result_pending arcade_channel_pending arcade_gotd_active`.split(' '));
const GAME_KEYS = /^(?:2048_(?:settings_v1|achievements_v1|stats_v1|daily_seed|highscores_v1|last_name)|ast_(?:settings_v1|achv_v1|stats_v1|scores_v1|last_name)|bk_(?:settings_v1|achv_v1|stats_v1|highscores_v1|last_name)|mk_(?:settings_v1|achievements_v1|stats_v1|highscores_v1|last_name|tut_seen)|mp_(?:settings_v1|achievements_v1|stats_v1|highscores_v1|progress_v1|last_name|tut_seen)|rr_(?:settings_v3|achv_v3|stats_v3|highscores_v3|last_name|tut_seen|pacman_settings_v1|pacman_achv_v1|pacman_stats_v1|pacman_highscores_v1)|pong_(?:settings_v1|achv_v1|stats_v1|highscores_v1|last_name)|snake_(?:settings_v1|achv_v1|stats_v1|hs_v1)|si_(?:settings_v1|scores_v1|achv_v1)|tr_(?:settings_v1|achv_v1|stats_v1|highscores_v1|last_name)|arcade-runner_(?:settings_v1|progress_v1|stats_v1|achievements_v1|highscores_v1|inventory_v1|last_name|daily_seed_v1)|ar_tutorial_v2_steps|GameRunnerSave)$/;
const HUB_DYNAMIC = /^arcade_(?:top|playcount|added|bosses|lootbox_count|lb)_[a-zA-Z0-9_-]+$/;
export const META_KEY = 'arkid_cloud_snapshot_meta_v1';
export const isGameKey = key => HUB_KEYS.has(key) || GAME_KEYS.test(key) || HUB_DYNAMIC.test(key);

export function collect(storage) {
  const data = Object.create(null);
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && isGameKey(key)) data[key] = storage.getItem(key);
  }
  return { schema: 1, storage: data };
}
export function validate(snapshot) {
  if (!snapshot || snapshot.schema !== 1 || Object.keys(snapshot).some(k => k !== 'schema' && k !== 'storage') || !snapshot.storage || typeof snapshot.storage !== 'object' || Array.isArray(snapshot.storage)) throw Error('Unsupported snapshot format.');
  const entries = Object.entries(snapshot.storage);
  if (entries.length > 1000 || entries.some(([k, v]) => !isGameKey(k) || typeof v !== 'string')) throw Error('Invalid snapshot keys or values.');
  if (new TextEncoder().encode(JSON.stringify(snapshot)).length > 1900000) throw Error('Snapshot is too large.');
  return snapshot;
}
function same(a, b) {
  const x = validate(a).storage, y = validate(b).storage;
  return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(k => Object.hasOwn(y, k) && x[k] === y[k]);
}
export function meta(storage) {
  const raw = storage.getItem(META_KEY);
  if (!raw) return null;
  const result = JSON.parse(raw);
  if (!result || typeof result.user !== 'string' || typeof result.revision !== 'string') throw Error('Invalid local cloud metadata.');
  if (result.project !== SUPABASE_URL) throw Error('Local cloud binding belongs to another or unknown project. Preserve local data and resolve the binding before cloud use.');
  return result;
}
// Avoid adopting another session's result after an asynchronous request.
export async function requireCurrentUser(client, user) {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (!user || data?.session?.user?.id !== user) throw Error('Account changed during cloud operation.');
}
export async function readRemote(client, user) {
  const { data, error } = await client.from('arkid_cloud_snapshots').select('revision,data,updated_at').eq('user_id', user).maybeSingle();
  if (error) throw error;
  if (data) {
    if (typeof data.revision !== 'string' || !data.revision) throw Error('Invalid cloud revision.');
    validate(data.data);
  }
  return data;
}
export async function upload(client, user, storage) {
  const originalMeta = storage.getItem(META_KEY);
  const binding = meta(storage);
  if (binding && binding.user !== user) throw Error('This browser is linked to a different account; do not upload shared local progress to another account.');
  if (storage.getItem('arcade_active_session') !== null) throw Error('A game session is active; finish it before backing up.');
  const snapshot = validate(collect(storage));
  if (!Object.keys(snapshot.storage).length) throw Error('No local game data to back up.');
  await requireCurrentUser(client, user);
  const remote = await readRemote(client, user);
  await requireCurrentUser(client, user);
  if (storage.getItem(META_KEY) !== originalMeta) throw Error('Local cloud binding changed during upload.');
  if (storage.getItem('arcade_active_session') !== null) throw Error('A game session is active; finish it before backing up.');
  if (remote && same(remote.data, snapshot)) {
    storage.setItem(META_KEY, JSON.stringify({ user, revision: remote.revision, project: SUPABASE_URL }));
    return { unchanged: true, localChanged: storage.getItem('arcade_active_session') !== null || !same(snapshot, collect(storage)) };
  }
  if (remote && (!binding || binding.revision !== remote.revision)) throw Error('Cloud conflict: another device has a different snapshot. Nothing was overwritten.');
  if (!remote && binding) throw Error('Cloud snapshot is missing; refusing to overwrite or recreate it automatically.');
  const { data, error } = await client.rpc('arkid_save_snapshot', { expected_user: user, expected_revision: remote?.revision ?? null, snapshot });
  if (error) throw error;
  // PostgREST may serialize composite RPC results as a one-element array.
  const saved = Array.isArray(data) ? data[0] : data;
  if (!saved || typeof saved.revision !== 'string' || !saved.revision) throw Error('Unexpected cloud response.');
  await requireCurrentUser(client, user);
  if (storage.getItem(META_KEY) !== originalMeta) throw Error('Local cloud binding changed during upload.');
  storage.setItem(META_KEY, JSON.stringify({ user, revision: saved.revision, project: SUPABASE_URL }));
  return { unchanged: false, localChanged: storage.getItem('arcade_active_session') !== null || !same(snapshot, collect(storage)) };
}
// Only install on a pristine browser. No existing game key is replaced or deleted.
export function restoreEmpty(storage, user, remote) {
  if (!user || !remote || typeof remote.revision !== 'string' || !remote.revision) throw Error('Invalid cloud account or revision.');
  validate(remote.data);
  const originalMeta = storage.getItem(META_KEY);
  const binding = meta(storage);
  if (binding && binding.user !== user) throw Error('This browser is linked to another account.');
  if (storage.getItem('arcade_active_session') !== null) throw Error('A game session is active; close it before restoring.');
  if (Object.keys(collect(storage).storage).length) throw Error('Local game data already exists. Restore is blocked to protect it.');
  if (!Object.keys(remote.data.storage).length) throw Error('Cloud snapshot is empty.');
  const written = [];
  try {
    for (const [key, value] of Object.entries(remote.data.storage)) {
      if (storage.getItem(META_KEY) !== originalMeta || storage.getItem('arcade_active_session') !== null || storage.getItem(key) !== null) throw Error('Local data changed during restore.');
      storage.setItem(key, value);
      written.push(key);
    }
    if (storage.getItem(META_KEY) !== originalMeta || storage.getItem('arcade_active_session') !== null || !same(remote.data, collect(storage))) throw Error('Local data changed during restore.');
    storage.setItem(META_KEY, JSON.stringify({ user, revision: remote.revision, project: SUPABASE_URL }));
  } catch (error) {
    let rollbackFailed = false;
    for (const key of written) {
      try { if (storage.getItem(key) === remote.data.storage[key]) storage.removeItem(key); }
      catch (_) { rollbackFailed = true; }
    }
    if (rollbackFailed) throw new Error('Restore failed and rollback was incomplete; do not clear storage, seek recovery help.', { cause: error });
    throw error;
  }
}
