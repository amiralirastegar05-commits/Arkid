/* ★ دستهٔ مشترک: مستقل از منطق بازی؛ تنها فضای نام ArcadeGamepad */
(function () {
'use strict';
if (window.ArcadeGamepad) return;
const script = document.currentScript, hub = script?.hasAttribute('data-hub');
const css = document.createElement('link'); css.rel='stylesheet'; css.href=new URL('arcade-gamepad.css',script?.src || location.href).href; document.head.append(css);
/* ★ پل ذخیره‌سازی: هاب از LS خودش استفاده می‌کند؛ بازی مستقل fallback امن دارد */
let gpStorageAdapter=null;
const localStorage={
 getItem(key){if(gpStorageAdapter){const value=gpStorageAdapter.get(key,null);return value==null?null:JSON.stringify(value)}try{return window.localStorage.getItem(key)}catch(_){return null}},
 setItem(key,value){if(gpStorageAdapter){let parsed;try{parsed=JSON.parse(value)}catch(_){return}gpStorageAdapter.set(key,parsed);return}try{window.localStorage.setItem(key,value)}catch(_){}},
 removeItem(key){if(gpStorageAdapter)return gpStorageAdapter.remove(key);try{window.localStorage.removeItem(key)}catch(_){}}
};
const KEY='arcade_gamepad_config';
const defaults={enabled:true,layout:'classic',skin:'retro',size:1,opacity:.85,position:{x:null,y:null},mappings:{dpadUp:'ArrowUp',dpadDown:'ArrowDown',dpadLeft:'ArrowLeft',dpadRight:'ArrowRight',buttonA:' ',buttonB:'Shift',buttonX:'z',buttonY:'x',start:'Enter',select:'Escape',buttonL:'q',buttonR:'e'},haptic:true,physicalMappings:{}};
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch(_){return fallback}}
function owns(id){const inv=read('arcade_inventory',{});return Array.isArray(inv?.items)&&inv.items.includes(id)}
function clamp(v,a,b,d){return Number.isFinite(Number(v))?Math.max(a,Math.min(b,Number(v))):d}
function validKey(v){return typeof v==='string'&&v.length>0&&v.length<40}
function sanitize(raw){
 const r=raw&&typeof raw==='object'?raw:{}, c=JSON.parse(JSON.stringify(defaults));
 c.enabled=typeof r.enabled==='boolean'?r.enabled:true;c.haptic=typeof r.haptic==='boolean'?r.haptic:true;
 c.layout=['basic','classic','minimal','extended'].includes(r.layout)?r.layout:'classic';
 if(['minimal','extended'].includes(c.layout)&&!owns('gp-layout-'+c.layout))c.layout='classic';
 c.skin=['retro','minimal','neon','gold','diamond'].includes(r.skin)?r.skin:'retro';
 if(['neon','gold','diamond'].includes(c.skin)&&!owns('gp-skin-'+c.skin))c.skin='retro';
 c.size=clamp(r.size??1,.6,1.4,1);c.opacity=clamp(r.opacity??.85,.3,1,.85);
 for(const k of ['x','y'])c.position[k]=r.position?.[k]!=null?clamp(r.position[k],0,100000,0):null;
 for(const k of Object.keys(c.mappings))if(validKey(r.mappings?.[k]))c.mappings[k]=r.mappings[k];
 if(r.physicalMappings&&typeof r.physicalMappings==='object')for(const [k,v]of Object.entries(r.physicalMappings))if(/^(button\d{1,2}|axis[0-3][+-])$/.test(k)&&validKey(v))c.physicalMappings[k]=v;
 if(owns('gp-color-custom')&&/^#[\da-f]{6}$/i.test(r.color))c.color=r.color;
 c.hapticPro=owns('gp-haptic-pro')&&r.hapticPro===true;
 c.profiles=owns('gp-profile-extra')&&Array.isArray(r.profiles)?r.profiles.slice(0,3).map(p=>({mappings:sanitizeMappings(p.mappings),physicalMappings:p.physicalMappings||{}})):[];
 return c;
}
function sanitizeMappings(m){const out={...defaults.mappings};for(const k of Object.keys(out))if(validKey(m?.[k]))out[k]=m[k];return out}
function get(){return sanitize(read(KEY,{}))}
function set(patch){const old=get();const c=sanitize({...old,...patch,position:{...old.position,...patch.position},mappings:{...old.mappings,...patch.mappings},physicalMappings:patch.physicalMappings??old.physicalMappings});try{localStorage.setItem(KEY,JSON.stringify(c))}catch(_){} window.dispatchEvent(new CustomEvent('arcade-gamepad-change',{detail:c}));return c}
const labels={dpadUp:'↑',dpadDown:'↓',dpadLeft:'←',dpadRight:'→',buttonA:'A',buttonB:'B',buttonX:'X',buttonY:'Y',start:'Start',select:'Select',buttonL:'L',buttonR:'R'};
function markup(c){const ids=['dpadUp','dpadLeft','dpadDown','dpadRight'];if(c.layout!=='minimal')ids.push('buttonA','buttonB');if(['classic','extended'].includes(c.layout))ids.push('buttonX','buttonY','start','select');if(c.layout==='extended')ids.push('buttonL','buttonR');return '<div class="gp-controls gp-skin-'+c.skin+' gp-layout-'+c.layout+'" style="'+(c.color?'--gp-accent:'+c.color:'')+'">'+ids.map(k=>'<button type="button" class="gp-key gp-'+k+'" data-gp-key="'+k+'" aria-label="'+k+'">'+labels[k]+'</button>').join('')+(c.layout==='extended'?'<div class="gp-stick" role="group" aria-label="آنالوگ لمسی"><span></span></div>':'')+'</div>'}
function pads(){try{return Array.from(navigator.getGamepads?.()||[]).filter(Boolean)}catch(_){return []}}
window.ArcadeGamepad={get,set,sanitize,defaults,markup,pads,owns};
/* ★ API افزایشی، توابع موجود حفظ شده‌اند */
window.ArcadeGamepad.useStorage=adapter=>{if(adapter&&typeof adapter.get==='function'&&typeof adapter.set==='function')gpStorageAdapter=adapter};
if(hub)return;
function boot(){
 let audio=null;
 function clickSound(){const eq=read('arcade_equipped',{});if(!['sound-pack-retro','sound-pack-chiptune'].includes(eq?.soundPack)||!owns(eq.soundPack))return;try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime;o.type=eq.soundPack==='sound-pack-retro'?'square':'triangle';o.frequency.value=eq.soundPack==='sound-pack-retro'?440:660;g.gain.setValueAtTime(.02,t);g.gain.exponentialRampToValueAtTime(.001,t+.07);o.connect(g);g.connect(audio.destination);o.start();o.stop(t+.08)}catch(_){}}
 let c=get(), root,controls,settings,badge,toggle, frame=0,visible=matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0,physical=false;
 const held=new Map(),counts=new Map();let suspended=false;
 function keyInfo(key){const table={ArrowUp:[38,'ArrowUp'],ArrowDown:[40,'ArrowDown'],ArrowLeft:[37,'ArrowLeft'],ArrowRight:[39,'ArrowRight'],' ':[32,'Space'],Enter:[13,'Enter'],Escape:[27,'Escape'],Shift:[16,'ShiftLeft'],Control:[17,'ControlLeft'],Alt:[18,'AltLeft'],Tab:[9,'Tab'],Backspace:[8,'Backspace']};return table[key]||[key.length===1?key.toUpperCase().charCodeAt(0):(/^F\d+$/.test(key)?111+Number(key.slice(1)):0),key.length===1?(/[a-z]/i.test(key)?'Key'+key.toUpperCase():/\d/.test(key)?'Digit'+key:key):key]}
 function emit(key,down){const [code,name]=keyInfo(key),event=new KeyboardEvent(down?'keydown':'keyup',{key,code:name,bubbles:true,cancelable:true,keyCode:code,which:code});for(const p of ['keyCode','which'])try{Object.defineProperty(event,p,{get:()=>code})}catch(_){}window.dispatchEvent(event)}
 function hold(source,key,down){if(down){if(held.has(source)||!key||suspended)return;held.set(source,key);const n=counts.get(key)||0;counts.set(key,n+1);if(!n)emit(key,true)}else{key=held.get(source);if(!key)return;held.delete(source);const n=(counts.get(key)||1)-1;if(n)counts.set(key,n);else{counts.delete(key);emit(key,false)}}}
 function release(){for(const source of [...held.keys()])hold(source,null,false)}
 function vibrate(pad){if(!c.haptic)return;try{const promise=pad?.vibrationActuator?.playEffect('dual-rumble',{duration:c.hapticPro?70:25,strongMagnitude:c.hapticPro ? .5 : .15,weakMagnitude:.25});promise?.catch(()=>{});if(!pad)navigator.vibrate?.(c.hapticPro?30:8)}catch(_){}}
 function position(){if(!root)return;const scale=Math.min(c.size,(innerWidth-16)/380);root.style.setProperty('--gp-scale',scale);root.style.opacity=c.opacity;const w=380*scale,h=205*scale;const x=Math.max(0,Math.min(c.position.x??innerWidth-w-12,innerWidth-w));const y=Math.max(0,Math.min(c.position.y??innerHeight-h-12,innerHeight-h));root.style.transform='translate3d('+x+'px,'+y+'px,0) scale('+scale+')';root.dataset.x=x;root.dataset.y=y}
 function build(){release();if(settings)suspended=false;root?.remove();settings?.remove();toggle?.remove();badge?.remove();root=settings=toggle=badge=null;
 if(!c.enabled)return;
 if(physical){badge=document.createElement('div');badge.className='gp-physical-badge';badge.textContent='🎮 دستهٔ فیزیکی متصل';document.body.append(badge);return}
 toggle=document.createElement('button');toggle.className='gp-launch';toggle.textContent='🎮';toggle.setAttribute('aria-label','نمایش یا پنهان کردن دسته');toggle.onclick=()=>{visible=!visible;build()};document.body.append(toggle);
 if(!visible)return;
 root=document.createElement('div');root.className='gp-overlay';root.innerHTML=markup(c)+'<button type="button" class="gp-settings-button" aria-label="تنظیمات دسته">⚙ تنظیمات / جابه‌جایی</button>';document.body.append(root);controls=root.querySelector('.gp-controls');position();
 root.querySelectorAll('[data-gp-key]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);hold('touch'+e.pointerId,c.mappings[b.dataset.gpKey],true);b.classList.add('gp-pressed');vibrate();clickSound()};const up=e=>{hold('touch'+e.pointerId,null,false);b.classList.remove('gp-pressed')};b.onpointerup=up;b.onpointercancel=up;b.onlostpointercapture=up});
 const handle=root.querySelector('.gp-settings-button');let drag;
 handle.onpointerdown=e=>{handle.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,y:e.clientY,ox:Number(root.dataset.x),oy:Number(root.dataset.y),moved:false}};
 handle.onpointermove=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>5)drag.moved=true;if(drag.moved){c.position={x:drag.ox+dx,y:drag.oy+dy};position()}};
 handle.onpointerup=()=>{if(!drag)return;const moved=drag.moved;drag=null;if(moved)set({position:c.position});else panel()};handle.onpointercancel=()=>{drag=null};
 const stick=root.querySelector('.gp-stick');if(stick){const move=e=>{if(!stick.hasPointerCapture(e.pointerId))return;const r=stick.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;[['dpadLeft',x<-.18],['dpadRight',x>.18],['dpadUp',y<-.18],['dpadDown',y>.18]].forEach(([k,on])=>hold('stick'+k,c.mappings[k],on))};stick.onpointerdown=e=>{e.preventDefault();stick.setPointerCapture(e.pointerId);move(e)};stick.onpointermove=move;stick.onlostpointercapture=()=>{for(const k of ['dpadLeft','dpadRight','dpadUp','dpadDown'])hold('stick'+k,null,false)}}
 }
 function panel(){release();suspended=true;settings=document.createElement('section');settings.className='gp-panel';settings.dir='rtl';settings.setAttribute('role','dialog');settings.setAttribute('aria-label','تنظیمات دسته');settings.innerHTML='<strong>تنظیمات دسته</strong><p>برای جابه‌جایی، دستگیرهٔ تنظیمات را بکشید.</p><button data-size="-.1">− اندازه</button><button data-size=".1">+ اندازه</button><label>شفافیت <input aria-label="شفافیت" type="range" min=".3" max="1" step=".05" value="'+c.opacity+'"></label><button data-reset>بازنشانی</button><button data-close>بستن</button>';document.body.append(settings);settings.querySelectorAll('[data-size]').forEach(b=>b.onclick=()=>{c=set({size:c.size+Number(b.dataset.size)});position()});settings.querySelector('input').oninput=e=>{c=set({opacity:Number(e.target.value)});root.style.opacity=c.opacity};settings.querySelector('[data-reset]').onclick=()=>{c=set({...defaults,physicalMappings:{}});settings.remove();settings=null;suspended=false;build()};const close=()=>{settings?.remove();settings=null;suspended=false;root?.querySelector('.gp-settings-button').focus()};settings.querySelector('[data-close]').onclick=close;settings.onkeydown=e=>{e.stopPropagation();if(e.key==='Escape')close();if(e.key==='Tab'){const list=[...settings.querySelectorAll('button,input')],i=list.indexOf(document.activeElement);e.preventDefault();list[(i+(e.shiftKey?-1:1)+list.length)%list.length].focus()}};settings.querySelector('button').focus()}
 const standard={0:'buttonA',1:'buttonB',2:'buttonX',3:'buttonY',4:'buttonL',5:'buttonR',8:'select',9:'start',12:'dpadUp',13:'dpadDown',14:'dpadLeft',15:'dpadRight'};
 function poll(){frame=0;if(document.hidden||!c.enabled)return;const list=pads(),now=!!list.length;if(now!==physical){physical=now;build()}const wanted=new Set();for(const pad of list){pad.buttons.forEach((b,i)=>{const source=pad.index+':button'+i,key=c.physicalMappings['button'+i]??c.mappings[standard[i]];if(b.pressed||b.value>.5){wanted.add(source);const fresh=!held.has(source);hold(source,key,true);if(fresh)vibrate(pad)}});pad.axes.slice(0,4).forEach((a,i)=>{for(const sign of ['-','+']){const source=pad.index+':axis'+i+sign,key=c.physicalMappings['axis'+i+sign]??c.mappings[i%2===0?(sign==='-'?'dpadLeft':'dpadRight'):(sign==='-'?'dpadUp':'dpadDown')];if(sign==='-'?a<-.35:a>.35){wanted.add(source);hold(source,key,true)}}})}for(const source of [...held.keys()])if(source.includes(':')&&!wanted.has(source))hold(source,null,false);if(list.length)frame=requestAnimationFrame(poll)}
 function refresh(){release();c=get();physical=pads().length>0;build();cancelAnimationFrame(frame);poll()}
 window.addEventListener('gamepadconnected',refresh);window.addEventListener('gamepaddisconnected',refresh);window.addEventListener('blur',()=>{suspended=true;release()});window.addEventListener('focus',()=>{suspended=!!settings;cancelAnimationFrame(frame);poll()});document.addEventListener('visibilitychange',()=>{release();cancelAnimationFrame(frame);if(!document.hidden)poll()});window.addEventListener('pagehide',release);window.addEventListener('resize',position);window.addEventListener('storage',e=>{if(e.key===KEY||e.key==='arcade_inventory')refresh()});refresh();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
