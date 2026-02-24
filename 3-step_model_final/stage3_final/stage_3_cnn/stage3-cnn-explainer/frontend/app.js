const BACKEND_BASE = `${window.location.protocol}//${window.location.hostname}:8001`;
const POLL_INTERVAL_MS = 700;

const STEP_ORDER = [
  "VALIDATING",
  "RESIZE",
  "PREPROCESS",
  "INFERENCING",
  "EXPLAINING",
  "COMPLETED",
];

const STEP_DESCRIPTION = {
  VALIDATING: "입력 이미지 유효성 검사 및 원본 정보 수집",
  RESIZE: "모델 규격 (224x224) 리사이즈",
  PREPROCESS: "EfficientNet preprocess_input 적용",
  INFERENCING: "model(x, training=false)로 softmax 확률 산출",
  EXPLAINING: "Grad-CAM / Occlusion 기반 시각 근거 생성",
  COMPLETED: "실행 완료",
};

const CLASS_LABEL = {
  CN: "CN",
  DM: "DM (치매/AD)",
  MCI: "MCI",
};

const state = {
  meta: null,
  samples: { CN: [], DM: [], MCI: [] },
  inputMode: "sample",
  sampleClass: "CN",
  selectedSampleId: null,
  uploadedFile: null,
  runId: null,
  runData: null,
  pollTimer: null,
  selectedStep: null,
  lastPipelineStatus: null,
  gradcamView: "overlay",
  chart: null,
};

const el = {
  runIdLabel: document.getElementById("runIdLabel"),
  statusBadge: document.getElementById("statusBadge"),
  backboneLabel: document.getElementById("backboneLabel"),
  inputSizeLabel: document.getElementById("inputSizeLabel"),
  tabButtons: document.querySelectorAll(".tab-btn"),
  sampleTab: document.getElementById("sampleTab"),
  uploadTab: document.getElementById("uploadTab"),
  sampleClassTabs: document.getElementById("sampleClassTabs"),
  sampleGrid: document.getElementById("sampleGrid"),
  dropZone: document.getElementById("dropZone"),
  fileInput: document.getElementById("fileInput"),
  uploadPreviewBox: document.getElementById("uploadPreviewBox"),
  uploadPreview: document.getElementById("uploadPreview"),
  uploadFilename: document.getElementById("uploadFilename"),
  optExplain: document.getElementById("optExplain"),
  optOcclusion: document.getElementById("optOcclusion"),
  runBtn: document.getElementById("runBtn"),
  inputWarning: document.getElementById("inputWarning"),
  stepper: document.getElementById("stepper"),
  artifactTitle: document.getElementById("artifactTitle"),
  artifactBody: document.getElementById("artifactBody"),
  predClass: document.getElementById("predClass"),
  predConfidence: document.getElementById("predConfidence"),
  probChart: document.getElementById("probChart"),
  probFallback: document.getElementById("probFallback"),
  gradcamMeta: document.getElementById("gradcamMeta"),
  gradcamImage: document.getElementById("gradcamImage"),
  camToggleButtons: document.querySelectorAll("[data-cam-view]"),
  occlusionCard: document.getElementById("occlusionCard"),
  occlusionImage: document.getElementById("occlusionImage"),
  occlusionTopList: document.getElementById("occlusionTopList"),
  printReportBtn: document.getElementById("printReportBtn"),
  printReport: document.getElementById("printReport"),
  imageModal: document.getElementById("imageModal"),
  modalImage: document.getElementById("modalImage"),
  modalCloseBtn: document.getElementById("modalCloseBtn"),
};

async function init() {
  bindEvents();
  await Promise.all([fetchMeta(), fetchSamples()]);
  renderSampleClassTabs();
  renderSampleGrid();
  renderStepper();
  initChart();
}

