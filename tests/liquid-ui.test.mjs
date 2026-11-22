import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = file => readFileSync(new URL('../'+file, import.meta.url),'utf8');

test('every standalone game loads the lightweight icon converter without the hub handlers', () => {
  for (const game of ['2048','arcade-runner','asteroids','breakout','game-runner','mushroom-killer','mushroom-platformer','pacman','pong','river-raid','snake','space-invaders','tetris']) {
    const html=read(game+'.html');
    assert.match(html, /href="arcade-icons\.css"/);
    assert.match(html, /src="arcade-polish\.js" data-icons-only defer/);
  }
  const icons=read('arcade-polish.js');
  assert.match(icons,/data-icons-only/);
  assert.match(icons,/apx-i-/); // independent from the runner's own sprite
  assert.match(icons,/1F300.*1FAFF/);
  assert.match(icons,/SKIP\[n.nodeName\] \|\| n.namespaceURI === NS/);
});

test('redesigned surfaces preserve the existing controls, settings and offline assets', () => {
  const html=read('index.html'), css=read('liquid-ui.css'), sw=read('sw.js');
  for(const id of ['shopGrid','shopTabs','profileModal','auSound','auMotion','auPetType','auPetName','auPetVisible','auSchemeDark','auSchemeLight']) assert.ok(html.includes(id),id);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/\.au-no-motion/);
  assert.match(css,/:root\[data-scheme=light\]/);
  assert.match(sw,/'liquid-ui\.css'/); assert.match(sw,/'arcade-icons\.css'/);
  assert.match(html,/await drawCosmeticName\(/);
});
