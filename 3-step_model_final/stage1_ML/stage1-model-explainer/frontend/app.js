let API_BASE = window.__API_BASE__ || null;

const API_CANDIDATES = [
  API_BASE,
  `${window.location.protocol}//${window.location.hostname}:8000`,
  `${window.location.protocol}//${window.location.hostname}:18000`,
  "http://localhost:8000",
  "http://localhost:18000",
].filter((value, index, arr) => Boolean(value) && arr.indexOf(value) === index);

const FIELD_DEFS = [
  { id: "CIST_ORIENT", feature: "CIST_ORIENT", label: "지남력", hint: "날짜/장소를 파악하는 능력", min: 0, max: 5, step: 1 },
  { id: "CIST_ATTENTION", feature: "CIST_ATTENTION", label: "주의력", hint: "집중해서 과제를 수행하는 능력", min: 0, max: 3, step: 1 },
  { id: "CIST_EXEC", feature: "CIST_EXEC", label: "집행기능", hint: "계획·판단·문제해결 능력", min: 0, max: 6, step: 1 },
  { id: "CIST_MEMORY", feature: "CIST_MEMORY", label: "기억력", hint: "최근 정보를 기억하는 능력", min: 0, max: 10, step: 1 },
  { id: "CIST_LANGUAGE", feature: "CIST_LANGUAGE", label: "언어기능", hint: "말 이해/표현 능력", min: 0, max: 4, step: 1 },
  { id: "entry_age", feature: "entry_age", label: "나이", hint: "만 나이(세)", min: 40, max: 100, step: 1 },
  { id: "PTEDUCAT", feature: "PTEDUCAT", label: "교육 연수", hint: "총 교육 기간(년)", min: 0, max: 25, step: 1 },
  { id: "VSBPSYS", feature: "VSBPSYS", label: "수축기 혈압", hint: "최고혈압(mmHg)", min: 70, max: 250, step: 1 },
  { id: "BMI", feature: "BMI", label: "체질량지수(BMI)", hint: "몸무게/키 기반 지수", min: 10, max: 60, step: 0.1 },
  {
    id: "gender",
    feature: "PTGENDER_num",
    label: "성별",
    hint: "생물학적 성별",
    type: "select",
    options: [
      { value: "Male", text: "남성" },
      { value: "Female", text: "여성" },
    ],
  },
];

const STEP_DEFS = [
  { key: "VALIDATING", title: "1) 입력 확인", desc: "필수 항목이 비어 있는지 확인해요" },
  { key: "ORDERING", title: "2) 형식 맞추기", desc: "모델이 읽을 순서로 입력값을 정렬해요" },
  { key: "CLIPPING", title: "3) 범위 보정", desc: "너무 크거나 작은 값을 허용 범위로 조정해요" },
  { key: "IMPUTING", title: "4) 빈칸 채우기", desc: "비어 있는 값을 통계 기반으로 채워요" },
  { key: "SCALING", title: "5) 계산 준비", desc: "모델이 계산하기 쉬운 형태로 변환해요" },
  { key: "INFERENCING", title: "6) 위험도 계산", desc: "두 모델 결과를 합쳐 최종 확률을 만들어요" },
  { key: "EXPLAINING", title: "7) 영향 요인 보기", desc: "어떤 항목이 결과에 민감한지 보여줘요" },
];

const FEATURE_NAME_MAP = Object.fromEntries(
  FIELD_DEFS.map((field) => [field.feature, field.label])
);

const STATUS_TEXT_MAP = {
  QUEUED: "대기 중",
  VALIDATING: "입력 확인 중",
  CLIPPING: "범위 보정 중",
  IMPUTING: "빈칸 채우는 중",
  SCALING: "계산 준비 중",
  INFERENCING: "위험도 계산 중",
  EXPLAINING: "영향 요인 계산 중",
  COMPLETED: "완료",
  FAILED: "실패",
  DATA_MISSING: "입력 부족",
};

const STEP_ARTIFACT_KEYS = {
  VALIDATING: null,
  ORDERING: "input_ordered",
  CLIPPING: "clipping_delta",
  IMPUTING: "imputed_values",
  SCALING: "scaled_values",
  INFERENCING: "model_breakdown",
  EXPLAINING: "local_sensitivity",
};

const TERMINAL_STATUS = new Set(["COMPLETED", "FAILED", "DATA_MISSING"]);

