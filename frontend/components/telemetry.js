// Telemetria: callouts do centro e faixa inferior. updateTelemetry(D, k, hasFlame)
const _$=id=>document.getElementById(id);
function _fmt(D,key,k,d){return D.missing.includes(key)?'–':D[key][k].toFixed(d)}
function updateTelemetry(D,k){
  _$('c1').innerHTML=_fmt(D,'h',k,1)+'<small>m</small>';
  _$('c2').innerHTML=_fmt(D,'v',k,1)+'<small>m/s</small>';
  _$('c3').innerHTML=_fmt(D,'a',k,1)+'<small>m/s²</small>';
  _$('c4').innerHTML=_fmt(D,'thrust',k,1)+'<small>N</small>';
  const kv=[[D.t[k].toFixed(2),'s'],[_fmt(D,'h',k,1),'m'],[_fmt(D,'v',k,1),'m/s'],[_fmt(D,'a',k,1),'m/s²'],[_fmt(D,'m',k,3),'kg'],[_fmt(D,'drag',k,2),'N']];
  kv.forEach((q,j)=>_$('k'+j).innerHTML=q[0]+'<small>'+q[1]+'</small>');
  const g=(key,den)=>D.missing.includes(key)||!den?0:D[key][k]/den;
  const fr=[D.t[k]/D.TT,g('h',D.max.h),g('v',D.max.v),g('a',D.max.a),g('m',D.m[0]),g('drag',D.max.drag)];
  fr.forEach((q,j)=>_$('b'+j).style.width=Math.max(0,Math.min(1,q))*100+'%');
}