function bindEvents() {
  el.tabButtons.forEach((button) => {
    button.addEventListener("click", () => setInputMode(button.dataset.tab));
  });

  el.sampleClassTabs.addEventListener("click", (event) => {
    const target = event.target.closest("button.class-tab-btn");
    if (!target) return;
    state.sampleClass = target.dataset.class;
    renderSampleClassTabs();
    renderSampleGrid();
  });

  el.sampleGrid.addEventListener("click", (event) => {
    const item = event.target.closest("button.sample-item");
    if (!item) return;
    state.selectedSampleId = item.dataset.id;
    state.uploadedFile = null;
    clearUploadPreview();
    setInputMode("sample");
    renderSampleGrid();
  });

  ["dragenter", "dragover"].forEach((type) => {
    el.dropZone.addEventListener(type, (event) => {
      event.preventDefault();
      el.dropZone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach((type) => {
    el.dropZone.addEventListener(type, (event) => {
      event.preventDefault();
      el.dropZone.classList.remove("dragover");
    });
  });

  el.dropZone.addEventListener("drop", (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  });

  el.fileInput.addEventListener("change", () => {
    const file = el.fileInput.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  });

  el.runBtn.addEventListener("click", startRun);

  el.camToggleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.gradcamView = button.dataset.camView;
      renderGradcamPanel();
    });
  });

  el.gradcamImage.addEventListener("click", () => openImageModal(el.gradcamImage.src));
  el.occlusionImage.addEventListener("click", () => openImageModal(el.occlusionImage.src));

  el.imageModal.addEventListener("click", (event) => {
    if (event.target.dataset.closeModal === "true") {
      closeImageModal();
    }
  });
  el.modalCloseBtn.addEventListener("click", closeImageModal);

  el.printReportBtn.addEventListener("click", () => {
    if (!state.runData) {
      el.inputWarning.textContent = "리포트를 생성할 run 데이터가 없습니다.";
      return;
    }
    buildPrintReport();
    window.print();
  });
}

function setInputMode(mode) {
  state.inputMode = mode;

  el.tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === mode);
  });

  el.sampleTab.classList.toggle("active", mode === "sample");
  el.uploadTab.classList.toggle("active", mode === "upload");
}

function setUploadedFile(file) {
  state.uploadedFile = file;
  state.selectedSampleId = null;
  setInputMode("upload");
  renderSampleGrid();

  const reader = new FileReader();
  reader.onload = () => {
    el.uploadPreview.src = reader.result;
    el.uploadFilename.textContent = file.name;
    el.uploadPreviewBox.classList.remove("hidden");
  };
  reader.readAsDataURL(file);
}

function clearUploadPreview() {
  el.fileInput.value = "";
  el.uploadPreview.src = "";
  el.uploadFilename.textContent = "";
  el.uploadPreviewBox.classList.add("hidden");
}

async function fetchMeta() {
  const response = await fetch(`${BACKEND_BASE}/api/meta`);
  if (!response.ok) {
    throw new Error(`meta fetch failed (${response.status})`);
  }

  state.meta = await response.json();

  el.backboneLabel.textContent = state.meta?.model_info?.backbone_name ?? "-";
  el.inputSizeLabel.textContent = state.meta?.input_size?.join(" x ") ?? "-";
}

async function fetchSamples() {
  const response = await fetch(`${BACKEND_BASE}/api/samples`);
  if (!response.ok) {
    throw new Error(`samples fetch failed (${response.status})`);
  }

  const data = await response.json();
  state.samples = data.samples || data || { CN: [], DM: [], MCI: [] };
}

function renderSampleClassTabs() {
  const keys = ["CN", "DM", "MCI"].filter((key) => Array.isArray(state.samples[key]));
  if (!keys.includes(state.sampleClass)) {
    state.sampleClass = keys[0] || "CN";
  }

  el.sampleClassTabs.innerHTML = keys
    .map((key) => {
      const activeClass = state.sampleClass === key ? "active" : "";
      return `<button class="class-tab-btn ${activeClass}" data-class="${key}">${CLASS_LABEL[key] || key}</button>`;
    })
    .join("");
}

