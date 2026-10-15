# Neuro-Shield — ADNI-based Dementia Risk Management System

> **Project portfolio:** [Neuro-Shield — ADNI Dementia Risk Management Portfolio (Notion)](https://app.notion.com/p/3f16cc14e6038187a443e966874a7d60)  
> **My role:** Project & service planning · Implementation · Visualization  
> **Dataset / domain:** ADNI3 clinical, cognitive, and MRI-related data · MCI / Alzheimer's disease  
> **Service stack:** React/Vite · FastAPI · PostgreSQL · Docker · Linux/Ubuntu · OCI

## Project Overview

Neuro-Shield is a team project designed to connect dementia-risk analyses with a **screening → staged analysis → case tracking → follow-up management** workflow. The service separates predictive risk signals from clinical diagnoses: results inform additional review and follow-up, rather than making clinical decisions automatically.

## My Contributions

My primary responsibility was **project/service planning, implementation, and visualization**, including:

- Defining stage-specific service flows and linking risk-model outputs to screening and follow-up actions.
- Building and organizing a React/Vite frontend, dashboards, case views, and tracking interfaces.
- Developing/integrating FastAPI backend components and PostgreSQL-backed case/workflow management.
- Configuring web/API/database services with Docker Compose and documenting Linux/OCI deployment steps.
- Presenting project objectives, service architecture, model-to-workflow integration, and practical issues including false positives, privacy, and operator review.

**Contribution boundary:** The ML/ANN/MRI modeling below represents **team project work**. I did **not** individually develop or train every model in the pipeline; my main direct contribution was the service design, implementation, visualization, and integration of model outputs.

## Data and Longitudinal Modeling

The team's ADNI3 work combined clinical/cognitive measurements and MRI-related information, including:

- Demographics, diagnosis and visit history.
- MMSE, CDR/CDRSB, FAQ, and delayed-recall cognitive measures.
- FreeSurfer-derived structural MRI ROI features, DTI ROI summaries, and T1 MRI data.

A Stage 2 ANN dataset documented **1,042 observations across 533 subjects** (866 MCI, 176 AD), with approximately 1.95 visits per subject. This made subject-based splitting, baseline and visit ordering, follow-up windows, leakage control, and class imbalance important considerations.

## Team Modeling Pipeline

### Stage 1 — Screening

The initial stage generates signals for *additional evaluation or prioritization*, rather than definite medical diagnoses. Risk output is translated into a workflow-friendly screening signal.

### Stage 2 — ANN Risk Modeling

The team processed longitudinal subject/visit records, used forward filling and training-set-fitted imputation (MICE), engineered and scaled features, and trained multi-input ANN / soft-voting architectures over health, cognitive, and engineered feature groups.

**Team-reported results:** accuracy **0.90**, macro F1 **0.86**, weighted F1 **0.91**, AD recall **0.93**. Low/Mid/High MCI risk groups were based on thresholds applied to predicted AD probability, **not independently established clinical diagnoses**.

### Stage 3 — MRI / Multimodal

Team materials describe a three-class CN/MCI/Dementia MRI study with approximately **1,127 subjects** and **13,590 2D MRI slices**. The workflow included DICOM/NIfTI handling, registration/orientation, skull stripping, bias correction, intensity normalization, multi-plane slicing, resizing, denoising, augmentation, and related steps.

The team used **EfficientNet-based transfer learning with attention** and documented **91.4% test accuracy**, **0.89 macro F1**, and **0.28 test loss**, alongside confusion matrix/calibration/occlusion/heatmap interpretation. These are **team-level reported metrics**, not my individually reproduced results or clinical validation.

### Progression Analysis

The team further explored **MCI → AD conversion**, baseline/follow-up diagnosis, censoring, **Kaplan–Meier** analysis, and **Random Survival Forest**, shifting the question from present classification toward *when disease conversion risk might increase*.

## Service Architecture

```text
ADNI-based analysis / team model outputs
                  ↓
         Risk / stage signal
                  ↓
         FastAPI service layer
                  ↓
      PostgreSQL case & workflow DB
                  ↓
    React/Vite dashboard & follow-up UI
```

**Risk signal ≠ clinical diagnosis.** The system is designed around *Human-in-the-Loop* review, tracking, and management support; it is not a clinically deployed diagnostic device.

## What I Learned

- **Longitudinal cohorts:** subject-wise splitting, baseline selection, follow-up, missingness, and leakage control can meaningfully affect evaluation.
- **Multimodal data:** clinical, cognitive, and MRI information must be aligned by subject and time; combining features is not sufficient by itself.
- **Research-to-service:** producing predictive scores and converting those into responsible, traceable operator workflows are different technical problems.
- **Research direction:** The project built upon an earlier interest in BCI and brain function, and strengthened my interest in preprocessing, modeling, and analyzing MRI/fMRI, EEG, and other biomedical information. Dementia risk management is one application area rather than my sole research goal.

## Repository Structure

- `src/` — React/Vite frontend.
- `server_fastapi/` — FastAPI backend.
- `deploy/` — deployment-related configuration.
- `docker-compose.yml` — service container orchestration.
- `3-step_model_final/` — integrated stage-related project materials; model components belong to the team project.

## Running the Service (Existing Development Guide)

**Frontend:**

```bash
npm i
npm run dev
```

**Local backend stack:**

```bash
docker compose up -d api db redis minio sms worker beat
```

Optionally expose the local API, for example using `cloudflared tunnel --url http://localhost:80`, then open the frontend with an `?apiBase=https://<tunnel-host>` query parameter. Set `CORS_ORIGINS` in `.env` as needed, then restart `docker compose up -d --build api`.

API URL priority: URL query `apiBase` → browser `localStorage["neuro_shield_api_base"]` → `VITE_API_BASE_URL`.

UI source reference: [Figma — UI/UX Structure Enhancement](https://www.figma.com/design/WjxvjXNuFweVSxoHZ6PNBJ/UI-UX-Structure-Enhancement).

> **Reproducibility caveat:** These commands document service development and are not sufficient to reproduce the full team's ADNI preprocessing, training runs, or performance without the applicable data and environments.

---

For the full project explanation, see the **[Notion ADNI portfolio](https://app.notion.com/p/3f16cc14e6038187a443e966874a7d60)**.
