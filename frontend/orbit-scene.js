import * as THREE from 'three';

// ---------- Parâmetros de composição (ajuste aqui) ----------
const EARTH_RADIUS_BY_WIDTH = 0.62;   // raio da Terra = fração da largura do painel
const EARTH_RADIUS_BY_HEIGHT = 0.56;  // ...limitado por esta fração da altura
const EARTH_OFFSET_X = 0.08;          // deslocamento do centro (fração da largura do painel)
const PIXEL_RATIO_CAP = 1.5;

const panel = document.querySelector('.space-panel');

if (panel) {
  boot().catch((error) => {
    console.warn('ORBIT LAB: cena 3D indisponível.', error);
  });
}

async function boot() {
  const canvas = document.createElement('canvas');
  canvas.id = 'orbit-scene';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'low-power'
    });
  } catch (error) {
    console.warn('ORBIT LAB: WebGL indisponível; a página segue sem a cena 3D.', error);
    canvas.remove();
    return;
  }

  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PIXEL_RATIO_CAP));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  panel.classList.add('has-3d-scene');

  // Ambiente para reflexos metálicos (só foguete e satélites; a Terra não usa).
  let envTexture = null;
  try {
    const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
    const pmrem = new THREE.PMREMGenerator(renderer);
    envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
  } catch (error) {
    console.warn('ORBIT LAB: ambiente de reflexos indisponível; usando iluminação direta.', error);
  }

  const pbr = (params, envMapIntensity = 1) =>
    new THREE.MeshStandardMaterial({ envMap: envTexture, envMapIntensity, ...params });

  // ---------- Cena e câmera ----------
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(22, 1, 1, 60);
  camera.position.set(0, 0, 16);

  const sunDir = new THREE.Vector3(0.8, 0.35, 0.6).normalize();

  const sun = new THREE.DirectionalLight('#fff1de', 3.2);
  sun.position.copy(sunDir).multiplyScalar(20);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight('#4a68b8', '#07070f', 0.55));

  // Tudo o que pertence ao sistema orbital fica em `root` (1 unidade = raio da Terra).
  const root = new THREE.Group();
  scene.add(root);

  // ---------- Terra ----------
  const planetGroup = new THREE.Group();
  planetGroup.rotation.z = THREE.MathUtils.degToRad(-12);
  root.add(planetGroup);

  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(1, 96, 64),
    new THREE.MeshStandardMaterial({ color: '#2a5d9f', roughness: 0.9, metalness: 0 })
  );
  planetGroup.add(planet);

  new THREE.TextureLoader().load(
    './assets/earth-texture.jpg',
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
      planet.material.map = texture;
      planet.material.color.set('#ffffff');
      planet.material.needsUpdate = true;
      invalidate();
    },
    undefined,
    (error) => console.warn('ORBIT LAB: textura da Terra indisponível; mantendo cor sólida.', error)
  );

  // Halo atmosférico fino, mais forte no lado iluminado.
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.035, 64, 48),
    new THREE.ShaderMaterial({
      uniforms: {
        uSun: { value: sunDir.clone() },
        uColor: { value: new THREE.Color('#5aa7ff') }
      },
      vertexShader: `
        varying vec3 vN; varying vec3 vW; varying vec3 vV;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vW = normalize(mat3(modelMatrix) * normal);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uSun; uniform vec3 uColor;
        varying vec3 vN; varying vec3 vW; varying vec3 vV;
        void main() {
          float rim = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), 2.4);
          float lit = smoothstep(-0.35, 0.55, dot(normalize(vW), uSun));
          float a = rim * (0.18 + 0.82 * lit);
          gl_FragColor = vec4(uColor * 1.2, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  planetGroup.add(atmosphere);

  // ---------- Foguete (eixo longitudinal = +Z, nariz em +Z) ----------
  function cylZ(radiusTop, radiusBottom, height, segments, material, z, open = false) {
    const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments, 1, open);
    geometry.rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = z;
    return mesh;
  }

  function buildRocket() {
    const rocket = new THREE.Group();

    const titanium = pbr({ color: '#cfd6e4', metalness: 0.85, roughness: 0.28, side: THREE.DoubleSide });
    const ceramic = pbr({ color: '#f2f4fa', metalness: 0.15, roughness: 0.32, side: THREE.DoubleSide }, 0.7);
    const darkMetal = pbr({ color: '#2a3046', metalness: 0.9, roughness: 0.35 });
    const accent = pbr({
      color: '#a78bfa', metalness: 0.5, roughness: 0.3,
      emissive: '#2a1a5a', emissiveIntensity: 0.4
    });
    const glass = new THREE.MeshPhysicalMaterial({
      color: '#6fe3ff', metalness: 0.1, roughness: 0.08, clearcoat: 1,
      emissive: '#0b7fb0', emissiveIntensity: 0.7,
      envMap: envTexture, envMapIntensity: 1.2
    });

    const R0 = 0.085;

    // Fuselagem torneada (perfil suave) e ogiva.
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

    // Janela: aro + vidro (voltada para +Y).
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

    // Bocal (aberto, alargando para trás) e fundo escuro.
    rocket.add(cylZ(0.05, 0.075, 0.10, 40, titanium, -0.35, true));
    rocket.add(cylZ(0.05, 0.05, 0.01, 32, darkMetal, -0.33));

    // Chama em duas camadas; a base fica na origem e o ápice aponta para -Z.
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

    const engineGlow = new THREE.PointLight('#9b6cff', 1.2, 1.5, 2);
    engineGlow.position.z = -0.52;
    rocket.add(engineGlow);

    return { rocket, flameOuter, flameCore, engineGlow };
  }

  // ---------- Satélite ----------
  function buildSatellite() {
    const g = new THREE.Group();
    const bodyMat = pbr({ color: '#d9dbe8', metalness: 0.8, roughness: 0.3 });
    const foil = pbr({ color: '#c9a24a', metalness: 0.9, roughness: 0.35 });
    const dark = pbr({ color: '#2a3046', metalness: 0.9, roughness: 0.35 });
    const panelMat = pbr({
      color: '#2d4aa3', metalness: 0.55, roughness: 0.35,
      emissive: '#0a1a4a', emissiveIntensity: 0.5
    });

    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.16), bodyMat));
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.125, 0.05), foil);
    band.position.z = 0.04;
    g.add(band);

    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.012), dark);
      arm.position.x = side * 0.11;
      g.add(arm);
      const solar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.006, 0.13), panelMat);
      solar.position.x = side * 0.28;
      g.add(solar);
    }

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.1, 8), dark);
    antenna.position.y = 0.1;
    g.add(antenna);
    return g;
  }

  // ---------- Órbitas: círculos inclinados; objeto e linha usam a mesma geometria ----------
  const bodies = [];
  const N = new THREE.Vector3(0, 0, 1);
  const T = new THREE.Vector3();
  const X = new THREE.Vector3();
  const basis = new THREE.Matrix4();

  // Posiciona o objeto no ângulo dado e aponta o eixo +Z dele ao longo do movimento.
  function place(object, radius, angle, direction) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    object.position.set(c * radius, s * radius, 0);
    T.set(-s * direction, c * direction, 0);
    X.crossVectors(N, T);
    basis.makeBasis(X, N, T);
    object.quaternion.setFromRotationMatrix(basis);
  }

  function addBody({ object, radius, incl, tilt, speed, phase, color, opacity }) {
    const group = new THREE.Group();
    group.rotation.order = 'ZYX';
    group.rotation.x = incl;
    group.rotation.z = tilt;

    const points = [];
    for (let i = 0; i < 192; i++) {
      const a = (i / 192) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0));
    }
    group.add(new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false })
    ));

    group.add(object);
    root.add(group);

    const direction = Math.sign(speed) || 1;
    bodies.push({ object, radius, speed, angle: phase, direction });
    place(object, radius, phase, direction);
  }

  const { rocket, flameOuter, flameCore, engineGlow } = buildRocket();
  const flame = flameOuter; // referência mantida para a animação
  rocket.scale.setScalar(0.36);

  addBody({ object: rocket, radius: 1.30, incl: 1.10, tilt: -0.45, speed: 0.20, phase: 0.6,
            color: '#b69cff', opacity: 0.28 });

  const satelliteConfigs = [
    { radius: 1.18, incl: 1.05, tilt: 0.30, speed: 0.12, phase: 0.3, color: '#56d9ff' },
    { radius: 1.42, incl: -0.80, tilt: -0.50, speed: -0.085, phase: 2.0, color: '#9c83ff' },
    { radius: 1.62, incl: 1.35, tilt: 0.90, speed: 0.06, phase: 4.0, color: '#779eff' }
  ];
  for (const config of satelliteConfigs) {
    const satellite = buildSatellite();
    satellite.scale.setScalar(0.2);
    addBody({ object: satellite, opacity: 0.16, ...config });
  }

  // ---------- Layout: ancora a cena no .space-panel ----------
  const anchor = { visible: true };

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function layout() {
    const rect = panel.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const radiusPx = Math.min(rect.width * EARTH_RADIUS_BY_WIDTH, rect.height * EARTH_RADIUS_BY_HEIGHT);
    const cx = rect.left + rect.width * (0.5 + EARTH_OFFSET_X);
    const cy = rect.top + rect.height * 0.5;

    anchor.visible = rect.width > 0 && cy + radiusPx * 1.8 > 0 && cy - radiusPx * 1.8 < vh;

    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    const unitsPerPx = (2 * halfH) / vh;

    root.position.set((cx - vw / 2) * unitsPerPx, -(cy - vh / 2) * unitsPerPx, 0);
    root.scale.setScalar(radiusPx * unitsPerPx);
  }

  // ---------- Animação ----------
  const clock = new THREE.Clock();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let t = 0;
  let raf = 0;
  let running = false;
  let dirty = true;
  let queued = false;

  function step(dt) {
    t += dt;

    planet.rotation.y += dt * 0.035;
    root.rotation.set(Math.sin(t * 0.11) * 0.035, Math.sin(t * 0.07) * 0.05, 0);

    for (const b of bodies) {
      b.angle += b.speed * dt;
      place(b.object, b.radius, b.angle, b.direction);
    }

    // Motor: combinação de frequências, sem criar objetos por quadro.
    const pulse = 0.93 + 0.06 * Math.sin(t * 23) + 0.04 * Math.sin(t * 37 + 1.3) + 0.03 * Math.sin(t * 11);
    flameOuter.scale.set(1 + 0.05 * Math.sin(t * 29), 1 + 0.05 * Math.sin(t * 31 + 2), pulse);
    flameCore.scale.set(1, 1, 0.9 + 0.1 * Math.sin(t * 41 + 0.7));
    flameOuter.material.opacity = 0.6 + 0.08 * Math.sin(t * 17);
    engineGlow.intensity = 1.2 + 0.25 * Math.sin(t * 19);
  }

  function draw() {
    if (!anchor.visible) {
      renderer.clear();
      return;
    }
    renderer.render(scene, camera);
  }

  function wantsAnimation() {
    return !document.hidden && anchor.visible && !reduced.matches;
  }

  function frame() {
    if (!running) return;
    raf = requestAnimationFrame(frame);

    if (dirty) {
      layout();
      dirty = false;
      if (!wantsAnimation()) {
        stop();
        step(0);
        draw();
        return;
      }
    }

    step(Math.min(clock.getDelta(), 0.05));
    draw();
  }

  function start() {
    if (running) return;
    running = true;
    clock.getDelta();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  function flush() {
    if (dirty) {
      layout();
      dirty = false;
    }
    if (wantsAnimation()) {
      start();
    } else {
      stop();
      step(0);
      draw();
    }
  }

  function invalidate() {
    dirty = true;
    if (running || queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      flush();
    });
  }

  // ---------- Eventos e limpeza ----------
  const onResize = () => {
    resize();
    invalidate();
  };

  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('scroll', invalidate, { passive: true });
  document.addEventListener('visibilitychange', invalidate);
  reduced.addEventListener('change', invalidate);

  const observer = new ResizeObserver(invalidate);
  observer.observe(panel);

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    stop();
  });
  canvas.addEventListener('webglcontextrestored', invalidate);

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) invalidate();
  });

  window.addEventListener('pagehide', (event) => {
    stop();
    if (event.persisted) return;

    observer.disconnect();
    window.removeEventListener('resize', onResize);
    window.removeEventListener('scroll', invalidate);
    document.removeEventListener('visibilitychange', invalidate);

    scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          if (material.map) material.map.dispose();
          material.dispose();
        });
      }
    });
    if (envTexture) envTexture.dispose();
    renderer.dispose();
    canvas.remove();
  });

  resize();
  flush();
}
