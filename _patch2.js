// Patch 2: Budget, Packing, Map, .ics export, nav, normaliseTrip, SW v5.
const fs = require('fs');
const P = '/home/user/workspace/asia-app/';
let html = fs.readFileSync(P + 'index.html', 'utf8');
let js = fs.readFileSync(P + 'app.js', 'utf8');
const must = (s, label) => { if (!s.includes(label)) throw new Error('anchor missing: ' + label); };

/* ============ index.html ============ */

// 1) CSS additions
must(html, '</style>');
const cssAdd = `
/* ---- Scrollable nav ---- */
.bottom{position:fixed}
.bottom::after{content:"";position:absolute;top:7px;bottom:7px;right:0;width:24px;background:linear-gradient(90deg,rgba(255,254,250,0),rgba(255,254,250,.95));pointer-events:none}
/* ---- Budget ---- */
.bstats{margin-top:8px}
.rate-row{display:flex;align-items:center;gap:8px;font-size:14px;margin:8px 0}
.rate-row input{width:110px;height:42px;border:1px solid var(--line);border-radius:9px;padding:0 10px;background:#fff}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
.form-grid .full{grid-column:1/-1}
.form-grid label{font-size:12px;color:var(--muted);display:block;margin-bottom:4px}
.form-grid input,.form-grid select{width:100%;height:44px;border:1px solid var(--line);border-radius:9px;padding:0 10px;background:#fff}
.exp-row{display:flex;align-items:center;gap:10px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px;margin-top:8px}
.exp-main{flex:1;min-width:0}.exp-main b{display:block;font-size:15px}.exp-main span{font-size:12px;color:var(--muted)}
.exp-amt{text-align:right}.exp-amt b{display:block;color:var(--brand2)}.exp-amt span{font-size:12px;color:var(--muted)}
.exp-row [data-del]{background:none;border:0;font-size:20px;color:var(--danger);min-width:36px}
.est-row{display:flex;justify-content:space-between;gap:10px;font-size:13px;padding:7px 0;border-bottom:1px dashed var(--line)}
.est-row.total{border-bottom:0;font-weight:800}
.hint{font-size:12px;color:var(--muted);margin:4px 0 0}
/* ---- Packing ---- */
.pbar{height:8px;background:var(--soft);border-radius:999px;overflow:hidden;margin-top:12px}
.pbar-fill{height:100%;width:0;background:var(--brand);border-radius:999px;transition:width .3s}
.pack-row{display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin-top:8px}
.pack-row input[type=checkbox]{width:22px;height:22px;accent-color:var(--brand);flex:0 0 auto}
.pack-row span{flex:1;font-size:15px}
.pack-row.done span{text-decoration:line-through;color:var(--muted)}
.pack-row [data-delpk]{background:none;border:0;font-size:20px;color:var(--danger);min-width:36px}
.pack-add{display:flex;gap:8px;margin-top:12px}
.pack-add input{flex:1;min-width:0;height:46px;border:1px solid var(--line);border-radius:12px;padding:0 12px;background:var(--card)}
/* ---- Map ---- */
#mapBox{height:440px;border-radius:16px;overflow:hidden;border:1px solid var(--line);background:var(--card)}
#mapBox svg{width:100%;height:100%;display:block}
.leaflet-container{height:100%;background:#dfe9e6}
`;
html = html.replace('</style>', cssAdd + '</style>');

// 2) Nav: scrollable flex
must(html, '.nav{max-width:900px;margin:auto;display:grid;grid-template-columns:repeat(3,1fr);gap:6px}');
html = html.replace('.nav{max-width:900px;margin:auto;display:grid;grid-template-columns:repeat(3,1fr);gap:6px}',
  '.nav{max-width:900px;margin:auto;display:flex;gap:6px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:2px}.nav::-webkit-scrollbar{display:none}.tab{flex:1 0 auto;min-width:86px;white-space:nowrap}');

