/* ORBIT LAB — integração com o backend Python.
   Módulo ES: o modelo 3D é carregado de forma isolada; se o Three.js falhar,
   o restante do painel (gráficos, telemetria, trajetória) continua funcionando. */

const SIM_ENDPOINT = "/api/simulate";
const MIN_ATTITUDE_SPEED = 0.3; // m/s: abaixo disso a direção da velocidade não é confiável
const $ = (id) => document.getElementById(id);

let D = null;
let idx = 0;
let playing = false;
let speed = 1;
let last = 0;
let raf = 0;

const REST_STATE = { tilt: 0, flame: false, hNorm: 0, vectors: false };
let rocket = { ok: false, render() {} };

const charts = [
  createChart("c_h", [{ k: "h", c: "#56d9ff", n: "altitude (m)" }], seek),
  createChart("c_v", [{ k: "v", c: "#a78bfa", n: "velocidade (m/s)" }], seek),
  createChart("c_e", [
    { k: "Ek", c: "#a78bfa", n: "Ec (J)" },
    { k: "Ep", c: "#56d9ff", n: "Ep (J)" }
  ], seek),
  createChart("c_f", [
    { k: "thrust", c: "#56d9ff", n: "empuxo (N)" },
    { k: "drag", c: "#ff5b8a", n: "arrasto (N)" },
    { k: "weight", c: "#b7a4ff", n: "peso (N)" }
  ], seek)
];

const traj = createTrajectory("cT", "xy");

// Carrega o 3D sem bloquear o resto da interface.
import("./rocket3d.js")
  .then((module) => module.createRocket3D("view", "gl", "err"))
  .then((instance) => {
    rocket = instance;
    paint();
  })
  .catch((error) => {
    console.warn("ORBIT LAB: modelo 3D indisponível.", error);
    const box = $("err");
    if (box) box.style.display = "grid";
  });

/* ---------- utilidades ---------- */

// Máximo sem espalhar o array em argumentos (evita RangeError em séries longas).
function maxOf(values, useAbs = false) {
  let m = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = useAbs ? Math.abs(values[i]) : values[i];
    if (v > m) m = v;
  }
  return m === -Infinity ? 0 : m;
}

function indexOfMax(values) {
  let best = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[best]) best = i;
  }
  return best;
}

// Inclinação do foguete em cada instante (rotação em Z; nariz em +Y quando 0).
// Segue a direção da velocidade, sem saltos de volta completa e interpolando
// os trechos de velocidade muito baixa (início e apogeu).
function buildAttitude(vx, vy, v) {
  const N = v.length;
  const tilt = new Array(N).fill(NaN);
  let current = 0;
  let started = false;

  for (let i = 0; i < N; i++) {
    if (!(v[i] > MIN_ATTITUDE_SPEED)) continue;

    let a = -Math.atan2(vx[i], vy[i]);
    if (started) {
      while (a - current > Math.PI) a -= 2 * Math.PI;
      while (a - current < -Math.PI) a += 2 * Math.PI;
    }
    tilt[i] = a;
    current = a;
    started = true;
  }

  if (!started) return tilt.fill(0);

  let prev = -1;
  for (let i = 0; i < N; i++) {
    if (Number.isNaN(tilt[i])) continue;

    if (prev === -1) {
      for (let j = 0; j < i; j++) tilt[j] = tilt[i];
    } else if (i - prev > 1) {
      for (let j = prev + 1; j < i; j++) {
        const f = (j - prev) / (i - prev);
        tilt[j] = tilt[prev] + (tilt[i] - tilt[prev]) * f;
      }
    }
    prev = i;
  }

  for (let j = prev + 1; j < N; j++) tilt[j] = tilt[prev];
  return tilt;
}

/* ---------- dados do backend ---------- */

