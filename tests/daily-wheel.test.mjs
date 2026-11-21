import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const reminderCode = html.slice(html.indexOf('function auUpdateSpinReminder(){'), html.indexOf('function auSpinOpen(){'));
const spinCode = html.slice(html.indexOf('async function auSpin(){'), html.indexOf('\nfunction auLeaderboard('));
const spinFunction = spinCode.slice(0, spinCode.indexOf('\n'));

function reminderSetup() {
  const store = {arcade_onboarded:true}, reminder = {hidden:true};
  const env = {store, today:'2026-11-20', feedbackReady:true, document:{hidden:false}, boot:false, modalStack:[], sideMenuOpen:false, launchInProgress:false, pendingNavigation:false, AU:{spinBusy:false}, reminder};
  const ctx = { ...env, LS:{get:(key,def)=>store[key]??def,set:(key,value)=>{store[key]=value;}}, dateKey:()=>ctx.today, auEl:id=>id==='spinReminder'?reminder:null, bootIsActive:()=>ctx.boot };
  vm.runInNewContext(reminderCode+'\nglobalThis.api={auUpdateSpinReminder,auDismissSpinReminder};',ctx);
  return {ctx,store,reminder,api:ctx.api};
}

test('reminder is once per local day and never grants a spin', () => {
  const {ctx,store,reminder,api} = reminderSetup();
  api.auUpdateSpinReminder(); assert.equal(reminder.hidden,false);
  api.auDismissSpinReminder(); assert.equal(reminder.hidden,true);
  assert.equal(store.arcade_spin_reminder_dismissed,ctx.today);
  assert.equal(store.arcade_last_spin,undefined);
  api.auUpdateSpinReminder(); assert.equal(reminder.hidden,true);
  ctx.today = '2026-11-21'; api.auUpdateSpinReminder(); assert.equal(reminder.hidden,false);
  store.arcade_last_spin=ctx.today; api.auUpdateSpinReminder(); assert.equal(reminder.hidden,true);
});
test('reminder waits for onboarding, boot, other overlays, navigation and unfinished rewards', () => {
  const {ctx,store,reminder,api} = reminderSetup();
  for (const [target,key,value] of [
    [store,'arcade_onboarded',false],[ctx,'feedbackReady',false],[ctx.document,'hidden',true],[ctx,'boot',true],
    [ctx,'modalStack',[{id:'onboardingModal'}]],[ctx,'sideMenuOpen',true],[ctx,'launchInProgress',true],
    [ctx,'pendingNavigation',true],[ctx.AU,'spinBusy',true],[store,'arcade_reward_pending',{label:'prize'}]
  ]) {
    const old=target[key]; target[key]=value; api.auUpdateSpinReminder(); assert.equal(reminder.hidden,true,key); target[key]=old;
  }
  api.auUpdateSpinReminder(); assert.equal(reminder.hidden,false);
});
function spinSetup(chances) {
  const data={}, granted=[], timer=[], button={}, wheel={style:{}};
  const prizes=Array.from({length:7},(_,i)=>({kind:'points',amount:i+1,label:String(i)})).concat({kind:'again',label:'again'});
  let n=0;
  const ctx={AU:{spinBusy:false},LS:{get:(k,d)=>data[k]??d,set:(k,v)=>{data[k]=v;},remove:k=>{delete data[k];}},dateKey:()=> 'day',auChance:()=>chances[n++],auSpinPrizes:prizes,
    economyAction:async fn=>fn(),auGrantPrize:p=>granted.push(p),auEl:id=>id==='auWheel'?wheel:{querySelector:()=>button},playUI(){},setTimeout:fn=>timer.push(fn),auMotion:()=>true,closeModal(){},auPrizeModal(){},auSync(){}};
  vm.runInNewContext(spinFunction+'\nglobalThis.spin=auSpin;',ctx);
  return {ctx,data,granted,timer,button,wheel};
}
test('spinning records exactly one daily prize and the pointer lands on the chosen segment', async () => {
  for (let index=0;index<7;index++) {
    const {ctx,data,granted,timer,button,wheel}=spinSetup([(index+.1)/8]);
    await ctx.spin(); assert.equal(granted.length,1); assert.equal(data.arcade_last_spin,'day'); assert.equal(button.disabled,true);
    const rotation=Number(wheel.style.transform.match(/\(([-.\d]+)deg\)/)[1]);
    assert.equal((rotation + index*45 + 22.5)%360,0);
    await ctx.spin(); assert.equal(granted.length,1); timer[0](); await ctx.spin(); assert.equal(granted.length,1);
  }
});
test('again selects one final prize and keeps the same one-spin daily limit', async () => {
  const {ctx,data,granted,timer,wheel}=spinSetup([.99, .4]);
  await ctx.spin();
  assert.equal(granted.length,1); assert.equal(granted[0].amount,3); assert.equal(data.arcade_last_spin,'day');
  const rotation=Number(wheel.style.transform.match(/\(([-.\d]+)deg\)/)[1]); assert.equal((rotation + 2*45 + 22.5)%360,0);
  timer[0](); await ctx.spin(); assert.equal(granted.length,1);
});