// 3) New sections between stay and overview
must(html, '<section id="overview"');
const sections = `
<section id="map" class="hidden"><div class="section-head"><h2>Route map</h2></div><div class="notice"><strong>The whole route in order.</strong> Tap a marker for dates. The basemap needs a connection — offline you still get the route schematic.</div><div id="mapBox"></div><div class="panel" id="unmapped"></div></section>
<section id="budget" class="hidden"><div class="section-head"><h2>Budget</h2></div>
<div class="stats bstats"><div class="stat"><b id="bSpent">—</b><span>Logged spending</span></div><div class="stat"><b id="bLeft">—</b><span>Remaining</span></div><div class="stat"><b id="bAccom">—</b><span>Est. accommodation</span></div></div>
<div class="panel"><strong>Trip budget</strong><div class="form-grid"><div class="full"><label for="bTotalIn">Total budget (EUR)</label><input id="bTotalIn" type="number" min="0" step="50" placeholder="e.g. 6000"></div></div></div>
<div class="panel"><strong>Exchange rates</strong><p class="hint">1 EUR equals — edit as rates move. Estimates only.</p><div id="rates"></div></div>
<div class="panel"><strong>Add an expense</strong><div class="form-grid">
<div><label for="expDate">Date</label><input id="expDate" type="date"></div>
<div><label for="expStop">Stop</label><select id="expStop"></select></div>
<div><label for="expDesc">What for</label><input id="expDesc" placeholder="e.g. Island ferry"></div>
<div><label for="expAmt">Amount</label><input id="expAmt" type="number" min="0" step="any"></div>
<div><label for="expCur">Currency</label><select id="expCur"></select></div>
<div><label for="expCat">Category</label><select id="expCat"></select></div>
<div class="full"><button class="btn" id="expAdd" type="button">Add expense</button></div>
</div></div>
<div id="expList"></div>
<div class="panel"><strong>Estimated accommodation</strong><p class="hint">From nightly prices on the Stay tab — kept separate from logged spending. Set the currency on each stay card for accuracy.</p><div id="accomEst"></div></div>
</section>
<section id="packing" class="hidden"><div class="section-head"><h2>Packing</h2></div><div class="pbar"><div class="pbar-fill" id="pFill"></div></div><p class="hint" id="pCount"></p><div class="pack-add"><input id="packNew" placeholder="Add an item…"><button class="btn" id="packAdd" type="button">Add</button></div><div id="packList"></div></section>
`;
html = html.replace('<section id="overview"', sections + '<section id="overview"');

// 4) Nav tabs
must(html, '<button class="tab" data-view="overview">Overview</button>');
html = html.replace('<button class="tab" data-view="overview">Overview</button>',
  '<button class="tab" data-view="map">Map</button><button class="tab" data-view="budget">Budget</button><button class="tab" data-view="packing">Packing</button><button class="tab" data-view="overview">Overview</button>');

// 5) Dialog lat/lng fields
must(html, '<div class="field"><label for="stopNights">Nights</label><input id="stopNights" type="number" min="0" max="60" required></div></div>');
html = html.replace('<div class="field"><label for="stopNights">Nights</label><input id="stopNights" type="number" min="0" max="60" required></div></div>',
  '<div class="field"><label for="stopNights">Nights</label><input id="stopNights" type="number" min="0" max="60" required></div></div><div class="grid"><div class="field"><label for="stopLat">Latitude (optional)</label><input id="stopLat" type="number" step="any"></div><div class="field"><label for="stopLng">Longitude (optional)</label><input id="stopLng" type="number" step="any"></div></div>');

// 6) .ics button in backup tools
must(html, '<button class="btn ghost" id="copy">Copy itinerary</button>');
html = html.replace('<button class="btn ghost" id="copy">Copy itinerary</button>',
  '<button class="btn secondary" id="ics">Calendar (.ics)</button><button class="btn ghost" id="copy">Copy itinerary</button>');

// 7) Leaflet css + js
must(html, '</head>');
html = html.replace('</head>', '<link rel="stylesheet" href="./leaflet.css"></head>');
must(html, '<script src="./app.js"></script>');
html = html.replace('<script src="./app.js"></script>', '<script src="./leaflet.js"></script><script src="./app.js"></script>');