function normalizeBackend(api) {
  if (!api || !Array.isArray(api.states) || !api.states.length) {
    throw new Error("A API não retornou estados da simulação.");
  }

  if (!api.analysis) {
    throw new Error("A API não retornou os dados da análise.");
  }

  const states = api.states;
  const a = api.analysis;
  const N = states.length;

  if (N < 2) {
    throw new Error("A simulação precisa ter pelo menos dois estados.");
  }

  const series = {
    t: states.map((s) => Number(s.time)),
    x: states.map((s) => Number(s.x)),
    h: states.map((s) => Number(s.y)),
    vx: states.map((s) => Number(s.vx)),
    vy: states.map((s) => Number(s.vy)),
    v: states.map((s) => Number(s.speed))
  };

  for (const key of ["t", "x", "h", "vx", "vy", "v"]) {
    if (series[key].some((value) => !Number.isFinite(value))) {
      throw new Error("A API retornou valores inválidos em " + key + ".");
    }
  }

  const mapping = {
    a: "acceleration_m_s2",
    thrust: "thrust_n",
    drag: "drag_n",
    weight: "weight_n",
    Ek: "kinetic_energy_j",
    Ep: "potential_energy_j"
  };

  for (const [key, apiKey] of Object.entries(mapping)) {
    if (!Array.isArray(a[apiKey]) || a[apiKey].length !== N) {
      throw new Error("A série " + apiKey + " está ausente ou tem tamanho incorreto.");
    }

    series[key] = a[apiKey].map(Number);

    if (series[key].some((value) => !Number.isFinite(value))) {
      throw new Error("A API retornou valores inválidos em " + apiKey + ".");
    }
  }

  // A API atual não fornece massa por estado. Não inventamos essa série.
  series.m = Array(N).fill(0);

  const t0 = series.t[0];
  series.t = series.t.map((t) => t - t0);
  series.N = N;
  series.TT = series.t[N - 1];
  series.DT = series.TT / (N - 1);
  series.AP = indexOfMax(series.h);
  series.max = {
    h: Math.max(0, maxOf(series.h)),
    v: Math.max(0, maxOf(series.v)),
    a: maxOf(series.a, true),
    drag: maxOf(series.drag, true),
    thrust: maxOf(series.thrust, true)
  };
  series.tilt = buildAttitude(series.vx, series.vy, series.v);
  series.missing = ["m"];
  series.derived = [];

  if (!(series.TT > 0) || !(series.DT > 0)) {
    throw new Error("A série temporal da API é inválida.");
  }

  return series;
}

function setData(data, label) {
  D = data;

  charts.forEach((chart) => chart.setData(D));
  traj.setData(D);

  $("src").textContent = "Fonte: " + label;
  $("n").textContent = D.N;
  $("dur").textContent = D.TT.toFixed(2) + " s";
  $("apx").textContent = D.h[D.AP].toFixed(2) + " m";
  $("apt").textContent = D.t[D.AP].toFixed(2) + " s";

  $("msg").className = "msg";
  $("msg").textContent =
    "Simulação calculada pelo backend Python. " +
    "Massa por estado indisponível na resposta atual.";

  reset();
}

function fail(message) {
  $("msg").className = "msg bad";
  $("msg").textContent = message;
  $("stx").textContent = "ERRO";
  console.error(message);
}

function readField(id) {
  const raw = $(id).value.trim().replace(",", ".");
  return raw === "" ? NaN : Number(raw);
}