let meta = null;
let pollTimer = null;
let currentRunId = null;
let latestRunPayload = null;
let sensitivityChart = null;
let demoBucketChart = null;
let isInputPanelCollapsed = false;

const $ = (selector) => document.querySelector(selector);

function toStatusClass(status) {
  return `status-${String(status || "queued").toLowerCase()}`;
}

function formatPercent(probability) {
  if (probability == null || Number.isNaN(Number(probability))) return "-";
  return `${(Number(probability) * 100).toFixed(1)}%`;
}

function formatProbability(value) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return Number(value).toFixed(3);
}

function cssVar(name, fallback = "") {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function chartPalette() {
  return [
    cssVar("--chart-1"),
    cssVar("--chart-2"),
    cssVar("--chart-3"),
    cssVar("--chart-4"),
    cssVar("--chart-5"),
  ];
}

function asNumber(value) {
  if (value == null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function displayFeatureName(featureKey) {
  return FEATURE_NAME_MAP[featureKey] || featureKey;
}

function riskLabelKo(label) {
  if (label === "High Risk") return "높은 위험";
  if (label === "Borderline") return "주의 필요";
  return "낮은 위험";
}

function riskAdvice(label) {
  if (label === "High Risk") return "현재 입력 기준으로 위험도가 높게 나왔습니다. 전문의 상담을 권장합니다.";
  if (label === "Borderline") return "현재 입력 기준으로 주의가 필요합니다. 주기적인 재검과 생활관리 권장.";
  return "현재 입력 기준으로 위험도가 낮게 나왔습니다. 꾸준한 건강관리를 권장합니다.";
}

function riskBadgeClass(label) {
  if (label === "High Risk") return "risk-high";
  if (label === "Borderline") return "risk-borderline";
  return "risk-normal";
}

function compactJSON(value) {
  return JSON.stringify(value ?? {}, null, 2);
}

function resetResultPanel() {
  $("#probability-text").textContent = "-";
  $("#probability-fill").style.width = "0%";
  const riskBadge = $("#risk-badge");
  riskBadge.className = "badge risk-normal";
  riskBadge.textContent = "-";
  const resultGuide = $("#result-guide");
  if (resultGuide) {
    resultGuide.textContent = "입력 후 계산을 시작하면, 결과 해석 문구가 여기에 표시됩니다.";
  }
  $("#rf-proba").textContent = "-";
  $("#hgb-proba").textContent = "-";
  $("#ens-proba").textContent = "-";
  $("#report-btn").disabled = true;
  if (sensitivityChart) {
    sensitivityChart.destroy();
    sensitivityChart = null;
  }
}

function setInputPanelCollapsed(collapsed) {
  const nextState = Boolean(collapsed);
  isInputPanelCollapsed = nextState;

  const content = $("#input-panel-content");
  const hint = $("#input-panel-collapsed-hint");
  const toggleBtn = $("#input-panel-toggle-btn");
  const grid = $(".main-grid");

  if (!content || !hint || !toggleBtn || !grid) return;

  content.classList.toggle("hidden", nextState);
  hint.classList.toggle("hidden", !nextState);
  grid.classList.toggle("input-collapsed", nextState);

  toggleBtn.textContent = nextState ? "입력 항목 펼치기" : "입력 항목 숨기기";
  toggleBtn.setAttribute("aria-expanded", String(!nextState));
}

function initInputPanelToggle() {
  const toggleBtn = $("#input-panel-toggle-btn");
  if (!toggleBtn) return;

  toggleBtn.addEventListener("click", () => {
    setInputPanelCollapsed(!isInputPanelCollapsed);
  });

  setInputPanelCollapsed(false);
}

function initStepper() {
  const stepper = $("#stepper");
  stepper.innerHTML = "";

  STEP_DEFS.forEach((step) => {
    const card = document.createElement("div");
    card.id = `step-${step.key}`;
    card.className = "step-card";

    card.innerHTML = `
      <div class="step-top">
        <div class="step-title">${step.title}</div>
        <div id="step-state-${step.key}" class="badge status-queued">대기</div>
      </div>
      <div id="step-summary-${step.key}" class="step-body">${step.desc}</div>
      <div class="step-code">${step.key}</div>
      <button type="button" class="raw-btn" data-step="${step.key}">전문가용 원본 데이터</button>
      <pre id="step-raw-${step.key}" class="raw-json hidden">{}</pre>
    `;

    stepper.appendChild(card);
  });

  stepper.querySelectorAll(".raw-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const step = button.dataset.step;
      const pre = document.getElementById(`step-raw-${step}`);
      if (!pre) return;
      pre.classList.toggle("hidden");
    });
  });
}

