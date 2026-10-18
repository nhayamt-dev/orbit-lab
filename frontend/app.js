/* ORBIT LAB — integração com o backend Python.
   Mantém os componentes visuais existentes e usa dados reais da API. */

const SIM_ENDPOINT = "/api/simulate";
const G = 9.80665;
const $ = (id) => document.getElementById(id);

let D = null;
let idx = 0;
let playing = false;
let speed = 1;
let last = 0;
let raf = 0;
let rotTilt = 0;

const charts = [
  createChart("c_h", [{ k: "h", c: "#ff2b2b", n: "altitude (m)" }], seek),
  createChart("c_v", [{ k: "v", c: "#ff2b2b", n: "velocidade (m/s)" }], seek),
  createChart("c_e", [
    { k: "Ek", c: "#ff2b2b", n: "Ec (J)" },
    { k: "Ep", c: "#8a8a8a", n: "Ep (J)" }
  ], seek),
  createChart("c_f", [
    { k: "thrust", c: "#ff2b2b", n: "empuxo (N)" },
    { k: "drag", c: "#f2f2f2", n: "arrasto (N)" },
    { k: "weight", c: "#8a8a8a", n: "peso (N)" }
  ], seek)
];

const traj = createTrajectory("cT", "xy");
const rocket = createRocket3D("view", "gl", "err");

function normalizeBackend(api) {
  if (!Array.isArray(api.states) || !api.states.length) {
    throw new Error("A API não retornou estados da simulação.");
  }

  if (!api.analysis) {
    throw new Error("A API não retornou os dados da análise.");
  }

  const states = api.states;
  const a = api.analysis;
  const N = states.length;

  const series = {
    t: states.map(s => Number(s.time)),
    x: states.map(s => Number(s.x)),
    h: states.map(s => Number(s.y)),
    vx: states.map(s => Number(s.vx)),
    vy: states.map(s => Number(s.vy)),
    v: states.map(s => Number(s.speed)),
    a: a.acceleration_m_s2,
    thrust: a.thrust_n,
    drag: a.drag_n,
    weight: a.weight_n,
    Ek: a.kinetic_energy_j,
    Ep: a.potential_energy_j
  };

  for (const key of ["t", "x", "h", "vx", "vy", "v"]) {
    if (series[key].some(value => !Number.isFinite(value))) {
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
      throw new Error(
        "A série " + apiKey + " está ausente ou tem tamanho incorreto."
      );
    }

    series[key] = a[apiKey].map(Number);

    if (series[key].some(value => !Number.isFinite(value))) {
      throw new Error("A API retornou valores inválidos em " + apiKey + ".");
    }
  }

  if (N < 2) {
    throw new Error("A simulação precisa ter pelo menos dois estados.");
  }

  // A API atual não fornece massa por estado. Não inventamos essa série.
  series.m = Array(N).fill(0);

  const max = {
    h: Math.max(0, ...series.h),
    v: Math.max(0, ...series.v),
    a: Math.max(0, ...series.a.map(Math.abs)),
    drag: Math.max(0, ...series.drag.map(Math.abs))
  };

  const t0 = series.t[0];
  series.t = series.t.map(t => t - t0);
  series.N = N;
  series.TT = series.t[N - 1];
  series.DT = series.TT / (N - 1);
  series.AP = series.h.indexOf(Math.max(...series.h));
  series.max = max;
  series.missing = ["m"];
  series.derived = [];

  if (!(series.TT > 0) || !(series.DT > 0)) {
    throw new Error("A série temporal da API é inválida.");
  }

  return series;
}

function setData(data, label) {
  D = data;

  charts.forEach(chart => chart.setData(D));
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

async function simulate() {
  let input;

  try {
    input = JSON.parse($("payload").value || "{}");
  } catch (error) {
    fail("JSON de parâmetros inválido: " + error.message);
    return;
  }

  // Mantém o controle de parâmetros existente no dashboard.
  // Se o JSON estiver vazio, usa valores iniciais válidos.
  const payload = {
    thrust: Number(input.thrust ?? 50),
    duration: Number(input.duration ?? 0.5),
    angle: Number(input.angle ?? 80)
  };

  if (
    !Number.isFinite(payload.thrust) ||
    !Number.isFinite(payload.duration) ||
    !Number.isFinite(payload.angle)
  ) {
    fail("Empuxo, duração e ângulo precisam ser números válidos.");
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

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Erro HTTP " + response.status);
    }

    const data = normalizeBackend(result);
    setData(data, "API Python " + SIM_ENDPOINT);
    play();
  } catch (error) {
    fail(error.message || "Falha ao executar a simulação.");
  } finally {
    $("bsim").disabled = false;
  }
}

function paint() {
  if (!D) return;

  const k = Math.max(0, Math.min(D.N - 1, Math.floor(idx)));

  charts.forEach(chart => chart.draw(k));
  traj.draw(k);

  if (D.v[k] > 0.3) {
    rotTilt = -Math.atan2(D.vx[k], D.vy[k] || 0.000001);
  }

  rocket.render({
    tilt: rotTilt,
    flame: D.thrust[k] > 0,
    hNorm: D.h[k] / (D.max.h || 1)
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

  idx += ((now - last) / 1000) * speed / D.DT;
  last = now;

  if (idx >= D.N - 1) {
    idx = D.N - 1;
    playing = false;
  }

  paint();

  if (playing) {
    raf = requestAnimationFrame(tick);
  } else {
    raf = 0;
  }
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
  pause(true);
  idx = Math.max(0, Math.min(D.N - 1, Number(index)));
  paint();
}

$("bp").addEventListener("click", play);
$("bs").addEventListener("click", () => pause());
$("br").addEventListener("click", reset);
$("bsim").addEventListener("click", simulate);

$("scr").addEventListener("input", event => {
  if (D) seek(Number(event.target.value) / 1000 * (D.N - 1));
});

document.querySelectorAll("#spd button").forEach(button => {
  button.addEventListener("click", () => {
    speed = Number(button.dataset.s);
    $("spv").textContent = button.textContent;

    document.querySelectorAll("#spd button").forEach(item => {
      item.classList.toggle("on", item === button);
    });
  });
});

addEventListener("keydown", event => {
  if (
    event.code === "Space" &&
    event.target.tagName !== "TEXTAREA" &&
    event.target.tagName !== "INPUT"
  ) {
    event.preventDefault();
    playing ? pause() : play();
  }
});

new ResizeObserver(() => {
  charts.forEach(chart => chart.size());
  traj.size();
  if (D) paint();
}).observe(document.body);

// Mantém o renderizador 3D atualizado quando a simulação está pausada.
(function idleRender() {
  if (D && !playing) {
    rocket.render({
      tilt: rotTilt,
      flame: D.thrust[Math.floor(idx)] > 0,
      hNorm: D.h[Math.floor(idx)] / (D.max.h || 1)
    });
  }

  requestAnimationFrame(idleRender);
})();

// Sem dados fictícios no início: a simulação só carrega ao clicar em Simular.
$("src").textContent = "Fonte: aguardando simulação Python";
$("msg").textContent = "Configure os parâmetros e clique em Simular.";
$("stx").textContent = "PRONTO";
