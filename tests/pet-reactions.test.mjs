import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const css=await readFile(new URL('../arkid-refresh.css',import.meta.url),'utf8');
const code=html.slice(html.indexOf('// Reactions are ephemeral'),html.indexOf('/* ★ پالت فرمان'));
function setup({onboarded=true,visible=true,score=0,session=false}={}){
 const state={arcade_onboarded:onboarded};const writes=[];const sessionData={};let next=0;const timers=new Map();
 const elements=Object.fromEntries(['petReaction','petReactionArt','petReactionName','petReactionText','hero','spinReminder'].map(id=>[id,{hidden:id==='petReaction'||id==='spinReminder',textContent:'',innerHTML:'',getBoundingClientRect:()=>({top:100,bottom:250})}]));
 const records=[];
 const context={AU:{settings:{petVisible:visible}},LS:{get:(k,d)=>state[k]??d,set:(k,v)=>{state[k]=v;writes.push(k)}},auEl:id=>elements[id],safeSessionGet:k=>sessionData[k]||null,safeSessionSet:(k,v)=>sessionData[k]=v,feedbackReady:true,document:{hidden:false,querySelector:()=>records.find(e=>!e.removed)||null,createElement:()=>({setAttribute(){},remove(){this.removed=true}}),body:{append:e=>records.push(e)}},bootIsActive:()=>false,modalStack:[],sideMenuOpen:false,launchInProgress:false,pendingNavigation:null,attractActive:false,innerHeight:800,hubSessionId:'this-tab',auRecordCandidate:session?{id:'snake',highScoreBefore:100}:null,auPet:()=>({type:'cat',name:'پیکسل'}),auPetWorn:()=>({hat:true}),auPetSVG:(type,worn)=>`${type}:${worn.hat}`,GAMES:[{id:'snake',title:'مار'}],getTop:()=>score,safeXP:n=>Math.max(0,Number(n)||0),esc:s=>s,auButton:()=>'<button>اشتراک</button>',setTimeout:(fn,ms)=>{timers.set(++next,{fn,ms});return next},clearTimeout:id=>timers.delete(id)};
 vm.createContext(context);vm.runInContext(code,context);return {context,state,sessionData,elements,writes,records,timers};
}
test('welcome waits for a clear visible hero, respects preferences and appears once per session',()=>{
 const x=setup();x.context.modalStack.push({});x.context.auPetReactionTick();assert.equal(x.elements.petReaction.hidden,true);x.context.modalStack.pop();
 x.elements.spinReminder.hidden=false;x.context.auPetReactionTick();assert.equal(x.elements.petReaction.hidden,true);x.elements.spinReminder.hidden=true;
 x.context.auPetReactionTick();assert.equal(x.elements.petReaction.hidden,false);assert.match(x.elements.petReactionText.textContent,/خوش برگشتی/);assert.equal(x.elements.petReactionArt.innerHTML,'cat:true');assert.equal(x.sessionData.arkid_pet_greeted,'1');assert.deepEqual(x.writes,[]);
 const timer=[...x.timers.values()].find(t=>t.ms===8000);assert.ok(timer);timer.fn();x.context.auPetReactionTick();assert.equal(x.elements.petReaction.hidden,true);
 const disabled=setup({visible:false});disabled.context.auPetReactionTick();assert.equal(disabled.elements.petReaction.hidden,true);assert.deepEqual(disabled.writes,[]);
 const fresh=setup({onboarded:false});fresh.context.auPetReactionTick();assert.equal(fresh.elements.petReaction.hidden,true);fresh.state.arcade_onboarded=true;fresh.context.auPetReactionTick();assert.equal(fresh.elements.petReaction.hidden,true);
});
test('a real new record takes priority over a return; no record produces a gentle return',()=>{
 const x=setup({score:250,session:true});x.context.auRecordCheck();assert.equal(x.records.length,1);assert.deepEqual(x.writes,['arcade_last_record_notif']);x.context.auPetReactionTick();assert.equal(x.elements.petReaction.hidden,true);
 x.records[0].remove();x.context.auPetReactionTick();assert.match(x.elements.petReactionText.textContent,/رکورد جدید در مار/);assert.equal(x.elements.petReaction.hidden,false);
 const y=setup({score:100,session:true});y.context.auRecordCheck();y.context.auPetReactionTick();assert.match(y.elements.petReactionText.textContent,/مار چطور بود/);assert.deepEqual(y.writes,[]);
 const other=setup({score:100});other.context.auRecordCandidate={id:'snake',owner:'other-tab',highScoreBefore:100};other.sessionData.arkid_pet_greeted='1';other.context.auRecordCheck();other.context.auPetReactionTick();assert.equal(other.elements.petReaction.hidden,true);
});
test('reactions stay pending off-screen, hide for overlays, and honour motion preferences',()=>{
 const x=setup({score:250,session:true});x.elements.hero.getBoundingClientRect=()=>({top:-500,bottom:-100});x.context.auRecordCheck();x.records[0].remove();x.context.auPetReactionTick();assert.equal(x.elements.petReaction.hidden,true);
 x.elements.hero.getBoundingClientRect=()=>({top:100,bottom:250});x.context.auPetReactionTick();assert.equal(x.elements.petReaction.hidden,false);x.context.document.hidden=true;x.context.auPetReactionTick();assert.equal(x.elements.petReaction.hidden,true);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\.hero \.pet-reaction/);assert.match(css,/\.au-no-motion \.hero \.pet-reaction/);assert.match(html,/role="status" aria-live="polite"/);
});
