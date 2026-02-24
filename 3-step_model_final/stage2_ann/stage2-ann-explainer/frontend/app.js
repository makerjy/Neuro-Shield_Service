const API_BASE = `${window.location.protocol}//${window.location.hostname}:8010`;

const STAGES = [
  { key: "VALIDATING", label: "1) VALIDATING" },
  { key: "IMPUTING", label: "2) IMPUTING" },
  { key: "ENGINEERING", label: "3) ENGINEERING" },
  { key: "SCALING", label: "4) SCALING" },
  { key: "SPLITTING", label: "5) SPLITTING" },
  { key: "INFERENCING", label: "6) INFERENCING" },
  { key: "EXPLAINING", label: "7) EXPLAINING" },
];

const DONE_STATUSES = ["COMPLETED"];
const FIELD_LABEL = {
  entry_age: "entry_age",
  PTGENDER: "PTGENDER",
  VSBPSYS: "VSBPSYS",
  COG_DISORDER: "COG_DISORDER",
  dementia_med: "dementia_med",
  antidepressant_med: "antidepressant_med",
  CDRSB: "CDRSB",
  MMSCORE: "MMSCORE",
  FAQTOTAL: "FAQTOTAL",
  LDELTOTAL: "LDELTOTAL",
};

const DEMO_PRESETS = {
  normal: {
    entry_age: 67,
    PTGENDER: 1,
    VSBPSYS: 122,
    CDRSB: 0.1,
    MMSCORE: 29,
    FAQTOTAL: 1,
    LDELTOTAL: 8,
    COG_DISORDER: 0,
    dementia_med: 0,
    antidepressant_med: 0,
  },
  mci: {
    entry_age: 74,
    PTGENDER: 0,
    VSBPSYS: 136,
    CDRSB: 2.6,
    MMSCORE: 24,
    FAQTOTAL: 9,
    LDELTOTAL: 3,
    COG_DISORDER: 1,
    dementia_med: 1,
    antidepressant_med: 0,
  },
  ad: {
    entry_age: 79,
    PTGENDER: 0,
    VSBPSYS: 148,
    CDRSB: 6.4,
    MMSCORE: 13,
    FAQTOTAL: 18,
    LDELTOTAL: 1,
    COG_DISORDER: 1,
    dementia_med: 1,
    antidepressant_med: 1,
  },
};

const state = {
  meta: null,
  samples: [],
  runId: null,
  runData: null,
  poller: null,
  sensitivityChart: null,
};

function el(id) {
  return document.getElementById(id);
}

function getCssVar(name, fallback = "") {
  if (typeof window.cssVar === "function") return window.cssVar(name, fallback);
  return fallback;
}

function getChartPalette() {
  if (typeof window.chartPalette === "function") return window.chartPalette();
  return [
    getCssVar("--chart-1"),
    getCssVar("--chart-2"),
    getCssVar("--chart-3"),
    getCssVar("--chart-4"),
    getCssVar("--chart-5"),
  ];
}

function hexToRgb(hex) {
  const clean = (hex || "").trim().replace("#", "");
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return { r, g, b };
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return { r, g, b };
  }
  return { r: 0, g: 0, b: 0 };
}