function renderInputForm() {
  const form = $("#input-form");
  form.innerHTML = "";

  FIELD_DEFS.forEach((field) => {
    const row = document.createElement("div");
    row.className = "field-row";

    let defaultValue = meta?.default_values?.[field.feature] ?? null;
    if (field.type === "select") {
      defaultValue = Number(defaultValue) === 2 ? "Female" : "Male";
    }

    const rangeText =
      field.type === "select"
        ? "남성 / 여성"
        : `${field.min} ~ ${field.max}`;

    const inputHtml =
      field.type === "select"
        ? `<select id="input-${field.id}">
            ${field.options
              .map(
                (option) =>
                  `<option value="${option.value}" ${defaultValue === option.value ? "selected" : ""}>${option.text}</option>`
              )
              .join("")}
          </select>`
        : `<input id="input-${field.id}" type="number" min="${field.min}" max="${field.max}" step="${field.step}" value="${defaultValue ?? ""}" />`;

    row.innerHTML = `
      <div class="field-head">
        <label class="field-label" for="input-${field.id}">${field.label}</label>
        <span class="range-tag">${rangeText}</span>
      </div>
      <div class="field-hint">${field.hint || ""} <span class="field-code">${field.feature}</span></div>
      <div class="field-input-wrap">
        ${inputHtml}
        <label class="missing-toggle" for="missing-${field.id}">
          <input id="missing-${field.id}" type="checkbox" />
          모름/미입력
        </label>
      </div>
    `;

    form.appendChild(row);

    const missingCheckbox = row.querySelector(`#missing-${field.id}`);
    const inputEl = row.querySelector(`#input-${field.id}`);
    missingCheckbox.addEventListener("change", () => {
      inputEl.disabled = missingCheckbox.checked;
    });
  });
}

function collectValues() {
  const values = {};

  FIELD_DEFS.forEach((field) => {
    const inputEl = document.getElementById(`input-${field.id}`);
    const missing = document.getElementById(`missing-${field.id}`)?.checked;

    if (field.type === "select") {
      values[field.id] = missing ? null : inputEl.value;
      return;
    }

    values[field.feature] = missing ? null : asNumber(inputEl.value);
  });

  (meta?.features || []).forEach((feature) => {
    if (feature === "PTGENDER_num" && "gender" in values) return;
    if (feature in values) return;
    const fallback = meta?.default_values?.[feature];
    values[feature] = typeof fallback === "number" ? fallback : null;
  });

  return values;
}

function renderRunStatus(status) {
  const statusEl = $("#run-status");
  statusEl.className = `badge ${toStatusClass(status)}`;
  statusEl.textContent = STATUS_TEXT_MAP[status] || status || "-";
}

function renderMissing(runData) {
  const alert = $("#missing-message");
  const missingRequired = (runData?.missing_required || []).map(displayFeatureName);

  if (runData?.status === "DATA_MISSING") {
    alert.classList.remove("hidden");
    alert.textContent = `필수 입력이 비어 있어 계산이 중단되었습니다: ${missingRequired.join(", ") || "확인 필요"}.`;
    return;
  }

  if (missingRequired.length > 0 && runData?.status !== "DATA_MISSING") {
    alert.classList.remove("hidden");
    alert.textContent = `데모 모드로 진행되었습니다. 비어 있던 항목: ${missingRequired.join(", ")} (자동 보정됨).`;
    return;
  }

  alert.classList.add("hidden");
  alert.textContent = "";
}