async function simulate() {
  const payload = {
    thrust: readField("f_thrust"),
    duration: readField("f_duration"),
    angle: readField("f_angle")
  };

  if (
    !Number.isFinite(payload.thrust) ||
    !Number.isFinite(payload.duration) ||
    !Number.isFinite(payload.angle)
  ) {
    fail("Preencha empuxo, duração e ângulo com números válidos.");
    return;
  }

  $("stx").textContent = "CALCULANDO";
  pause(true);
  $("bsim").disabled = true;

  try {
    const response = await fetch(SIM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    let result;

    try {
      result = JSON.parse(text);
    } catch {
      throw new Error(
        response.ok
          ? "A API retornou uma resposta que não é JSON."
          : "Erro HTTP " + response.status + " (a resposta não é JSON). " +
            "Use o backend: python -m backend.main"
      );
    }

    if (!response.ok) {
      throw new Error((result && result.error) || "Erro HTTP " + response.status);
    }

    setData(normalizeBackend(result), "API Python " + SIM_ENDPOINT);
    play();
  } catch (error) {
    fail(error.message || "Falha ao executar a simulação.");
  } finally {
    $("bsim").disabled = false;
  }
}

/* ---------- desenho e reprodução ---------- */

function paint() {
  if (!D) {
    rocket.render(REST_STATE);
    return;
  }

  const k = Math.max(0, Math.min(D.N - 1, Math.floor(idx)));

  charts.forEach((chart) => chart.draw(k));
  traj.draw(k);

  rocket.render({
    tilt: D.tilt[k],
    flame: D.thrust[k] > 0,
    thrustNorm: D.max.thrust ? Math.abs(D.thrust[k]) / D.max.thrust : 1,
    hNorm: Math.max(0, Math.min(1, D.h[k] / (D.max.h || 1))),
    vectors: true,
    vx: D.vx[k],
    vy: D.vy[k],
    vNorm: D.max.v ? D.v[k] / D.max.v : 0,
    dragNorm: D.max.drag ? Math.abs(D.drag[k]) / D.max.drag : 0
  });

  updateTelemetry(D, k);

  $("tv").textContent = D.t[k].toFixed(2) + " s";
  $("scr").value = String(k / (D.N - 1) * 1000);
  $("ev").style.display = k === D.AP ? "block" : "none";

  $("stx").textContent =
    k >= D.N - 1 ? "FIM DA SIMULAÇÃO" :
    playing ? "REPRODUZINDO" :
    k > 0 ? "PAUSADO" : "PRONTO";

  $("stw").classList.toggle("run", playing);
}

function tick(now) {
  if (!playing || !D) return;

  // Limita o intervalo entre quadros: evita saltos ao voltar de outra aba.
  const dtMs = Math.min(now - last, 100);
  idx += (dtMs / 1000) * speed / D.DT;
  last = now;

  if (idx >= D.N - 1) {
    idx = D.N - 1;
    playing = false;
  }

  paint();
  raf = playing ? requestAnimationFrame(tick) : 0;
}

function play() {
  if (!D || playing) return;

  if (idx >= D.N - 1) idx = 0;

  playing = true;
  last = performance.now();
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(tick);
  paint();
}

function pause(silent = false) {
  playing = false;
  cancelAnimationFrame(raf);
  raf = 0;

  if (!silent) paint();
}

function reset() {
  pause(true);
  idx = 0;
  paint();
}

function seek(index) {
  if (!D) return;

  pause(true);
  idx = Math.max(0, Math.min(D.N - 1, Number(index)));
  paint();
}

/* ---------- eventos ---------- */

$("bp").addEventListener("click", play);
$("bs").addEventListener("click", () => pause());
$("br").addEventListener("click", reset);
$("bsim").addEventListener("click", simulate);

["f_thrust", "f_duration", "f_angle"].forEach((id) => {
  $(id).addEventListener("keydown", (event) => {
    if (event.key === "Enter") simulate();
  });
});

$("scr").addEventListener("input", (event) => {
  if (D) seek(Number(event.target.value) / 1000 * (D.N - 1));
});

document.querySelectorAll("#spd button").forEach((button) => {
  button.addEventListener("click", () => {
    speed = Number(button.dataset.s);
    $("spv").textContent = button.textContent;

    document.querySelectorAll("#spd button").forEach((item) => {
      item.classList.toggle("on", item === button);
    });
  });
});

addEventListener("keydown", (event) => {
  const tag = event.target.tagName;

  if (
    event.code === "Space" &&
    tag !== "TEXTAREA" &&
    tag !== "INPUT" &&
    tag !== "BUTTON" &&
    tag !== "SELECT"
  ) {
    event.preventDefault();
    playing ? pause() : play();
  }
});

new ResizeObserver(() => {
  charts.forEach((chart) => chart.size());
  traj.size();
  if (D) paint();
}).observe(document.body);

// Sem dados fictícios no início: a simulação só carrega ao clicar em Simular.
$("src").textContent = "Fonte: aguardando simulação Python";
$("msg").textContent = "Configure os parâmetros e clique em Simular.";
$("stx").textContent = "PRONTO";
paint();
