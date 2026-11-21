import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('service worker caches the helper and serves a clear fallback for uncached games offline',async()=>{
  const code=await readFile(new URL('../sw.js',import.meta.url),'utf8');
  assert.match(code,/hub-enhancements\.js/);
  const handlers={}, stored=new Map();
  const cache={match:async k=>stored.get(typeof k==='string'?k:k.url),put:async(k,v)=>stored.set(k,v)};
  const env={self:{location:{href:'https://example.test/arkid/sw.js'},addEventListener:(type,cb)=>{handlers[type]=cb}},URL,Response,fetch:async()=>{throw Error('offline')},caches:{open:async()=>cache}};
  vm.runInNewContext(code,env);
  async function handle(url){let promise;handlers.fetch({request:{url,method:'GET',mode:'navigate',destination:'document'},respondWith:p=>{promise=p}});return await promise;}
  const saved=new Response('cached game');stored.set('https://example.test/arkid/saved.html',saved);
  assert.equal(await (await handle('https://example.test/arkid/saved.html')).text(),'cached game');
  const result=await handle('https://example.test/arkid/not-saved.html');
  assert.equal(result.status,503);assert.match(await result.text(),/هنوز برای حالت آفلاین ذخیره نشده/);
});
