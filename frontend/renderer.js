// Trajetória 2D (x = alcance, y = altitude), marcador sincronizado.
// createTrajectory(canvasId, labelId) -> { setData(D), draw(idx), size() }
function createTrajectory(canvasId,labelId){
  const c=document.getElementById(canvasId),x=c.getContext('2d');
  let W=0,H=0,D=null,XM=1,YM=1;
  function size(){
    const r=c.getBoundingClientRect(),d=devicePixelRatio||1;
    W=r.width;H=r.height;c.width=W*d;c.height=H*d;x.setTransform(d,0,0,d,0,0);
  }
  function setData(data){
    D=data;XM=Math.max(1e-6,...D.x.map(Math.abs));YM=Math.max(1e-6,...D.h);
  }
  function draw(i){
    x.clearRect(0,0,W,H);if(!D)return;
    const k=Math.min(D.N-1,Math.floor(i));
    const s=Math.min((H-26)/(YM*1.1),(W-30)/(2*XM*1.15)),ox=W/2,oy=H-14;
    x.strokeStyle='#1d1d1d';x.lineWidth=1;
    for(let g=0;g<=4;g++){const yy=oy-g/4*YM*1.1*s;x.beginPath();x.moveTo(0,yy);x.lineTo(W,yy);x.stroke()}
    x.strokeStyle='#444';x.beginPath();x.moveTo(0,oy);x.lineTo(W,oy);x.stroke();
    x.beginPath();
    for(let j=0;j<=k;j++){const px=ox+D.x[j]*s,py=oy-D.h[j]*s;j?x.lineTo(px,py):x.moveTo(px,py)}
    x.strokeStyle='#ff2b2b';x.lineWidth=1.8;x.stroke();
    if(k>=D.AP){x.strokeStyle='#7a0f0f';x.strokeRect(ox+D.x[D.AP]*s-4,oy-D.h[D.AP]*s-4,8,8)}
    const px=ox+D.x[k]*s,py=oy-D.h[k]*s;
    x.fillStyle='#fff';x.fillRect(px-3,py-3,6,6);
    x.strokeStyle='#ff2b2b';x.beginPath();x.arc(px,py,9,0,7);x.stroke();
    document.getElementById(labelId).textContent='x '+D.x[k].toFixed(1)+' · y '+D.h[k].toFixed(1);
  }
  size();
  return {setData,draw,size};
}
