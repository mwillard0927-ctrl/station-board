// Merge tools/day.json into index.html, pick/, archive.js and data/<date>.json.
// Usage: node tools/update.js   (run from the repo root)
const fs=require('fs');const day=JSON.parse(fs.readFileSync('tools/day.json','utf8'));
let s=fs.readFileSync('index.html','utf8');
function span(name){const i=s.indexOf(name);if(i<0)throw 'missing '+name;let j=s.indexOf('{',i),d=0,k=j,q=null;for(;k<s.length;k++){const c=s[k];if(q){if(c=='\\'){k++;continue}if(c==q)q=null;continue}if(c=='"'||c=='`'||c=="'")q=c;else if(c=='{')d++;else if(c=='}'){d--;if(!d)break}}return [j,k+1]}
const get=n=>{const [a,b]=span(n);return eval('('+s.slice(a,b)+')')};
const put=(n,txt)=>{const [a,b]=span(n);s=s.slice(0,a)+txt+s.slice(b)};
const J=o=>JSON.stringify(o);
const daysTxt=o=>'{'+Object.keys(o).sort().reverse().map(k=>J(k)+': {label:'+J(o[k].label)+', rows:`'+o[k].rows+'`}').join(',\n')+'}';
const sortObj=o=>Object.fromEntries(Object.keys(o).sort().reverse().map(k=>[k,o[k]]));
const date=(day.drivers||day.pick).date;
const DAYS=get('const DAYS ='),LOAD=get('const LOAD ='),TOT=get('const TOT ='),PICK=get('const PICK='),C0=get('const C0=');
if(day.drivers){const r=day.drivers.rows.slice().sort((a,b)=>a[1].toLowerCase().localeCompare(b[1].toLowerCase()));
  // merge with drivers already on the board for this day (e.g. 7:30 + 10:00 waves); newest upload wins per name
  const have={};if(DAYS[date])DAYS[date].rows.trim().split('\n').forEach(l=>{if(l.trim()){const x=l.split('|');have[x[1]+'|'+x[5]]=x}});
  r.forEach(x=>{have[x[1]+'|'+x[5]]=x});const all=Object.values(have).sort((a,b)=>a[1].toLowerCase().localeCompare(b[1].toLowerCase()));
  DAYS[date]={label:day.drivers.label,rows:'\n'+all.map(x=>x.join('|')).join('\n')}}
if(day.pick){const R=day.pick.routes,L={};for(const k in R){const{b,o,k:kk,t,c}=R[k];L[k]={b,o,k:kk,t,c}}LOAD[date]=Object.assign({},LOAD[date]||{},L);const M=LOAD[date];
  const t=Object.fromEntries(Object.entries(M).map(([k,v])=>[k,v.t]));const ks=Object.keys(t);
  const hi=ks.reduce((a,b)=>t[b]>t[a]?b:a),lo=ks.reduce((a,b)=>t[b]<t[a]?b:a);
  TOT[date]={routes:ks.length,pk:ks.reduce((a,k)=>a+t[k],0),bags:Object.values(M).reduce((a,v)=>a+v.b.length,0),of:Object.values(M).reduce((a,v)=>a+v.o.reduce((x,y)=>x+y[1],0),0),comm:Object.values(M).reduce((a,v)=>a+(v.c||0),0),hi:[hi,t[hi]],lo:[lo,t[lo]]};
  fs.mkdirSync('pick/'+date,{recursive:true});PICK[date]=PICK[date]||{};
  for(const r in day.pick.pics){const f='pick/'+date+'/'+r.replace(/\s+/g,'')+'.jpg';fs.writeFileSync(f,Buffer.from(day.pick.pics[r],'base64'));PICK[date][r]=f}}
