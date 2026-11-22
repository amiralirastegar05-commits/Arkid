import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const css=await readFile(new URL('../arkid-refresh.css',import.meta.url),'utf8');
const code=html.slice(html.indexOf('function cardHTML('),html.indexOf('/* بازی‌های قابل نمایش',html.indexOf('function cardHTML(')));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const faNum=n=>String(n).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);
const game={id:'pacman',title:'پک من',genre:'کلاسیک',genreTag:'classic',sub:'PACMAN',year:1980,available:true,cover:'pacman'};
function card(best,g=game){const context={getTop:()=>best,getPlayCount:()=>0,isNewGame:()=>false,newFoundGames:new Set(),COVERS:{pacman:()=>'<img>'},esc,faNum};vm.createContext(context);vm.runInContext(code,context);return context.cardHTML(g,0,null)}
test('game card shows a labelled real best and genre with an accessible empty state',()=>{
 const scored=card(1250);assert.match(scored,/رکورد: ۱۲۵۰/);assert.match(scored,/card-glance-genre">کلاسیک/);assert.match(scored,/class="share-mini"/);
 const empty=card(0);assert.match(empty,/هنوز رکوردی نیست/);assert.match(empty,/بدون رکورد/);assert.doesNotMatch(empty,/class="share-mini"/);
 const unavailable=card(0,{...game,available:false});assert.match(unavailable,/class="card soon/);assert.doesNotMatch(unavailable,/class="card-glance"/);
 const escaped=card(0,{...game,genre:'<unsafe>'});assert.match(escaped,/&lt;unsafe&gt;/);
});
test('card preview supports hover, touch and keyboard, and respects motion and layouts',()=>{
 for(const piece of [':hover .card-glance',':active .card-glance',':focus-visible .card-glance','@media(prefers-reduced-motion:reduce)','.au-no-motion',':root[data-layout=list]'])assert.ok(css.includes(piece),piece);
 assert.match(html,/e\.target===card&&e\.key==='Enter'/);assert.match(html,/aria-label',game\.title\+'، '\+game\.genre/);
 assert.match(html,/!e\.target\.closest\('\.share-mini'\)&&!e\.target\.closest\('\.au-card-tools'\)/);
 assert.doesNotMatch(css.slice(css.indexOf('/* Game-card preview:' )),/@keyframes|setInterval/);
});