function renderSampleGrid() {
  const items = state.samples[state.sampleClass] || [];
  if (!items.length) {
    el.sampleGrid.innerHTML = "<p>샘플 이미지가 없습니다.</p>";
    return;
  }

  el.sampleGrid.innerHTML = items
    .map((item) => {
      const active = state.selectedSampleId === item.id ? "active" : "";
      const thumb = `${BACKEND_BASE}${item.url_thumbnail}`;
      return `
        <button class="sample-item ${active}" data-id="${escapeHtml(item.id)}">
          <img src="${thumb}" alt="${escapeHtml(item.name)}" />
          <p>${escapeHtml(item.name)}</p>
        </button>
      `;
    })
    .join("");
}

async function startRun() {
  el.inputWarning.textContent = "";

  const hasUpload = !!state.uploadedFile;
  const hasSample = !!state.selectedSampleId;

  if (!hasUpload && !hasSample) {
    el.inputWarning.textContent = "이미지를 선택하거나 업로드해 주세요.";
    return;
  }

  el.runBtn.disabled = true;

  const formData = new FormData();
  if (hasUpload) {
    formData.append("file", state.uploadedFile);
  } else if (hasSample) {
    formData.append("sample_id", state.selectedSampleId);
  }

  formData.append("explain", String(el.optExplain.checked));
  formData.append("occlusion", String(el.optOcclusion.checked));
  formData.append("allow_cpu_only", "true");

  try {
    const response = await fetch(`${BACKEND_BASE}/api/run`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `run start failed (${response.status})`);
    }

    const data = await response.json();
    state.runId = data.run_id;
    state.runData = null;
    state.lastPipelineStatus = null;
    state.selectedStep = "VALIDATING";
    el.runIdLabel.textContent = data.run_id;

    updateStatusBadge("QUEUED");
    renderStepper();
    resetResultsPanel();
    startPolling();
  } catch (error) {
    el.inputWarning.textContent = `실행 실패: ${error.message}`;
    el.runBtn.disabled = false;
  }
}

