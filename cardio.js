"use strict";
// Cardio plan + run log + mile tracker. Data: profile.week (per-profile schedule) and "runs" collection (synced via entries like everything else).
const WD=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const LIFT_DAYS={2:[1,4],3:[1,3,5],4:[1,2,4,5],5:[1,2,4,5,6],6:[1,2,3,4,5,6]};
const RUN_TYPES=[["mile","Mile time trial"],["easy","Easy run"],["intervals","Intervals"]];
const FINISHERS=["8 min bike/rower: 6 × 20 s hard / 40 s easy","10 min incline walk (10–12%, 3 mph)","8 min: 4 × 1 min fast jog / 1 min walk"];
function defaultWeek(days){const lift=LIFT_DAYS[days]||LIFT_DAYS[4],run=[6,0,3].find(d=>!lift.includes(d))??6,upper=lift.filter((_,i)=>i%2===0).slice(0,2);
 return{days,run:[run],fin:upper,testEvery:14,bump:150,lift}}
function week(p){let w=p.week;if(!w||w.days!==p.days&&!w.custom)w=defaultWeek(p.days);return w}
const dow=d=>new Date(d+"T12:00").getDay();
const myRuns=()=>mine("runs").sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:(a.updated||0)-(b.updated||0));
const miles=()=>myRuns().filter(r=>r.type==="mile"&&r.sec>0);
const fmtSec=s=>{s=Math.round(s);return Math.floor(s/60)+":"+pad(s%60)};
const parseT=t=>{t=String(t||"").trim();if(!t)return 0;const a=t.split(":").map(Number);if(a.some(isNaN))return 0;return a.length===3?a[0]*3600+a[1]*60+a[2]:a.length===2?a[0]*60+a[1]:a[0]*60};
const paceOf=r=>r.dist>0?r.sec/r.dist:0;
function mileTestDue(p,d=dkey()){const w=week(p);if(!w.testEvery)return null;const ms=miles(),last=ms.length?ms.at(-1).date:null;
 const due=last?addDays(last,w.testEvery):(p.startDate||d);return due}
function cardioFor(p,d=dkey()){const w=week(p),wd=dow(d),out=[];
 if(w.run.includes(wd)){const due=mileTestDue(p,d),test=due&&d>=due;
  const wkNo=Math.floor(daysBetween("2026-01-04",d)/7);
  out.push(test?{k:"mile",t:"🏁 Mile test day",s:"Warm up 10 min easy, then 1 mile all-out. Log the time."}:wkNo%2?{k:"intervals",t:"🏃 Intervals",s:"5 min easy, 6 × 1 min hard / 90 s walk, 5 min easy (~20 min)"}:{k:"easy",t:"🏃 Easy run",s:"20–25 min conversational pace (can talk in sentences)"})}
 if(w.fin.includes(wd))out.push({k:"fin",t:"⚡ Finisher after lifting",s:FINISHERS[wd%FINISHERS.length]});
 return out}
const liftOn=(p,d)=>week(p).lift.includes(dow(d));
function cardioBump(p,d=dkey()){const w=week(p);if(!w.bump)return 0;const ran=myRuns().some(r=>r.date===d);return(ran||w.run.includes(dow(d)))?w.bump:0}
function runAch(a){const rs=myRuns(),ms=miles();if(rs.length)a.push(["run1","First run","👟"]);[[10,"10 runs"],[25,"25 runs"],[50,"50 runs"]].forEach(([n,t])=>rs.length>=n&&a.push(["run"+n,t,"👟"]));
 if(ms.length)a.push(["mile1","First mile test","🏁"]);let best=Infinity,prs=0;for(const m of ms){if(m.sec<best){if(best<Infinity)prs++;best=m.sec}}
 if(prs>=1)a.push(["milepr1","Mile PR","⏱️"]);if(prs>=3)a.push(["milepr3","3 mile PRs","⏱️"]);
 [[600,"Sub-10:00 mile"],[540,"Sub-9:00 mile"],[480,"Sub-8:00 mile"],[420,"Sub-7:00 mile"],[360,"Sub-6:00 mile"]].forEach(([s,t])=>best<s&&a.push(["mile"+s,t,"🏁"]));
 const dist=rs.reduce((x,r)=>x+(+r.dist||0),0);[[10,"10 miles run"],[50,"50 miles run"],[100,"100 miles run"]].forEach(([n,t])=>dist>=n&&a.push(["dist"+n,t,"🛣️"]))}
