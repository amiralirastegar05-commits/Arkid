import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const claimFunctions = html.slice(html.indexOf('function getEarnClaimed()'), html.indexOf('function getHubDailyStreak()'));
const channelFunctions = html.slice(html.indexOf('const EARN_CHANNELS = ['), html.indexOf('function renderEarnPointsModal()'));

function setup(existing = {}) {
  let time = 100000, points = 0;
  const data = {arcade_earn_claimed: {...existing}}, session = {}, opened = [];
  const nodes = new Map();
  const context = {
    LS: {get: (key, fallback) => structuredClone(data[key] ?? fallback), set: (key, value) => {data[key] = structuredClone(value);}},
    POINTS_REWARDS: {channelAliGraph:80,channelDrPlus:80,channelArkidTelegram:80,channelArkidEitaa:80},
    readSessionJSON: (key, fallback) => session[key] ? JSON.parse(session[key]) : fallback,
    safeSessionSet: (key,value) => {session[key] = value;},
    document: {getElementById(id) { if (!nodes.has(id)) nodes.set(id, {className:'',textContent:'',disabled:false}); return nodes.get(id); }},
    window: {open: (...args) => opened.push(args)}, location:{protocol:'https:'},
    economyBusy:false, economyAction:fn=>fn(), faNum:String,
    showToast() {}, addPoints(amount) {points += amount;},
    Date: class extends Date { static now() {return time;} }
  };
  vm.runInNewContext(`${claimFunctions}\n${channelFunctions}\nglobalThis.testApi = {getEarnClaimed,handleChannelClick,updateChannelBonusUI};`,context);
  return {api:context.testApi, data, session, opened, nodes, get points(){return points;}, advance(ms){time += ms;}};
}

test('all messenger mini apps appear as safe external links in the discoverable dialog', () => {
  assert.match(html, /id="heroMessengersBtn"/);
  assert.match(html, /data-action="messengers"/);
  const dialog = html.slice(html.indexOf('id="messengersModal"'), html.indexOf('<!-- ============ منوی شیشه‌ای'));
  for (const url of ['https://t.me/arcade_ir_bot','https://ble.ir/arcade_ir_bot','https://splus.ir/arcade_ir_bot','https://eitaa.com/arcade_ir_app']) {
    assert.ok(dialog.includes(`href="${url}" target="_blank" rel="noopener noreferrer"`), url);
  }
});

test('new channel rewards wait five seconds and can be claimed once independently', () => {
  const state = setup({'channel-aligraph':1, 'channel-drplus':2});
  state.api.updateChannelBonusUI();
  for (const [key,url,status] of [
    ['channel-arkid-telegram','https://t.me/arcade_ir_Channel','channelArkidTelegramStatus'],
    ['channel-arkid-eitaa','https://eitaa.com/arcade_ir_Channel','channelArkidEitaaStatus']
  ]) {
    const before = state.points;
    state.api.handleChannelClick(key);
    assert.equal(state.opened.at(-1)[0],url);
    state.api.handleChannelClick(key); assert.equal(state.points,before);
    state.advance(4999); state.api.handleChannelClick(key); assert.equal(state.points,before);
    state.advance(1); state.api.updateChannelBonusUI(); assert.equal(state.nodes.get(status).textContent,'دریافت');
    state.api.handleChannelClick(key); assert.equal(state.points,before+80);
    state.api.handleChannelClick(key); assert.equal(state.points,before+80);
    state.api.updateChannelBonusUI(); assert.equal(state.nodes.get(status).textContent,'✓ دریافت شد');
  }
  assert.equal(state.api.getEarnClaimed()['channel-aligraph'],1);
  assert.equal(state.api.getEarnClaimed()['channel-drplus'],2);
  assert.ok(state.api.getEarnClaimed()['channel-arkid-telegram']);
  assert.ok(state.api.getEarnClaimed()['channel-arkid-eitaa']);
  assert.equal(state.points,160);
});

test('previously claimed new channel remains claimed on subsequent loads', () => {
  const state = setup({'channel-arkid-telegram':123,'channel-arkid-eitaa':456});
  state.api.updateChannelBonusUI();
  assert.equal(state.nodes.get('channelArkidTelegramBtn').disabled,true);
  assert.equal(state.nodes.get('channelArkidEitaaBtn').disabled,true);
  state.api.handleChannelClick('channel-arkid-telegram');
  state.api.handleChannelClick('channel-arkid-eitaa');
  assert.equal(state.points,0); assert.equal(state.opened.length,0);
});
