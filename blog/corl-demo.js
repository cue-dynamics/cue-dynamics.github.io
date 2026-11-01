(async()=>{
 const root=document.querySelector('#corl-demo');if(!root)return;
 const data=await fetch('assets/corl-endpoints.json').then(r=>r.json());
 const videos=[...root.querySelectorAll('video')];const button=root.querySelector('button');
 const ns='http://www.w3.org/2000/svg';
 videos.forEach((video,i)=>{const svg=video.nextElementSibling;
  const markers=data[i].points.map(p=>{const ring=document.createElementNS(ns,'circle');ring.setAttribute('cx',p.predicted[0]);ring.setAttribute('cy',p.predicted[1]);ring.setAttribute('r','19');ring.setAttribute('fill','#d28bdf');ring.setAttribute('fill-opacity','0.5');svg.append(ring);
   const cross=document.createElementNS(ns,'path');const [x,y]=p.real;cross.setAttribute('d',`M${x-14} ${y}h28 M${x} ${y-14}v28`);cross.setAttribute('stroke','#6ee7ec');cross.setAttribute('stroke-width','6');svg.append(cross);return {p,ring,cross};});
  function update(){markers.forEach(({p,ring,cross})=>{ring.style.display=video.currentTime>=p.start?'':'none';cross.style.display=video.currentTime>=p.end?'':'none';});}video.addEventListener('timeupdate',update);update();
 });
 button.onclick=()=>{if(videos.some(v=>!v.paused&&!v.ended)){videos.forEach(v=>v.pause());button.textContent='Resume demos';}else{if(videos.every(v=>v.ended))videos.forEach(v=>v.currentTime=0);videos.forEach(v=>v.play());button.textContent='Pause demos';}};
 videos[0].addEventListener('ended',()=>button.textContent='Replay demos');
})();
