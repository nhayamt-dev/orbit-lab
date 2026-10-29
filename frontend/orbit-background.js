(() => {
  if (document.getElementById('orbit-background')) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'orbit-background';
  canvas.setAttribute('aria-hidden', 'true');

  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '0'
  });

  document.body.prepend(canvas);

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let width = 0;
  let height = 0;
  let dpr = 1;
  let lastTime = 0;
  let elapsed = 0;
  let frame = 0;

  let seed = 92741;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const stars = Array.from({ length: 150 }, () => ({
    x: random(),
    y: random(),
    radius: 0.35 + random() * 1.1,
    phase: random() * Math.PI * 2,
    speed: 0.35 + random() * 0.8,
    blue: random() > 0.72
  }));

  const satellites = [
    { orbit: 0, phase: 0.2, speed: 0.10, size: 1.0, color: '#bba6ff' },
    { orbit: 1, phase: 2.5, speed: -0.075, size: 0.8, color: '#73dcff' },
    { orbit: 2, phase: 4.2, speed: 0.055, size: 0.65, color: '#d7ccff' }
  ];

  const orbits = [
    { x: 0.50, y: 0.36, rx: 0.44, ry: 0.19, angle: -0.20 },
    { x: 0.52, y: 0.54, rx: 0.56, ry: 0.26, angle: 0.25 },
    { x: 0.48, y: 0.73, rx: 0.43, ry: 0.17, angle: -0.32 }
  ];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawSatellite(x, y, angle, size, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-size * 13, 0);
    ctx.lineTo(size * 13, 0);
    ctx.stroke();

    ctx.globalAlpha = 0.78;
    ctx.fillStyle = '#27365f';
    ctx.strokeStyle = color;

    for (const side of [-1, 1]) {
      ctx.fillRect(side * size * 8 - size * 5, -size * 3, size * 5, size * 6);
      ctx.strokeRect(side * size * 8 - size * 5, -size * 3, size * 5, size * 6);

      ctx.beginPath();
      ctx.moveTo(side * size * 5, 0);
      ctx.lineTo(side * size * 8, 0);
      ctx.stroke();
    }

    ctx.fillStyle = '#e7e1ff';
    ctx.fillRect(-size * 3, -size * 3, size * 6, size * 6);

    ctx.fillStyle = '#8be7ff';
    ctx.fillRect(-size, -size, size * 2, size * 2);

    ctx.restore();
  }

  function render(time) {
    frame = requestAnimationFrame(render);

    if (!width || !height) return;

    const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.04) : 0;
    lastTime = time;

    if (!reducedMotion.matches) elapsed += dt;

    ctx.clearRect(0, 0, width, height);

    for (const star of stars) {
      const twinkle = reducedMotion.matches
        ? 0.7
        : 0.38 + (Math.sin(elapsed * star.speed + star.phase) + 1) * 0.30;

      ctx.globalAlpha = twinkle;
      ctx.fillStyle = star.blue ? '#9bcaff' : '#e9e2ff';
      ctx.beginPath();
      ctx.arc(star.x * width, star.y * height, star.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;

    satellites.forEach((sat, index) => {
      const orbit = orbits[sat.orbit];

      ctx.save();
      ctx.translate(orbit.x * width, orbit.y * height);
      ctx.rotate(orbit.angle);
      ctx.strokeStyle = '#9a82e9';
      ctx.globalAlpha = 0.10;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(0, 0, orbit.rx * width, orbit.ry * height, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      const angle = sat.phase + elapsed * sat.speed;
      const ox = Math.cos(angle) * orbit.rx * width;
      const oy = Math.sin(angle) * orbit.ry * height;
      const ca = Math.cos(orbit.angle);
      const sa = Math.sin(orbit.angle);
      const x = orbit.x * width + ox * ca - oy * sa;
      const y = orbit.y * height + ox * sa + oy * ca;

      drawSatellite(x, y, angle + orbit.angle, sat.size, sat.color);
    });

    ctx.globalAlpha = 1;
  }

  window.addEventListener('resize', resize, { passive: true });

  resize();
  render(0);

  window.addEventListener('pagehide', () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', resize);
  }, { once: true });
})();
