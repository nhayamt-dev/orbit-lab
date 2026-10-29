// ORBIT LAB — modelo 3D ilustrativo do simulador (Three.js 0.180, módulo ES).
// NÃO é CFD: reflete atitude, chama e altura relativa dos estados calculados pelo backend.
//
// createRocket3D(viewId, canvasId, errId) -> Promise<{ ok, render(state), dispose() }>
//
// state: { tilt, flame, thrustNorm, hNorm, vectors, vx, vy, vNorm, dragNorm }
//   tilt = -atan2(vx, vy) alinha o nariz à velocidade (rotação em Z, nariz em +Y quando tilt = 0).
// Controles: arrastar gira a câmera, roda do mouse dá zoom, duplo clique restaura, tecla V alterna vetores.
import * as THREE from 'three';

const PIXEL_RATIO_CAP = 1.5;
const MODEL_SCALE = 2.8;
const HEIGHT_SHIFT = 0.8;      // deslocamento vertical total do foguete na vista
const GROUND_BASE_Y = -1.55;   // piso na altitude zero
const GROUND_TRAVEL = 7;       // quanto o piso desce quando hNorm = 1
const DEFAULT_AZ = 0.55;
const DEFAULT_POL = 1.5;
const DEFAULT_DIST = 10;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function buildRocket(envTexture) {
  // Eixo longitudinal do modelo: +Z (nariz em +Z). O invólucro da cena converte para +Y.
  const rocket = new THREE.Group();

  const pbr = (params, envMapIntensity = 1) =>
    new THREE.MeshStandardMaterial({ envMap: envTexture, envMapIntensity, ...params });

  const titanium = pbr({ color: '#cfd6e4', metalness: 0.85, roughness: 0.28, side: THREE.DoubleSide });
  const ceramic = pbr({ color: '#f2f4fa', metalness: 0.15, roughness: 0.32, side: THREE.DoubleSide }, 0.7);
  const darkMetal = pbr({ color: '#2a3046', metalness: 0.9, roughness: 0.35 });
  const accent = pbr({
    color: '#a78bfa', metalness: 0.5, roughness: 0.3,
    emissive: '#2a1a5a', emissiveIntensity: 0.4, side: THREE.DoubleSide
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: '#6fe3ff', metalness: 0.1, roughness: 0.08, clearcoat: 1,
    emissive: '#0b7fb0', emissiveIntensity: 0.7,
    envMap: envTexture, envMapIntensity: 1.2
  });

  function cylZ(radiusTop, radiusBottom, height, segments, material, z, open = false) {
    const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments, 1, open);
    geometry.rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = z;
    return mesh;
  }

  const R0 = 0.085;

  // Fuselagem torneada e ogiva.
  const hullProfile = [[0.058, -0.30], [0.075, -0.27], [0.085, -0.22], [R0, 0.16]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const hull = new THREE.LatheGeometry(hullProfile, 48);
  hull.rotateX(Math.PI / 2);
  rocket.add(new THREE.Mesh(hull, ceramic));

  const noseProfile = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    noseProfile.push(new THREE.Vector2(R0 * Math.sqrt(1 - Math.pow(t, 1.8)), 0.16 + 0.42 * t));
  }
  const nose = new THREE.LatheGeometry(noseProfile, 48);
  nose.rotateX(Math.PI / 2);
  rocket.add(new THREE.Mesh(nose, titanium));

  // Faixa roxa e anéis de junção.
  rocket.add(cylZ(0.0865, 0.0865, 0.05, 48, accent, 0.03));
  rocket.add(cylZ(0.0875, 0.0875, 0.012, 48, darkMetal, -0.20));
  rocket.add(cylZ(0.0875, 0.0875, 0.012, 48, darkMetal, 0.15));

  // Janela: aro + vidro.
  const ring = new THREE.TorusGeometry(0.03, 0.006, 12, 40);
  ring.rotateX(Math.PI / 2);
  const ringMesh = new THREE.Mesh(ring, darkMetal);
  ringMesh.position.set(0, 0.0865, 0.08);
  rocket.add(ringMesh);

  const glassMesh = new THREE.Mesh(new THREE.SphereGeometry(0.028, 24, 16), glass);
  glassMesh.scale.set(1, 0.3, 1);
  glassMesh.position.set(0, 0.085, 0.08);
  rocket.add(glassMesh);

  // Quatro aletas com volume.
  const finShape = new THREE.Shape();
  finShape.moveTo(0.082, -0.02);
  finShape.lineTo(0.20, -0.22);
  finShape.lineTo(0.20, -0.33);
  finShape.lineTo(0.082, -0.28);
  finShape.closePath();
  const finGeometry = new THREE.ExtrudeGeometry(finShape, { depth: 0.014, bevelEnabled: false });
  finGeometry.translate(0, 0, -0.007);
  finGeometry.rotateX(Math.PI / 2);
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(finGeometry, accent);
    fin.rotation.z = (i * Math.PI) / 2;
    rocket.add(fin);
  }

  // Bocal e fundo escuro.
  rocket.add(cylZ(0.05, 0.075, 0.10, 40, titanium, -0.35, true));
  rocket.add(cylZ(0.05, 0.05, 0.01, 32, darkMetal, -0.33));

  // Chama em duas camadas: a base fica na origem do mesh e o ápice aponta para -Z.
  function flameCone(radius, length, color, opacity) {
    const geometry = new THREE.ConeGeometry(radius, length, 32, 1);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, 0, -length / 2);
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
      })
    );
    mesh.position.z = -0.40;
    return mesh;
  }
  const flameOuter = flameCone(0.06, 0.38, '#9b6cff', 0.62);
  const flameCore = flameCone(0.032, 0.24, '#9ff0ff', 0.95);
  rocket.add(flameOuter, flameCore);

  const engineGlow = new THREE.PointLight('#9b6cff', 0, 5, 2);
  engineGlow.position.z = -0.52;
  rocket.add(engineGlow);

  return { rocket, flameOuter, flameCore, engineGlow };
}

