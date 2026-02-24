# Repository Structure

아래 기준으로 레포를 정리했습니다.

## 1) 핵심 원본 소스코드 (Core Source)
- `src/` : 3-Stage 데모 프론트엔드 소스
- `stage1_ML/` : Stage1 원본 모델/설명 서비스 소스
- `stage2_ann/` : Stage2 원본 모델/설명 서비스 소스
- `stage3_final/core_source/stage3_예측모델/` : Stage3 원본 파이프라인 소스 (`run_pipeline.py`, `utils.py`)

## 2) 데이터/모델 자산 (Data)
- `stage3_final/data/preprocessing/` : Stage3 전처리 자산 (`stage2_mice_imputer.pkl`, `stage2_scaler.pkl`)
- `stage3_final/stage_3_cnn/TEST_IMAGE/` : Stage3 MRI 샘플 이미지
- `stage3_final/stage_3_cnn/best_model_final.keras` : Stage3 CNN 가중치
- `stage2_modelfinal/` : Stage2 ANN 가중치(5-seed)

## 3) 서비스 실행 소스 (Services)
- `stage1_ML/stage1-model-explainer/`
- `stage2_ann/stage2-ann-explainer/`
- `stage3_final/stage_3_cnn/stage3-cnn-explainer/`
- `stage3_final/services/stage3-future-explainer/`

## 정리 항목
- 미사용/임시 파일 삭제
  - `stage3_final/Untitled8.ipynb`
  - `stage3_final/mode_is_good.py`
  - `stage3_final/scaler_cog_bio.pkl`
  - `stage3_final/scaler_health.pkl`
- 빌드 산출물/캐시 제거
  - `node_modules/`, `dist/`, `*.tsbuildinfo`, `vite.config.js`, `vite.config.d.ts`
  - `__pycache__/`, `.DS_Store`