function summarizeStep(stepKey, runData) {
  const artifacts = runData?.step_artifacts || {};

  if (stepKey === "VALIDATING") {
    if ((runData?.missing_required || []).length > 0) {
      return `비어 있는 필수 항목: ${(runData.missing_required || []).map(displayFeatureName).join(", ")}`;
    }
    return "필수 입력 확인 완료";
  }

  if (stepKey === "ORDERING") {
    const ordered = artifacts.input_ordered || {};
    const preview = Object.entries(ordered)
      .slice(0, 4)
      .map(([k, v]) => `${displayFeatureName(k)}:${v}`)
      .join(" | ");
    return preview || "입력 형식 정렬 대기";
  }

  if (stepKey === "CLIPPING") {
    const changes = Object.keys(artifacts.clipping_delta || {});
    return changes.length > 0 ? `${changes.length}개 항목이 허용 범위로 자동 조정됨` : "조정된 항목 없음";
  }

  if (stepKey === "IMPUTING") {
    const imputed = Object.keys(artifacts.imputed_values || {});
    return imputed.length > 0 ? `${imputed.length}개 빈칸을 자동으로 채움` : "채운 항목 없음";
  }

  if (stepKey === "SCALING") {
    const scaled = Object.entries(artifacts.scaled_values || {})
      .slice(0, 3)
      .map(([k, v]) => `${displayFeatureName(k)}:${v}`)
      .join(" | ");
    return scaled || "계산 준비 변환 대기";
  }

  if (stepKey === "INFERENCING") {
    const modelBreakdown = artifacts.model_breakdown || {};
    const ens = modelBreakdown.ensemble_proba;
    return ens != null ? `예상 위험도: ${formatPercent(ens)}` : "위험도 계산 대기";
  }

  if (stepKey === "EXPLAINING") {
    const top = (artifacts.local_sensitivity?.features || [])[0];
    if (!top) return "영향 요인 계산 대기";
    return `가장 영향이 큰 항목: ${displayFeatureName(top.feature)} (${top.prob_delta >= 0 ? "+" : ""}${top.prob_delta})`;
  }

  return "-";
}

function renderStepper(runData) {
  const stepStates = runData?.step_states || {};

  STEP_DEFS.forEach((step) => {
    const state = stepStates[step.key] || "pending";
    const card = document.getElementById(`step-${step.key}`);
    const stateEl = document.getElementById(`step-state-${step.key}`);
    const summaryEl = document.getElementById(`step-summary-${step.key}`);
    const rawEl = document.getElementById(`step-raw-${step.key}`);

    card.classList.remove("step-running", "step-completed", "step-failed");
    if (state === "running") card.classList.add("step-running");
    if (state === "completed") card.classList.add("step-completed");
    if (state === "failed") card.classList.add("step-failed");

    let badgeHtml = "대기";
    if (state === "running") {
      badgeHtml = '<span class="loading-dot"></span>진행 중';
    } else if (state === "completed") {
      badgeHtml = "완료";
    } else if (state === "failed") {
      badgeHtml = "중단";
    }

    stateEl.className = `badge ${state === "failed" ? "status-failed" : state === "completed" ? "status-completed" : "status-queued"}`;
    stateEl.innerHTML = badgeHtml;

    summaryEl.textContent = summarizeStep(step.key, runData);

    const artifactKey = STEP_ARTIFACT_KEYS[step.key];
    const rawPayload =
      artifactKey == null
        ? { missing_required: runData?.missing_required || [], status: runData?.status }
        : runData?.step_artifacts?.[artifactKey] || {};
    rawEl.textContent = compactJSON(rawPayload);
  });
}

function renderModelBreakdown(modelBreakdown) {
  $("#rf-proba").textContent = formatPercent(modelBreakdown?.rf_proba);
  $("#hgb-proba").textContent = formatPercent(modelBreakdown?.hgb_proba);
  $("#ens-proba").textContent = formatPercent(modelBreakdown?.ensemble_proba);
}

function renderSensitivityChart(localSensitivity) {
  const rows = localSensitivity?.features || [];
  const labels = rows.slice(0, 12).map((row) => displayFeatureName(row.feature));
  const data = rows.slice(0, 12).map((row) => Number(row.prob_delta || 0));
  const riskHigh = cssVar("--risk-high");
  const riskLow = cssVar("--risk-low");
  const borderColor = cssVar("--border");
  const background = data.map((v) => (v >= 0 ? riskHigh : riskLow));

  const ctx = document.getElementById("sensitivity-chart");
  if (!ctx) return;

  if (sensitivityChart) {
    sensitivityChart.data.labels = labels;
    sensitivityChart.data.datasets[0].data = data;
    sensitivityChart.data.datasets[0].backgroundColor = background;
    sensitivityChart.data.datasets[0].borderColor = background;
    sensitivityChart.update();
    return;
  }

  sensitivityChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "위험도 변화량",
          data,
          backgroundColor: background,
          borderColor: background,
          borderWidth: 1,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      resizeDelay: 150,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          grid: { color: borderColor },
          ticks: {
            callback: (value) => Number(value).toFixed(2),
          },
        },
        y: {
          grid: { display: false },
        },
      },
    },
  });
}

