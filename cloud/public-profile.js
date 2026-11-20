// Public social identity is separate from local gameplay and the private profile.
// Callers must obtain an explicit choice before publishing it.
const columns = 'user_id,display_name,bio,is_public,revision';

export function validatePublicProfile(input) {
  const name = String(input.name ?? '').trim();
  const bio = String(input.bio ?? '').trim();
  if (!name || [...name].length > 40) throw new Error('invalid_name');
  if ([...bio].length > 160) throw new Error('invalid_bio');
  if (typeof input.isPublic !== 'boolean') throw new Error('invalid_visibility');
  return {display_name:name, bio, is_public:input.isPublic};
}
export async function currentUser(client) {
  const {data,error} = await client.auth.getSession();
  if (error) throw error;
  if (!data?.session?.user?.id) throw new Error('sign_in_required');
  return data.session.user.id;
}
export async function requireUser(client, expected) {
  if (await currentUser(client) !== expected) throw new Error('account_changed');
}
export async function readOwnProfile(client, userId) {
  await requireUser(client,userId);
  const {data,error} = await client.from('arkid_public_profiles').select(columns).eq('user_id',userId).maybeSingle();
  if (error) throw error;
  await requireUser(client,userId);
  return data;
}
export async function saveOwnProfile(client, userId, existing, input) {
  const values = validatePublicProfile(input);
  await requireUser(client,userId);
  let result;
  if (existing) {
    if (existing.user_id !== userId || !existing.revision) throw new Error('stale_profile');
    result = await client.from('arkid_public_profiles').update(values)
      .eq('user_id',userId).eq('revision',existing.revision).select(columns).maybeSingle();
  } else {
    result = await client.from('arkid_public_profiles').insert({user_id:userId,...values}).select(columns).single();
  }
  if (result.error) {
    if (result.error.code === '23505') throw new Error('stale_profile');
    throw result.error;
  }
  if (!result.data) throw new Error('stale_profile');
  await requireUser(client,userId);
  return result.data;
}
