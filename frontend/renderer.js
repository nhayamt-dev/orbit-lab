// Trajetória 2D (x = alcance, y = altitude): trajetória completa em tracejado e trecho percorrido em destaque.
// createTrajectory(canvasId, labelId) -> { setData(D), draw(idx), size() }
function createTrajectory(canvasId,labelId){
  const GRID='#262046', GROUND='#5a4e92', PATH='#a78bfa', FUTURE='rgba(167,139,250,.30)', APEX='#56d9ff', TXT='#8077a8';
  const c=document.getElementById(canvasId), x=c.getContext('2d'), label=document.getElementById(labelId);
  const PAD={l:16,r:16,t:16,b:24};
  let W=0, H=0, D=null, x0=0, x1=1, y1=1, s=1, ox=0, oy=0;

  function layout(){
    if(!D||!W||!H) return;
    const spanX=Math.max(1e-6,x1-x0), spanY=Math.max(1e-6,y1);
    s=Math.min((W-PAD.l-PAD.r)/spanX,(H-PAD.t-PAD.b)/(spanY*1.1));
    ox=PAD.l+((W-PAD.l-PAD.r)-spanX*s)/2-x0*s;
    oy=H-PAD.b;
  }
  function size(){
    const r=c.getBoundingClientRect(), d=Math.min(devicePixelRatio||1,2);
    W=r.width; H=r.height; c.width=W*d; c.height=H*d; x.setTransform(d,0,0,d,0,0);
    layout();
  }
  function setData(data){
    D=data;
    x0=0; x1=0; y1=0;
    for(let j=0;j<D.N;j++){
      if(D.x[j]<x0)x0=D.x[j];
      if(D.x[j]>x1)x1=D.x[j];
      if(D.h[j]>y1)y1=D.h[j];
    }
    layout();
  }
  const PX=j=>ox+D.x[j]*s, PY=j=>oy-D.h[j]*s;

  function draw(i){
    x.clearRect(0,0,W,H); if(!D) return;
    const k=Math.min(D.N-1,Math.floor(i));
    x.font='10px IBM Plex Mono,monospace'; x.lineWidth=1;

    // grade horizontal e solo
    x.strokeStyle=GRID;
    for(let g=1;g<=4;g++){const yy=oy-g/4*y1*1.1*s; x.beginPath(); x.moveTo(PAD.l,yy); x.lineTo(W-PAD.r,yy); x.stroke()}
    x.strokeStyle=GROUND; x.beginPath(); x.moveTo(PAD.l,oy); x.lineTo(W-PAD.r,oy); x.stroke();
    x.fillStyle=TXT; x.textAlign='center';
    x.fillText('0',ox,H-8);
    if(x1>0) x.fillText(x1.toFixed(0)+' m',ox+x1*s,H-8);

    // trajetória completa (prevista)
    x.setLineDash([3,4]); x.strokeStyle=FUTURE; x.lineWidth=1.2; x.beginPath();
    for(let j=0;j<D.N;j++){j?x.lineTo(PX(j),PY(j)):x.moveTo(PX(j),PY(j))}
    x.stroke(); x.setLineDash([]);

    // trecho percorrido
    x.strokeStyle=PATH; x.lineWidth=2; x.lineJoin='round'; x.beginPath();
    for(let j=0;j<=k;j++){j?x.lineTo(PX(j),PY(j)):x.moveTo(PX(j),PY(j))}
    x.stroke();

    // apogeu
    if(k>=D.AP){
      const ax=PX(D.AP), ay=PY(D.AP);
      x.fillStyle=APEX; x.beginPath();
      x.moveTo(ax,ay-5); x.lineTo(ax+5,ay); x.lineTo(ax,ay+5); x.lineTo(ax-5,ay); x.closePath(); x.fill();
      x.fillStyle=TXT; x.textAlign='left'; x.fillText(D.h[D.AP].toFixed(1)+' m',ax+9,ay+3);
    }

    // posição atual
    const px=PX(k), py=PY(k);
    x.fillStyle='#ebe7fb'; x.beginPath(); x.arc(px,py,3.5,0,7); x.fill();
    x.strokeStyle=APEX; x.lineWidth=1.4; x.beginPath(); x.arc(px,py,9,0,7); x.stroke();

    if(label) label.textContent='x '+D.x[k].toFixed(1)+' · y '+D.h[k].toFixed(1);
  }
  size();
  return {setData,draw,size};
}
