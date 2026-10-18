// Gráficos em canvas: curvas progressivas, cursor temporal, inspeção por mouse e clique para buscar instante.
// createChart(canvasId, series, onSeek) -> { setData(D), draw(idx), size() }
// series: [{k:'h', c:'#ff2b2b', n:'altitude (m)'}]  (k = chave em D)
function createChart(id, series, onSeek){
  const c=document.getElementById(id),x=c.getContext('2d'),P={l:38,r:8,t:8,b:16};
  let W=0,H=0,D=null,lo=0,hi=1,vis=series;
  const X=j=>P.l+D.t[j]/D.TT*(W-P.l-P.r);
  const Y=v=>P.t+(1-(v-lo)/(hi-lo))*(H-P.t-P.b);

  function size(){
    const r=c.getBoundingClientRect(),d=devicePixelRatio||1;
    W=r.width;H=r.height;c.width=W*d;c.height=H*d;x.setTransform(d,0,0,d,0,0);
  }
  function setData(data){
    D=data;
    vis=series.filter(s=>!D.missing.includes(s.k));
    let mn=0,mxv=0;
    vis.forEach(s=>D[s.k].forEach(v=>{if(v<mn)mn=v;if(v>mxv)mxv=v}));
    lo=mn;hi=(mxv||1)*1.08;
  }
  function draw(i){
    x.clearRect(0,0,W,H);if(!D)return;
    x.font='10px IBM Plex Mono,monospace';x.lineWidth=1;
    for(let g=0;g<=4;g++){
      const yy=P.t+g/4*(H-P.t-P.b);
      x.strokeStyle='#1d1d1d';x.beginPath();x.moveTo(P.l,yy);x.lineTo(W-P.r,yy);x.stroke();
      x.fillStyle='#6b6b6b';x.textAlign='right';x.fillText((hi-(hi-lo)*g/4).toFixed(hi>100?0:1),P.l-5,yy+3);
    }
    for(let g=0;g<=5;g++){
      const xx=P.l+g/5*(W-P.l-P.r);
      x.strokeStyle='#161616';x.beginPath();x.moveTo(xx,P.t);x.lineTo(xx,H-P.b);x.stroke();
      x.fillStyle='#6b6b6b';x.textAlign='center';x.fillText((D.TT*g/5).toFixed(1),xx,H-4);
    }
    const k=Math.min(D.N-1,Math.floor(i));
    if(k>=D.AP){ // apogeu
      x.setLineDash([3,3]);x.strokeStyle='#7a0f0f';x.beginPath();x.moveTo(X(D.AP),P.t);x.lineTo(X(D.AP),H-P.b);x.stroke();x.setLineDash([]);
    }
    vis.forEach((s,si)=>{
      const a=D[s.k];
      x.beginPath();
      for(let j=0;j<=k;j++){j?x.lineTo(X(j),Y(a[j])):x.moveTo(X(j),Y(a[j]))}
      x.strokeStyle=s.c;x.lineWidth=1.6;x.stroke();
      if(si===0&&vis.length<3){x.lineTo(X(k),Y(0));x.lineTo(X(0),Y(0));x.fillStyle='rgba(255,43,43,.10)';x.fill()}
      x.fillStyle=s.c;x.fillRect(X(k)-2.5,Y(a[k])-2.5,5,5);
    });
    x.strokeStyle='#fff';x.globalAlpha=.55;x.beginPath();x.moveTo(X(k),P.t);x.lineTo(X(k),H-P.b);x.stroke();x.globalAlpha=1;
  }
  function idxAt(ev){
    const r=c.getBoundingClientRect(),f=(ev.clientX-r.left-P.l)/(W-P.l-P.r);
    return Math.max(0,Math.min(D.N-1,Math.round(f*(D.N-1))));
  }
  const tip=document.getElementById('tip');
  c.addEventListener('mousemove',ev=>{
    if(!D)return;const j=idxAt(ev);
    tip.style.display='block';tip.style.left=ev.clientX+12+'px';tip.style.top=ev.clientY+12+'px';
    tip.textContent='t = '+D.t[j].toFixed(3)+' s\n'+vis.map(s=>s.n+' = '+D[s.k][j].toFixed(3)).join('\n');
  });
  c.addEventListener('mouseleave',()=>tip.style.display='none');
  c.addEventListener('click',ev=>{if(D&&onSeek)onSeek(idxAt(ev))});
  size();
  return {setData,draw,size};
}
