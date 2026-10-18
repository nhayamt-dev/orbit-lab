// Modelo 3D ilustrativo (Three.js r128). NÃO é CFD: só reflete atitude, chama e altura dos estados calculados.
// createRocket3D(viewId, canvasId, errId) -> { ok, render({tilt, flame, hNorm}) }
function createRocket3D(viewId,canvasId,errId){
  if(typeof THREE==='undefined'){document.getElementById(errId).style.display='grid';return {ok:false,render(){}}}
  const view=document.getElementById(viewId),cv=document.getElementById(canvasId);
  const renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true});
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,1,.1,100);
  let dist=9,rotY=.6,rotX=.15,drag=false,lx=0,ly=0;

  scene.add(new THREE.AmbientLight(0x555555));
  const key=new THREE.DirectionalLight(0xffffff,1.1);key.position.set(4,6,5);scene.add(key);
  const rim=new THREE.DirectionalLight(0xff2b2b,1.2);rim.position.set(-5,-2,-3);scene.add(rim);
  const M=(c,m,r)=>new THREE.MeshStandardMaterial({color:c,metalness:m,roughness:r});

  const tilt=new THREE.Group(),spin=new THREE.Group();tilt.add(spin);scene.add(tilt);
  spin.add(new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,3.2,48),M(0xd8d8d8,.7,.35)));
  const band=new THREE.Mesh(new THREE.CylinderGeometry(.505,.505,.28,48),M(0xff2b2b,.3,.5));band.position.y=.5;spin.add(band);
  const band2=band.clone();band2.scale.set(1,.4,1);band2.position.y=-.9;spin.add(band2);
  const nose=new THREE.Mesh(new THREE.ConeGeometry(.5,1.3,48),M(0x1a1a1a,.5,.4));nose.position.y=2.25;spin.add(nose);
  const nz=new THREE.Mesh(new THREE.CylinderGeometry(.3,.42,.4,32),M(0x222222,.9,.3));nz.position.y=-1.8;spin.add(nz);
  const sh=new THREE.Shape();sh.moveTo(0,0);sh.lineTo(.85,-.5);sh.lineTo(.85,-1.3);sh.lineTo(0,-.9);sh.lineTo(0,0);
  const fg=new THREE.ExtrudeGeometry(sh,{depth:.06,bevelEnabled:false});
  for(let i=0;i<4;i++){
    const f=new THREE.Mesh(fg,M(0xff2b2b,.3,.5)),p=new THREE.Group();
    f.position.set(.48,-.9,-.03);p.add(f);p.rotation.y=i*Math.PI/2;spin.add(p);
  }
  const flame=new THREE.Mesh(new THREE.ConeGeometry(.3,1.8,24),new THREE.MeshBasicMaterial({color:0xff5a2b,transparent:true,opacity:.85}));
  flame.rotation.x=Math.PI;flame.position.y=-2.9;flame.visible=false;spin.add(flame);

  function resize(){
    const w=view.clientWidth,h=view.clientHeight;if(!w||!h)return;
    renderer.setPixelRatio(devicePixelRatio);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(view);resize();

  cv.addEventListener('mousedown',e=>{drag=true;lx=e.clientX;ly=e.clientY});
  addEventListener('mouseup',()=>drag=false);
  addEventListener('mousemove',e=>{
    if(!drag)return;
    rotY+=(e.clientX-lx)*.01;rotX=Math.max(-1,Math.min(1,rotX+(e.clientY-ly)*.006));lx=e.clientX;ly=e.clientY;
  });
  cv.addEventListener('wheel',e=>{e.preventDefault();dist=Math.max(5,Math.min(16,dist+e.deltaY*.01))},{passive:false});

  function render(s){
    tilt.rotation.z=s.tilt||0;tilt.rotation.x=rotX;spin.rotation.y=rotY;
    flame.visible=!!s.flame;
    if(flame.visible){const t=performance.now();flame.scale.set(1+.15*Math.sin(t*.05),1+.2*Math.sin(t*.07),1+.15*Math.sin(t*.05))}
    tilt.position.y=((s.hNorm||0)-.5)*1.2;
    camera.position.set(0,0,dist);camera.lookAt(0,0,0);renderer.render(scene,camera);
  }
  return {ok:true,render};
}