function withAlpha(colorHex, alpha) {
  const rgb = hexToRgb(colorHex);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function shapLikeBarColors(values) {
  const posBase = getCssVar("--risk-high");
  const negBase = getCssVar("--chart-2");
  const maxAbs = Math.max(...values.map((v) => Math.abs(Number(v))), 0.000001);

  return values.map((v) => {
    const mag = Math.abs(Number(v)) / maxAbs;
    const alpha = 0.28 + mag * 0.72;
    return Number(v) >= 0 ? withAlpha(posBase, alpha) : withAlpha(negBase, alpha);
  });
}

function isBinaryField(name) {
  if (!state.meta) return false;
  const mh = state.meta.feature_groups?.mh_cols || [];
  return ["COG_DISORDER", "dementia_med", "antidepressant_med", ...mh].includes(name);
}

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${text}`);
  }
  return res.json();
}

function setStatusBadge(status) {
  const badge = el("statusBadge");
  badge.textContent = status;
  badge.className = "badge";
  if (["COMPLETED"].includes(status)) badge.classList.add("done");
  else if (["FAILED", "DATA_MISSING"].includes(status)) badge.classList.add("fail");
  else if (["IDLE"].includes(status)) badge.classList.add("idle");
  else badge.classList.add("running");
}

function setRunMessage(msg) {
  el("runMessage").textContent = msg || "";
}

function createField(container, name, required = false) {
  const wrap = document.createElement("div");
  wrap.className = "field";

  const label = document.createElement("label");
  label.textContent = `${FIELD_LABEL[name] || name}${required ? " *" : ""}`;
  wrap.appendChild(label);

  if (isBinaryField(name)) {
    const row = document.createElement("label");
    row.className = "switch-line";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.dataset.field = name;
    input.dataset.kind = "binary";

    const span = document.createElement("span");
    span.textContent = "0/1";

    row.appendChild(input);
    row.appendChild(span);
    wrap.appendChild(row);
  } else {
    const input = document.createElement("input");
    input.type = "number";
    input.step = "any";
    input.dataset.field = name;
    input.placeholder = required ? "required" : "optional";
    wrap.appendChild(input);
  }

  container.appendChild(wrap);
}

function renderManualForm() {
  const healthCore = el("healthCoreFields");
  const cog = el("cogFields");
  const bio = el("bioFields");
  const flags = el("flagFields");
  const mh = el("mhFields");

  [healthCore, cog, bio, flags, mh].forEach((x) => (x.innerHTML = ""));

  ["entry_age", "PTGENDER", "VSBPSYS"].forEach((f) =>
    createField(healthCore, f, state.meta.required_fields.includes(f))
  );

  state.meta.feature_groups.cog.forEach((f) => createField(cog, f, state.meta.required_fields.includes(f)));
  state.meta.feature_groups.bio.forEach((f) => createField(bio, f, state.meta.required_fields.includes(f)));

  ["COG_DISORDER", "dementia_med", "antidepressant_med"].forEach((f) => createField(flags, f, false));
  state.meta.feature_groups.mh_cols.forEach((f) => createField(mh, f, false));
}

function renderRiskFilter() {
  const select = el("riskFilter");
  const options = [
    { value: "ALL", label: "전체" },
    { value: "0", label: "CN" },
    { value: "1", label: "MCI_Low" },
    { value: "2", label: "MCI_Mid" },
    { value: "3", label: "MCI_High" },
    { value: "4", label: "AD" },
  ];
  select.innerHTML = options
    .map((o) => `<option value="${o.value}">${o.label}</option>`)
    .join("");
}

function renderSampleList() {
  const list = el("sampleList");
  const filter = el("riskFilter").value;
  list.innerHTML = "";

  const view = state.samples.filter((s) => filter === "ALL" || String(s.risk_label) === filter);

  view.forEach((s) => {
    const li = document.createElement("li");
    li.className = "sample-item";
    li.dataset.id = s.id;
    li.innerHTML = `
      <div class="sample-head">
        <strong>${s.risk_name}</strong>
        <span>${s.subject_id || "unknown"}</span>
      </div>
      <div class="muted">${s.DIAGNOSIS || "-"}</div>
      <div class="muted">CDRSB ${num(s.brief_features.CDRSB)} | MMSE ${num(s.brief_features.MMSCORE)} | FAQ ${num(s.brief_features.FAQTOTAL)}</div>
    `;
    li.addEventListener("click", () => loadSampleToForm(s.id));
    list.appendChild(li);
  });
}

function collectValues() {
  const out = {};
  document.querySelectorAll("[data-field]").forEach((input) => {
    const key = input.dataset.field;
    if (input.type === "checkbox") {
      out[key] = input.checked ? 1 : 0;
    } else if (input.value === "") {
      out[key] = null;
    } else {
      const n = Number(input.value);
      out[key] = Number.isFinite(n) ? n : null;
    }
  });
  return out;
}

function fillForm(values) {
  Object.entries(values).forEach(([key, value]) => {
    const input = document.querySelector(`[data-field="${key}"]`);
    if (!input) return;
    if (input.type === "checkbox") {
      input.checked = Number(value) >= 0.5;
    } else {
      input.value = value ?? "";
    }
  });
}

function applyDemoPreset(kind) {
  const preset = DEMO_PRESETS[kind];
  if (!preset) return;
  fillForm(preset);
  switchTab("manualTab");
  setRunMessage(`${kind.toUpperCase()} 데모 입력값을 채웠습니다. 실행 버튼을 눌러 확인하세요.`);
}

async function loadSampleToForm(sampleId) {
  try {
    const data = await fetchJSON(`${API_BASE}/api/sample/${sampleId}`);
    fillForm(data.values);
    setRunMessage(`샘플 ${sampleId} 입력값을 채웠습니다.`);
  } catch (err) {
    setRunMessage(`샘플 로드 실패: ${err.message}`);
  }
}

function switchTab(tabId) {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });
  document.querySelectorAll(".tab-content").forEach((tab) => {
    tab.classList.toggle("active", tab.id === tabId);
  });
}

function initStepper() {
  const wrap = el("stepper");
  wrap.innerHTML = "";

  STAGES.forEach((s) => {
    const card = document.createElement("div");
    card.className = "step-card";
    card.dataset.stage = s.key;
    card.innerHTML = `
      <div class="step-title">
        <span class="step-name">${s.label}</span>
        <button class="ghost-btn json-btn">원본 JSON 보기</button>
      </div>
      <p class="step-summary">대기 중</p>
      <pre class="json-view" hidden>{}</pre>
    `;

    card.querySelector(".json-btn").addEventListener("click", () => {
      const pre = card.querySelector("pre");
      pre.hidden = !pre.hidden;
    });

    wrap.appendChild(card);
  });
}

function stageArtifact(stageKey, artifacts) {
  switch (stageKey) {
    case "VALIDATING":
      return { input_raw: artifacts.input_raw, missing_required: artifacts.missing_required };
    case "IMPUTING":
      return { imputed_map: artifacts.imputed_map };
    case "ENGINEERING":
      return { engineered_values: artifacts.engineered_values, formulas: artifacts.formulas };
    case "SCALING":
      return { scaled_preview: artifacts.scaled_preview, scaled_stats: artifacts.scaled_stats };
    case "SPLITTING":
      return { split_dims: artifacts.split_dims };
    case "INFERENCING":
      return {
        probs: artifacts.probs,
        predicted_label: artifacts.predicted_label,
        confidence: artifacts.confidence,
        operational_bucket: artifacts.operational_bucket,
        stage3_eligible: artifacts.stage3_eligible,
      };
    case "EXPLAINING":
      return {
        local_sensitivity_top10: artifacts.local_sensitivity_top10,
        branch_summary: artifacts.branch_summary,
        note: artifacts.local_sensitivity_note,
      };
    default:
      return {};
  }
}

function stageSummary(stageKey, artifacts) {
  if (stageKey === "VALIDATING") {
    const miss = artifacts.missing_required?.length || 0;
    return miss ? `필수 누락 ${miss}개` : "필수 입력 확인 완료";
  }
  if (stageKey === "IMPUTING") {
    const n = Object.keys(artifacts.imputed_map || {}).length;
    return `결측 보간 ${n}개`;
  }
  if (stageKey === "ENGINEERING") {
    const n = Object.keys(artifacts.engineered_values || {}).length;
    return `합성 피처 계산 ${n}개`;
  }
  if (stageKey === "SCALING") {
    return `표준화 완료 (${artifacts.scaled_stats?.feature_count || 0} feats)`;
  }
  if (stageKey === "SPLITTING") {
    const d = artifacts.split_dims || {};
    return `H${d.health || 0}/C${d.cognitive || 0}/B${d.bio || 0}/E${d.engineering || 0}`;
  }
  if (stageKey === "INFERENCING") {
    if (!artifacts.predicted_label) return "추론 대기";
    return `${artifacts.predicted_label} (${pct(artifacts.confidence)})`;
  }
  if (stageKey === "EXPLAINING") {
    const n = artifacts.local_sensitivity_top10?.length || 0;
    return `민감도 Top${n}`;
  }
  return "대기 중";
}

function updateStepper(run) {
  const cards = [...document.querySelectorAll(".step-card")];
  let currentIdx = STAGES.findIndex((s) => s.key === run.status);
  if (currentIdx < 0 && run.status === "DATA_MISSING") {
    currentIdx = 0;
  }
  if (currentIdx < 0 && run.status === "FAILED") {
    const a = run.step_artifacts || {};
    if (a.local_sensitivity_top10) currentIdx = 6;
    else if (a.probs) currentIdx = 5;
    else if (a.split_dims) currentIdx = 4;
    else if (a.scaled_preview) currentIdx = 3;
    else if (a.engineered_values) currentIdx = 2;
    else if (a.imputed_map) currentIdx = 1;
    else currentIdx = 0;
  }

  cards.forEach((card, idx) => {
    card.classList.remove("active", "done", "failed");

    if (run.status === "FAILED") {
      if (idx < currentIdx) card.classList.add("done");
      if (idx === currentIdx) card.classList.add("failed");
    } else if (run.status === "DATA_MISSING") {
      if (idx === 0) card.classList.add("failed");
    } else if (DONE_STATUSES.includes(run.status)) {
      card.classList.add("done");
    } else if (idx < currentIdx) {
      card.classList.add("done");
    } else if (idx === currentIdx) {
      card.classList.add("active");
    }

    const stage = STAGES[idx];
    const summary = stageSummary(stage.key, run.step_artifacts || {});
    card.querySelector(".step-summary").textContent = summary;

    const artifact = stageArtifact(stage.key, run.step_artifacts || {});
    card.querySelector("pre").textContent = JSON.stringify(artifact, null, 2);
  });
}

function num(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "-";
  return Number(v).toFixed(2);
}

function pct(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "-";
  return `${(Number(v) * 100).toFixed(1)}%`;
}

function toTriProb(probs) {
  const cn = Number(probs?.CN || 0);
  const mciLow = Number(probs?.MCI_Low || 0);
  const mciMid = Number(probs?.MCI_Mid || 0);
  const mciHigh = Number(probs?.MCI_High || 0);
  const ad = Number(probs?.AD || 0);
  const mci = mciLow + mciMid + mciHigh;
  const sum = cn + mci + ad;

  if (sum <= 0) return null;

  const tri = {
    NORMAL: cn / sum,
    MCI: mci / sum,
    AD: ad / sum,
    MCI_Low: mciLow,
    MCI_Mid: mciMid,
    MCI_High: mciHigh,
  };
  tri.predicted = ["NORMAL", "MCI", "AD"].reduce((best, key) => (tri[key] > tri[best] ? key : best), "NORMAL");
  return tri;
}

function computeMciScoring(tri) {
  const den = tri.MCI_Low + tri.MCI_Mid + tri.MCI_High;
  if (den <= 0) return null;

  const score = Math.round((tri.MCI_Low * 20 + tri.MCI_Mid * 55 + tri.MCI_High * 88) / den);
  let zone = "양호";
  let detail = "MCI_Low";
  if (score >= 70) {
    zone = "위험";
    detail = "MCI_High";
  } else if (score >= 40) {
    zone = "중간";
    detail = "MCI_Mid";
  }
  return { score, zone, detail };
}

function renderTriClass(tri) {
  const map = [
    { key: "NORMAL", seg: "triSegNormal", chip: "triChipNormal", label: "NORMAL" },
    { key: "MCI", seg: "triSegMci", chip: "triChipMci", label: "MCI" },
    { key: "AD", seg: "triSegAd", chip: "triChipAd", label: "AD" },
  ];

  map.forEach((cfg) => {
    const p = tri[cfg.key];
    const pctText = `${(p * 100).toFixed(0)}%`;
    const seg = el(cfg.seg);
    const chip = el(cfg.chip);
    seg.style.flex = `${Math.max(p, 0.001)} 1 0`;
    seg.textContent = `${cfg.label} ${pctText}`;
    seg.classList.toggle("is-top", tri.predicted === cfg.key);
    chip.textContent = `${cfg.label} ${pctText}`;
    chip.classList.toggle("active", tri.predicted === cfg.key);
  });
}

function renderMciGauge(tri) {
  const card = el("mciGaugeCard");
  if (tri.predicted !== "MCI") {
    card.classList.add("hidden");
    return;
  }

  const score = computeMciScoring(tri);
  if (!score) {
    card.classList.add("hidden");
    return;
  }

  card.classList.remove("hidden");
  el("mciPin").style.left = `${Math.max(0, Math.min(100, score.score))}%`;
  el("mciZoneBadge").textContent = `현재 구간: ${score.zone}`;
  el("mciZoneBadge").className = `badge ${score.zone === "위험" ? "fail" : score.zone === "중간" ? "running" : "done"}`;
  el("mciScoreText").textContent = `점수 ${score.score} · 세부화 ${score.zone} (${score.detail})`;
}

function getSensitivityRows(artifacts) {
  const all = artifacts.local_sensitivity_all || [];
  const eng = new Set(state.meta?.feature_groups?.eng || []);
  const engOnly = el("engOnlyToggle").checked;
  return engOnly ? all.filter((x) => eng.has(x.feature)) : all;
}

function renderSensitivity(artifacts) {
  const rows = getSensitivityRows(artifacts).slice(0, 10);
  const methodNote = artifacts.local_sensitivity_note || "";
  el("sensitivityNote").textContent = `${methodNote} (+영향: 빨강, -영향: 파랑)`;

  const body = el("sensitivityBody");
  body.innerHTML = "";
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.feature}</td>
      <td>${num(r.base)}</td>
      <td>${num(r.perturbed)}</td>
      <td>${num(r.prob_delta_target)}</td>
    `;
    body.appendChild(tr);
  });

  const values = rows.map((r) => Number(r.prob_delta_target));
  const bgColors = shapLikeBarColors(values);
  const borderColors = shapLikeBarColors(values.map((v) => (v >= 0 ? 1 : -1)));

  if (state.sensitivityChart) state.sensitivityChart.destroy();
  state.sensitivityChart = new Chart(el("sensitivityChart"), {
    type: "bar",
    data: {
      labels: rows.map((r) => r.feature),
      datasets: [
        {
          label: "ΔTarget Prob",
          data: values,
          backgroundColor: bgColors,
          borderColor: borderColors,
          borderWidth: 1,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { callback: (v) => Number(v).toFixed(3) } } },
    },
  });
}