fs.writeFileSync(P + 'index.html', html);

/* ============ app.js ============ */

// A) D header: version 5 + budget + packing defaults
must(js, "const D={version:4,startDate:'2027-01-15',stays:{},stops:[");
js = js.replace("const D={version:4,startDate:'2027-01-15',stays:{},stops:[",
  "const D={version:5,startDate:'2027-01-15',stays:{},budget:{total:0,rates:{EUR:1,THB:36.5,KHR:4150,VND:26300,CNY:7.6},expenses:[]},packing:PACK_DEFAULT.map((t,k)=>({id:'pk'+k,text:t,done:false})),stops:[");

// B) stops get lat/lng from COORDS
must(js, "].map(x=>({id:x[0],location:x[1],country:x[2],nights:x[3],notes:x[4],transport:x[5]}))};");
js = js.replace("].map(x=>({id:x[0],location:x[1],country:x[2],nights:x[3],notes:x[4],transport:x[5]}))};",
  "].map(x=>({id:x[0],location:x[1],country:x[2],nights:x[3],notes:x[4],transport:x[5],lat:COORDS[x[0]]?.[0]??null,lng:COORDS[x[0]]?.[1]??null}))};");

// C) COORDS + PACK_DEFAULT before const $=
must(js, 'const D={version:5,startDate');
const consts = `const COORDS={fly:[53.4264,-6.2499],bkk:[13.7563,100.5018],samui:[9.5372,100.0642],phangan:[9.7358,99.9810],tao:[10.0947,99.8265],railay:[8.0106,98.8374],lanta:[7.6472,99.0281],phiphi:[7.7330,98.7670],siem:[13.3633,103.8564],hcmc:[10.8231,106.6297],hoian:[15.8801,108.3380],hanoi:[21.0278,105.8342],hagiang:[22.8345,104.9835],sapa:[22.3365,103.8429],hanoi2:[21.0278,105.8342],changsha:[28.2282,112.9388],fenghuang:[27.9485,109.6001],furong:[28.7465,109.9959],zjjcity:[29.1170,110.4793],wulingyuan:[29.3480,110.5510],cq:[29.5630,106.5516]};
const PACK_DEFAULT=['Passport (valid 6+ months)','China visa','Vietnam e-visa','Cambodia visa','Travel insurance policy','Flight bookings','Hotel confirmations','eSIM / data plan','Power bank','Universal travel adapter','Hiking boots','Rain jacket','Warm layers (Ha Giang & Sapa nights)','Reef-safe sunscreen','Insect repellent','First-aid kit','Rehydration salts','Dry bag (island trips)','Water shoes','Daypack','Padlocks','Laundry soap sheets','EUR cash + cards','Photocopies of documents','Tissues & hand sanitiser'];
const CURRS=['EUR','THB','KHR','VND','CNY'];
const CATS=['Food & drink','Transport','Accommodation','Activities','Shopping','Other'];
const VIEWS=['itinerary','stay','map','budget','packing','overview','backup'];
const DEF_RATES={EUR:1,THB:36.5,KHR:4150,VND:26300,CNY:7.6};
`;
js = js.replace("const D={version:5,startDate", consts + "const D={version:5,startDate");

// D) save(): normaliseTrip instead of hardcoded version
must(js, "try{status('Saving…','saving');trip.version=4;trip.updatedAt=");
js = js.replace("try{status('Saving…','saving');trip.version=4;trip.updatedAt=",
  "try{normaliseTrip();status('Saving…','saving');trip.updatedAt=");

// E) change(): normalise + render all
must(js, 'async function change(fn,msg=\'Saved\'){fn();render();renderStays();await save(msg)}');
js = js.replace("async function change(fn,msg='Saved'){fn();render();renderStays();await save(msg)}",
  "async function change(fn,msg='Saved'){fn();normaliseTrip();render();renderStays();renderBudget();renderPacking();renderMap();await save(msg)}");