function renderDemoBucketChart(bucketCounts) {
  const labels = ["CN", "MCI", "DM"];
  const values = labels.map((label) => Number(bucketCounts?.[label] || 0));
  const palette = chartPalette();
  const colors = [palette[0], palette[1], palette[2]];
  const borderColor = cssVar("--border");

  const canvas = document.getElementById("demo-bucket-chart");
  if (!canvas) return;

  if (demoBucketChart) {
    demoBucketChart.data.datasets[0].data = values;
    demoBucketChart.update();
    return;
  }

  demoBucketChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "구간별 개수",
          data: values,
          backgroundColor: colors,
          borderColor: colors,
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 },
          grid: { color: borderColor },
        },
        x: {
          grid: { display: false },
        },
      },
    },
  });
}

function renderDemoSummary(summary) {
  $("#demo-summary").classList.remove("hidden");
  $("#demo-n").textContent = String(summary?.n ?? "-");
  $("#demo-cn").textContent = String(summary?.bucket_counts?.CN ?? "-");
  $("#demo-mci").textContent = String(summary?.bucket_counts?.MCI ?? "-");
  $("#demo-dm").textContent = String(summary?.bucket_counts?.DM ?? "-");
  $("#demo-mean").textContent = formatProbability(summary?.prob_mean);
  $("#demo-mci-mean").textContent = formatProbability(summary?.mci_mean);
  $("#demo-range").textContent = `${formatProbability(summary?.prob_min)} / ${formatProbability(summary?.prob_max)}`;
  $("#demo-priority-high").textContent = String(summary?.priority_counts?.High_Interest ?? "-");

  renderDemoBucketChart(summary?.bucket_counts || {});
}

function setDemoMessage(message, isError = false) {
  const el = $("#demo-message");
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? cssVar("--destructive") : cssVar("--muted-foreground");
}

async function generateDemoCsv() {
  const btn = $("#demo-generate-btn");
  const downloadLink = $("#demo-download-link");
  btn.disabled = true;
  downloadLink.classList.add("hidden");

  const payload = {
    n: 100,
    mix: { CN: 40, MCI: 35, DM: 25 },
    seed: 42,
    include_clipping_cases_ratio: 0.1,
  };

  try {
    const response = await fetch(`${API_BASE}/api/demo/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `데모 CSV 생성 실패 (${response.status})`);
    }

    const data = await response.json();
    renderDemoSummary(data.summary || {});

    downloadLink.href = `${API_BASE}${data.download_url}`;
    downloadLink.classList.remove("hidden");
    downloadLink.setAttribute("download", "stage1_demo_scored.csv");

    const warnings = data?.summary?.warnings || [];
    if (warnings.length > 0) {
      setDemoMessage(`생성 완료. 일부 목표 분포는 근사값으로 보정되었습니다: ${warnings.join(" | ")}`, false);
    } else {
      setDemoMessage(`생성 완료: ${data.path} (${data.summary?.n || 0}건)`, false);
    }
  } catch (error) {
    setDemoMessage(`데모 CSV 생성 중 오류: ${error.message}`, true);
  } finally {
    btn.disabled = false;
  }
}

function renderResult(runData) {
  const result = runData?.result;
  if (!result) {
    resetResultPanel();
    return;
  }

  const probability = Number(result.probability || 0);
  const width = Math.max(0, Math.min(1, probability)) * 100;

  $("#probability-text").textContent = formatPercent(probability);
  $("#probability-fill").style.width = `${width}%`;

  const riskBadge = $("#risk-badge");
  riskBadge.className = `badge ${riskBadgeClass(result.risk_label)}`;
  riskBadge.textContent = riskLabelKo(result.risk_label);
  const resultGuide = $("#result-guide");
  if (resultGuide) {
    resultGuide.textContent = riskAdvice(result.risk_label);
  }

  renderModelBreakdown(result.model_breakdown || runData?.step_artifacts?.model_breakdown || {});
  renderSensitivityChart(runData?.step_artifacts?.local_sensitivity || {});

  if (result.generated_at) {
    $("#generated-at").textContent = new Date(result.generated_at).toLocaleString();
  }

  $("#report-btn").disabled = false;
}

function renderRunData(runData) {
  latestRunPayload = runData;
  renderRunStatus(runData.status);
  renderMissing(runData);
  renderStepper(runData);

  if (runData.status === "COMPLETED") {
    renderResult(runData);
  } else if (runData.status === "DATA_MISSING") {
    resetResultPanel();
  }
}

async function pollRun(runId) {
  try {
    const response = await fetch(`${API_BASE}/api/run/${runId}`);
    if (!response.ok) throw new Error(`상태 조회 실패 (${response.status})`);

    const payload = await response.json();
    renderRunData(payload);

    if (TERMINAL_STATUS.has(payload.status)) {
      clearInterval(pollTimer);
      pollTimer = null;
      $("#run-btn").disabled = false;
    }
  } catch (error) {
    clearInterval(pollTimer);
    pollTimer = null;
    $("#run-btn").disabled = false;
    renderRunStatus("FAILED");
    const alert = $("#missing-message");
    alert.classList.remove("hidden");
    alert.textContent = `상태 조회 중 오류가 발생했습니다: ${error.message}`;
  }
}

async function startRun() {
  $("#run-btn").disabled = true;
  resetResultPanel();

  const payload = {
    values: collectValues(),
    options: {
      allow_missing_demo: $("#allow-missing-demo").checked,
    },
  };

  try {
    const response = await fetch(`${API_BASE}/api/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `계산 요청 실패 (${response.status})`);
    }

    const data = await response.json();
    currentRunId = data.run_id;
    $("#run-id").textContent = currentRunId;
    renderRunStatus("QUEUED");

    if (pollTimer) clearInterval(pollTimer);
    await pollRun(currentRunId);
    if (!TERMINAL_STATUS.has(latestRunPayload?.status)) {
      pollTimer = setInterval(() => pollRun(currentRunId), 450);
    }
  } catch (error) {
    $("#run-btn").disabled = false;
    renderRunStatus("FAILED");
    const alert = $("#missing-message");
    alert.classList.remove("hidden");
    alert.textContent = `계산 시작 중 오류가 발생했습니다: ${error.message}`;
  }
}

