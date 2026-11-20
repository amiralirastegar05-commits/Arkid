// Monthly display tiers are derived from verified points, never from coins.
// Thresholds are provisional competition rules and reset with each UTC month.
const TIERS=[
  {name:'تازه‌کار',minimum:0},
  {name:'برنزی',minimum:500},
  {name:'نقره‌ای',minimum:2000},
  {name:'طلایی',minimum:5000},
  {name:'الماسی',minimum:12000},
  {name:'افسانه‌ای',minimum:25000},
];
export function monthlyTier(value){
  if(typeof value!=='number'&&(typeof value!=='string'||!/^\d+$/.test(value)))throw Error('invalid_points');
  const points=Number(value);
  if(!Number.isSafeInteger(points)||points<0)throw Error('invalid_points');
  let index=0;while(index+1<TIERS.length&&points>=TIERS[index+1].minimum)index++;
  const current=TIERS[index],next=TIERS[index+1];
  return {points,name:current.name,nextName:next?.name||null,pointsToNext:next?next.minimum-points:0};
}
