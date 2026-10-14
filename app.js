"use strict";
const KEY="gain.state";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const pad=n=>String(n).padStart(2,"0");
const dkey=(d=new Date())=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const addDays=(k,n)=>{const d=new Date(k+"T12:00:00");d.setDate(d.getDate()+n);return dkey(d)};
const daysBetween=(a,b)=>Math.round((new Date(b+"T12:00:00")-new Date(a+"T12:00:00"))/864e5);
const r5=n=>Math.round(n/5)*5, r50=n=>Math.round(n/50)*50;
const fmtT=t=>{const[h,m]=t.split(":").map(Number);return (h%12||12)+":"+pad(m)+(h<12?" AM":" PM")};
const COLS=["profiles","logs","weights","workouts","photos","inv","prep","pack","sleep","checkins","foods","ach","grocery"];
let S=JSON.parse(localStorage.getItem(KEY)||"null")||{col:{},deleted:{},active:null};
for(const c of COLS)S.col[c]=S.col[c]||{};S.deleted=S.deleted||{};
let tab=(location.hash||"#today").slice(1), ui={};
function save(){localStorage.setItem(KEY,JSON.stringify(S));window.onLocalSave&&window.onLocalSave()}
function put(col,rec){rec.updated=Date.now();S.col[col][rec.id]=rec;save();return rec}
function del(col,id){delete S.col[col][id];S.deleted[col+":"+id]=Date.now();save()}
const P=()=>S.col.profiles[S.active]||null;
const mine=col=>Object.values(S.col[col]).filter(r=>r.pid===S.active);
function toast(m){const t=$("#toast");t.textContent=m;t.classList.remove("hidden");clearTimeout(t._t);t._t=setTimeout(()=>t.classList.add("hidden"),2600)}
function sheet(html){$("#sheetCard").innerHTML=html;$("#sheet").classList.remove("hidden")}
function closeSheet(){$("#sheet").classList.add("hidden");$("#sheetCard").innerHTML=""}
// ---------- photos (IndexedDB) ----------
let idb;function db(){return idb||(idb=new Promise((ok,no)=>{const r=indexedDB.open("gain",1);r.onupgradeneeded=()=>r.result.createObjectStore("p");r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)}))}
async function pPut(k,v){const d=await db();return new Promise(ok=>{const t=d.transaction("p","readwrite");t.objectStore("p").put(v,k);t.oncomplete=ok})}
async function pGet(k){const d=await db();return new Promise(ok=>{const q=d.transaction("p").objectStore("p").get(k);q.onsuccess=()=>ok(q.result);q.onerror=()=>ok(null)})}
function resize(file,max=1080){return new Promise(ok=>{const img=new Image();img.onload=()=>{const s=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement("canvas");c.width=img.width*s;c.height=img.height*s;c.getContext("2d").drawImage(img,0,0,c.width,c.height);ok(c.toDataURL("image/jpeg",.82))};img.src=URL.createObjectURL(file)})}
// ---------- targets ----------
function calcTargets(p){const kg=p.weight/2.2046,cm=p.heightIn*2.54;
 const bmr=10*kg+6.25*cm-5*p.age+(p.sex==="f"?-161:5),tdee=bmr*p.activity;
 const rate=p.goal==="maintain"?0:(p.goal==="lose"?-Math.abs(p.rate):Math.abs(p.rate));
 let kcal=r50(tdee+rate*500+(p.goal==="gain"&&p.hardGainer?100:0));kcal=Math.max(kcal,p.sex==="f"?1200:1500);
 const perLb=p.goal==="gain"?0.9:p.goal==="lose"?1.0:0.8,base=p.goal==="lose"?Math.min(p.weight,p.goalWeight||p.weight):p.weight;
 const protein=r5(base*perLb),fat=r5(kcal*.27/9),carbs=r5((kcal-protein*4-fat*9)/4);
 return{bmr:Math.round(bmr),tdee:Math.round(tdee),kcal,protein,fat,carbs,rate}}
const kcalT=p=>p.kcal+(p.kcalAdj||0);
// ---------- day totals ----------
const dayLogs=(d=dkey())=>mine("logs").filter(l=>l.date===d);
function totals(d){return dayLogs(d).reduce((a,l)=>(a.k+=l.k,a.p+=l.p,a),{k:0,p:0})}
function slotTarget(p,s){const sum=p.slots.reduce((a,x)=>a+(+x.share||0),0)||1;return{k:r5(kcalT(p)*s.share/sum),p:r5(p.protein*s.share/sum)}}
// ---------- weight trend & auto-adjust ----------
function wSeries(){return mine("weights").sort((a,b)=>a.date<b.date?-1:1)}
function avg7(ws,d){const v=ws.filter(w=>w.date<=d&&daysBetween(w.date,d)<7).map(w=>w.lb);return v.length?v.reduce((a,b)=>a+b)/v.length:null}
function trendRate(){const ws=wSeries();if(ws.length<6)return null;const last=ws.at(-1).date,pts=ws.filter(w=>daysBetween(w.date,last)<=21);
 if(pts.length<6||daysBetween(pts[0].date,last)<10)return null;
 const xs=pts.map(w=>daysBetween(pts[0].date,w.date)),ys=pts.map(w=>w.lb),mx=xs.reduce((a,b)=>a+b)/xs.length,my=ys.reduce((a,b)=>a+b)/ys.length;
 let n=0,dd=0;xs.forEach((x,i)=>{n+=(x-mx)*(ys[i]-my);dd+=(x-mx)**2});return dd?n/dd*7:null}
function adjustSuggestion(p){const r=trendRate();if(r==null)return null;if(p.lastAdj&&daysBetween(p.lastAdj,dkey())<7)return null;
 const t=p.goal==="maintain"?0:(p.goal==="lose"?-p.rate:p.rate);let d=0,why="";
 if(p.goal==="gain"){if(r<t*.5){d=r<0?200:150;why=`gaining ${r.toFixed(2)} lb/wk, target ${t}`}else if(r>t*1.6&&daysBetween(p.startDate,dkey())>28){d=-100;why=`gaining fast (${r.toFixed(2)} lb/wk) — extra may be fat`}}
 else if(p.goal==="lose"){if(r>t*.5){d=-150;why=`losing ${(-r).toFixed(2)} lb/wk, target ${p.rate}`}else if(r<t*1.6){d=100;why=`losing fast (${(-r).toFixed(2)} lb/wk)`}}
 else if(Math.abs(r)>.3){d=r>0?-100:100;why=`drifting ${r.toFixed(2)} lb/wk`}
 return d?{d,why,r}:null}