// pick lists: keep only this day and later
for(const d in PICK)if(d<date)delete PICK[d];for(const d in (C0.PICK||{}))if(d<date)delete C0.PICK[d];
if(fs.existsSync('pick'))for(const d of fs.readdirSync('pick'))if(d<date)fs.rmSync('pick/'+d,{recursive:true,force:true});
// archive days older than 14 days
const cut=new Date(date+'T12:00:00Z');cut.setUTCDate(cut.getUTCDate()-14);const CUT=cut.toISOString().slice(0,10);
let A={DAYS:{},LOAD:{},TOT:{}};if(fs.existsSync('archive.js')){const w={};new Function('window',fs.readFileSync('archive.js','utf8'))(w);A=w.ARCH||A}
for(const [n,o] of [['DAYS',DAYS],['LOAD',LOAD],['TOT',TOT]])for(const d in o)if(d<CUT){A[n][d]=o[d];delete o[d]}
fs.writeFileSync('archive.js','window.ARCH='+J(A)+';');
// Cycle 0 (TX routes) lives on its own board (C0); regular board keeps the rest
const isC0=r=>/^TX\s*\d+$/.test(r);
// rescue (R#) drivers on a driver list that has TX routes belong to cycle 0 too
const c0R=new Set(day.drivers&&day.drivers.rows.some(x=>isC0(x[5]))?day.drivers.rows.filter(x=>/^R\d/.test(x[5])).map(x=>x[1]+'|'+x[5]):[]);
const rowC0=(l,d0)=>{const x=l.split('|');return isC0(x[5])||(day.drivers&&d0===day.drivers.date&&c0R.has(x[1]+'|'+x[5]))};
const totOf=M=>{const t=Object.fromEntries(Object.entries(M).map(([k,v])=>[k,v.t]));const ks=Object.keys(t);if(!ks.length)return null;const hi=ks.reduce((a,b)=>t[b]>t[a]?b:a),lo=ks.reduce((a,b)=>t[b]<t[a]?b:a);
  return {routes:ks.length,pk:ks.reduce((a,k)=>a+t[k],0),bags:Object.values(M).reduce((a,v)=>a+v.b.length,0),of:Object.values(M).reduce((a,v)=>a+v.o.reduce((x,y)=>x+y[1],0),0),comm:Object.values(M).reduce((a,v)=>a+(v.c||0),0),hi:[hi,t[hi]],lo:[lo,t[lo]]}};
for(const k of ['DAYS','LOAD','TOT','PICK'])C0[k]=C0[k]||{};
for(const d of Object.keys(DAYS)){const rows=DAYS[d].rows.trim().split('\n').filter(Boolean);const c=rows.filter(l=>rowC0(l,d));if(!c.length)continue;
  const keep=rows.filter(l=>!rowC0(l,d));const base=DAYS[d].label.split(' · ')[0];
  const have={};if(C0.DAYS[d])C0.DAYS[d].rows.trim().split('\n').filter(Boolean).forEach(l=>{const x=l.split('|');have[x[1]+'|'+x[5]]=l});c.forEach(l=>{const x=l.split('|');have[x[1]+'|'+x[5]]=l});
  C0.DAYS[d]={label:base+' · Cycle 0 · 7:30 AM',rows:'\n'+Object.values(have).sort((a,b)=>a.split('|')[1].toLowerCase().localeCompare(b.split('|')[1].toLowerCase())).join('\n')};
  if(keep.length)DAYS[d].rows='\n'+keep.join('\n');else delete DAYS[d]}
for(const d of Object.keys(LOAD)){for(const r of Object.keys(LOAD[d]))if(isC0(r)){(C0.LOAD[d]=C0.LOAD[d]||{})[r]=LOAD[d][r];delete LOAD[d][r]}
  if(C0.LOAD[d])C0.TOT[d]=totOf(C0.LOAD[d]);if(Object.keys(LOAD[d]).length)TOT[d]=totOf(LOAD[d]);else{delete LOAD[d];delete TOT[d]}}
for(const d of Object.keys(PICK)){for(const r of Object.keys(PICK[d]))if(isC0(r)){(C0.PICK[d]=C0.PICK[d]||{})[r]=PICK[d][r];delete PICK[d][r]}if(!Object.keys(PICK[d]).length)delete PICK[d]}
put('const DAYS =',daysTxt(DAYS));put('const LOAD =',J(sortObj(LOAD)));put('const TOT =',J(sortObj(TOT)));put('const PICK=',J(sortObj(PICK)));put('const C0=',J(C0));
fs.writeFileSync('index.html',s);
// per-day data file for Master and other apps
const rows=(DAYS[date]?DAYS[date].rows.trim().split('\n'):[]).map(l=>{const[g,name,van,bag,stg,route,type]=l.split('|');return{g,name,van,bag,stg,route,type,load:(LOAD[date]||{})[route]||null}});
const data={date,label:DAYS[date]?DAYS[date].label:null,tot:TOT[date]||null,drivers:rows,errors:day.errors||[],updated:new Date().toISOString()};
fs.mkdirSync('data',{recursive:true});fs.writeFileSync('data/'+date+'.json',J(data));let L0=null;try{L0=JSON.parse(fs.readFileSync('data/latest.json','utf8')).date}catch(e){}if(!L0||date>=L0)fs.writeFileSync('data/latest.json',J(data));
for(const f of fs.readdirSync('data'))if(/^\d{4}-\d\d-\d\d\.json$/.test(f)&&f.slice(0,10)<CUT)fs.unlinkSync('data/'+f);
console.log('updated',date,'drivers',rows.length,'routes',Object.keys(LOAD[date]||{}).length,'errors',data.errors.length);
