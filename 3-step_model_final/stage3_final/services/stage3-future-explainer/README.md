# Stage3 Future Predictor

`run_pipeline.py` / `utils.py` 원본 로직을 API로 감싼 Stage3 실제 예측 백엔드입니다.

## 실행

```bash
cd stage3_final/services/stage3-future-explainer
docker-compose up --build
```

- API: [http://localhost:8002](http://localhost:8002)
- OpenAPI: [http://localhost:8002/docs](http://localhost:8002/docs)

## 엔드포인트

- `GET /api/meta`
- `POST /api/predict`

요청 예시:

```json
{
  "subject_id": "002_S_1155",
  "scan_id": "MRI-002_S_1155-2026Q1"
}
```

## 데이터/모델 경로

컨테이너는 `STAGE3_PROJECT_ROOT`(기본: 자동 탐지) 아래의 다음 자원을 사용합니다.

- `stage3_final/core_source/stage3_예측모델/ADNI3_Golden_Master_Longitudinal_image.csv`
- `stage3_final/core_source/stage3_예측모델/delta_patient_level.csv`
- `stage3_final/stage_3_cnn/best_model_final.keras`
- `stage2_modelfinal/best_stage2_binary_ann_seed*.keras`
- `stage3_final/data/preprocessing/stage2_mice_imputer.pkl`
- `stage3_final/data/preprocessing/stage2_scaler.pkl`

`ADNI_Longitudinal_DATA.csv` 또는 RSF joblib가 없으면,
임상 CSV로부터 종단 포맷을 자동 생성해 RSF를 학습합니다.