// F) edit(): lat/lng fields
must(js, "$('#transport').value=s?.transport||'';");
js = js.replace("$('#transport').value=s?.transport||'';",
  "$('#transport').value=s?.transport||'';$('#stopLat').value=s?.lat??'';$('#stopLng').value=s?.lng??'';");

// G) form submit: lat/lng
must(js, "transport:$('#transport').value.trim()};");
js = js.replace("transport:$('#transport').value.trim()};",
  "transport:$('#transport').value.trim(),lat:numIn($('#stopLat').value),lng:numIn($('#stopLng').value)};");

// H) Tabs
must(js, "['itinerary','stay','overview','backup'].forEach(x=>$('#'+x).classList.toggle('hidden',x!==b.dataset.view));scrollTo(0,0)});");
js = js.replace("['itinerary','stay','overview','backup'].forEach(x=>$('#'+x).classList.toggle('hidden',x!==b.dataset.view));scrollTo(0,0)});",
  "VIEWS.forEach(x=>$('#'+x).classList.toggle('hidden',x!==b.dataset.view));if(b.dataset.view==='map')renderMap(true);scrollTo(0,0);try{b.scrollIntoView({inline:'nearest',block:'nearest',behavior:'smooth'})}catch{}});");

// I) Import: normalise + render all
must(js, "trip.stops=trip.stops.map(s=>({...s,id:s.id||uid(),nights:Math.max(0,+s.nights||0)}));");
js = js.replace("trip.stops=trip.stops.map(s=>({...s,id:s.id||uid(),nights:Math.max(0,+s.nights||0)}));",
  "trip.stops=trip.stops.map(s=>({...s,id:s.id||uid(),nights:Math.max(0,+s.nights||0),lat:s.lat??null,lng:s.lng??null}));");
const impOld = `   if(!trip.stays||typeof trip.stays!=='object'||Array.isArray(trip.stays))trip.stays={};
   const ids=new Set(trip.stops.map(s=>s.id));
   for(const id of Object.keys(trip.stays))if(!ids.has(id))delete trip.stays[id];
   trip.stops.forEach(st=>{if(!trip.stays[st.id])trip.stays[st.id]={area:'',hotel:'',price:'',ref:'',notes:'',status:'Researching'}});
   render();renderStays();await save('Restored')`;
must(js, impOld);
js = js.replace(impOld, `   normaliseTrip();render();renderStays();renderBudget();renderPacking();renderMap();await save('Restored')`);

// J) init(): replace normalisation block
const initOld = `  /* Normalise accommodation: one entry per stop, keyed by stop id so reordering never loses selections. */
  if(!trip.stays||typeof trip.stays!=='object')trip.stays={};
  const ids=new Set(trip.stops.map(s=>s.id));
  for(const id of Object.keys(trip.stays))if(!ids.has(id))delete trip.stays[id];
  trip.stops.forEach(st=>{if(!trip.stays[st.id])trip.stays[st.id]={area:'',hotel:'',price:'',ref:'',notes:'',status:'Researching'}});}catch(e){status('Storage unavailable','error')}render();renderStays();`;
must(js, initOld);
js = js.replace(initOld, `  normaliseTrip();}catch(e){status('Storage unavailable','error');normaliseTrip()}render();renderStays();renderBudget();renderPacking();`);

// K) Stay card: currency select next to nightly price
must(js, '<div><label for="p-${s.id}">Nightly price</label><input id="p-${s.id}" data-f="price" value="${esc(acc.price)}"></div>');
js = js.replace('<div><label for="p-${s.id}">Nightly price</label><input id="p-${s.id}" data-f="price" value="${esc(acc.price)}"></div>',
  '<div><label for="p-${s.id}">Nightly price</label><input id="p-${s.id}" data-f="price" value="${esc(acc.price)}"></div><div><label for="c-${s.id}">Currency</label><select id="c-${s.id}" data-f="currency">${CURRS.map(c=>`<option ${acc.currency===c?\'selected\':\'\'}>${c}</option>`).join(\'\')}</select></div>');

