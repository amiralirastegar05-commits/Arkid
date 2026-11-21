import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {collect} from '../cloud/snapshot.js';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const css=await readFile(new URL('../arcade-upgrade.css',import.meta.url),'utf8');
const slice=(from,to)=>html.slice(html.indexOf(from),html.indexOf(to,html.indexOf(from)));

function setup(points=2000){
  const data={arcade_points:points},items=[{id:'home-layout-list',kind:'homeLayout',layout:'list',price:600},{id:'home-layout-gallery',kind:'homeLayout',layout:'gallery',price:1200},{id:'frame-gold',kind:'frame',price:1000}];
  const c={SHOP_ITEMS:items,LS:{get:(k,d)=>data[k]??d,set:(k,v)=>data[k]=v},getPoints:()=>data.arcade_points,setPoints:v=>data.arcade_points=v,logPoints(){},showToast(){},playUI(){},renderShop(){},applyCosmetics(){},auEnhanceShop(){},auSync(){},auPrice:i=>i.price,economyAction:async f=>f()};
  vm.runInNewContext(slice('function getInventory()','function getActiveXPBoost()')+slice('function equipItem(value)','let currentShopCat')+slice('async function auPurchase(id)','function auEnhanceShop()')+'\nglobalThis.api={getInventory,getEquipped,equipItem,unequip,auPurchase}',c);
  return {data,api:c.api};
}

test('layout purchase charges once, requires ownership to equip, and switching or returning to default is free',async()=>{
 const {data,api}=setup();
 assert.equal(api.equipItem('home-layout-list'),false); assert.equal(data.arcade_points,2000);
 await api.auPurchase('home-layout-list'); assert.equal(data.arcade_points,1400); assert.equal(api.getInventory().items.includes('home-layout-list'),true);
 await api.auPurchase('home-layout-list'); assert.equal(data.arcade_points,1400);
 assert.equal(api.equipItem('home-layout-list'),true); assert.equal(api.getEquipped().homeLayout,'home-layout-list');
 await api.auPurchase('home-layout-gallery');assert.equal(data.arcade_points,200);
 assert.equal(api.equipItem('home-layout-gallery'),true);assert.equal(api.getEquipped().homeLayout,'home-layout-gallery');
 api.unequip('homeLayout');assert.equal(api.getEquipped().homeLayout,undefined);assert.equal(data.arcade_points,200);
 assert.equal(api.equipItem('home-layout-list'),true);assert.equal(data.arcade_points,200);
});

test('insufficient balance cannot grant ownership and invalid/unowned equipment is ignored',async()=>{
 const {data,api}=setup(599);await api.auPurchase('home-layout-list');assert.equal(data.arcade_points,599);assert.equal(api.getInventory().items.length,0);
 data.arcade_equipped={homeLayout:'home-layout-list',frame:'frame-gold'};assert.equal(api.getEquipped().homeLayout,undefined);assert.equal(api.getEquipped().frame,undefined);
});

test('settings and layout ownership use existing cloud backup keys, not new untracked keys',()=>{
 const values={arcade_inventory:JSON.stringify({items:['home-layout-list']}),arcade_equipped:JSON.stringify({homeLayout:'home-layout-list'}),arcade_settings:JSON.stringify({scheme:'light',motion:false})};
 const keys=Object.keys(values),storage={length:keys.length,key:i=>keys[i],getItem:k=>values[k]};const snapshot=collect(storage);
 for(const key of keys)assert.equal(snapshot.storage[key],values[key]);
 assert.match(html,/dataset\.scheme=AU\.settings\.scheme/);assert.match(html,/saved\.scheme==='light'\?'light':'dark'/);
 assert.match(html,/data-layout-preview/);assert.match(html,/پیش‌نمایش چیزی را خریداری یا فعال نمی‌کند/);
 assert.match(css,/:root\[data-scheme=light\]/);assert.match(css,/:root\[data-layout=list\]/);assert.match(css,/:root\[data-layout=gallery\]/);
});