function applyAdjust(p,s){p.kcalAdj=(p.kcalAdj||0)+s.d;p.lastAdj=dkey();(p.adjLog=p.adjLog||[]).push({date:dkey(),d:s.d,why:s.why});put("profiles",p)}
function autoAdjust(){const p=P();if(!p||!p.autoAdjust)return;const s=adjustSuggestion(p);if(s){applyAdjust(p,s);toast(`Auto-adjusted calories ${s.d>0?"+":""}${s.d} (${s.why})`)}}
// ---------- workouts ----------
const exFor=(p,id,home)=>{const e=EX[id];if((home||p.equipment==="home")&&!e.home&&e.alt?.db)return e.alt.db;return id};
function plan(p){return PLANS[p.days]||PLANS[4]}
function nextDay(p){const ws=mine("workouts").filter(w=>w.done).sort((a,b)=>a.date<b.date?-1:1),pl=plan(p);if(!ws.length)return pl[0];const i=pl.indexOf(ws.at(-1).day);return pl[(i+1)%pl.length]}
function lastSets(ex){const ws=mine("workouts").filter(w=>w.done).sort((a,b)=>a.date<b.date?1:-1);for(const w of ws){const s=w.sets.filter(x=>x.ex===ex&&x.done);if(s.length)return{date:w.date,sets:s}}return null}
const e1rm=(w,r)=>w*(1+r/30);
function suggest(p,ex,lo,hi){const l=lastSets(ex),e=EX[ex];if(!l)return{w:"",r:lo,msg:"First time: pick a weight you could do ~3 more reps with"};
 const top=Math.max(...l.sets.map(s=>s.w||0)),allHit=l.sets.every(s=>s.r>=hi);let w=top;
 if(allHit&&e.inc){w=top+e.inc;if(EX[ex].home&&(p.equipment!=="gym")&&w>(p.dbMax||25)){w=top;return{w,r:hi,msg:`At max DB (${p.dbMax} lb): slow the tempo or add a set`}}return{w,r:lo,msg:`Hit ${hi} reps last time → +${e.inc} lb`}}
 return{w,r:Math.min(hi,Math.max(...l.sets.map(s=>s.r))+1),msg:"Same weight, aim for +1 rep"}}
function deloadDue(p){const ws=mine("workouts").filter(w=>w.done).sort((a,b)=>a.date<b.date?-1:1);if(!ws.length)return null;
 const lastD=[...ws].reverse().find(w=>w.deload),since=lastD?lastD.date:ws[0].date,wk=daysBetween(since,dkey())/7;
 if(wk>=(p.deloadEvery||6))return`${Math.floor(wk)} weeks since ${lastD?"last deload":"you started"}`;
 for(const ex of ["bench","squat","dead","row","ohp"]){const hist=ws.filter(w=>w.sets.some(s=>s.ex===ex&&s.done)).slice(-3).map(w=>Math.max(...w.sets.filter(s=>s.ex===ex&&s.done).map(s=>e1rm(s.w||0,s.r))));
  if(hist.length===3&&hist[2]<=hist[0]&&hist[1]<=hist[0])return`${EX[ex].n} stalled 2 sessions in a row`}
 return null}
// ---------- achievements ----------
function streak(test){let n=0,d=dkey();if(!test(d))d=addDays(d,-1);while(test(d)){n++;d=addDays(d,-1)}return n}
function achievements(){const p=P();if(!p)return[];const a=[],ws=wSeries(),cur=ws.length?ws.at(-1).lb:p.weight,start=p.startWeight||p.weight,dir=p.goal==="lose"?-1:1;
 const moved=(cur-start)*dir;for(let x=2;x<=40;x+=2)if(moved>=x)a.push(["w"+x,`${dir>0?"+":"−"}${x} lb`,"🏋️"]);
 if(p.goal!=="maintain"&&p.goalWeight&&(cur-p.goalWeight)*dir>=0&&ws.length)a.push(["goal","Goal weight reached!","🏆"]);
 const wo=mine("workouts").filter(w=>w.done).length;[[1,"First workout"],[10,"10 workouts"],[25,"25 workouts"],[50,"50 workouts"],[100,"100 workouts"]].forEach(([n,t])=>wo>=n&&a.push(["wo"+n,t,"💪"]));
 const ps=streak(d=>{const t=totals(d);return t.p>=p.protein*.95});[[3,"3-day protein streak"],[7,"7-day protein streak"],[14,"14-day protein streak"],[30,"30-day protein streak"]].forEach(([n,t])=>ps>=n&&a.push(["ps"+n,t,"🥩"]));
 const ks=streak(d=>totals(d).k>=kcalT(p)*.9);[[3,"3 days hitting calories"],[7,"7 days hitting calories"],[21,"21 days hitting calories"]].forEach(([n,t])=>ks>=n&&a.push(["ks"+n,t,"🍽️"]));
 if(mine("inv").length||mine("prep").some(x=>x.cooked))a.push(["prep1","First meal prep","🥡"]);
 if(mine("photos").length)a.push(["ph1","First progress photo","📸"]);
 const prs=prCount();if(prs>=1)a.push(["pr1","First PR","⭐"]);if(prs>=10)a.push(["pr10","10 PRs","🌟"]);
 return a}
function prCount(){const best={};let n=0;mine("workouts").filter(w=>w.done).sort((a,b)=>a.date<b.date?-1:1).forEach(w=>w.sets.filter(s=>s.done&&s.w).forEach(s=>{const v=e1rm(s.w,s.r);if(best[s.ex]&&v>best[s.ex]+.1)n++;if(!best[s.ex]||v>best[s.ex])best[s.ex]=v}));return n}
function checkAch(){const p=P();if(!p)return;for(const[id,t,ic]of achievements()){const k=S.active+":"+id;if(!S.col.ach[k]){put("ach",{id:k,pid:S.active,date:dkey(),t,ic});toast(`${ic} Unlocked: ${t}`)}}}
// ---------- charts ----------
function lineChart(series,{h=160,goal=null,fmt=v=>v.toFixed(1)}={}){const all=series.flatMap(s=>s.pts.map(p=>p[1]));if(goal!=null&&all.length&&Math.min(...all.map(v=>Math.abs(v-goal)))<=8)all.push(goal);else goal=null;if(!series[0]?.pts.length)return`<p class="mute">No data yet.</p>`;
 const xs=series.flatMap(s=>s.pts.map(p=>p[0])),x0=Math.min(...xs),x1=Math.max(...xs)||1,lo=Math.min(...all),hi=Math.max(...all),W=340,pd=4,rng=(hi-lo)||1;
 const X=x=>pd+(x-x0)/((x1-x0)||1)*(W-2*pd),Y=v=>h-pd-(v-lo)/rng*(h-2*pd-14);
 let g=`<svg viewBox="0 0 ${W} ${h}" class="chart" role="img">`;if(goal!=null)g+=`<line x1="0" x2="${W}" y1="${Y(goal)}" y2="${Y(goal)}" class="goal"/><text x="${W-4}" y="${Y(goal)-4}" text-anchor="end" class="lbl">goal ${fmt(goal)}</text>`;
 for(const s of series){const d=s.pts.map((p,i)=>(i?"L":"M")+X(p[0]).toFixed(1)+" "+Y(p[1]).toFixed(1)).join(" ");g+=`<path d="${d}" class="${s.cls}"/>`;if(s.dots)s.pts.forEach(p=>g+=`<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="2.5" class="${s.cls}d"/>`)}
 g+=`<text x="4" y="12" class="lbl">${fmt(hi)}</text><text x="4" y="${h-6}" class="lbl">${fmt(lo)}</text></svg>`;return g}
// ---------- inventory ----------
const invDaysLeft=i=>i.days-daysBetween(i.made,dkey());
function useInv(id,n=1){const i=S.col.inv[id];if(!i)return;i.left=Math.max(0,i.left-n);if(i.left<=0)del("inv",id);else put("inv",i)}
// ---------- render ----------
const TABS=[["today","🍽️","Today"],["prep","🥡","Prep"],["train","🏋️","Train"],["progress","📈","Progress"],["me","👤","Me"]];
function render(){const p=P();$("#tabs").innerHTML=p?TABS.map(([id,ic,t])=>`<button data-tab="${id}" class="${tab===id?"on":""}"><span>${ic}</span>${t}</button>`).join(""):"";
 $("#who").textContent=p?p.name:"";$("#who").classList.toggle("hidden",!p);
 const v=$("#view");if(!p){v.innerHTML=welcome();return}
 v.innerHTML=({today:vToday,prep:vPrep,train:vTrain,progress:vProgress,me:vMe}[tab]||vToday)();
 if(tab==="progress")loadPhotos();if(tab==="me"&&typeof syncCardInner==="function"){const c=$("#syncCard");if(c)c.innerHTML=syncCardInner()}}
