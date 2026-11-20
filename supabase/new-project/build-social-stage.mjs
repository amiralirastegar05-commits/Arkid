// Produce the exact additive first-stage SQL. No network or database access.
// The caller must execute the whole result in ONE transaction on the verified
// intended project; never replay migrations 001/002 on the existing project.
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const files=['003_public_profiles.sql','004_teams_and_discovery.sql','005_announcements.sql','006_monthly_ranking.sql','007_social_safety.sql','008_ranked_sessions.sql','009_moderation.sql','010_my_monthly_points.sql'];
export async function buildSocialStage(){
 const parts=['-- Additive Arkid social stage; reporting RPCs held at the end.\n-- Execute atomically; never apply 001 or 002 to the existing project.'];
 for(const name of files)parts.push(`\n-- BEGIN ${name}\n${await readFile(new URL('./migrations/'+name,import.meta.url),'utf8')}\n-- END ${name}`);
 parts.push(`\n-- BEGIN hold_reporting.sql\n${await readFile(new URL('./rollout/hold_reporting.sql',import.meta.url),'utf8')}\n-- END hold_reporting.sql\n`);
 return parts.join('\n');
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)process.stdout.write(await buildSocialStage());