// L) Append new feature code before init()
must(js, 'async function init(){');
const newCode = `
/* ---------- helpers ---------- */
function numIn(v){v=parseFloat(v);return isFinite(v)?v:null}
function num(v){if(typeof v==='number')return v;v=parseFloat(String(v??'').replace(/,/g,'.'));return isFinite(v)?v:null}
function uid2(){return Date.now().toString(36)+Math.random().toString(36).slice(2)}
function fmtMoney(v){return new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v)}
function normaliseTrip(){
  trip.version=5;
  if(!Array.isArray(trip.stops))trip.stops=[];
  if(!trip.stays||typeof trip.stays!=='object'||Array.isArray(trip.stays))trip.stays={};
  if(!trip.budget||typeof trip.budget!=='object'||Array.isArray(trip.budget))trip.budget={};
  const b=trip.budget;
  if(!b.rates||typeof b.rates!=='object'||Array.isArray(b.rates))b.rates={};
  CURRS.forEach(c=>{if(!(num(b.rates[c])>0))b.rates[c]=DEF_RATES[c]});
  if(!Array.isArray(b.expenses))b.expenses=[];
  b.expenses=b.expenses.filter(e=>e&&e.id).map(e=>({id:String(e.id),date:e.date||'',stopId:e.stopId||'',desc:String(e.desc||''),amount:Math.max(0,num(e.amount)||0),currency:CURRS.includes(e.currency)?e.currency:'EUR',category:e.category||'Other'}));
  if(!(num(b.total)>=0))b.total=0;
  if(!Array.isArray(trip.packing))trip.packing=PACK_DEFAULT.map((t,k)=>({id:'pk'+k,text:t,done:false}));
  trip.packing=trip.packing.filter(p=>p&&p.text).map(p=>({id:p.id||uid2(),text:String(p.text),done:!!p.done}));
  const ids=new Set(trip.stops.map(s=>s.id));
  for(const id of Object.keys(trip.stays))if(!ids.has(id))delete trip.stays[id];
  trip.stops.forEach(st=>{ if(!st.id)st.id=uid2(); st.nights=Math.max(0,+st.nights||0); if(st.lat!=null&&num(st.lat)==null)st.lat=null; if(st.lng!=null&&num(st.lng)==null)st.lng=null;
    if(!trip.stays[st.id])trip.stays[st.id]={area:'',hotel:'',price:'',currency:'EUR',ref:'',notes:'',status:'Researching'};
    const a=trip.stays[st.id]; ['area','hotel','price','ref','notes'].forEach(f=>{if(a[f]==null)a[f]=''}); if(!a.status)a.status='Researching'; if(!CURRS.includes(a.currency))a.currency='EUR'; });
  return trip;
}
/* ---------- Budget ---------- */
function rateOf(c){return num(trip.budget.rates[c])||1}
function toHome(amt,cur){const r=rateOf(cur);return r>0?amt/r:amt}
function renderBudget(){
  if(!$('#expList'))return;
  const b=trip.budget;
  $('#rates').innerHTML=CURRS.filter(c=>c!=='EUR').map(c=>'<label class="rate-row">1 EUR = <input type="number" step="any" min="0" data-rate="'+c+'" value="'+b.rates[c]+'"> <span>'+c+'</span></label>').join('');
  $('#bTotalIn').value=b.total>0?b.total:'';
  const opts=(arr,sel)=>arr.map(v=>'<option value="'+v+'"'+(sel===v?' selected':'')+'>'+v+'</option>').join('');
  $('#expStop').innerHTML='<option value="">General / no stop</option>'+trip.stops.map(s=>'<option value="'+s.id+'">'+esc(s.location)+'</option>').join('');
  $('#expCur').innerHTML=opts(CURRS,'THB');
  $('#expCat').innerHTML=opts(CATS,'Food & drink');
  if(!$('#expDate').value)$('#expDate').value=new Date().toISOString().slice(0,10);
  const spent=b.expenses.reduce((a,e)=>a+toHome(+e.amount||0,e.currency),0);
  $('#bSpent').textContent=fmtMoney(spent);
  const total=num(b.total)||0;
  $('#bLeft').textContent=total?fmtMoney(total-spent):'—';
  const list=$('#expList');
  list.innerHTML=b.expenses.length?'':'<div class="empty">No expenses yet — add your first above.</div>';
  [...b.expenses].reverse().forEach(e=>{const stop=trip.stops.find(s=>s.id===e.stopId);const row=document.createElement('div');row.className='exp-row';row.innerHTML='<div class="exp-main"><b>'+esc(e.desc||'Expense')+'</b><span>'+esc(e.date||'')+' · '+esc(stop?stop.location:'General')+' · '+esc(e.category)+'</span></div><div class="exp-amt"><b>'+fmtMoney(toHome(+e.amount||0,e.currency))+'</b><span>'+(+e.amount||0).toLocaleString('en-IE')+' '+esc(e.currency)+'</span></div><button data-del="'+e.id+'" aria-label="Delete expense">×</button>';list.append(row)});
  let rows=[],sum=0,assumed=false;
  trip.stops.forEach(s=>{const a=trip.stays[s.id]||{};const txt=String(a.price||'');const amt=num(txt.replace(/[^0-9.,]/g,''));if(amt!=null&&txt.match(/[0-9]/)){
    const sym=String(txt.match(/€|฿|₫|¥|៛|EUR|THB|KHR|VND|CNY/i)||[]).slice(-1)[0];
    let c=a.currency||'EUR';
    if(sym)c=({'€':'EUR','฿':'THB','₫':'VND','¥':'CNY','៛':'KHR'})[sym]||(CURRS.includes(String(sym).toUpperCase())?String(sym).toUpperCase():c);
    else assumed=true;
    const h=toHome(amt*(s.nights||0),c);sum+=h;
    rows.push('<div class="est-row"><span>'+esc(s.location)+'</span><span>'+amt.toLocaleString('en-IE')+' '+c+' × '+(s.nights||0)+'n ≈ '+fmtMoney(h)+'</span></div>');
  }});
  $('#bAccom').textContent=rows.length?fmtMoney(sum):'—';
  $('#accomEst').innerHTML=rows.length?rows.join('')+'<div class="est-row total"><span>Estimated total</span><b>'+fmtMoney(sum)+'</b></div>'+(assumed?'<p class="hint">Some prices had no currency symbol — the stay card currency was assumed.</p>':''):'<p class="hint">Add nightly prices on the Stay tab to see an estimate.</p>';
}
$('#rates').oninput=e=>{const c=e.target.dataset.rate;if(!c)return;const v=num(e.target.value);if(v>0){trip.budget.rates[c]=v;clearTimeout(e.target._t);e.target._t=setTimeout(()=>{renderBudget();save()},600)}};
$('#bTotalIn').oninput=e=>{const v=num(e.target.value);trip.budget.total=v!=null?v:0;clearTimeout(e.target._t);e.target._t=setTimeout(()=>save(),600)};
$('#expAdd').onclick=()=>{const amt=num($('#expAmt').value);if(!(amt>0)){toast('Enter an amount first');return}change(()=>{trip.budget.expenses.push({id:uid2(),date:$('#expDate').value,stopId:$('#expStop').value,desc:$('#expDesc').value.trim(),amount:amt,currency:$('#expCur').value,category:$('#expCat').value})},'Saved');$('#expDesc').value='';$('#expAmt').value=''};
$('#expList').onclick=e=>{const b=e.target.closest('[data-del]');if(!b)return;change(()=>{trip.budget.expenses=trip.budget.expenses.filter(x=>String(x.id)!==b.dataset.del)},'Deleted')};
/* ---------- Packing ---------- */
function renderPacking(){const l=$('#packList');if(!l)return;const items=trip.packing;const done=items.filter(p=>p.done).length;$('#pCount').textContent=items.length?done+' of '+items.length+' packed':'Nothing on the list yet';$('#pFill').style.width=(items.length?100*done/items.length:0)+'%';l.innerHTML=items.length?'':'<div class="empty">No items yet — add what you need.</div>';items.forEach(p=>{const r=document.createElement('div');r.className='pack-row'+(p.done?' done':'');r.innerHTML='<input type="checkbox" data-pk="'+p.id+'"'+(p.done?' checked':'')+' aria-label="'+esc(p.text)+'"><span>'+esc(p.text)+'</span><button data-delpk="'+p.id+'" aria-label="Delete item">×</button>';l.append(r)})}
$('#packAdd').onclick=()=>{const v=$('#packNew').value.trim();if(!v){toast('Type an item first');return}change(()=>trip.packing.push({id:uid2(),text:v,done:false}),'Added');$('#packNew').value='';$('#packNew').focus()};
$('#packNew').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('#packAdd').click()}};
$('#packList').onchange=e=>{const i=e.target.dataset.pk;if(!i)return;const it=trip.packing.find(p=>p.id===i);if(it){it.done=e.target.checked;save();renderPacking()}};
$('#packList').onclick=e=>{const b=e.target.closest('[data-delpk]');if(!b)return;change(()=>{trip.packing=trip.packing.filter(p=>p.id!==b.dataset.delpk)},'Deleted')};
/* ---------- Map ---------- */
let mapObj=null,mapInit=false;
function renderMap(force){const box=$('#mapBox');if(!box)return;if($('#map').classList.contains('hidden')&&!force)return;
  const pts=trip.stops.map(s=>({s,lat:num(s.lat),lng:num(s.lng)})).filter(p=>p.lat!=null&&p.lng!=null);
  const unmapped=trip.stops.filter(s=>num(s.lat)==null||num(s.lng)==null);
  $('#unmapped').innerHTML=unmapped.length?'<strong>Not on the map</strong><p>'+unmapped.map(s=>esc(s.location)).join(' · ')+' — add latitude and longitude via Edit details to place them.</p>':'';
  if(!pts.length){box.innerHTML='<div class="empty">No mapped stops yet.</div>';return}
  if(window.L&&navigator.onLine){
    if(!mapInit){mapObj=L.map(box,{scrollWheelZoom:false,attributionControl:true});L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:12,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(mapObj);mapInit=true}
    if(mapObj._asiaLayer)mapObj.removeLayer(mapObj._asiaLayer);
    const layer=L.layerGroup().addTo(mapObj);mapObj._asiaLayer=layer;
    L.polyline(pts.map(p=>[p.lat,p.lng]),{color:'#0b696b',weight:2.5,opacity:.85}).addTo(layer);
    let cur=date(trip.startDate);
    trip.stops.forEach((s,k)=>{const start=new Date(cur);cur=add(cur,+s.nights||0);const la=num(s.lat),ln=num(s.lng);if(la==null||ln==null)return;L.circleMarker([la,ln],{radius:13,color:'#084d4f',weight:2,fillColor:'#0b696b',fillOpacity:1}).bindPopup('<b>'+(k+1)+'. '+esc(s.location)+'</b><br>'+range(start,+s.nights||0)).addTo(layer)});
    mapObj.fitBounds(pts.map(p=>[p.lat,p.lng]),{padding:[28,28]});
    setTimeout(()=>mapObj.invalidateSize(),60);
  } else {
    const lats=pts.map(p=>p.lat),lngs=pts.map(p=>p.lng);
    const minLat=Math.min(...lats),maxLat=Math.max(...lats),minLng=Math.min(...lngs),maxLng=Math.max(...lngs);
    const W=640,H=440,pad=46;
    const X=lng=>pad+(lng-minLng)/((maxLng-minLng)||1)*(W-2*pad);
    const Y=lat=>H-pad-(lat-minLat)/((maxLat-minLat)||1)*(H-2*pad);
    let svg='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Route schematic">';
    svg+='<polyline points="'+pts.map(p=>X(p.lng).toFixed(1)+','+Y(p.lat).toFixed(1)).join(' ')+'" fill="none" stroke="#0b696b" stroke-width="2.5" opacity=".8"/>';
    let cur=date(trip.startDate);
    trip.stops.forEach((s,k)=>{const start=new Date(cur);cur=add(cur,+s.nights||0);const la=num(s.lat),ln=num(s.lng);if(la==null||ln==null)return;const x=X(ln),y=Y(la);const nm=s.location.length>20?s.location.slice(0,19)+'…':s.location;svg+='<g><circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="14" fill="#0b696b" stroke="#084d4f" stroke-width="2"/><text x="'+x.toFixed(1)+'" y="'+(y+4).toFixed(1)+'" text-anchor="middle" fill="#fff" font-size="11" font-weight="700">'+(k+1)+'</text><text x="'+x.toFixed(1)+'" y="'+(y-22).toFixed(1)+'" text-anchor="middle" font-size="10" fill="#1f2927">'+esc(nm)+'</text></g>'});
    svg+='</svg>';
    box.innerHTML=svg+'<p class="hint" style="padding:8px 4px 0">Offline route schematic — connect once for the full basemap.</p>';
  }
}
/* ---------- Calendar export ---------- */
function icsDate(d){return d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')}
function icsEsc(t){return String(t||'').replace(/\\\\/g,'\\\\\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\\r?\\n/g,'\\n')}
function icsFold(l){const out=[];let b=new TextEncoder().encode(l),s=0;while(b.length-s>73){let e=73;while(e>0&&(b[s+e]&0xC0)===0x80)e--;out.push(new TextDecoder().decode(b.slice(s,s+e)));s+=e}out.push(new TextDecoder().decode(b.slice(s)));return out.join('\\r\\n ')}
$('#ics').onclick=()=>{const CRLF='\\r\\n';let out='BEGIN:VCALENDAR'+CRLF+'VERSION:2.0'+CRLF+'PRODID:-//Asia 2027 Planner//EN'+CRLF+'CALSCALE:GREGORIAN'+CRLF;const stamp=new Date().toISOString().replace(/[-:]/g,'').slice(0,15)+'Z';let cur=date(trip.startDate);let ev=0;trip.stops.forEach((s,i)=>{const start=new Date(cur);cur=add(cur,+s.nights||0);const n=+s.nights||0;if(n<=0)return;ev++;const desc=[s.notes&&('Plans: '+s.notes),s.transport&&('Getting there: '+s.transport)].filter(Boolean).join('\\n');out+='BEGIN:VEVENT'+CRLF;out+='UID:'+s.id+'-asia2027@planner'+CRLF;out+='DTSTAMP:'+stamp+CRLF;out+=icsFold('DTSTART;VALUE=DATE:'+icsDate(start))+CRLF;out+=icsFold('DTEND;VALUE=DATE:'+icsDate(add(start,n)))+CRLF;out+=icsFold('SUMMARY:'+icsEsc((i+1)+'. '+s.location))+CRLF;if(desc)out+=icsFold('DESCRIPTION:'+icsEsc(desc))+CRLF;out+='END:VEVENT'+CRLF});out+='END:VCALENDAR';const a=document.createElement('a'),u=URL.createObjectURL(new Blob([out],{type:'text/calendar;charset=utf-8'}));a.href=u;a.download='asia-2027.ics';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);toast(ev?'Calendar file downloaded — import it into Google Calendar':'Nothing to export yet')};
`;
js = js.replace('async function init(){', newCode + 'async function init(){');

fs.writeFileSync(P + 'app.js', js);

/* ============ sw.js rewrite ============ */
const sw = `'use strict';
/* Asia 2027 — offline app shell. Network-first with cache fallback so code stays fresh. */
const CACHE = 'asia-2027-v5';
const ASSETS = ['./', './index.html', './app.js', './leaflet.js', './leaflet.css', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.all(ASSETS.map(a => c.add(new Request(a, { cache: 'reload' })).catch(() => null))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('asia-2027') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // map tiles go straight to network
  const fresh = fetch(e.request).then(res => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => null);
  e.respondWith(
    fresh.then(res => res || caches.match(e.request).then(h => h || caches.match('./index.html')))
  );
});
`;
fs.writeFileSync(P + 'sw.js', sw);
console.log('patch2 applied');
