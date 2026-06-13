// ── Hermes GUI (Fase: makkelijke web-console) ─────────────────────────────────
// Eén zelfstandige HTML-pagina die de HTTP-server serveert op / en /ui. Praat met
// de eigen API (/v1/chat/completions, /api/jobs, /api/skills, /api/memory). Geen
// build-stap, geen framework — vanilla JS. De API-token wordt lokaal opgeslagen.

export const UI_HTML = `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Hermes</title>
<style>
  :root{
    --bg:#0d0d0f; --panel:#151519; --panel2:#1c1c21; --border:#2a2a31;
    --text:#ECE9E2; --muted:#8d8a83; --accent:#C9A227; --accent2:#7FB069; --danger:#c2603f;
    --mono:ui-monospace,"SF Mono",Menlo,monospace;
    --sans:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
  }
  *{box-sizing:border-box}
  html,body{margin:0;height:100%}
  body{background:var(--bg);color:var(--text);font-family:var(--sans);font-size:15px;line-height:1.55;display:grid;grid-template-columns:1fr 280px;grid-template-rows:56px 1fr;height:100vh}
  header{grid-column:1/3;display:flex;align-items:center;gap:14px;padding:0 20px;border-bottom:1px solid var(--border)}
  header .logo{font-weight:600;letter-spacing:.02em;font-size:17px}
  header .dot{width:8px;height:8px;border-radius:50%;background:var(--muted);transition:background .3s}
  header .dot.on{background:var(--accent2)}
  header .spacer{flex:1}
  header input{background:var(--panel2);border:1px solid var(--border);color:var(--text);font-family:var(--mono);font-size:12px;padding:6px 9px;border-radius:7px;width:200px}
  header input:focus{outline:none;border-color:var(--accent)}
  /* chat */
  main{display:flex;flex-direction:column;min-width:0;min-height:0}
  #log{flex:1;overflow-y:auto;padding:24px clamp(20px,6vw,80px);display:flex;flex-direction:column;gap:18px}
  .msg{max-width:760px;white-space:pre-wrap;word-wrap:break-word}
  .msg .who{font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:5px}
  .msg.user{align-self:flex-end;text-align:right}
  .msg.user .bubble{background:var(--panel2);border:1px solid var(--border);padding:10px 14px;border-radius:12px;display:inline-block;text-align:left}
  .msg.assistant .bubble{color:var(--text)}
  .empty{color:var(--muted);margin:auto;text-align:center;max-width:420px}
  .empty h2{font-weight:500;font-size:20px;color:var(--text);margin:0 0 8px}
  /* composer */
  .composer{border-top:1px solid var(--border);padding:14px clamp(20px,6vw,80px);display:flex;gap:10px;align-items:flex-end}
  textarea{flex:1;resize:none;background:var(--panel2);border:1px solid var(--border);color:var(--text);font-family:var(--sans);font-size:15px;padding:11px 13px;border-radius:10px;max-height:180px;min-height:46px}
  textarea:focus{outline:none;border-color:var(--accent)}
  button{font-family:var(--sans);font-size:14px;font-weight:500;cursor:pointer;border:1px solid var(--border);background:var(--panel2);color:var(--text);padding:11px 18px;border-radius:10px;transition:background .15s,border-color .15s}
  button:hover{border-color:var(--accent)}
  button.primary{background:var(--accent);border-color:var(--accent);color:#1a1505}
  button.primary:disabled{opacity:.5;cursor:default}
  /* sidebar */
  aside{border-left:1px solid var(--border);background:var(--panel);overflow-y:auto;display:flex;flex-direction:column}
  .tabs{display:flex;border-bottom:1px solid var(--border)}
  .tabs button{flex:1;border:0;border-radius:0;background:transparent;color:var(--muted);padding:12px 4px;font-size:11px;border-bottom:2px solid transparent}
  .tabs button.active{color:var(--text);border-bottom-color:var(--accent)}
  .panel{padding:16px;display:none}
  .panel.active{display:block}
  .row{padding:9px 0;border-bottom:1px solid var(--border)}
  .row:last-child{border:0}
  .row .k{font-family:var(--mono);font-size:11px;color:var(--muted)}
  .row .v{font-size:14px}
  .item{padding:10px 0;border-bottom:1px solid var(--border)}
  .item:last-child{border:0}
  .item .name{font-family:var(--mono);font-size:13px;color:var(--accent2)}
  .item .desc{font-size:12px;color:var(--muted);margin-top:2px}
  .item .run{font-size:11px;padding:4px 9px;margin-top:6px}
  .search{width:100%;background:var(--panel2);border:1px solid var(--border);color:var(--text);padding:8px 10px;border-radius:8px;font-size:13px;margin-bottom:10px}
  .search:focus{outline:none;border-color:var(--accent)}
  .muted{color:var(--muted);font-size:13px}
  @media(max-width:760px){body{grid-template-columns:1fr}aside{display:none}}
</style>
</head>
<body>
  <header>
    <span class="dot" id="dot"></span>
    <span class="logo">Hermes</span>
    <span class="muted" id="model" style="font-family:var(--mono);font-size:12px"></span>
    <span class="spacer"></span>
    <input id="token" type="password" placeholder="API-token (Bearer)" />
  </header>

  <main>
    <div id="log"><div class="empty"><h2>Hermes-console</h2><div>Praat met je agent op je Claude Max-abonnement. Stel een vraag of geef een opdracht.</div></div></div>
    <div class="composer">
      <textarea id="input" placeholder="Typ een opdracht…  (Enter = versturen, Shift+Enter = nieuwe regel)" rows="1"></textarea>
      <button class="primary" id="send">Stuur</button>
    </div>
  </main>

  <aside>
    <div class="tabs">
      <button data-tab="status" class="active">Status</button>
      <button data-tab="jobs">Jobs</button>
      <button data-tab="skills">Skills</button>
      <button data-tab="memory">Geheugen</button>
    </div>
    <div class="panel active" id="p-status"><div class="muted">Laden…</div></div>
    <div class="panel" id="p-jobs"><div class="muted">Laden…</div></div>
    <div class="panel" id="p-skills"><div class="muted">Laden…</div></div>
    <div class="panel" id="p-memory">
      <input class="search" id="memq" placeholder="Zoek in eerdere gesprekken…" />
      <div id="memres" class="muted">Typ om te zoeken.</div>
    </div>
  </aside>

<script>
const $=s=>document.querySelector(s);
const tokenEl=$("#token"), dot=$("#dot"), log=$("#log");
tokenEl.value=localStorage.getItem("hermes_token")||"";
tokenEl.addEventListener("change",()=>{localStorage.setItem("hermes_token",tokenEl.value);refresh()});
const auth=()=>({Authorization:"Bearer "+tokenEl.value});
let sessionId=null, busy=false;

async function api(path){try{const r=await fetch(path,{headers:auth()});if(!r.ok)return null;return await r.json()}catch{return null}}

function bubble(who,cls){
  const e=document.querySelector(".empty"); if(e)e.remove();
  const m=document.createElement("div"); m.className="msg "+cls;
  m.innerHTML='<div class="who">'+who+'</div><div class="bubble"></div>';
  log.appendChild(m); log.scrollTop=log.scrollHeight; return m.querySelector(".bubble");
}

async function send(){
  const text=$("#input").value.trim(); if(!text||busy)return;
  if(!tokenEl.value){alert("Vul eerst je API-token in (rechtsboven).");return}
  busy=true; $("#send").disabled=true; $("#input").value="";
  bubble("Jij","user").textContent=text;
  const out=bubble("Hermes","assistant");
  try{
    const r=await fetch("/v1/chat/completions",{method:"POST",headers:{...auth(),"Content-Type":"application/json"},
      body:JSON.stringify({stream:true,session_id:sessionId,messages:[{role:"user",content:text}]})});
    if(!r.ok){out.textContent="⚠️ "+r.status+" — token correct?";busy=false;$("#send").disabled=false;return}
    const reader=r.body.getReader(), dec=new TextDecoder(); let buf="";
    for(;;){const {done,value}=await reader.read(); if(done)break; buf+=dec.decode(value,{stream:true});
      const parts=buf.split("\\n\\n"); buf=parts.pop();
      for(const p of parts){const line=p.trim(); if(!line.startsWith("data:"))continue;
        const data=line.slice(5).trim(); if(data==="[DONE]")continue;
        try{const j=JSON.parse(data); if(j.session_id)sessionId=j.session_id;
          const d=j.choices?.[0]?.delta?.content; if(d){out.textContent+=d;log.scrollTop=log.scrollHeight}}catch{}}}
  }catch(err){out.textContent="⚠️ "+err.message}
  busy=false; $("#send").disabled=false; $("#input").focus();
}
$("#send").onclick=send;
$("#input").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}
  e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,180)+"px"});

// tabs
document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>{
  document.querySelectorAll(".tabs button").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll(".panel").forEach(x=>x.classList.remove("active"));
  b.classList.add("active"); $("#p-"+b.dataset.tab).classList.add("active");
});

async function runJob(name){await fetch("/api/jobs/"+encodeURIComponent(name)+"/run",{method:"POST",headers:auth()});loadJobs()}
window.runJob=runJob;

async function loadStatus(){
  const models=await api("/v1/models"), jobs=await api("/api/jobs"), skills=await api("/api/skills"), mem=await api("/api/memory/profile");
  const ok=!!models; dot.classList.toggle("on",ok);
  $("#model").textContent=models?.data?.[0]?.id||"";
  $("#p-status").innerHTML = ok ? [
    ['model',models.data[0].id],['jobs',(jobs?.data?.length??0)+''],['skills',(skills?.data?.length??0)+''],
    ['geheugen',(mem?.stats?.turns??0)+' turns, '+(mem?.stats?.facts??0)+' feiten']
  ].map(([k,v])=>'<div class="row"><div class="k">'+k+'</div><div class="v">'+v+'</div></div>').join('')
  : '<div class="muted">Niet verbonden. Vul je API-token in (rechtsboven).</div>';
}
async function loadJobs(){const j=await api("/api/jobs");
  $("#p-jobs").innerHTML=(j?.data?.length)? j.data.map(x=>'<div class="item"><div class="name">'+x.name+'</div><div class="desc">'+(x.cron||'')+'</div><button class="run" onclick="runJob(\\''+x.name.replace(/'/g,"")+'\\')">Run nu</button></div>').join('') : '<div class="muted">Geen jobs (of niet verbonden).</div>';}
async function loadSkills(){const s=await api("/api/skills");
  $("#p-skills").innerHTML=(s?.data?.length)? s.data.map(x=>'<div class="item"><div class="name">/'+x.name+'</div><div class="desc">'+(x.description||'')+'</div></div>').join('') : '<div class="muted">Nog geen skills.</div>';}
let memT; $("#memq").addEventListener("input",e=>{clearTimeout(memT);memT=setTimeout(async()=>{
  const q=e.target.value.trim(); if(!q){$("#memres").innerHTML='<div class="muted">Typ om te zoeken.</div>';return}
  const r=await api("/api/memory/search?q="+encodeURIComponent(q));
  $("#memres").innerHTML=(r?.data?.length)? r.data.map(h=>'<div class="item"><div class="desc">'+(h.ts||'').slice(0,10)+' · '+h.source+'</div>'+h.text.slice(0,200).replace(/</g,"&lt;")+'</div>').join('') : '<div class="muted">Niets gevonden.</div>';
},300)});

function refresh(){loadStatus();loadJobs();loadSkills()}
refresh(); setInterval(loadStatus,15000);
</script>
</body>
</html>`;