function renderBranch(artifacts) {
  const body = el("branchBody");
  body.innerHTML = "";

  const summary = artifacts.branch_summary || {};
  Object.entries(summary).forEach(([k, v]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${k}</td>
      <td>${v.dim}</td>
      <td>${num(v.l2_norm)}</td>
      <td>${num(v.mean)}</td>
      <td>${num(v.std)}</td>
    `;
    body.appendChild(tr);
  });

  el("branchNote").textContent = artifacts.branch_note || "";
}

function renderResults(run) {
  const a = run.step_artifacts || {};

  if (!a.probs) {
    el("resultSummary").textContent = "확률 결과가 없습니다.";
    return;
  }

  const tri = toTriProb(a.probs);
  if (!tri) {
    el("resultSummary").textContent = "3중 분류 계산 실패";
    return;
  }

  const triPredLabel = tri.predicted === "NORMAL" ? "NORMAL" : tri.predicted;
  el("resultSummary").innerHTML = `
    <strong>${triPredLabel}</strong>
    <span class="muted"> 3중 confidence ${pct(tri[tri.predicted])} | Σp ${num(a.prob_sum)}</span>
  `;

  el("bucketBadge").textContent = `bucket ${a.operational_bucket?.name || "-"}`;
  el("bucketBadge").className = "badge running";

  el("stage3Badge").textContent = a.stage3_eligible ? "Stage3 추적 대상" : "Stage3 비대상";
  el("stage3Badge").className = `badge ${a.stage3_eligible ? "done" : "idle"}`;

  renderTriClass(tri);
  renderMciGauge(tri);
  renderSensitivity(a);
  renderBranch(a);
}

function clearResultViews(message = "실행 대기 중") {
  el("resultSummary").textContent = message;
  el("bucketBadge").textContent = "bucket -";
  el("bucketBadge").className = "badge idle";
  el("stage3Badge").textContent = "Stage3 -";
  el("stage3Badge").className = "badge idle";
  el("triSegNormal").style.flex = "1 1 0";
  el("triSegMci").style.flex = "1 1 0";
  el("triSegAd").style.flex = "1 1 0";
  el("triSegNormal").textContent = "NORMAL 0%";
  el("triSegMci").textContent = "MCI 0%";
  el("triSegAd").textContent = "AD 0%";
  el("triSegNormal").classList.remove("is-top");
  el("triSegMci").classList.remove("is-top");
  el("triSegAd").classList.remove("is-top");
  el("triChipNormal").textContent = "NORMAL 0%";
  el("triChipMci").textContent = "MCI 0%";
  el("triChipAd").textContent = "AD 0%";
  el("triChipNormal").classList.remove("active");
  el("triChipMci").classList.remove("active");
  el("triChipAd").classList.remove("active");
  el("mciGaugeCard").classList.add("hidden");
  el("mciZoneBadge").textContent = "현재 구간: -";
  el("mciZoneBadge").className = "badge idle";
  el("mciScoreText").textContent = "점수 - · 세부화 -";
  el("mciPin").style.left = "0%";
  el("sensitivityBody").innerHTML = "";
  el("branchBody").innerHTML = "";
  el("sensitivityNote").textContent = "";
  el("branchNote").textContent = "";
  if (state.sensitivityChart) {
    state.sensitivityChart.destroy();
    state.sensitivityChart = null;
  }
}

function stopPolling() {
  if (state.poller) {
    clearInterval(state.poller);
    state.poller = null;
  }
}

async function pollRun() {
  if (!state.runId) return;

  try {
    const run = await fetchJSON(`${API_BASE}/api/run/${state.runId}`);
    state.runData = run;

    setStatusBadge(run.status);
    el("runUpdatedAt").textContent = run.updated_at ? new Date(run.updated_at).toLocaleTimeString() : "-";
    updateStepper(run);

    if (run.status === "DATA_MISSING") {
      const miss = run.step_artifacts?.missing_required || [];
      clearResultViews(`DATA_MISSING: ${miss.join(", ")}`);
      setRunMessage("필수 입력 누락으로 실행을 종료했습니다. 확률은 표시하지 않습니다.");
      stopPolling();
      return;
    }

    if (run.status === "FAILED") {
      setRunMessage(`실행 실패: ${run.error || "unknown"}`);
      el("resultSummary").textContent = "실행 실패";
      stopPolling();
      return;
    }

    if (run.status === "COMPLETED") {
      renderResults(run);
      setRunMessage("실행 완료");
      stopPolling();
      return;
    }
  } catch (err) {
    setRunMessage(`폴링 오류: ${err.message}`);
    stopPolling();
  }
}

async function runInference() {
  try {
    setRunMessage("run 생성 중...");
    clearResultViews("실행 중...");
    const payload = {
      values: collectValues(),
      options: {
        allow_missing_demo: el("allowMissingToggle").checked,
        target_class: el("targetClassSelect").value,
      },
    };

    const data = await fetchJSON(`${API_BASE}/api/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    state.runId = data.run_id;
    el("runIdText").textContent = state.runId;
    setStatusBadge("QUEUED");

    stopPolling();
    state.poller = setInterval(pollRun, 700);
    pollRun();
  } catch (err) {
    setRunMessage(`실행 요청 실패: ${err.message}`);
  }
}

async function loadMeta() {
  state.meta = await fetchJSON(`${API_BASE}/api/meta`);
  const d = state.meta.model_info.branch_dim;
  const arch = state.meta.model_info.architecture || "ANN";
  const hasBio = Number(d.bio || 0) > 0;
  const branchText = hasBio
    ? `4-branch(H${d.health}/C${d.cognitive}/B${d.bio}/E${d.engineering})`
    : `3-branch(H${d.health}/C${d.cognitive}/E${d.engineering})`;
  el("modelInfo").textContent = `v${state.meta.model_info.version} | ${arch} | ${branchText} | scaler: ${state.meta.model_info.scaler_source}`;
}

async function loadSamples() {
  const data = await fetchJSON(`${API_BASE}/api/samples`);
  state.samples = data.samples || [];
  renderSampleList();
}

function bindEvents() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  el("riskFilter").addEventListener("change", renderSampleList);
  el("reloadSamples").addEventListener("click", loadSamples);
  el("presetNormalBtn").addEventListener("click", () => applyDemoPreset("normal"));
  el("presetMciBtn").addEventListener("click", () => applyDemoPreset("mci"));
  el("presetAdBtn").addEventListener("click", () => applyDemoPreset("ad"));
  el("runBtn").addEventListener("click", runInference);
  el("engOnlyToggle").addEventListener("change", () => {
    if (state.runData?.step_artifacts) renderSensitivity(state.runData.step_artifacts);
  });
}

async function init() {
  setStatusBadge("IDLE");
  clearResultViews("실행 대기 중");
  renderRiskFilter();
  initStepper();
  bindEvents();

  try {
    await loadMeta();
    renderManualForm();
    await loadSamples();
    setRunMessage("메타/샘플 로딩 완료");
  } catch (err) {
    setRunMessage(`초기화 실패: ${err.message}`);
  }
}

init();