function welcome(){const ps=Object.values(S.col.profiles);return`<section class="card hero"><h2>💪 Gain</h2><p>Your eating + training plan that fits a day on the road.</p>
 ${ps.length?`<h3>Who's using this phone?</h3>${ps.map(x=>`<button class="btn big" data-act="pickProfile" data-id="${x.id}">${esc(x.name)}</button>`).join("")}`:""}
 <button class="btn big" data-act="onboard" data-preset="chris">Start as Chris (prefilled)</button>
 <button class="btn sec big" data-act="onboard">New profile</button>
 <p class="small mute">Have a family code? Set up a profile, then go to Me → Family sync. Other profiles show up after it syncs.</p></section>`}
function bar(v,t,cls=""){const pc=Math.min(100,t?v/t*100:0);return`<div class="bar ${cls}"><i style="width:${pc}%"></i></div>`}
function vToday(){const p=P(),d=ui.day||dkey(),t=totals(d),K=kcalT(p),now=new Date(),isToday=d===dkey();
 const expected=isToday?p.slots.filter(s=>s.time<=pad(now.getHours())+":"+pad(now.getMinutes())).reduce((a,s)=>a+slotTarget(p,s).k,0):0,behind=r50(expected-t.k);
 const adj=adjustSuggestion(p),dl=deloadDue(p),wToday=mine("weights").find(w=>w.date===d),sl=S.col.sleep[S.active+":"+d];
 return`<div class="daynav"><button class="pill" data-act="day" data-n="-1">‹</button><b>${isToday?"Today":new Date(d+"T12:00").toLocaleDateString([], {weekday:"short",month:"short",day:"numeric"})}</b><button class="pill" data-act="day" data-n="1" ${isToday?"disabled":""}>›</button></div>
 <section class="card"><div class="tot"><div><b>${t.k}</b> / ${K} kcal${bar(t.k,K)}</div><div><b>${t.p}</b> / ${p.protein} g protein${bar(t.p,p.protein,"pr")}</div></div>
 ${isToday&&behind>=300?`<div class="nudge">⏰ You're <b>${behind} kcal behind</b> for this time of day. Easy catch-up: ${behind>=900?"Chipotle double-chicken bowl (1,040)":behind>=500?"½ shake + Core Power (755)":"Core Power + banana (335)"}.</div>`:""}
 ${!wToday&&isToday?`<div class="row"><input id="wIn" type="number" inputmode="decimal" step="0.1" placeholder="Morning weight (lb)"><button class="btn" data-act="logW">Weigh in</button></div>`:wToday?`<p class="small mute">⚖️ ${wToday.lb} lb logged</p>`:""}
 </section>
 ${adj&&!p.autoAdjust?`<section class="card warn"><b>Calorie check:</b> ${esc(adj.why)}. Suggest ${adj.d>0?"+":""}${adj.d} kcal/day.<button class="btn" data-act="applyAdj">Apply</button></section>`:""}
 ${dl?`<section class="card warn">🧘 Deload suggested: ${esc(dl)}. Go to Train to start a deload week.</section>`:""}
 ${p.slots.map(s=>{const st=slotTarget(p,s),ls=dayLogs(d).filter(l=>l.slot===s.id),k=ls.reduce((a,l)=>a+l.k,0),pr=ls.reduce((a,l)=>a+l.p,0);
  return`<section class="card slot ${k>=st.k*.8?"done":""}"><div class="sh"><div><span class="time">${fmtT(s.time)}</span><h3>${esc(s.n)}</h3><p class="small mute">${esc(s.hint||"")} · goal ~${st.k} kcal / ${st.p} g</p></div><button class="btn check" data-act="logSlot" data-slot="${s.id}" aria-label="Log ${esc(s.n)}">${k>=st.k*.8?"✓":"+"}</button></div>
  ${ls.map(l=>`<div class="li"><span>${esc(l.n)}</span><span>${l.k} · ${l.p}g <button class="x" data-act="delLog" data-id="${l.id}" aria-label="Remove">✕</button></span></div>`).join("")}${ls.length?`<p class="small mute">${k} kcal · ${pr} g</p>`:""}</section>`}).join("")}
 <section class="card"><div class="row"><button class="btn sec" data-act="logSlot" data-slot="extra">+ Extra food</button><button class="btn sec" data-act="packing">🧊 Pack for the road</button></div>
 <div class="row"><label class="grow">😴 Sleep last night (h)<input id="slIn" type="number" inputmode="decimal" step="0.5" value="${sl?sl.h:""}" placeholder="7.5"></label><button class="btn ghost" data-act="logSleep">Save</button></div></section>`}
function foodPicker(slotId){const p=P(),s=p.slots.find(x=>x.id===slotId),tag=s?.tag||"",inv=mine("inv").filter(i=>invDaysLeft(i)>=0),favs=mine("foods");
 const recFor=r=>!tag||r.tags.includes(tag)||(tag==="snack");const prepped=inv.filter(i=>recFor(RECIPES.find(r=>r.id===i.rid)||{tags:[]}));
 const item=(f,extra="")=>`<button class="fi" data-act="addFood" data-slot="${slotId}" data-k="${f.k}" data-p="${f.p}" data-n="${esc(f.n)}" ${extra}><span>${esc(f.n)}</span><b>${f.k} · ${f.p}g</b></button>`;
 const grp=(t,arr)=>arr.length?`<h4>${t}</h4>${arr.join("")}`:"";
 return`<h2>${esc(s?s.n:"Extra food")}</h2>
 ${grp("🥡 Prepped (from your fridge/freezer)",prepped.map(i=>item({n:i.n+` (${i.left} left)`,k:i.k,p:i.p},`data-inv="${i.id}"`)))}
 ${grp("⭐ Favorites",favs.map(f=>item(f)))}
 ${grp("🚗 Road picks",FOODS.filter(f=>f.t==="road").map(f=>item(f)))}
 ${grp("⛽ Gas station / Costco / home",FOODS.filter(f=>f.t!=="road").map(f=>item(f)))}
 <h4>✏️ Custom</h4><input id="cfN" placeholder="What did you eat?"><div class="row"><input id="cfK" type="number" inputmode="numeric" placeholder="kcal"><input id="cfP" type="number" inputmode="numeric" placeholder="protein g"></div>
 <label class="chk"><input type="checkbox" id="cfFav"> Save as favorite</label><button class="btn" data-act="addCustom" data-slot="${slotId}">Add</button>
 <p class="small mute">Restaurant numbers come from official nutrition pages (see Me → Sources). Portions vary.</p><button class="btn ghost" data-act="close">Close</button>`}
function packing(){const p=P(),d=dkey(),k=S.active+":"+d,rec=S.col.pack[k]||{id:k,pid:S.active,date:d,done:{}},inv=mine("inv"),lunch=inv.find(i=>RECIPES.find(r=>r.id===i.rid)?.tags.includes("lunch"));
 const items=[...p.pack];if(lunch)items.splice(1,0,`Prepped: ${lunch.n} (${lunch.left} left)`);
 return`<h2>🧊 Take with you</h2><p class="small mute">Check off as you load the cooler bag.</p>${items.map((t,i)=>`<label class="chk big"><input type="checkbox" data-act="packChk" data-i="${esc(t)}" ${rec.done[t]?"checked":""}> ${esc(t)}</label>`).join("")}
 <div class="row"><input id="packNew" placeholder="Add item to your list"><button class="btn sec" data-act="packAdd">Add</button></div><button class="btn ghost" data-act="close">Done</button>`}
// ---------- prep ----------
function weekStart(d=dkey()){const x=new Date(d+"T12:00");x.setDate(x.getDate()-x.getDay());return dkey(x)}
function prepRec(){const w=weekStart(),k=S.active+":"+w;return S.col.prep[k]||{id:k,pid:S.active,week:w,items:{bowls:6,burritos:10,oats:5,shake:5},cooked:{}}}
function grocery(pr){const agg={};for(const[rid,n]of Object.entries(pr.items)){const r=RECIPES.find(x=>x.id===rid);if(!r||!n)continue;const f=n/r.serv;
 for(const[name,q,u,aisle]of r.ing){const key=name+"|"+u;agg[key]=agg[key]||{name,u,aisle,q:0};agg[key].q+=q*f}}
 return Object.values(agg).sort((a,b)=>a.aisle<b.aisle?-1:a.aisle>b.aisle?1:a.name<b.name?-1:1).map(g=>({...g,q:Math.ceil(g.q*4-1e-9)/4}))}
function vPrep(){const pr=prepRec(),g=grocery(pr),gk=S.active+":"+pr.week,gc=(S.col.grocery[gk]||{chk:{}}).chk,inv=mine("inv").sort((a,b)=>invDaysLeft(a)-invDaysLeft(b));
 const totMin=Object.entries(pr.items).reduce((a,[rid,n])=>a+(n?RECIPES.find(r=>r.id===rid).min:0),0);let aisle="";
 const sub=ui.prepTab||"plan";
 return`<div class="seg">${[["plan","Plan"],["list","Grocery"],["inv","Fridge/Freezer"]].map(([k,t])=>`<button data-act="prepTab" data-k="${k}" class="${sub===k?"on":""}">${t}</button>`).join("")}</div>
 ${sub==="plan"?`<section class="card"><h2>Sunday prep · week of ${new Date(pr.week+"T12:00").toLocaleDateString([], {month:"short",day:"numeric"})}</h2><p class="small mute">Pick servings; grocery list scales automatically. Total hands-on ≈ ${totMin} min (overlap ovens/stove to cut it ~40%).</p></section>
 ${RECIPES.map(r=>{const n=pr.items[r.id]||0;return`<section class="card"><div class="sh"><div><h3>${esc(r.n)}</h3><p class="small mute">${r.k} kcal · ${r.p} g protein / serving · ${r.min} min · ${r.store} ${r.days>30?"~3 mo":r.days+" days"}</p></div></div>
 <div class="stepper"><button class="pill" data-act="serv" data-r="${r.id}" data-n="-1">−</button><b>${n}</b> servings<button class="pill" data-act="serv" data-r="${r.id}" data-n="1">+</button>
 ${n?`<button class="btn sm ${pr.cooked[r.id]?"ghost":""}" data-act="cooked" data-r="${r.id}">${pr.cooked[r.id]?"✓ Cooked":"Mark cooked"}</button>`:""}</div>
 <details><summary>Steps & ingredients</summary><ul>${r.ing.map(i=>`<li>${+(i[1]*(n||r.serv)/r.serv).toFixed(2)} ${i[2]} ${esc(i[0])}</li>`).join("")}</ul><ol>${r.steps.map(s=>`<li>${esc(s)}</li>`).join("")}</ol><p class="small mute">Macros are USDA-based estimates.</p></details></section>`}).join("")}`:""}
 ${sub==="list"?`<section class="card"><h2>🛒 Grocery list</h2>${g.length?g.map(x=>{const h=x.aisle!==aisle?`<h4>${aisle=x.aisle}</h4>`:"",k=x.name+"|"+x.u;return h+`<label class="chk big"><input type="checkbox" data-act="gChk" data-k="${esc(k)}" ${gc[k]?"checked":""}> ${+x.q.toFixed(2)} ${esc(x.u)} — ${esc(x.name)}</label>`}).join(""):"<p class='mute'>Add servings in Plan.</p>"}
 <button class="btn ghost" data-act="gClear">Uncheck all</button><button class="btn sec" data-act="gShare">Share / copy list</button></section>`:""}
 ${sub==="inv"?`<section class="card"><h2>🧊 Fridge & freezer</h2>${inv.length?inv.map(i=>{const dl=invDaysLeft(i);return`<div class="li inv ${dl<=1?"bad":""}"><span><b>${esc(i.n)}</b><br><small>${i.store} · ${i.left} left · ${dl<0?"expired":dl+" days left"}</small></span><span class="row"><button class="pill" data-act="invUse" data-id="${i.id}">−1</button><button class="pill" data-act="invFreeze" data-id="${i.id}" title="Move to freezer">❄️</button><button class="x" data-act="invDel" data-id="${i.id}" aria-label="Toss">🗑️</button></span></div>`}).join(""):"<p class='mute'>Mark recipes cooked to fill this.</p>"}
 <h4>Add something</h4><input id="invN" placeholder="e.g. Leftover tri-tip"><div class="row"><input id="invS" type="number" placeholder="servings"><input id="invK" type="number" placeholder="kcal/serv"><input id="invP" type="number" placeholder="g protein"></div><div class="row"><select id="invSt"><option>fridge</option><option>freezer</option></select><button class="btn" data-act="invAdd">Add</button></div></section>`:""}`}
// ---------- train ----------
function vTrain(){const p=P(),cur=mine("workouts").find(w=>!w.done),dl=deloadDue(p),pl=plan(p);
 if(cur)return workoutView(p,cur);
 const nd=nextDay(p),ws=mine("workouts").filter(w=>w.done).sort((a,b)=>a.date<b.date?1:-1),wk={};
 ws.filter(w=>daysBetween(w.date,dkey())<7).forEach(w=>w.sets.filter(s=>s.done).forEach(s=>{const m=EX[s.ex].m;wk[m]=(wk[m]||0)+1}));
 return`<section class="card"><h2>Next up: ${DAYS[nd].n}</h2><p class="small mute">${p.days}-day plan: ${pl.map(x=>DAYS[x].n).join(" → ")}${p.gymName?" · "+esc(p.gymName):""}</p>
 ${dl?`<div class="nudge">🧘 Deload suggested (${esc(dl)}): same weights, half the sets, for one week.</div>`:""}
 <button class="btn big" data-act="startWo" data-day="${nd}">Start ${DAYS[nd].n}</button>
 ${p.equipment!=="gym"?`<button class="btn sec" data-act="startWo" data-day="HD">Home dumbbell day instead</button>`:""}
 <details><summary>Pick another day</summary>${Object.keys(DAYS).map(k=>`<button class="btn ghost sm" data-act="startWo" data-day="${k}">${DAYS[k].n}</button>`).join("")}</details>
 <label class="chk"><input type="checkbox" id="dlChk" ${dl?"checked":""}> Deload session (half sets)</label></section>
 <section class="card"><h3>Hard sets this week</h3><p class="small mute">Aim ~10–20 per muscle (start 8–10 your first 2 weeks back).</p>${["chest","back","shoulders","arms","quads","hams","calves","core"].map(m=>`<div class="li"><span>${m}</span><span>${wk[m]||0}</span></div>${bar(wk[m]||0,12)}`).join("")}</section>
 <section class="card"><h3>Strength trend (est. 1-rep max)</h3><select id="liftSel" data-act="liftSel">${Object.keys(EX).filter(k=>mine("workouts").some(w=>w.sets.some(s=>s.ex===k&&s.done))).map(k=>`<option value="${k}" ${ui.lift===k?"selected":""}>${EX[k].n}</option>`).join("")||"<option>—</option>"}</select>${liftChart(ui.lift||Object.keys(EX).find(k=>mine("workouts").some(w=>w.sets.some(s=>s.ex===k&&s.done))))}</section>
 <section class="card"><h3>History</h3>${ws.slice(0,12).map(w=>`<div class="li"><span>${w.date} · ${esc(DAYS[w.day]?.n||w.day)}${w.deload?" (deload)":""}</span><span>${w.sets.filter(s=>s.done).length} sets <button class="x" data-act="delWo" data-id="${w.id}" aria-label="Delete">✕</button></span></div>`).join("")||"<p class='mute'>No workouts yet.</p>"}</section>`}
function liftChart(ex){if(!ex||!EX[ex])return"";const pts=mine("workouts").filter(w=>w.done).sort((a,b)=>a.date<b.date?-1:1).map(w=>{const s=w.sets.filter(x=>x.ex===ex&&x.done&&x.w);return s.length?[new Date(w.date).getTime(),Math.max(...s.map(x=>e1rm(x.w,x.r)))]:null}).filter(Boolean);
 return lineChart([{pts,cls:"ln",dots:1}],{fmt:v=>Math.round(v)+" lb"})}
function startWorkout(day,deload){const p=P(),home=!!DAYS[day].home||p.equipment==="home",sets=[];
 for(const[e0,n,lo,hi]of DAYS[day].x){const ex=exFor(p,e0,home),sg=suggest(p,ex,lo,hi),cnt=deload?Math.max(1,Math.ceil(n/2)):n;for(let i=0;i<cnt;i++)sets.push({ex,lo,hi,w:sg.w,r:sg.r,done:false})}
 put("workouts",{id:uid(),pid:S.active,date:dkey(),day,deload:!!deload,sets,done:false})}
function workoutView(p,w){let last="",no=0;
 return`<section class="card"><h2>${esc(DAYS[w.day]?.n||w.day)}${w.deload?" · deload":""}</h2><p class="small mute">Stop 1–3 reps short of failure. Tap ✓ when a set is done; rest timer starts.</p></section>
 ${w.sets.map((s,i)=>{const head=s.ex!==last;last=s.ex;no=head?1:no+1;const sg=head?suggest(p,s.ex,s.lo,s.hi):null,ls=head?lastSets(s.ex):null;
  return(head?`<h3 class="exh">${esc(EX[s.ex].n)} <small>${s.lo}–${s.hi} reps</small></h3><p class="small mute">${ls?`Last (${ls.date}): ${ls.sets.map(x=>`${x.w||"BW"}×${x.r}`).join(", ")} · `:""}${esc(sg.msg)}</p>`:"")+
  `<div class="set ${s.done?"done":""}"><span>#${no}</span><input type="number" inputmode="decimal" step="2.5" value="${s.w}" data-act="setW" data-i="${i}" placeholder="lb" aria-label="weight"><span>lb ×</span><input type="number" inputmode="numeric" value="${s.r}" data-act="setR" data-i="${i}" aria-label="reps"><button class="btn check sm" data-act="setDone" data-i="${i}">${s.done?"✓":"○"}</button></div>`}).join("")}
 <section class="card"><div class="row"><button class="btn sec" data-act="addSet">+ Set</button><button class="btn sec" data-act="rest" data-s="90">⏱ 90s</button><button class="btn sec" data-act="rest" data-s="150">⏱ 2:30</button></div>
 <button class="btn big" data-act="finishWo">Finish workout</button><button class="btn ghost" data-act="cancelWo">Discard</button></section>`}
// ---------- progress ----------
function vProgress(){const p=P(),ws=wSeries(),r=trendRate(),cur=ws.length?ws.at(-1).lb:p.weight;
 const raw=ws.map(w=>[new Date(w.date).getTime(),w.lb]),av=ws.map(w=>[new Date(w.date).getTime(),avg7(ws,w.date)]);
 const toGo=p.goalWeight?Math.abs(p.goalWeight-cur):0,eta=r&&p.goal!=="maintain"&&Math.sign(r)===Math.sign(p.goalWeight-cur)?Math.ceil(toGo/Math.abs(r)):null;
 const ach=achievements(),ck=mine("checkins").sort((a,b)=>a.week<b.week?1:-1),sl=mine("sleep").filter(s=>daysBetween(s.date,dkey())<7),slA=sl.length?(sl.reduce((a,s)=>a+s.h,0)/sl.length).toFixed(1):"—";
 return`<section class="card"><h2>Weight</h2><div class="tot"><div><b>${cur}</b> lb now</div><div><b>${p.goalWeight||"—"}</b> goal</div><div><b>${r==null?"—":(r>0?"+":"")+r.toFixed(2)}</b> lb/wk</div></div>
 ${lineChart([{pts:raw,cls:"raw",dots:1},{pts:av,cls:"ln"}],{goal:p.goalWeight||null})}
 <p class="small mute">Dots = daily weigh-ins, line = 7-day average. ${r==null?"Need ~6 weigh-ins over 10+ days for a trend.":eta?`At this rate: goal in ~${eta} weeks.`:""}</p>
 <div class="row"><input id="wIn2" type="number" inputmode="decimal" step="0.1" placeholder="lb"><input id="wD" type="date" value="${dkey()}"><button class="btn" data-act="logW2">Add</button></div>
 <p class="small">Target now: <b>${kcalT(p)} kcal</b>${p.kcalAdj?` (base ${p.kcal} ${p.kcalAdj>0?"+":""}${p.kcalAdj} auto-adjust)`:""} · ${p.protein} g protein · auto-adjust ${p.autoAdjust?"ON":"off"}</p>
 ${(p.adjLog||[]).slice(-4).reverse().map(a=>`<p class="small mute">${a.date}: ${a.d>0?"+":""}${a.d} kcal — ${esc(a.why)}</p>`).join("")}</section>
 <section class="card"><h2>🏆 Milestones</h2><div class="badges">${ach.map(([id,t,ic])=>`<span class="badge">${ic} ${esc(t)}</span>`).join("")||"<span class='mute'>Log meals, weigh-ins and workouts to unlock.</span>"}</div>
 <p class="small mute">Next: ${p.goal==="maintain"?"keep streaks going":(()=>{const st=p.startWeight||p.weight,m=(cur-st)*(p.goal==="lose"?-1:1),n=Math.floor(Math.max(0,m)/2)*2+2;return`${p.goal==="lose"?"−":"+"}${n} lb (${(n-m).toFixed(1)} to go)`})()}</p></section>
 <section class="card"><h2>📸 Progress photos</h2><label class="btn sec filebtn">Add photo<input type="file" accept="image/*" capture="user" id="phIn" hidden></label>
 <div class="photos" id="photos">${mine("photos").sort((a,b)=>a.date<b.date?1:-1).map(x=>`<figure data-act="phSel" data-id="${x.id}" class="${(ui.cmp||[]).includes(x.id)?"sel":""}"><img data-pid="${x.photo}" alt="Progress ${x.date}"><figcaption>${x.date}${x.lb?` · ${x.lb}`:""}</figcaption></figure>`).join("")}</div>
 <p class="small mute">Tap 2 photos to compare side by side. Same spot, same light, every 2–4 weeks.</p><div id="cmp" class="cmp"></div></section>
 <section class="card"><h2>📝 Weekly check-in</h2><p class="small mute">Avg sleep (7 days): <b>${slA} h</b> — aim 7–9.</p>
 ${["energy","hunger","soreness","stress"].map(k=>`<label>${k} <span class="mute small">1 low – 5 high</span><div class="seg">${[1,2,3,4,5].map(n=>`<button data-act="ckSet" data-k="${k}" data-n="${n}" class="${(ui.ck||{})[k]===n?"on":""}">${n}</button>`).join("")}</div></label>`).join("")}
 <textarea id="ckNote" placeholder="Notes (appetite, travel, wins)"></textarea><button class="btn" data-act="ckSave">Save check-in</button>
 ${ck.slice(0,4).map(c=>`<p class="small mute">${c.week}: energy ${c.energy||"-"} · hunger ${c.hunger||"-"} · soreness ${c.soreness||"-"} · stress ${c.stress||"-"} ${esc(c.note||"")}</p>`).join("")}</section>`}
async function loadPhotos(){for(const im of $$("img[data-pid]")){const v=await pGet(im.dataset.pid);if(v)im.src=v}
 const c=ui.cmp||[];if(c.length===2){const a=S.col.photos[c[0]],b=S.col.photos[c[1]];if(a&&b){const[x,y]=a.date<b.date?[a,b]:[b,a];$("#cmp").innerHTML=`<div><img src="${await pGet(x.photo)||""}"><p>${x.date}</p></div><div><img src="${await pGet(y.photo)||""}"><p>${y.date}</p></div>`}}}
// ---------- me ----------
function vMe(){const p=P(),ps=Object.values(S.col.profiles);
 return`<section class="card"><h2>${esc(p.name)}</h2><p>${kcalT(p)} kcal · ${p.protein} g protein · ${p.fat} g fat · ${p.carbs} g carbs</p><p class="small mute">Goal: ${p.goal} ${p.goal!=="maintain"?`to ${p.goalWeight} lb at ${p.rate} lb/wk`:""} · ${p.days} training days · ${p.equipment==="both"?"gym + home DBs":p.equipment}</p>
 <button class="btn sec" data-act="onboard" data-edit="1">Edit goals, schedule & equipment</button>
 <label class="chk"><input type="checkbox" id="autoAdj" data-act="toggleAuto" ${p.autoAdjust?"checked":""}> Auto-adjust calories weekly from weight trend</label></section>
 <section class="card"><h2>🔔 Reminders</h2><p class="small mute">Phones only allow web-app alerts while the app is open/recent. For alerts you can count on, add the meal times to your calendar.</p>
 <div class="row"><button class="btn sec" data-act="notif">Enable app alerts</button><button class="btn sec" data-act="ics">Add to calendar (.ics)</button></div></section>
 <section class="card"><h2>👥 Profiles</h2>${ps.map(x=>`<div class="li"><span>${esc(x.name)}${x.id===S.active?" (this phone)":""}</span>${x.id!==S.active?`<button class="pill" data-act="pickProfile" data-id="${x.id}">Switch</button>`:""}</div>`).join("")}
 <button class="btn sec" data-act="onboard">+ Add profile (e.g. girlfriend)</button><p class="small mute">Each person gets their own goals, meals, workouts and photos. Everyone in the family code can see all profiles.</p></section>
 <section class="card" id="syncCard"></section>
 <section class="card"><h2>💾 Data</h2><div class="row"><button class="btn ghost" data-act="export">Export backup</button><label class="btn ghost filebtn">Import<input type="file" accept=".json" id="impIn" hidden></label></div></section>
 <section class="card"><h2>📚 Sources</h2><ul class="small">${Object.values(SOURCES).map(([t,u])=>`<li><a href="${u}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join("")}
 <li>Targets: Mifflin-St Jeor BMR × activity; protein 0.8–1.0 g/lb (ISSN 2017, Morton 2018); gain 0.25–0.5% BW/wk (Iraki 2019); volume 10–20 sets/muscle/wk (Schoenfeld 2017).</li></ul><p class="small mute">Not medical advice.</p></section>`}
function onboardForm(edit,preset){const p=edit?P():preset==="chris"?{...CHRIS}:{name:"",sex:"f",age:30,heightIn:65,weight:140,goal:"maintain",goalWeight:140,rate:0.5,activity:1.375,hardGainer:false,days:3,equipment:"gym",dbMax:25,gymName:"",wake:"06:30"};
 const slots=p.slots||DEFAULT_SLOTS;ui.ob={edit,preset,slots:JSON.parse(JSON.stringify(slots))};
 const opt=(v,list)=>list.map(([k,t])=>`<option value="${k}" ${String(v)===String(k)?"selected":""}>${t}</option>`).join("");
 return`<h2>${edit?"Edit plan":"Set up profile"}</h2><form id="ob">
 <label>Name<input name="name" value="${esc(p.name)}" required></label>
 <div class="row"><label>Sex<select name="sex">${opt(p.sex,[["m","Male"],["f","Female"]])}</select></label><label>Age<input name="age" type="number" value="${p.age}"></label></div>
 <div class="row"><label>Height ft<input name="ft" type="number" value="${Math.floor(p.heightIn/12)}"></label><label>in<input name="in" type="number" value="${p.heightIn%12}"></label><label>Weight lb<input name="weight" type="number" step="0.1" value="${p.weight}"></label></div>
 <label>Goal<select name="goal">${opt(p.goal,[["gain","Gain weight / build muscle"],["maintain","Maintain / recomp"],["lose","Lose fat"]])}</select></label>
 <div class="row"><label>Goal weight<input name="goalWeight" type="number" step="0.1" value="${p.goalWeight}"></label><label>lb / week<input name="rate" type="number" step="0.05" value="${p.rate}"></label></div>
 <label>Activity (incl. training)<select name="activity">${opt(p.activity,[[1.2,"Mostly sitting/driving, little exercise"],[1.375,"Light: 1–3 workouts/wk"],[1.55,"Moderate: 3–5 workouts/wk"],[1.725,"Very active / physical job"]])}</select></label>
 <label class="chk"><input type="checkbox" name="hardGainer" ${p.hardGainer?"checked":""}> Hard gainer (add +100 kcal buffer)</label>
 <div class="row"><label>Training days/wk<select name="days">${opt(p.days,[[2,"2"],[3,"3"],[4,"4"],[5,"5 (4 gym + home)"],[6,"6"]])}</select></label><label>Equipment<select name="equipment">${opt(p.equipment,[["gym","Gym"],["both","Gym + home DBs"],["home","Home dumbbells only"]])}</select></label></div>
 <div class="row"><label>Max home DB (lb)<input name="dbMax" type="number" value="${p.dbMax}"></label><label>Gym<input name="gymName" value="${esc(p.gymName||"")}"></label></div>
 <h3>Meal schedule</h3><p class="small mute">Rename, retime, or set share of daily calories. 🚗 = eaten on the road (goes on packing list).</p><div id="obSlots">${slotRows()}</div>
 <button type="button" class="btn ghost sm" data-act="obAddSlot">+ Add meal</button>
 <div id="obPrev" class="card inner"></div>
 <button class="btn big" type="submit">${edit?"Save":"Create profile"}</button>${edit?`<button type="button" class="btn ghost" data-act="close">Cancel</button>`:`<button type="button" class="btn ghost" data-act="close">Cancel</button>`}</form>`}
function slotRows(){return ui.ob.slots.map((s,i)=>`<div class="slotrow"><input data-sl="${i}" data-f="n" value="${esc(s.n)}" aria-label="meal name"><input data-sl="${i}" data-f="time" type="time" value="${s.time}" aria-label="time"><input data-sl="${i}" data-f="share" type="number" step="1" value="${Math.round(s.share*100)}" aria-label="% of calories"><span>%</span><button type="button" class="pill ${s.road?"on":""}" data-act="obRoad" data-i="${i}">🚗</button><button type="button" class="x" data-act="obDelSlot" data-i="${i}" aria-label="remove">✕</button></div>`).join("")}
function obRead(){const f=new FormData($("#ob")),g=k=>f.get(k);
 $$("#obSlots input").forEach(el=>{const s=ui.ob.slots[el.dataset.sl];if(!s)return;s[el.dataset.f]=el.dataset.f==="share"?(+el.value||0)/100:el.value});
 return{name:(g("name")||"").trim()||"Me",sex:g("sex"),age:+g("age"),heightIn:(+g("ft"))*12+(+g("in")),weight:+g("weight"),goal:g("goal"),goalWeight:+g("goalWeight"),rate:Math.abs(+g("rate")),activity:+g("activity"),hardGainer:!!g("hardGainer"),days:+g("days"),equipment:g("equipment"),dbMax:+g("dbMax"),gymName:g("gymName"),slots:ui.ob.slots}}
function obPreview(){if(!$("#ob"))return;const v=obRead(),t=calcTargets(v);$("#obPrev").innerHTML=`<b>${t.kcal} kcal · ${t.protein} g protein</b><br><small>BMR ${t.bmr} × ${v.activity} = ${t.tdee} maintenance ${t.rate?`${t.rate>0?"+":""}${Math.round(t.rate*500)} for ${t.rate} lb/wk`:""}${v.goal==="gain"&&v.hardGainer?" +100 hard-gainer":""} · fat ${t.fat} g · carbs ${t.carbs} g</small>`}
function obSave(){const v=obRead(),t=calcTargets(v),old=ui.ob.edit?P():null,id=old?old.id:ui.ob.preset==="chris"&&!S.col.profiles.chris?"chris":uid();
 const p={...(old||{}),...v,id,kcal:t.kcal,protein:t.protein,fat:t.fat,carbs:t.carbs,startWeight:old?.startWeight||v.weight,startDate:old?.startDate||dkey(),pack:old?.pack||[...DEFAULT_PACK],autoAdjust:old?old.autoAdjust:true,deloadEvery:old?.deloadEvery||6};
 if(old&&old.kcal!==t.kcal)p.kcalAdj=0;put("profiles",p);S.active=id;localStorage.setItem("gain.active",id);save();
 if(!old&&!mine("weights").length)put("weights",{id:id+":"+dkey(),pid:id,date:dkey(),lb:v.weight});closeSheet();tab="today";render();toast(old?"Plan updated":"Profile ready 💪")}
// ---------- reminders ----------
let remT=[];function scheduleReminders(){remT.forEach(clearTimeout);remT=[];const p=P();if(!p||!p.reminders||!("Notification"in window)||Notification.permission!=="granted")return;const now=new Date();
 for(const s of p.slots){const[h,m]=s.time.split(":").map(Number),t=new Date();t.setHours(h,m,0,0);if(t>now)remT.push(setTimeout(async()=>{const st=slotTarget(p,s),msg=`${s.n}: ~${st.k} kcal / ${st.p} g. ${s.hint||""}`;try{const r=await navigator.serviceWorker?.ready;r?r.showNotification("Gain 🍽️",{body:msg,icon:"icons/icon-192.png",tag:s.id}):new Notification("Gain",{body:msg})}catch(_){}},t-now))}}
function icsFile(){const p=P(),st=dkey().replace(/-/g,"");let o="BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Gain//EN\r\n";
 for(const s of p.slots){const t=slotTarget(p,s),hm=s.time.replace(":","");o+=`BEGIN:VEVENT\r\nUID:gain-${p.id}-${s.id}@gain\r\nDTSTAMP:${st}T000000Z\r\nDTSTART:${st}T${hm}00\r\nDURATION:PT15M\r\nRRULE:FREQ=DAILY\r\nSUMMARY:${s.n} (~${t.k} kcal / ${t.p}g)\r\nDESCRIPTION:${(s.hint||"").replace(/,/g,"\\,")}\r\nBEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:${s.n}\r\nTRIGGER:PT0M\r\nEND:VALARM\r\nEND:VEVENT\r\n`}
 o+="END:VCALENDAR\r\n";return o}
function download(name,text,type){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();a.remove()}
// ---------- events ----------
let restI=null;function rest(sec){clearInterval(restI);const el=$("#rest");let left=sec;el.classList.remove("hidden");const tick=()=>{el.textContent=`Rest ${Math.floor(left/60)}:${pad(left%60)} — tap to stop`;if(left--<=0){clearInterval(restI);el.textContent="Rest done — next set!";navigator.vibrate&&navigator.vibrate([200,100,200]);setTimeout(()=>el.classList.add("hidden"),4000)}};tick();restI=setInterval(tick,1000)}
function logFood(slot,n,k,p,inv){put("logs",{id:uid(),pid:S.active,date:ui.day||dkey(),slot,n,k:+k||0,p:+p||0});if(inv)useInv(inv);closeSheet();render();checkAch();toast(`Logged ${k} kcal · ${p} g`)}
document.addEventListener("click",async e=>{const b=e.target.closest("[data-act],[data-tab]");if(!b)return;if(b.dataset.tab){tab=b.dataset.tab;location.hash=tab;ui.day=null;render();scrollTo(0,0);return}
 const a=b.dataset.act,p=P(),d=b.dataset;
 if(b.tagName==="INPUT"&&b.type!=="checkbox")return;
 switch(a){
 case"close":closeSheet();break;
 case"onboard":sheet(onboardForm(!!d.edit,d.preset));obPreview();break;
 case"pickProfile":S.active=d.id;localStorage.setItem("gain.active",d.id);save();tab="today";render();scheduleReminders();break;
 case"obAddSlot":obRead();ui.ob.slots.push({id:uid(),n:"Snack",time:"16:00",share:.1,hint:""});$("#obSlots").innerHTML=slotRows();obPreview();break;
 case"obDelSlot":obRead();ui.ob.slots.splice(+d.i,1);$("#obSlots").innerHTML=slotRows();break;
 case"obRoad":obRead();ui.ob.slots[+d.i].road=ui.ob.slots[+d.i].road?0:1;$("#obSlots").innerHTML=slotRows();break;
 case"day":{const n=addDays(ui.day||dkey(),+d.n);ui.day=n>dkey()?dkey():n;render();break}
 case"logSlot":sheet(foodPicker(d.slot));break;
 case"addFood":logFood(d.slot,d.n,d.k,d.p,d.inv);break;
 case"addCustom":{const n=$("#cfN").value.trim()||"Food",k=+$("#cfK").value||0,pr=+$("#cfP").value||0;if($("#cfFav").checked)put("foods",{id:uid(),pid:S.active,n,k,p:pr});logFood(d.slot,n,k,pr);break}
 case"delLog":del("logs",d.id);render();break;
 case"logW":case"logW2":{const v=+$(a==="logW"?"#wIn":"#wIn2").value,dt=a==="logW2"?$("#wD").value||dkey():dkey();if(!v)return toast("Enter a weight");put("weights",{id:S.active+":"+dt,pid:S.active,date:dt,lb:v});if(dt===dkey()){p.weight=v;put("profiles",p)}autoAdjust();checkAch();render();toast("Weight saved");break}
 case"applyAdj":{const s=adjustSuggestion(p);if(s){applyAdjust(p,s);render();toast("Calories updated")}break}
 case"logSleep":{const h=+$("#slIn").value;if(!h)return;const k=S.active+":"+(ui.day||dkey());put("sleep",{id:k,pid:S.active,date:ui.day||dkey(),h});toast("Sleep saved");break}
 case"packing":sheet(packing());break;
 case"packChk":{const k=S.active+":"+dkey(),r=S.col.pack[k]||{id:k,pid:S.active,date:dkey(),done:{}};r.done[d.i]=b.checked;put("pack",r);break}
 case"packAdd":{const v=$("#packNew").value.trim();if(v){p.pack.push(v);put("profiles",p);sheet(packing())}break}
 case"prepTab":ui.prepTab=d.k;render();break;
 case"serv":{const r=prepRec(),rc=RECIPES.find(x=>x.id===d.r),step=rc.serv>=5?1:1;r.items[d.r]=Math.max(0,(r.items[d.r]||0)+(+d.n)*step);put("prep",r);render();break}
 case"cooked":{const r=prepRec(),rc=RECIPES.find(x=>x.id===d.r);if(r.cooked[d.r])return toast("Already marked cooked");r.cooked[d.r]=dkey();put("prep",r);put("inv",{id:uid(),pid:S.active,rid:rc.id,n:rc.n,k:rc.k,p:rc.p,left:r.items[d.r],store:rc.store,made:dkey(),days:rc.days});checkAch();render();toast(`${r.items[d.r]} servings added to ${rc.store}`);break}
 case"gChk":{const r=prepRec(),k=S.active+":"+r.week,g=S.col.grocery[k]||{id:k,pid:S.active,chk:{}};g.chk[d.k]=b.checked;put("grocery",g);break}
 case"gClear":{const r=prepRec(),k=S.active+":"+r.week;put("grocery",{id:k,pid:S.active,chk:{}});render();break}
 case"gShare":{const txt="Grocery list\n"+grocery(prepRec()).map(x=>`- ${+x.q.toFixed(2)} ${x.u} ${x.name}`).join("\n");try{if(navigator.share)await navigator.share({text:txt});else{await navigator.clipboard.writeText(txt);toast("Copied")}}catch(_){}break}
 case"invUse":useInv(d.id);render();break;
 case"invFreeze":{const i=S.col.inv[d.id];i.store="freezer";i.days=daysBetween(i.made,dkey())+90;put("inv",i);render();toast("Moved to freezer (~3 months)");break}
 case"invDel":del("inv",d.id);render();break;
 case"invAdd":{const n=$("#invN").value.trim();if(!n)return;const st=$("#invSt").value;put("inv",{id:uid(),pid:S.active,rid:"",n,k:+$("#invK").value||0,p:+$("#invP").value||0,left:+$("#invS").value||1,store:st,made:dkey(),days:st==="freezer"?90:4});render();break}
 case"startWo":startWorkout(d.day,$("#dlChk")?.checked);render();scrollTo(0,0);break;
 case"setDone":{const w=mine("workouts").find(x=>!x.done),s=w.sets[+d.i];s.done=!s.done;put("workouts",w);render();if(s.done)rest(EX[s.ex].m==="quads"||EX[s.ex].m==="hams"?150:90);break}
 case"addSet":{const w=mine("workouts").find(x=>!x.done),l=w.sets.at(-1);w.sets.push({...l,done:false});put("workouts",w);render();break}
 case"rest":rest(+d.s);break;
 case"finishWo":{const w=mine("workouts").find(x=>!x.done);w.done=true;w.sets=w.sets.filter(s=>s.done);put("workouts",w);const before=prCount();checkAch();render();toast("Workout saved 💪");break}
 case"cancelWo":{const w=mine("workouts").find(x=>!x.done);if(confirm("Discard this workout?")){del("workouts",w.id);render()}break}
 case"delWo":if(confirm("Delete this workout?")){del("workouts",d.id);render()}break;
 case"phSel":{ui.cmp=ui.cmp||[];const i=ui.cmp.indexOf(d.id);if(i>=0)ui.cmp.splice(i,1);else{ui.cmp.push(d.id);if(ui.cmp.length>2)ui.cmp.shift()}render();break}
 case"ckSet":ui.ck=ui.ck||{};ui.ck[d.k]=+d.n;render();break;
 case"ckSave":{const w=weekStart(),k=S.active+":"+w;put("checkins",{id:k,pid:S.active,week:w,...(ui.ck||{}),note:$("#ckNote").value});ui.ck={};render();toast("Check-in saved");break}
 case"toggleAuto":p.autoAdjust=b.checked;put("profiles",p);break;
 case"notif":{if(!("Notification"in window))return toast("This browser can't do alerts — use calendar");const r=await Notification.requestPermission();p.reminders=r==="granted";put("profiles",p);scheduleReminders();toast(r==="granted"?"Alerts on":"Alerts blocked — use calendar");break}
 case"ics":download(`gain-${p.name}-meals.ics`,icsFile(),"text/calendar");break;
 case"export":download(`gain-backup-${dkey()}.json`,JSON.stringify(S),"application/json");break;
 }});
document.addEventListener("input",e=>{const t=e.target;if(t.closest("#ob")){obPreview();return}
 if(t.dataset.act==="setW"||t.dataset.act==="setR"){const w=mine("workouts").find(x=>!x.done),s=w.sets[+t.dataset.i];if(t.dataset.act==="setW")s.w=t.value===""?"":+t.value;else s.r=+t.value;put("workouts",w)}});
document.addEventListener("change",async e=>{const t=e.target;
 if(t.id==="liftSel"){ui.lift=t.value;render()}
 if(t.id==="phIn"&&t.files[0]){const url=await resize(t.files[0]),pid=uid();await pPut(pid,url);const w=mine("weights").find(x=>x.date===dkey());put("photos",{id:pid,pid:S.active,date:dkey(),photo:pid,lb:w?.lb||null});checkAch();render()}
 if(t.id==="impIn"&&t.files[0]){try{const j=JSON.parse(await t.files[0].text());if(!j.col)throw 0;for(const c of COLS)Object.assign(S.col[c],j.col[c]||{});save();render();toast("Imported")}catch(_){toast("Not a Gain backup")}}});
document.addEventListener("submit",e=>{if(e.target.id==="ob"){e.preventDefault();obSave()}});
$("#sheet").addEventListener("click",e=>{if(e.target.id==="sheet")closeSheet()});
$("#rest").addEventListener("click",()=>{clearInterval(restI);$("#rest").classList.add("hidden")});
$("#who").addEventListener("click",()=>{tab="me";render()});
addEventListener("hashchange",()=>{const h=location.hash.slice(1);if(h&&h!==tab){tab=h;render()}});
S.active=S.active||localStorage.getItem("gain.active");if(S.active&&!S.col.profiles[S.active])S.active=null;
render();autoAdjust();scheduleReminders();
if("serviceWorker"in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