export async function createRocket3D(viewId, canvasId, errId) {
  const view = document.getElementById(viewId);
  const canvas = document.getElementById(canvasId);
  const errBox = document.getElementById(errId);
  const stub = { ok: false, render() {}, dispose() {} };

  if (!view || !canvas) return stub;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: true, powerPreference: 'low-power'
    });
  } catch (error) {
    console.warn('ORBIT LAB: WebGL indisponível; modelo 3D desativado.', error);
    if (errBox) {
      errBox.textContent = 'WebGL indisponível — modelo 3D desativado';
      errBox.style.display = 'grid';
    }
    return stub;
  }

  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PIXEL_RATIO_CAP));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;

  // Ambiente para reflexos metálicos.
  let envTexture = null;
  try {
    const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
    const pmrem = new THREE.PMREMGenerator(renderer);
    envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
  } catch (error) {
    console.warn('ORBIT LAB: ambiente de reflexos indisponível; usando iluminação direta.', error);
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const target = new THREE.Vector3(0, 0, 0);

  const key = new THREE.DirectionalLight('#fff1de', 3);
  key.position.set(4, 6, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#a78bfa', 1.6);
  rim.position.set(-5, -1, -4);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight('#6a7fd0', '#0a0914', 0.7));

  // Hierarquia: attitude (posição + inclinação de voo em Z) > spin (orientação da janela)
  //             > model (converte o eixo do modelo +Z para +Y) > scaled > rocket.
  const attitude = new THREE.Group();
  const spin = new THREE.Group();
  const model = new THREE.Group();
  const scaled = new THREE.Group();
  scene.add(attitude);
  attitude.add(spin);
  spin.add(model);
  model.add(scaled);
  model.rotation.x = -Math.PI / 2;
  spin.rotation.y = Math.PI;
  scaled.scale.setScalar(MODEL_SCALE);

  const { rocket, flameOuter, flameCore, engineGlow } = buildRocket(envTexture);
  rocket.position.z = 0.1; // centraliza o conjunto (corpo + chama) na origem
  scaled.add(rocket);

  // Piso em grade: desce conforme o foguete ganha altitude.
  const ground = new THREE.GridHelper(18, 18, 0x7c5cf0, 0x2b2358);
  ground.material.transparent = true;
  ground.material.opacity = 0.4;
  ground.material.depthWrite = false;
  scene.add(ground);

  // Vetores de direção (comprimento apenas relativo).
  function makeArrow(color) {
    const arrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 1, color, 0.22, 0.12
    );
    for (const part of [arrow.line, arrow.cone]) {
      part.material.depthTest = false;
      part.material.transparent = true;
      part.material.opacity = 0.92;
      part.renderOrder = 10;
    }
    arrow.visible = false;
    scene.add(arrow);
    return arrow;
  }
  const velArrow = makeArrow('#56d9ff');
  const dragArrow = makeArrow('#ff5b8a');
  const weightArrow = makeArrow('#b7a4ff');
  const dir = new THREE.Vector3();
  let vectorsOn = true;

  function setArrow(arrow, dx, dy, length) {
    const mag = Math.hypot(dx, dy);
    if (!vectorsOn || mag < 1e-9 || length < 0.05) {
      arrow.visible = false;
      return;
    }
    dir.set(dx / mag, dy / mag, 0);
    arrow.position.copy(attitude.position);
    arrow.setDirection(dir);
    arrow.setLength(length, Math.min(0.28, length * 0.4), 0.14);
    arrow.visible = true;
  }

  function updateVectors(s) {
    if (!s.vectors) {
      velArrow.visible = dragArrow.visible = weightArrow.visible = false;
      return;
    }
    const vx = s.vx || 0;
    const vy = s.vy || 0;
    const moving = Math.hypot(vx, vy) > 0.3;
    setArrow(velArrow, vx, vy, moving ? 0.8 + 1.4 * clamp(s.vNorm || 0, 0, 1) : 0);
    setArrow(dragArrow, -vx, -vy, moving && (s.dragNorm || 0) > 0.01 ? 0.4 + 0.9 * clamp(s.dragNorm, 0, 1) : 0);
    setArrow(weightArrow, 0, -1, 1.0);
  }

  // Câmera orbital.
  let az = DEFAULT_AZ;
  let pol = DEFAULT_POL;
  let dist = DEFAULT_DIST;

  function updateCamera() {
    const sp = Math.sin(pol);
    camera.position.set(
      target.x + dist * sp * Math.sin(az),
      target.y + dist * Math.cos(pol),
      target.z + dist * sp * Math.cos(az)
    );
    camera.lookAt(target);
  }

  // Estado e desenho (sob demanda, sem laço contínuo).
  let state = { tilt: 0, flame: false, hNorm: 0, vectors: false };
  let drawQueued = false;

  function draw() {
    drawQueued = false;
    const s = state;
    const t = performance.now() / 1000;
    const hNorm = clamp(s.hNorm || 0, 0, 1);

    attitude.position.y = (hNorm - 0.5) * HEIGHT_SHIFT;
    attitude.rotation.z = s.tilt || 0;
    ground.position.y = GROUND_BASE_Y - hNorm * GROUND_TRAVEL;

    const on = !!s.flame;
    flameOuter.visible = on;
    flameCore.visible = on;
    if (on) {
      const len = 0.55 + 0.45 * clamp(s.thrustNorm ?? 1, 0, 1);
      const pulse = 0.93 + 0.06 * Math.sin(t * 23) + 0.04 * Math.sin(t * 37 + 1.3) + 0.03 * Math.sin(t * 11);
      flameOuter.scale.set(1 + 0.05 * Math.sin(t * 29), 1 + 0.05 * Math.sin(t * 31 + 2), len * pulse);
      flameCore.scale.set(1, 1, len * (0.9 + 0.1 * Math.sin(t * 41 + 0.7)));
      flameOuter.material.opacity = 0.6 + 0.08 * Math.sin(t * 17);
    }
    engineGlow.intensity = on ? 6 + 1.2 * Math.sin(t * 19) : 0;

    updateVectors(s);
    updateCamera();
    renderer.render(scene, camera);
  }

  function requestDraw() {
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(draw);
  }

  function render(next) {
    state = next || state;
    draw();
  }

  function resize() {
    const w = view.clientWidth;
    const h = view.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    requestDraw();
  }

  const observer = new ResizeObserver(resize);
  observer.observe(view);

  // Interação (mouse e toque).
  canvas.style.touchAction = 'none';
  let dragging = false;
  let px = 0;
  let py = 0;

  const onDown = (e) => {
    dragging = true;
    px = e.clientX;
    py = e.clientY;
    canvas.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    if (!dragging) return;
    az -= (e.clientX - px) * 0.008;
    pol = clamp(pol - (e.clientY - py) * 0.006, 0.8, 1.95);
    px = e.clientX;
    py = e.clientY;
    requestDraw();
  };
  const onUp = () => { dragging = false; };
  const onWheel = (e) => {
    e.preventDefault();
    dist = clamp(dist + e.deltaY * 0.01, 6, 16);
    requestDraw();
  };
  const onDouble = () => {
    az = DEFAULT_AZ;
    pol = DEFAULT_POL;
    dist = DEFAULT_DIST;
    requestDraw();
  };
  const onKey = (e) => {
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'v' || e.key === 'V') {
      vectorsOn = !vectorsOn;
      requestDraw();
    }
  };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('dblclick', onDouble);
  window.addEventListener('keydown', onKey);

  canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());
  canvas.addEventListener('webglcontextrestored', requestDraw);

  function dispose() {
    observer.disconnect();
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('dblclick', onDouble);
    window.removeEventListener('keydown', onKey);

    scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    if (envTexture) envTexture.dispose();
    renderer.dispose();
  }

  window.addEventListener('pagehide', (e) => { if (!e.persisted) dispose(); }, { once: true });

  resize();
  draw();
  return { ok: true, render, dispose };
}
