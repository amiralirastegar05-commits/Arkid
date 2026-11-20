import {test} from 'node:test';
import assert from 'node:assert/strict';
import {monthlyTier} from '../cloud/rank-tiers.js';
test('monthly tiers change at exact thresholds and never depend on coins',()=>{
 assert.deepEqual(monthlyTier(0),{points:0,name:'تازه‌کار',nextName:'برنزی',pointsToNext:500});
 assert.equal(monthlyTier(499).name,'تازه‌کار');assert.equal(monthlyTier(500).name,'برنزی');
 assert.equal(monthlyTier('2000').name,'نقره‌ای');assert.equal(monthlyTier(5000).name,'طلایی');
 assert.equal(monthlyTier(12000).name,'الماسی');assert.deepEqual(monthlyTier(25000),{points:25000,name:'افسانه‌ای',nextName:null,pointsToNext:0});
 for(const value of [-1,1.5,NaN,Number.MAX_SAFE_INTEGER+1,null,'','1e3'])assert.throws(()=>monthlyTier(value),/invalid_points/);
});
