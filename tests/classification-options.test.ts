import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cleanSeries,canonicalSeries,canonicalBrand,normalizeClassification,completeSeasonChoices,compareSeasons} from '../src/utils/classification';
import {classificationChoices,addClassificationOption} from '../src/utils/classificationOptions';
import {emptyWorkspace,loadWorkspace,normalizeWorkspace} from '../src/utils/workspace';

for(const suffix of ['MAN','WOMAN','MEN','WOMEN','BOY','GIRL','BOYS','GIRLS','MAN/WOMEN/GIRL/BOY']){
 assert.equal(canonicalSeries(`admiral beachwear ${suffix} SS27`),'ADMIRAL BEACHWEAR');
}
assert.equal(canonicalSeries('ADMIRAL BEACHWEAR MAN / admiral beachwear woman'),'ADMIRAL BEACHWEAR');
assert.equal(canonicalSeries(' ABC BASKET  / ABC BASKET'),'ABC BASKET');
assert.equal(cleanSeries('WOMEN IN SPORT'),'WOMEN IN SPORT','Only trailing audience labels should be removed');
assert.equal(cleanSeries('ABC RUNNING TECH'),'ABC RUNNING TECH','Keep genuine product ranges distinct');
for(const [value,brand] of [['8848 OUTDOOR SS26','8848'],['ABC BASKET FW26','ABC'],['ABC RUNNING ACCESSORIES FW26','ABC'],['ADMIRAL BEACHWEAR','ADMIRAL'],['ARENA SPORTSWEAR GIRL SS26','ARENA'],['BEST COMPANY SPORTSWEAR SS27','BEST COMPANY']])assert.equal(canonicalBrand(value),brand);
assert.equal(canonicalBrand('NEW BRAND'),'NEW BRAND','Preserve custom multiword brand names');
assert.deepEqual(normalizeClassification({brand:'ARENA SPORTSWEAR GIRL SS26'}),{brand:'ARENA',series:'ARENA SPORTSWEAR',season:'SS26'},'Recover a series and season mistakenly stored in the brand field');
assert.equal(normalizeClassification({brand:'ADMIRAL BEACHWEAR',series:'CONFIRMED RANGE',season:'FW27'}).series,'CONFIRMED RANGE');
assert.deepEqual(['SS27','FW21','SS22','FW22','SS21'].sort(compareSeasons),['SS21','FW21','SS22','FW22','SS27']);
assert.deepEqual(completeSeasonChoices(['SS21','FW24','SS27'],2027),Array.from({length:7},(_,i)=>[`SS${21+i}`,`FW${21+i}`]).flat());
assert.ok(completeSeasonChoices(['常態款','SS29'],2028).indexOf('常態款')<completeSeasonChoices(['常態款','SS29'],2028).indexOf('SS29'));
let w=addClassificationOption(emptyWorkspace(),'series','admiral beachwear woman');
w=addClassificationOption(w,'series','ADMIRAL BEACHWEAR MAN');
w=addClassificationOption(w,'brand','new brand');
w=addClassificationOption(w,'factory','new-factory');
w=addClassificationOption(w,'season','SS29');
assert.equal(Object.keys(w.classificationOptions!).length,4);
const restored=loadWorkspace(JSON.stringify(w),null),choices=classificationChoices(restored,null,null);
assert.deepEqual(choices.series,['ADMIRAL BEACHWEAR']);
assert.ok(choices.brand.includes('NEW BRAND'));assert.ok(choices.factory.includes('NEW-FACTORY'));assert.ok(choices.season.includes('SS29'));
assert.deepEqual(normalizeWorkspace(restored),restored);
for(const bad of [[],null,{'test':{kind:'wrong',value:'test'}},{'test':{kind:'series',value:''}}])assert.throws(()=>loadWorkspace(JSON.stringify({...w,classificationOptions:bad}),null));

const refs=JSON.parse(fs.readFileSync('public/csq-workspace-references.json','utf8'));
const imported=loadWorkspace(JSON.stringify({...emptyWorkspace(),orders:refs.orders||[]}),null);
const commercial=(orders:any[])=>JSON.parse(JSON.stringify(orders.map(o=>[o.poNumber,o.totalPieces,o.totalAmountUSD,o.items.map(({erpItemNo,...item}:any)=>item)])));
assert.deepEqual(commercial(imported.orders),commercial(refs.orders||[]),'Classification migration must preserve quantities, prices, styles and colour details; confirmed ERP size mapping is tested separately');
const all=classificationChoices(restored,refs,null);
assert.ok(all.series.includes('ADMIRAL BEACHWEAR'));
assert.ok(!all.series.some(s=>/\s(?:MAN|MEN|WOMAN|WOMEN|BOY|BOYS|GIRL|GIRLS)$/.test(s)));
assert.equal(all.series.length,new Set(all.series).size);
assert.ok(!all.brand.some(b=>/^(?:ABC|ADMIRAL|ARENA|8848)\s/.test(b)),'Brand dropdowns must exclude their series and seasons');
console.log('PASS: audience series merge, deduplicated common choices, custom option backup persistence, invalid input rejection and unchanged order details.');