// ---- views ----
function cardioToday(p,d){const c=cardioFor(p,d),rs=myRuns().filter(r=>r.date===d),due=mileTestDue(p,d),lift=liftOn(p,d);
 return`<section class="card cardio"><div class="sh"><div><span class="time">${lift?"Lift day":"No lifting"} · ${WD[dow(d)]}</span><h3>${c.length?c.map(x=>esc(x.t)).join(" + "):"No cardio planned"}</h3>
 ${c.map(x=>`<p class="small mute">${esc(x.s)}</p>`).join("")}${!c.length?`<p class="small mute">Rest is part of gaining. Walk if you want.</p>`:""}</div><button class="btn check" data-act="runNew" data-type="${c[0]?.k==="mile"?"mile":c[0]?.k==="intervals"?"intervals":"easy"}" aria-label="Log run">${rs.length?"✓":"+"}</button></div>
 ${rs.map(r=>`<div class="li"><span>${esc(RUN_TYPES.find(t=>t[0]===r.type)?.[1]||r.type)} · ${r.dist} mi · ${fmtSec(r.sec)}</span><span>${fmtSec(paceOf(r))}/mi</span></div>`).join("")}
 ${cardioBump(p,d)?`<p class="small mute">+${cardioBump(p,d)} kcal added today for cardio.</p>`:""}${due&&due>d?`<p class="small mute">Next mile test: ${due}</p>`:""}</section>`}
function vWeek(p){const w=week(p),pl=plan(p),t=dkey(),ws=weekStart(t),due=mileTestDue(p);let li=0;
 return`<section class="card" id="weekPlan"><h2>📅 This week</h2><p class="small mute">Lifting rotates ${pl.map(x=>DAYS[x].n).join(" → ")}. Cardio kept light so it doesn't eat your surplus.</p>
 ${[0,1,2,3,4,5,6].map(i=>{const d=addDays(ws,i),c=cardioFor(p,d),l=w.lift.includes(i);const lab=l?DAYS[pl[li++%pl.length]].n:"";
  return`<div class="li wk ${d===t?"now":""}"><span><b>${WD[i]}</b> ${l?"🏋️ "+esc(lab):c.length?"":"<span class='mute'>Rest</span>"}${c.map(x=>`<br><small>${esc(x.t)}</small>`).join("")}</span><span class="small mute">${d.slice(5)}</span></div>`}).join("")}
 <p class="small mute">🏁 Mile test every ${w.testEvery?w.testEvery/7+" weeks":"— (off)"}${due?` · next due ${due}`:""} on your run day.${w.bump?` Run days get +${w.bump} kcal.`:""}</p>
 <button class="btn sec" data-act="weekEdit">Customize cardio days</button></section>`}
function weekForm(p){const w=week(p);
 return`<h2>Customize week</h2><p class="small mute">Hard-gainer default: 1 run day + short finishers on 2 upper days. More cardio = eat more.</p>
 <div id="wkf">${WD.map((n,i)=>`<div class="slotrow"><b style="width:44px">${n}</b><label class="chk"><input type="checkbox" data-wk="lift" data-i="${i}" ${w.lift.includes(i)?"checked":""}>Lift</label><label class="chk"><input type="checkbox" data-wk="run" data-i="${i}" ${w.run.includes(i)?"checked":""}>Run</label><label class="chk"><input type="checkbox" data-wk="fin" data-i="${i}" ${w.fin.includes(i)?"checked":""}>Finisher</label></div>`).join("")}</div>
 <div class="row"><label>Mile test every<select id="wkTest">${[[0,"Off"],[14,"2 weeks"],[21,"3 weeks"],[28,"4 weeks"]].map(([v,t])=>`<option value="${v}" ${w.testEvery===v?"selected":""}>${t}</option>`).join("")}</select></label><label>Run-day kcal bump<input id="wkBump" type="number" step="50" value="${w.bump}"></label></div>
 <button class="btn big" data-act="weekSave">Save</button><button class="btn ghost" data-act="weekReset">Reset to default</button><button class="btn ghost" data-act="close">Cancel</button>`}
function runForm(type,id){const r=id?S.col.runs[id]:{date:ui.day||dkey(),type:type||"easy",dist:type==="mile"?1:"",sec:0};
 return`<h2>${id?"Edit run":"Log run"}</h2><label>Type<select id="rnType">${RUN_TYPES.map(([k,t])=>`<option value="${k}" ${r.type===k?"selected":""}>${t}</option>`).join("")}</select></label>
 <div class="row"><label>Date<input id="rnDate" type="date" value="${r.date}"></label><label>Distance (mi)<input id="rnDist" type="number" inputmode="decimal" step="0.01" value="${r.dist}"></label></div>
 <label>Time (mm:ss or h:mm:ss)<input id="rnTime" inputmode="numeric" placeholder="8:30" value="${r.sec?fmtSec(r.sec):""}"></label><p class="small" id="rnPace">&nbsp;</p>
 <input id="rnNote" placeholder="Notes (treadmill, track, how it felt)" value="${esc(r.note||"")}">
 <button class="btn big" data-act="runSave" data-id="${id||""}">Save</button><button class="btn ghost" data-act="close">Cancel</button>`}
