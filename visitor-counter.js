(()=>{
 const endpoint='https://cue-visitor-counter.xilunz2023.workers.dev';
 // One random receipt per document load; retries reuse it and cannot double count.
 const id=crypto.randomUUID();
 const path=location.pathname.startsWith('/blog')?'/blog/':'/';
 const output=document.getElementById('cue-pageview-total');
 function show(data){
  if(!output)return;
  if(!Number.isSafeInteger(data.pageviews)||data.pageviews<0)throw Error('Invalid count');
  const date=data.since?new Date(data.since).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'}):'tracking start';
  output.textContent=`${data.pageviews.toLocaleString()} page opens since ${date}`;
 }
 async function record(){
  for(let attempt=0;attempt<3;attempt++){
   try{
    const response=await fetch(endpoint+'/visit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,path}),signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error('Counter unavailable');show(await response.json());return;
   }catch{if(attempt<2)await new Promise(resolve=>setTimeout(resolve,1500*(attempt+1)));}
  }
  if(output)output.textContent='Visitor count temporarily unavailable';
 }
 async function refresh(){if(document.hidden||!output)return;try{const r=await fetch(endpoint+'/count',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(r.ok)show(await r.json());}catch{/* Keep the last successfully retrieved real total. */}}
 if(location.hostname!=='cue-dynamics.github.io'){if(output)output.textContent='Live count available on the published website';return;}
 if(document.visibilityState==='visible')record();else document.addEventListener('visibilitychange',function start(){if(!document.hidden){document.removeEventListener('visibilitychange',start);record();}});
 setInterval(refresh,30000);document.addEventListener('visibilitychange',refresh);
})();