function tableFromObject(obj) {
  const rows = Object.entries(obj || {});
  if (!rows.length) return "<p>없음</p>";

  return `
    <table>
      <thead><tr><th>항목</th><th>값</th></tr></thead>
      <tbody>
        ${rows
          .map(
            ([key, value]) =>
              `<tr><td>${displayFeatureName(key)}</td><td><code>${typeof value === "object" ? JSON.stringify(value) : value}</code></td></tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function buildReportHtml(runData) {
  const result = runData?.result || {};
  const artifacts = runData?.step_artifacts || {};
  const sensitivityRows = artifacts.local_sensitivity?.features || [];
  const reportTheme = {
    background: cssVar("--background"),
    foreground: cssVar("--foreground"),
    card: cssVar("--card"),
    border: cssVar("--border"),
    muted: cssVar("--muted"),
    mutedForeground: cssVar("--muted-foreground"),
    secondary: cssVar("--secondary"),
  };

  const sensitivityTable = sensitivityRows.length
    ? `
      <table>
        <thead>
          <tr>
            <th>항목</th>
            <th>기준값</th>
            <th>변경값</th>
            <th>변화량</th>
            <th>위험도 변화</th>
          </tr>
        </thead>
        <tbody>
          ${sensitivityRows
            .map(
              (row) =>
                `<tr>
                  <td>${displayFeatureName(row.feature)}</td>
                  <td>${row.base_value}</td>
                  <td>${row.perturbed_value}</td>
                  <td>${row.delta_applied}</td>
                  <td>${row.prob_delta}</td>
                </tr>`
            )
            .join("")}
        </tbody>
      </table>
    `
    : "<p>민감도 데이터 없음</p>";

  return `
    <!DOCTYPE html>
    <html lang="ko">
      <head>
        <meta charset="UTF-8" />
        <title>Run Report - ${runData.run_id}</title>
        <style>
          :root {
            --report-background: ${reportTheme.background};
            --report-foreground: ${reportTheme.foreground};
            --report-card: ${reportTheme.card};
            --report-border: ${reportTheme.border};
            --report-muted: ${reportTheme.muted};
            --report-muted-foreground: ${reportTheme.mutedForeground};
            --report-secondary: ${reportTheme.secondary};
          }
          body { font-family: sans-serif; margin: 24px; color: var(--report-foreground); background: var(--report-background); }
          h1, h2 { margin: 0 0 10px; }
          .meta { margin-bottom: 14px; }
          .block { margin-bottom: 18px; padding: 12px; border: 1px solid var(--report-border); border-radius: 8px; background: var(--report-card); }
          table { border-collapse: collapse; width: 100%; font-size: 12px; }
          th, td { border: 1px solid var(--report-border); padding: 6px; text-align: left; vertical-align: top; }
          th { background: var(--report-muted); }
          code { white-space: pre-wrap; }
          .badge { display: inline-block; padding: 3px 8px; border-radius: 999px; background: var(--report-secondary); }
          .note { font-size: 12px; color: var(--report-muted-foreground); }
        </style>
      </head>
      <body>
        <h1>Stage1 ML Model Explainer - Run Report</h1>
        <p class="meta">
          실행 ID: <code>${runData.run_id}</code> |
          상태: <span class="badge">${STATUS_TEXT_MAP[runData.status] || runData.status}</span> |
          생성 시각: ${result.generated_at || "-"}
        </p>
        <p class="note">브라우저 인쇄 기능으로 PDF 저장이 가능합니다.</p>

        <div class="block">
          <h2>결과 요약</h2>
          <p>예상 위험도: <strong>${formatPercent(result.probability)}</strong></p>
          <p>위험 구간: <strong>${riskLabelKo(result.risk_label)}</strong></p>
          <p>RF/HGB/최종 평균: ${formatPercent(result.model_breakdown?.rf_proba)} / ${formatPercent(
            result.model_breakdown?.hgb_proba
          )} / ${formatPercent(result.model_breakdown?.ensemble_proba)}</p>
        </div>

        <div class="block">
          <h2>사용자 입력 원본</h2>
          ${tableFromObject(artifacts.input_raw)}
        </div>

        <div class="block">
          <h2>모델 입력 순서 정렬</h2>
          ${tableFromObject(artifacts.input_ordered)}
        </div>

        <div class="block">
          <h2>허용 범위 보정 내역</h2>
          ${tableFromObject(artifacts.clipping_delta)}
        </div>

        <div class="block">
          <h2>빈칸 자동 채움 값</h2>
          ${tableFromObject(artifacts.imputed_values)}
        </div>

        <div class="block">
          <h2>계산용 변환 결과</h2>
          ${tableFromObject(artifacts.scaled_values)}
        </div>

        <div class="block">
          <h2>모델별 결과 비교</h2>
          ${tableFromObject(artifacts.model_breakdown)}
        </div>

        <div class="block">
          <h2>영향 요인 분석</h2>
          ${sensitivityTable}
        </div>
      </body>
    </html>
  `;
}

function openReport() {
  if (!latestRunPayload || latestRunPayload.status !== "COMPLETED") return;
  const reportWindow = window.open("", "_blank");
  if (!reportWindow) return;
  reportWindow.document.write(buildReportHtml(latestRunPayload));
  reportWindow.document.close();
}

async function loadMeta() {
  let lastError = null;

  try {
    for (const candidate of API_CANDIDATES) {
      try {
        const response = await fetch(`${candidate}/api/meta`);
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || `초기 정보 불러오기 실패 (${response.status})`);
        }

        API_BASE = candidate;
        meta = await response.json();
        $("#model-version").textContent = meta.model_version || "unknown";
        renderInputForm();
        $("#run-btn").disabled = false;
        $("#demo-generate-btn").disabled = false;
        return;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("연결 가능한 서버가 없습니다");
  } catch (error) {
    const alert = $("#missing-message");
    alert.classList.remove("hidden");
    alert.textContent = `초기 정보를 불러오지 못했습니다: ${error.message}`;
    $("#model-version").textContent = "불러오기 실패";
  }
}

function init() {
  initStepper();
  initInputPanelToggle();
  resetResultPanel();
  $("#run-btn").disabled = true;
  $("#demo-generate-btn").disabled = true;
  $("#run-btn").addEventListener("click", startRun);
  $("#report-btn").addEventListener("click", openReport);
  $("#demo-generate-btn").addEventListener("click", generateDemoCsv);
  loadMeta();
}

init();