function runPace(){const el=$("#rnPace");if(!el)return;const s=parseT($("#rnTime").value),di=+$("#rnDist").value;el.textContent=s&&di?`Pace ${fmtSec(s/di)}/mi`:"\u00a0"}
function vRuns(){const rs=myRuns().reverse();
 return`<section class="card"><h2>👟 Run log</h2><button class="btn sec" data-act="runNew">+ Log run</button>
 ${rs.slice(0,15).map(r=>`<div class="li"><span>${r.date} · ${esc(RUN_TYPES.find(t=>t[0]===r.type)?.[1]||r.type)}<br><small>${r.dist} mi · ${fmtSec(r.sec)} · ${fmtSec(paceOf(r))}/mi</small></span><span><button class="pill" data-act="runEdit" data-id="${r.id}">✎</button><button class="x" data-act="runDel" data-id="${r.id}" aria-label="Delete">✕</button></span></div>`).join("")||"<p class='mute'>No runs yet.</p>"}</section>`}
function vMile(p){const ms=miles(),best=ms.length?ms.reduce((a,b)=>b.sec<a.sec?b:a):null,last=ms.at(-1),prev=ms.at(-2),due=mileTestDue(p);
 const pts=ms.map(m=>[new Date(m.date+"T12:00").getTime(),m.sec]);
 return`<section class="card" id="mileCard"><h2>🏁 Mile time</h2><div class="tot"><div><b>${best?fmtSec(best.sec):"—"}</b> best (PR)</div><div><b>${last?fmtSec(last.sec):"—"}</b> latest</div><div><b>${last&&prev?((last.sec<=prev.sec?"−":"+")+fmtSec(Math.abs(last.sec-prev.sec))):"—"}</b> vs prev</div></div>
 ${lineChart([{pts,cls:"ln",dots:1}],{fmt:fmtSec})}<p class="small mute">Lower is faster. ${ms.length} test${ms.length===1?"":"s"}${best?` · PR on ${best.date}`:""}${due?` · next test ${due}`:""}</p>
 <div class="row"><input id="mlT" inputmode="numeric" placeholder="Mile time 8:30"><input id="mlD" type="date" value="${dkey()}"><button class="btn" data-act="mileAdd">Log</button></div></section>`}
document.addEventListener("click",e=>{const b=e.target.closest("[data-act]");if(!b)return;const a=b.dataset.act,d=b.dataset,p=P();
 switch(a){
 case"weekEdit":sheet(weekForm(p));break;
 case"weekReset":{delete p.week;put("profiles",p);closeSheet();render();toast("Week reset");break}
 case"weekSave":{const w={days:p.days,custom:true,lift:[],run:[],fin:[],testEvery:+$("#wkTest").value,bump:Math.max(0,+$("#wkBump").value||0)};
  $$("#wkf input[data-wk]").forEach(i=>i.checked&&w[i.dataset.wk].push(+i.dataset.i));p.week=w;put("profiles",p);closeSheet();render();toast("Week saved");break}
 case"runNew":sheet(runForm(d.type));runPace();break;
 case"runEdit":sheet(runForm(null,d.id));runPace();break;
 case"runDel":if(confirm("Delete this run?")){del("runs",d.id);render()}break;
 case"runSave":{const sec=parseT($("#rnTime").value),dist=+$("#rnDist").value;if(!sec||!dist)return toast("Enter distance and time");
  const old=d.id?S.col.runs[d.id]:null,prevBest=miles().reduce((m,r)=>Math.min(m,r.sec),Infinity),type=$("#rnType").value;
  put("runs",{...(old||{}),id:old?.id||uid(),pid:S.active,date:$("#rnDate").value||dkey(),type,dist,sec,note:$("#rnNote").value.trim()});
  closeSheet();checkAch();render();toast(type==="mile"&&sec<prevBest&&prevBest<Infinity?`⏱️ New mile PR ${fmtSec(sec)}!`:`Run saved · ${fmtSec(sec/dist)}/mi`);break}
 case"mileAdd":{const sec=parseT($("#mlT").value);if(!sec)return toast("Enter time like 8:30");const prevBest=miles().reduce((m,r)=>Math.min(m,r.sec),Infinity);
  put("runs",{id:uid(),pid:S.active,date:$("#mlD").value||dkey(),type:"mile",dist:1,sec,note:""});checkAch();render();toast(sec<prevBest&&prevBest<Infinity?`⏱️ New mile PR ${fmtSec(sec)}!`:"Mile logged");break}
 }});
document.addEventListener("input",e=>{if(e.target.closest("#rnTime,#rnDist"))runPace()});
