// Gráficos em canvas: curvas progressivas, cursor temporal, inspeção por mouse e clique para buscar instante.
// createChart(canvasId, series, onSeek) -> { setData(D), draw(idx), size() }
// series: [{k:'h', c:'#56d9ff', n:'altitude (m)'}]  (k = chave em D; cor em hex de 6 dígitos)
function createChart(id, series, onSeek){
  const GRID='#262046', GRID_V='#1b1736', AXIS='#8077a8', CURSOR='#ebe7fb', APOGEE='#8c75ed';
  const c=document.getElementById(id), x=c.getContext('2d'), P={l:42,r:10,t:22,b:18};
  let W=0, H=0, D=null, lo=0, hi=1, vis=series, hov=-1, lastI=0;

  const X=j=>P.l+D.t[j]/D.TT*(W-P.l-P.r);
  const Y=v=>P.t+(1-(v-lo)/(hi-lo))*(H-P.t-P.b);

  function rgba(hex,a){
    const n=parseInt(hex.slice(1),16);
    return 'rgba('+(n>>16&255)+','+(n>>8&255)+','+(n&255)+','+a+')';
  }
  function dec(v){return v>=100?0:v>=10?1:v>=1?2:3}

  function size(){
    const r=c.getBoundingClientRect(), d=Math.min(devicePixelRatio||1,2);
    W=r.width; H=r.height; c.width=W*d; c.height=H*d; x.setTransform(d,0,0,d,0,0);
  }
  function setData(data){
    D=data;
    vis=series.filter(s=>!D.missing.includes(s.k));
    let mn=0, mxv=0;
    vis.forEach(s=>D[s.k].forEach(v=>{if(v<mn)mn=v; if(v>mxv)mxv=v}));
    lo=mn; hi=(mxv||1)*1.08;
    hov=-1;
  }
  function draw(i){
    lastI=i;
    x.clearRect(0,0,W,H); if(!D) return;
    x.font='10px IBM Plex Mono,monospace'; x.lineWidth=1;

    // grade
    for(let g=0;g<=4;g++){
      const yy=P.t+g/4*(H-P.t-P.b);
      x.strokeStyle=GRID; x.beginPath(); x.moveTo(P.l,yy); x.lineTo(W-P.r,yy); x.stroke();
      x.fillStyle=AXIS; x.textAlign='right';
      const val=hi-(hi-lo)*g/4;
      x.fillText(val.toFixed(dec(Math.abs(hi))),P.l-6,yy+3);
    }
    for(let g=0;g<=5;g++){
      const xx=P.l+g/5*(W-P.l-P.r);
      x.strokeStyle=GRID_V; x.beginPath(); x.moveTo(xx,P.t); x.lineTo(xx,H-P.b); x.stroke();
      x.fillStyle=AXIS; x.textAlign='center'; x.fillText((D.TT*g/5).toFixed(1),xx,H-5);
    }

    const k=Math.min(D.N-1,Math.floor(i));

    // apogeu
    if(k>=D.AP){
      x.setLineDash([3,3]); x.strokeStyle=APOGEE;
      x.beginPath(); x.moveTo(X(D.AP),P.t); x.lineTo(X(D.AP),H-P.b); x.stroke();
      x.setLineDash([]);
    }

    // curvas
    vis.forEach(s=>{
      const a=D[s.k], line=new Path2D();
      for(let j=0;j<=k;j++){ j?line.lineTo(X(j),Y(a[j])):line.moveTo(X(j),Y(a[j])) }
      if(vis.length<3){
        const area=new Path2D(line);
        area.lineTo(X(k),Y(0)); area.lineTo(X(0),Y(0)); area.closePath();
        const gr=x.createLinearGradient(0,P.t,0,H-P.b);
        gr.addColorStop(0,rgba(s.c,.28)); gr.addColorStop(1,rgba(s.c,0));
        x.fillStyle=gr; x.fill(area);
      }
      x.strokeStyle=s.c; x.lineWidth=1.8; x.lineJoin='round'; x.stroke(line);
      x.fillStyle=s.c; x.fillRect(X(k)-2.5,Y(a[k])-2.5,5,5);
    });

    // cursor do instante atual
    x.lineWidth=1; x.strokeStyle=CURSOR; x.globalAlpha=.5;
    x.beginPath(); x.moveTo(X(k),P.t); x.lineTo(X(k),H-P.b); x.stroke(); x.globalAlpha=1;

    // posição do mouse
    if(hov>=0 && hov!==k){
      x.setLineDash([2,3]); x.strokeStyle=AXIS;
      x.beginPath(); x.moveTo(X(hov),P.t); x.lineTo(X(hov),H-P.b); x.stroke(); x.setLineDash([]);
      vis.forEach(s=>{
        x.strokeStyle=s.c; x.beginPath(); x.arc(X(hov),Y(D[s.k][hov]),3.5,0,7); x.stroke();
      });
    }

    // legenda interna (várias séries)
    if(vis.length>1){
      let xx=W-P.r; x.textAlign='right';
      for(let q=vis.length-1;q>=0;q--){
        const name=vis[q].n.split(' (')[0], w=x.measureText(name).width;
        x.fillStyle=AXIS; x.fillText(name,xx,13);
        x.fillStyle=vis[q].c; x.fillRect(xx-w-11,6,7,7);
        xx-=w+11+12;
      }
    }
  }
  // índice do estado mais próximo do tempo sob o mouse (busca por tempo, não por índice)
  function idxAt(ev){
    const r=c.getBoundingClientRect();
    const f=Math.max(0,Math.min(1,(ev.clientX-r.left-P.l)/(W-P.l-P.r)));
    const tt=f*D.TT; let a=0, b=D.N-1;
    while(b-a>1){const m=(a+b)>>1; if(D.t[m]<=tt)a=m; else b=m}
    return (tt-D.t[a]<=D.t[b]-tt)?a:b;
  }
  const tip=document.getElementById('tip');
  c.addEventListener('mousemove',ev=>{
    if(!D) return;
    const j=idxAt(ev);
    tip.style.display='block'; tip.style.left=ev.clientX+12+'px'; tip.style.top=ev.clientY+12+'px';
    tip.textContent='t = '+D.t[j].toFixed(3)+' s\n'+vis.map(s=>s.n+' = '+D[s.k][j].toFixed(3)).join('\n');
    if(j!==hov){hov=j; draw(lastI)}
  });
  c.addEventListener('mouseleave',()=>{tip.style.display='none'; if(hov>=0){hov=-1; draw(lastI)}});
  c.addEventListener('click',ev=>{if(D&&onSeek) onSeek(idxAt(ev))});
  size();
  return {setData,draw,size};
}
