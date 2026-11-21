import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {collect} from '../cloud/snapshot.js';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const css=await readFile(new URL('../arcade-upgrade.css',import.meta.url),'utf8');
const part=(start,end)=>html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)));
function setup(pet={},owned=[]){
 const data={arcade_pet:{type:'cat',name:'پیکسل',xp:0,lastFed:0,userXP:0,remainder:0,...pet},arcade_inventory:{items:owned}};
 const ctx={LS:{get:(key,def)=>data[key]??def,set:(key,value)=>data[key]=value},auSafeObject:x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{},safeXP:n=>Math.max(0,Number(n)||0),getProfile:()=>({xp:0}),hasItem:id=>data.arcade_inventory.items.includes(id),auRenderPet:()=>{}};
 vm.runInNewContext(part('function auPet(){','// All artwork and equipment share')+';globalThis.api={auPet,auPetWorn,auSetPetAccessory}',ctx);
 return {data,...ctx.api};
}

test('legacy pets retain their selected accessory and level-up hat without a migration write',()=>{
 const old=setup({accessory:'pet-glasses',name:'یار',xp:110,extra:'keep'},['pet-glasses']);
 assert.equal(old.auPetWorn(old.auPet()).glasses,true);assert.equal(old.auPetWorn(old.auPet()).hat,false);
 assert.equal(old.data.arcade_pet.accessories,undefined);assert.equal(old.data.arcade_pet.extra,'keep');
 const bonus=setup({xp:110});assert.equal(bonus.auPetWorn(bonus.auPet()).hat,true);
});

test('owned hat and glasses are independently equipped, removed and preserved in existing pet record',()=>{
 const x=setup({accessory:'pet-glasses',name:'یار',extra:'keep'},['pet-hat','pet-glasses']);
 assert.equal(x.auSetPetAccessory('pet-hat',true),true);
 assert.equal(x.auPetWorn(x.auPet()).hat,true);assert.equal(x.auPetWorn(x.auPet()).glasses,true);
 assert.equal(x.data.arcade_pet.accessories.hat,'pet-hat');assert.equal(x.data.arcade_pet.accessories.glasses,'pet-glasses');
 x.auSetPetAccessory('pet-glasses',false);assert.equal(x.auPetWorn(x.auPet()).glasses,false);assert.equal(x.auPetWorn(x.auPet()).hat,true);
 x.auSetPetAccessory('pet-hat',false);assert.equal(x.auPetWorn(x.auPet()).hat,false);assert.equal(x.data.arcade_pet.name,'یار');assert.equal(x.data.arcade_pet.extra,'keep');
 assert.equal(x.auSetPetAccessory('invalid',true),false);
});

test('unowned items cannot be equipped or rendered, and settings remain within the existing backup key',()=>{
 const x=setup({accessory:'pet-hat',accessories:{hat:'pet-hat',glasses:'pet-glasses'}},['pet-hat']);
 assert.equal(x.auPetWorn(x.auPet()).hat,true);assert.equal(x.auPetWorn(x.auPet()).glasses,false);assert.equal(x.auSetPetAccessory('pet-glasses',true),false);
 const value=JSON.stringify(x.data.arcade_pet),storage={length:1,key:()=> 'arcade_pet',getItem:()=>value};assert.equal(collect(storage).storage.arcade_pet,value);
});

test('rendering uses shared SVG layers, stable DOM and respects reduced motion within the card',()=>{
 const svg=part('function auPetSVG(type','function auRenderPet()');
 assert.ok(svg.indexOf('au-ghost-body')<svg.indexOf('au-ghost-glasses'));assert.ok(svg.indexOf('au-ghost-glasses')<svg.indexOf('au-ghost-hat'));
 assert.match(html,/button\.dataset\.petArt!==signature/);
 assert.match(css,/#homePetSlot \.au-pet \.au-ghost\{[^}]*animation:au-pet-walk/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{#homePetSlot \.au-pet \.au-ghost\{animation:none\}/);
 assert.match(css,/\.au-no-motion \*[^\n]+animation:none!important/);
});

test('roaming is decorative, bounded, disabled for reduced motion and shares the same pet artwork',()=>{
 assert.match(html,/roamer\.firstElementChild\.innerHTML=art/);
 assert.match(html,/roamer\.setAttribute\('aria-hidden','true'\)/);
 assert.match(html,/roamer\.hidden=button\.hidden/);
 assert.match(css,/\.au-roaming-pet\{[^}]*z-index:40;[^}]*pointer-events:none/);
 assert.match(css,/\.overlay-open \.au-roaming-pet\{visibility:hidden\}/);
 assert.match(css,/\.au-no-motion \.au-roaming-pet\{display:none\}/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\.au-roaming-pet\{display:none\}/);
 assert.match(css,/@keyframes au-roam/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\.au-ghost-eye\{animation:none\}/);
});


test('companions have distinct anatomy, animated walking and a collision-safe decorative layer',()=>{
 const code=part('function auPetSVG(type','function auRenderPet()');
 const ctx={};vm.runInNewContext(code+';globalThis.draw=auPetSVG',ctx);
 const art=['cat','dog','dragon','robot'].map(kind=>ctx.draw(kind,{hat:true,glasses:true}));
 assert.equal(new Set(art).size,4);
 for(const [i,kind] of ['cat','dog','dragon','robot'].entries()){
  assert.match(art[i],new RegExp(`data-pet-type="${kind}"`));
  for(const cls of ['au-pet-leg-left','au-pet-leg-right','au-ghost-hat','au-ghost-glasses'])assert.ok(art[i].includes(cls));
 }
 assert.match(css,/@keyframes au-pet-step/);assert.match(css,/@keyframes au-pet-walk/);
 assert.match(css,/\.au-roaming-pet\.au-roam-obscured\{z-index:0\}/);
 assert.match(html,/function auPetAvoidUi\(\)/);assert.match(html,/setInterval\(auPetAvoidUi,250\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\.au-pet-leg,\.au-pet-tail/);
});


test('scroll hides the companion immediately and restores it only after the last scroll settles',()=>{
 const callbacks=new Map(),classes=new Set();let next=0,avoidCalls=0;
 const context={document:{body:{classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}}},setTimeout:(cb,delay)=>{assert.equal(delay,700);const id=++next;callbacks.set(id,cb);return id},clearTimeout:id=>callbacks.delete(id),auPetAvoidUi:()=>avoidCalls++};
 vm.runInNewContext(part('let auPetScrollTimeout=null;','function auFeedPet()')+';globalThis.onScroll=auPetOnScroll',context);
 context.onScroll();assert.ok(classes.has('au-pet-scrolling'));const first=[...callbacks.keys()][0];
 context.onScroll();assert.equal(callbacks.has(first),false);assert.equal(callbacks.size,1);
 [...callbacks.values()][0]();assert.equal(classes.has('au-pet-scrolling'),false);assert.equal(avoidCalls,1);
 assert.match(html,/window\.addEventListener\('scroll',auPetOnScroll,\{passive:true\}\)/);
 assert.match(css,/\.au-pet-scrolling \.au-roaming-pet\{opacity:0/);
 assert.match(css,/\.au-roaming-path\{[^}]*width:44px;height:50px/);
});