function startPolling() {
  stopPolling();
  pollRun();
  state.pollTimer = setInterval(pollRun, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (state.pollTimer) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
}

async function pollRun() {
  if (!state.runId) return;

  try {
    const response = await fetch(`${BACKEND_BASE}/api/run/${state.runId}`);
    if (!response.ok) {
      throw new Error(`poll failed (${response.status})`);
    }

    state.runData = await response.json();

    const status = state.runData.status;
    if (STEP_ORDER.includes(status)) {
      state.lastPipelineStatus = status;
      if (!state.selectedStep || !STEP_ORDER.includes(state.selectedStep)) {
        state.selectedStep = status;
      }
    }

    updateStatusBadge(status);
    renderStepper();
    renderArtifactPanel();
    renderResultPanel();

    if (["COMPLETED", "FAILED", "DATA_MISSING"].includes(status)) {
      stopPolling();
      el.runBtn.disabled = false;
    }
  } catch (error) {
    stopPolling();
    el.runBtn.disabled = false;
    el.inputWarning.textContent = `상태 조회 실패: ${error.message}`;
  }
}

function renderStepper() {
  const status = state.runData?.status || "IDLE";

  const cards = STEP_ORDER.map((step) => {
    const visualState = getStepVisualState(step, status);
    const selected = state.selectedStep === step ? "selected" : "";

    const loading = visualState === "active"
      ? '<span class="loading-dot"><span></span><span></span><span></span></span>'
      : "";

    return `
      <div class="step-card ${visualState} ${selected}" data-step="${step}">
        <h4>${step}${loading}</h4>
        <p>${STEP_DESCRIPTION[step]}</p>
      </div>
    `;
  }).join("");

  el.stepper.innerHTML = cards;

  el.stepper.querySelectorAll(".step-card").forEach((card) => {
    card.addEventListener("click", () => {
      state.selectedStep = card.dataset.step;
      renderStepper();
      renderArtifactPanel();
    });
  });
}

function getStepVisualState(step, status) {
  if (status === "FAILED") {
    return state.lastPipelineStatus === step ? "failed" : "pending";
  }

  if (status === "DATA_MISSING" || status === "QUEUED" || status === "IDLE") {
    return "pending";
  }

  if (status === "COMPLETED") {
    return "done";
  }

  const currentIndex = STEP_ORDER.indexOf(status);
  const stepIndex = STEP_ORDER.indexOf(step);

  if (stepIndex < currentIndex) return "done";
  if (stepIndex === currentIndex) return "active";
  return "pending";
}

function renderArtifactPanel() {
  if (!state.runData) {
    el.artifactTitle.textContent = "Step Artifact";
    el.artifactBody.textContent = "run을 시작하면 단계별 산출물이 표시됩니다.";
    return;
  }

  const step = state.selectedStep || state.lastPipelineStatus || "VALIDATING";
  const artifacts = state.runData.step_artifacts || {};

  el.artifactTitle.textContent = `${step} Artifact`;

  if (step === "VALIDATING") {
    const info = artifacts.input_info;
    const original = imageFromBase64(artifacts.image_preview_original);
    el.artifactBody.innerHTML = `
      ${info ? `
      <table class="stat-table">
        <tr><td>filename</td><td>${escapeHtml(info.filename)}</td></tr>
        <tr><td>mime</td><td>${escapeHtml(info.mime)}</td></tr>
        <tr><td>original_size</td><td>${escapeHtml((info.original_size || []).join(" x "))}</td></tr>
      </table>
      ` : "<p>입력 정보가 아직 없습니다.</p>"}
      ${original ? `<img class="artifact-img" src="${original}" alt="Original" />` : ""}
      ${renderRawDetails(artifacts)}
    `;
    return;
  }

  if (step === "RESIZE") {
    const resized = imageFromBase64(artifacts.image_preview_resized);
    el.artifactBody.innerHTML = `
      <p>리사이즈 결과: 224 x 224 x 3</p>
      ${resized ? `<img class="artifact-img" src="${resized}" alt="Resized" />` : "<p>리사이즈 산출물이 없습니다.</p>"}
      ${renderRawDetails({ image_preview_resized: artifacts.image_preview_resized })}
    `;
    return;
  }

  if (step === "PREPROCESS") {
    const stats = artifacts.preprocess_stats;
    el.artifactBody.innerHTML = stats
      ? `
        <table class="stat-table">
          <tr><td>min</td><td>${num(stats.min)}</td></tr>
          <tr><td>max</td><td>${num(stats.max)}</td></tr>
          <tr><td>mean</td><td>${num(stats.mean)}</td></tr>
          <tr><td>std</td><td>${num(stats.std)}</td></tr>
        </table>
        <p>전처리: <code>tf.keras.applications.efficientnet.preprocess_input</code></p>
        ${renderRawDetails({ preprocess_stats: stats })}
      `
      : "<p>전처리 통계가 아직 없습니다.</p>";
    return;
  }

  if (step === "INFERENCING") {
    const probs = artifacts.probs_ui || artifacts.probs;
    el.artifactBody.innerHTML = probs
      ? `
        <table class="stat-table">
          ${Object.entries(probs)
            .map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${(value * 100).toFixed(2)}%</td></tr>`)
            .join("")}
          <tr><td>top_class</td><td>${escapeHtml(artifacts.top_class_ui || artifacts.top_class || "-")}</td></tr>
          <tr><td>confidence</td><td>${((artifacts.confidence || 0) * 100).toFixed(2)}%</td></tr>
        </table>
        ${renderRawDetails({ probs, top_class: artifacts.top_class_ui || artifacts.top_class, confidence: artifacts.confidence })}
      `
      : "<p>추론 결과가 아직 없습니다.</p>";
    return;
  }

  if (step === "EXPLAINING") {
    const gradcam = artifacts.gradcam;
    const occlusion = artifacts.occlusion;
    const gradImage = gradcam ? imageFromBase64(gradcam.overlay || gradcam.heatmap) : null;
    const occImage = occlusion ? imageFromBase64(occlusion.delta_map) : null;

    el.artifactBody.innerHTML = `
      ${gradcam && !gradcam.disabled ? `<p>target_layer: <code>${escapeHtml(gradcam.target_layer_name)}</code></p>` : "<p>Grad-CAM 비활성 또는 미생성</p>"}
      <div class="artifact-grid">
        ${gradImage ? `<img class="artifact-img" src="${gradImage}" alt="GradCAM" />` : ""}
        ${occImage ? `<img class="artifact-img" src="${occImage}" alt="Occlusion" />` : ""}
      </div>
      ${renderRawDetails({ gradcam, occlusion })}
    `;
    return;
  }

  if (step === "COMPLETED") {
    el.artifactBody.innerHTML = `
      <p>Pipeline execution completed.</p>
      <p>최종 status: <code>${escapeHtml(state.runData.status)}</code></p>
      ${renderRawDetails(state.runData)}
    `;
    return;
  }
}

function renderRawDetails(payload) {
  const compact = compactForRaw(payload);
  return `
    <details>
      <summary>Raw JSON</summary>
      <pre>${escapeHtml(JSON.stringify(compact, null, 2))}</pre>
    </details>
  `;
}

function renderResultPanel() {
  if (!state.runData) {
    resetResultsPanel();
    return;
  }

  const status = state.runData.status;
  const artifacts = state.runData.step_artifacts || {};

  if (status === "DATA_MISSING") {
    el.predClass.textContent = "DATA_MISSING";
    el.predConfidence.textContent = "입력 없음";
    updateChart([0, 0, 0]);
    el.gradcamMeta.textContent = "입력 이미지가 없어 결과를 생성하지 않았습니다.";
    el.gradcamImage.classList.add("hidden");
    el.occlusionCard.classList.add("hidden");
    return;
  }

  const probs = artifacts.probs_ui || artifacts.probs;
  if (probs) {
    const entries = Object.entries(probs);
    const labels = entries.map(([label]) => label);
    const values = entries.map(([, value]) => Number(value) * 100);

    const topClass = artifacts.top_class_ui || artifacts.top_class || "-";
    const confidence = Number(artifacts.confidence || 0) * 100;

    el.predClass.textContent = topClass;
    el.predConfidence.textContent = `${confidence.toFixed(2)}%`;

    updateChart(values, labels);
  }

  renderGradcamPanel();
  renderOcclusionPanel();
}

function renderGradcamPanel() {
  const gradcam = state.runData?.step_artifacts?.gradcam;

  el.camToggleButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.camView === state.gradcamView);
  });

  if (!gradcam || gradcam.disabled) {
    el.gradcamMeta.textContent = "No Grad-CAM output yet.";
    el.gradcamImage.classList.add("hidden");
    return;
  }

  const key = state.gradcamView === "heatmap" ? "heatmap" : "overlay";
  const src = imageFromBase64(gradcam[key]);
  if (!src) {
    el.gradcamMeta.textContent = "Grad-CAM 이미지를 불러오지 못했습니다.";
    el.gradcamImage.classList.add("hidden");
    return;
  }

  el.gradcamMeta.textContent = `target layer: ${gradcam.target_layer_name}`;
  el.gradcamImage.src = src;
  el.gradcamImage.classList.remove("hidden");
}

function renderOcclusionPanel() {
  const occlusion = state.runData?.step_artifacts?.occlusion;
  if (!occlusion) {
    el.occlusionCard.classList.add("hidden");
    el.occlusionTopList.innerHTML = "";
    return;
  }

  const src = imageFromBase64(occlusion.delta_map);
  if (src) {
    el.occlusionImage.src = src;
  }

  const topRegions = occlusion.top_regions || [];
  if (!topRegions.length) {
    el.occlusionTopList.innerHTML = "<li>확률 하락 영역이 감지되지 않았습니다.</li>";
  } else {
    el.occlusionTopList.innerHTML = topRegions
      .map((region) => {
        return `<li>Top${region.rank}: (${region.x}, ${region.y}) drop=${(region.prob_drop * 100).toFixed(2)}%</li>`;
      })
      .join("");
  }

  el.occlusionCard.classList.remove("hidden");
}

function resetResultsPanel() {
  el.predClass.textContent = "-";
  el.predConfidence.textContent = "-";
  updateChart([0, 0, 0], ["CN", "DM", "MCI"]);
  el.gradcamMeta.textContent = "No Grad-CAM output yet.";
  el.gradcamImage.classList.add("hidden");
  el.gradcamImage.src = "";
  el.occlusionCard.classList.add("hidden");
}

function updateStatusBadge(status) {
  const label = status || "IDLE";
  const normalized = label.toLowerCase();

  el.statusBadge.textContent = label;
  el.statusBadge.className = "badge";

  if (label === "COMPLETED") {
    el.statusBadge.classList.add("badge-completed");
    return;
  }

  if (label === "FAILED") {
    el.statusBadge.classList.add("badge-failed");
    return;
  }

  if (label === "DATA_MISSING") {
    el.statusBadge.classList.add("badge-data-missing");
    return;
  }

  if (label === "QUEUED") {
    el.statusBadge.classList.add("badge-queued");
    return;
  }

  if (["validating", "resize", "preprocess", "inferencing", "explaining"].includes(normalized)) {
    el.statusBadge.classList.add("badge-running");
    return;
  }

  el.statusBadge.classList.add("badge-idle");
}

function initChart() {
  state.chart = new Chart(el.probChart, {
    type: "bar",
    data: {
      labels: ["CN", "DM", "MCI"],
      datasets: [
        {
          label: "Probability (%)",
          data: [0, 0, 0],
          backgroundColor: ["#2c7be5", "#d9534f", "#f0ad4e"],
          borderRadius: 6,
          maxBarThickness: 50,
        },
      ],
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: {
            callback: (value) => `${value}%`,
            font: { family: "IBM Plex Mono" },
          },
        },
        x: {
          ticks: {
            font: { family: "IBM Plex Mono" },
          },
        },
      },
    },
  });
}

function updateChart(values, labels = ["CN", "DM (치매/AD)", "MCI"]) {
  renderProbabilityFallback(values, labels);
  if (!state.chart) return;
  state.chart.data.labels = labels;
  state.chart.data.datasets[0].data = values;
  state.chart.update();
}

function renderProbabilityFallback(values, labels) {
  const colors = ["#2c7be5", "#d9534f", "#f0ad4e"];
  const safeValues = Array.isArray(values) ? values : [];
  const safeLabels = Array.isArray(labels) ? labels : [];
  const length = Math.max(safeValues.length, safeLabels.length, 3);

  const rows = [];
  for (let i = 0; i < length; i += 1) {
    const label = safeLabels[i] ?? `Class ${i + 1}`;
    const numeric = Number(safeValues[i] ?? 0);
    const clamped = Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : 0;
    const color = colors[i % colors.length];

    rows.push(`
      <div class="prob-row">
        <span class="label">${escapeHtml(label)}</span>
        <div class="track"><div class="fill" style="width:${clamped.toFixed(2)}%;background:${color};"></div></div>
        <span class="value">${clamped.toFixed(2)}%</span>
      </div>
    `);
  }

  el.probFallback.innerHTML = rows.join("");
}

function buildPrintReport() {
  const run = state.runData;
  const artifacts = run.step_artifacts || {};
  const inputInfo = artifacts.input_info || {};

  const original = imageFromBase64(artifacts.image_preview_original);
  const resized = imageFromBase64(artifacts.image_preview_resized);
  const gradcam = imageFromBase64(artifacts.gradcam?.overlay);
  const occlusion = imageFromBase64(artifacts.occlusion?.delta_map);

  el.printReport.innerHTML = `
    <div class="report-title">
      <h2>Stage3 CNN Run Report</h2>
      <p>run_id: ${escapeHtml(run.run_id || "-")} | status: ${escapeHtml(run.status || "-")}</p>
      <p>model: ${escapeHtml(state.meta?.model_info?.backbone_name || "EfficientNetB3")} | input: ${escapeHtml((state.meta?.input_size || [224, 224]).join("x"))}</p>
    </div>

    <div class="report-grid">
      <div class="report-block">
        <h3>Input</h3>
        <p>filename: ${escapeHtml(inputInfo.filename || "-")}</p>
        <p>mime: ${escapeHtml(inputInfo.mime || "-")}</p>
        <p>original_size: ${escapeHtml((inputInfo.original_size || []).join(" x ") || "-")}</p>
        ${original ? `<img src="${original}" alt="original" />` : ""}
      </div>

      <div class="report-block">
        <h3>Resize / Preprocess</h3>
        <p>target size: 224 x 224</p>
        <p>min/max/mean/std: ${escapeHtml(
          artifacts.preprocess_stats
            ? `${num(artifacts.preprocess_stats.min)} / ${num(artifacts.preprocess_stats.max)} / ${num(artifacts.preprocess_stats.mean)} / ${num(artifacts.preprocess_stats.std)}`
            : "-"
        )}</p>
        ${resized ? `<img src="${resized}" alt="resized" />` : ""}
      </div>

      <div class="report-block">
        <h3>Inference</h3>
        <p>predicted: ${escapeHtml(artifacts.top_class_ui || artifacts.top_class || "-")}</p>
        <p>confidence: ${escapeHtml(
          artifacts.confidence !== undefined ? `${(artifacts.confidence * 100).toFixed(2)}%` : "-"
        )}</p>
        <pre>${escapeHtml(JSON.stringify(artifacts.probs_ui || artifacts.probs || {}, null, 2))}</pre>
      </div>

      <div class="report-block">
        <h3>Explainability</h3>
        <p>target layer: ${escapeHtml(artifacts.gradcam?.target_layer_name || "-")}</p>
        ${gradcam ? `<img src="${gradcam}" alt="gradcam" />` : "<p>Grad-CAM output 없음</p>"}
        ${occlusion ? `<img src="${occlusion}" alt="occlusion" />` : ""}
      </div>
    </div>
  `;
}

function imageFromBase64(data) {
  if (!data) return null;
  return `data:image/png;base64,${data}`;
}

function openImageModal(src) {
  if (!src) return;
  el.modalImage.src = src;
  el.imageModal.classList.remove("hidden");
}

function closeImageModal() {
  el.modalImage.src = "";
  el.imageModal.classList.add("hidden");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function num(value) {
  return Number(value).toFixed(6);
}

function compactForRaw(value) {
  if (Array.isArray(value)) {
    return value.map((item) => compactForRaw(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, compactForRaw(val)]));
  }

  if (typeof value === "string" && value.length > 180) {
    return `${value.slice(0, 80)}...<trimmed>...${value.slice(-50)} (len=${value.length})`;
  }

  return value;
}

window.addEventListener("beforeunload", () => {
  stopPolling();
});

init().catch((error) => {
  updateStatusBadge("FAILED");
  el.inputWarning.textContent = `초기화 실패: ${error.message}`;
});
