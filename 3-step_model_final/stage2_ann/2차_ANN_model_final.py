"""
=============================================================
Stage2 ANN - Feature Analysis & Engineering
1. Correlation Heatmap (risk_label 최상단)
2. Random Forest Feature Importance
3. 엔지니어링 피처 추가 후 v4 재학습

[분석 결과 요약]
- FAQ_LDELTA_ratio: CN=0.01 → MCI_High=1.97 → AD=5.57 (분리도 최고)
- high_risk_score: CN=-12.6 → MCI_High=5.7 → AD=17.1 (선형 분리)
- cog_composite: CN=28.8 → MCI_High=18.1 → AD=7.4 (역방향 선형)
- label 컬럼은 ALL_FEATS에 없음 ✓
=============================================================
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
import seaborn as sns
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.utils.class_weight import compute_class_weight
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, callbacks, regularizers
from imblearn.over_sampling import BorderlineSMOTE
import pickle, json, os, warnings
warnings.filterwarnings('ignore')

SAVE_DIR = '.'
CSV_PATH = '/Users/dudigi/project/test/ADNI3_Golden_Master_Longitudinal.csv'

# ============================================================
# 1. 데이터 로드 & 전처리 (v3와 동일)
# ============================================================
df = pd.read_csv(CSV_PATH)
df = df.sort_values(['subject_id', 'visit_order']).reset_index(drop=True)

MISS_THR = 50.0
meta_cols = ['subject_id','DIAGNOSIS','label','visit','Image.Data.ID',
             'visit_order','mmse_change','cdrsb_change']
drop_cols = [c for c in (df.isnull().mean()*100)[df.isnull().mean()*100 >= MISS_THR].index
             if c not in meta_cols]
df.drop(columns=drop_cols, inplace=True)
df = df.dropna(subset=['label']).copy()

MH_COLS     = [c for c in df.columns if c.startswith('MH')]
HEALTH_COLS = ['entry_age','PTGENDER','VSBPSYS','COG_DISORDER',
               'dementia_med','antidepressant_med'] + MH_COLS
COG_COLS    = ['CDRSB','MMSCORE','FAQTOTAL','LDELTOTAL']
BIO_COLS    = ['APOE4_Count']
BASE_FEATS  = HEALTH_COLS + COG_COLS + BIO_COLS

df[BASE_FEATS] = df.groupby('subject_id')[BASE_FEATS].ffill()
df['age_group'] = (df['entry_age'] // 10) * 10
for col in BASE_FEATS:
    df[col] = df.groupby(['age_group','PTGENDER'])[col].transform(
        lambda x: x.fillna(x.median()))
df[BASE_FEATS] = df[BASE_FEATS].fillna(df[BASE_FEATS].median())

def make_risk(row):
    if row['label'] == 0: return 0
    if row['label'] == 2: return 4
    if row['label'] == 1:
        s = row['CDRSB']
        if s <= 0.5:   return 1
        elif s <= 2.0: return 2
        else:          return 3
    return int(row['label'])

df['risk_label'] = df.apply(make_risk, axis=1)
label_names = {0:'CN', 1:'MCI_Low', 2:'MCI_Mid', 3:'MCI_High', 4:'AD'}

# ============================================================
# 2. 피처 엔지니어링 (MCI_High 분리 강화)
# ============================================================
# [핵심] FAQ_LDELTA_ratio: MCI_High=1.97, AD=5.57 (분리도 최고)
df['FAQ_LDELTA_ratio']   = df['FAQTOTAL'] / (df['LDELTOTAL'] + 1)

# CDRSB × MMSCORE 역방향 복합 지표
df['CDRSB_MMSE_ratio']   = df['CDRSB'] / (df['MMSCORE'] + 1)

# 고위험 복합 점수: CDRSB 높고 LDELTOTAL 낮을수록 ↑
df['high_risk_score']    = df['CDRSB'] * 2 + df['FAQTOTAL'] - df['LDELTOTAL']

# 인지 복합 점수: 낮을수록 위험
df['cog_composite']      = df['MMSCORE'] - df['CDRSB'] * 2 - df['FAQTOTAL'] * 0.5

# APOE4 × 나이 상호작용 (고령+고위험 유전자)
df['APOE4_age_interact'] = df['APOE4_Count'] * df['entry_age']

# dementia_med + COG_DISORDER 복합 위험 지표
df['med_cog_risk']       = df['dementia_med'] + df['COG_DISORDER']

ENG_FEATS = ['FAQ_LDELTA_ratio', 'CDRSB_MMSE_ratio', 'high_risk_score',
             'cog_composite', 'APOE4_age_interact', 'med_cog_risk']

ALL_FEATS = BASE_FEATS + ENG_FEATS
print(f"전체 피처: {len(BASE_FEATS)}개(기존) + {len(ENG_FEATS)}개(엔지니어링) = {len(ALL_FEATS)}개")

# label 컬럼 포함 여부 확인
label_check = [c for c in ALL_FEATS if c in ['label','risk_label','DIAGNOSIS']]
print(f"레이블 컬럼 포함 여부: {label_check if label_check else '없음 ✓'}")

# ============================================================
# 3. 상관관계 Heatmap (risk_label 최상단)
# ============================================================
VIZ_COLS = BASE_FEATS + ENG_FEATS   # 피처만 (label 제외)

# risk_label을 첫 번째로 배치
heatmap_df = df[['risk_label'] + VIZ_COLS].copy()

# 중요 피처만 선택 (너무 많으면 heatmap 가독성 저하)
key_cols = ['risk_label', 'CDRSB', 'MMSCORE', 'FAQTOTAL', 'LDELTOTAL',
            'APOE4_Count', 'entry_age', 'VSBPSYS', 'dementia_med',
            'COG_DISORDER', 'antidepressant_med', 'PTGENDER',
            'FAQ_LDELTA_ratio', 'CDRSB_MMSE_ratio', 'high_risk_score',
            'cog_composite', 'APOE4_age_interact', 'med_cog_risk']

heatmap_df = heatmap_df[key_cols]
corr = heatmap_df.corr()

fig, ax = plt.subplots(figsize=(16, 13))

# 커스텀 colormap: 음수=파랑, 0=흰색, 양수=빨강
cmap = sns.diverging_palette(230, 20, as_cmap=True)

sns.heatmap(
    corr,
    annot=True,
    fmt='.2f',
    cmap=cmap,
    center=0,
    vmin=-1, vmax=1,
    square=True,
    linewidths=0.5,
    annot_kws={'size': 8},
    ax=ax
)

# risk_label 행/열 강조 (첫 번째 행/열에 테두리)
ax.add_patch(plt.Rectangle((0, 0), len(key_cols), 1,
                            fill=False, edgecolor='#e74c3c', lw=3, clip_on=False))
ax.add_patch(plt.Rectangle((0, 0), 1, len(key_cols),
                            fill=False, edgecolor='#e74c3c', lw=3, clip_on=False))

ax.set_title('Feature Correlation Heatmap\n(risk_label 최상단 | 엔지니어링 피처 포함)',
             fontsize=15, fontweight='bold', pad=15)
plt.xticks(rotation=45, ha='right', fontsize=9)
plt.yticks(rotation=0, fontsize=9)
plt.tight_layout()
plt.savefig(os.path.join(SAVE_DIR, 'feature_heatmap.png'), dpi=150, bbox_inches='tight')
plt.show()
print("✅ Heatmap 저장: feature_heatmap.png")

# ============================================================
# 4. Random Forest Feature Importance
# ============================================================
rf = RandomForestClassifier(
    n_estimators=300, random_state=42,
    class_weight='balanced', max_depth=10
)
rf.fit(df[ALL_FEATS], df['risk_label'])

imp = pd.Series(rf.feature_importances_, index=ALL_FEATS).sort_values(ascending=True)

# 엔지니어링 피처 색상 구분
colors = ['#e74c3c' if f in ENG_FEATS else '#3498db' for f in imp.index]

fig, ax = plt.subplots(figsize=(11, 12))
bars = ax.barh(imp.index, imp.values, color=colors, edgecolor='white', linewidth=0.5)

# 값 표시
for i, (feat, val) in enumerate(zip(imp.index, imp.values)):
    ax.text(val + 0.002, i, f'{val:.3f}', va='center', fontsize=8,
            color='#e74c3c' if feat in ENG_FEATS else '#2c3e50')

# 범례
from matplotlib.patches import Patch
legend_elems = [Patch(facecolor='#e74c3c', label='엔지니어링 피처 (신규)'),
                Patch(facecolor='#3498db', label='기존 피처')]
ax.legend(handles=legend_elems, loc='lower right', fontsize=10)

ax.set_xlabel('Feature Importance', fontsize=12)
ax.set_title('Random Forest Feature Importance\n(5중 분류 기준, 빨강=엔지니어링 피처)',
             fontsize=13, fontweight='bold')
ax.set_xlim(0, imp.max() * 1.15)
ax.grid(axis='x', alpha=0.3)
plt.tight_layout()
plt.savefig(os.path.join(SAVE_DIR, 'feature_importance.png'), dpi=150, bbox_inches='tight')
plt.show()
print("✅ Feature Importance 저장: feature_importance.png")

# MCI_High 전용 importance
print("\n=== Top 10 Feature Importance (MCI_High vs 나머지 이진 분류) ===")
y_bin = (df['risk_label'] == 3).astype(int)
rf_bin = RandomForestClassifier(n_estimators=300, random_state=42, class_weight='balanced')
rf_bin.fit(df[ALL_FEATS], y_bin)
imp_bin = pd.Series(rf_bin.feature_importances_, index=ALL_FEATS).sort_values(ascending=False)
for feat, val in imp_bin.head(10).items():
    tag = '★ 엔지니어링' if feat in ENG_FEATS else '  기존'
    print(f"  {tag} {feat:25s}: {val:.4f}")

# ============================================================
# 5. 엔지니어링 피처 포함 v4 재학습
# ============================================================
print("\n" + "="*60)
print("  v4 재학습 시작 (엔지니어링 피처 포함)")
print("="*60)

h_dim  = len(HEALTH_COLS)
c_dim  = len(COG_COLS)
b_dim  = len(BIO_COLS)
e_dim  = len(ENG_FEATS)
NUM_CL = 5

X = df[ALL_FEATS].values
y = df['risk_label'].values

X_trainval, X_test, y_trainval, y_test = train_test_split(
    X, y, test_size=0.15, random_state=42, stratify=y)
X_train_r, X_val_r, y_train_r, y_val_r = train_test_split(
    X_trainval, y_trainval, test_size=0.18, random_state=42, stratify=y_trainval)

scaler = StandardScaler()
X_tr_sc = scaler.fit_transform(X_train_r)
X_va_sc = scaler.transform(X_val_r)
X_te_sc = scaler.transform(X_test)

cn_count = (y_train_r == 0).sum()
smote = BorderlineSMOTE(random_state=42, k_neighbors=3,
                        sampling_strategy={k: cn_count for k in range(5)})
X_train, y_train = smote.fit_resample(X_tr_sc, y_train_r)

def split_feats(X):
    h = X[:, :h_dim]
    c = X[:, h_dim:h_dim+c_dim]
    b = X[:, h_dim+c_dim:h_dim+c_dim+b_dim]
    e = X[:, h_dim+c_dim+b_dim:]
    return h, c, b, e

X_tr_h,X_tr_c,X_tr_b,X_tr_e = split_feats(X_train)
X_va_h,X_va_c,X_va_b,X_va_e = split_feats(X_va_sc)
X_te_h,X_te_c,X_te_b,X_te_e = split_feats(X_te_sc)

# ── Focal Loss ──────────────────────────────────────────────
class FocalLoss(keras.losses.Loss):
    def __init__(self, gamma=2.0, **kwargs):
        super().__init__(**kwargs)
        self.gamma = gamma
    def call(self, y_true, y_pred):
        y_pred = tf.clip_by_value(y_pred, 1e-7, 1.0)
        ce = -y_true * tf.math.log(y_pred)
        probs = tf.reduce_sum(y_true * y_pred, axis=-1, keepdims=True)
        focal_w = tf.pow(1.0 - probs, self.gamma)
        return tf.reduce_mean(tf.reduce_sum(focal_w * ce, axis=-1))

# ── 모델 (4-Branch: Health + Cog + Bio + Engineering) ───────
def build_v4_ann(h_dim, c_dim, b_dim, e_dim, num_classes=5):
    REG = regularizers.l2(1e-4)

    health_in = keras.Input(shape=(h_dim,), name='health_input')
    cog_in    = keras.Input(shape=(c_dim,), name='cog_input')
    bio_in    = keras.Input(shape=(b_dim,), name='bio_input')
    eng_in    = keras.Input(shape=(e_dim,), name='eng_input')    # 엔지니어링 피처

    # Health Branch
    h = layers.Dense(128, kernel_regularizer=REG, name='h_dense1')(health_in)
    h = layers.BatchNormalization(name='h_bn1')(h)
    h = layers.ReLU(name='h_relu1')(h)
    h = layers.Dropout(0.35, name='h_drop1')(h)
    h = layers.Dense(64, kernel_regularizer=REG, name='h_dense2')(h)
    h = layers.BatchNormalization(name='h_bn2')(h)
    h = layers.ReLU(name='h_relu2')(h)

    # Cognitive Branch (핵심)
    c = layers.Dense(256, kernel_regularizer=REG, name='c_dense1')(cog_in)
    c = layers.BatchNormalization(name='c_bn1')(c)
    c = layers.ReLU(name='c_relu1')(c)
    c = layers.Dropout(0.3, name='c_drop1')(c)
    c = layers.Dense(128, kernel_regularizer=REG, name='c_dense2')(c)
    c = layers.BatchNormalization(name='c_bn2')(c)
    c = layers.ReLU(name='c_relu2')(c)
    c = layers.Dense(64, kernel_regularizer=REG, name='c_dense3')(c)
    c = layers.ReLU(name='c_relu3')(c)

    # Bio Branch (APOE4)
    b = layers.Dense(16, kernel_regularizer=REG, name='b_dense1')(bio_in)
    b = layers.ReLU(name='b_relu1')(b)

    # Engineering Branch (합성 피처 - MCI_High 분리 강화)
    e = layers.Dense(64, kernel_regularizer=REG, name='e_dense1')(eng_in)
    e = layers.BatchNormalization(name='e_bn1')(e)
    e = layers.ReLU(name='e_relu1')(e)
    e = layers.Dropout(0.25, name='e_drop1')(e)
    e = layers.Dense(32, kernel_regularizer=REG, name='e_dense2')(e)
    e = layers.ReLU(name='e_relu2')(e)

    # Fusion: 64+64+16+32 = 176
    fused = layers.Concatenate(name='fusion')([h, c, b, e])

    x = layers.Dense(128, kernel_regularizer=REG, name='fc1')(fused)
    x = layers.BatchNormalization(name='fc_bn1')(x)
    x = layers.ReLU(name='fc_relu1')(x)
    x = layers.Dropout(0.4, name='fc_drop1')(x)
    x = layers.Dense(64, kernel_regularizer=REG, name='fc2')(x)
    x = layers.BatchNormalization(name='fc_bn2')(x)
    x = layers.ReLU(name='fc_relu2')(x)
    x = layers.Dropout(0.3, name='fc_drop2')(x)
    x = layers.Dense(32, kernel_regularizer=REG, name='fc3')(x)
    x = layers.ReLU(name='fc_relu')(x)

    output = layers.Dense(num_classes, activation='softmax', name='output')(x)
    return keras.Model(inputs=[health_in, cog_in, bio_in, eng_in], outputs=output, name='v4_ann')

model = build_v4_ann(h_dim, c_dim, b_dim, e_dim)
model.summary()

# Class weight (MCI_High 추가 강화)
cw_arr = compute_class_weight('balanced', classes=np.arange(NUM_CL), y=y_train)
cw_dict = {i: float(w) for i, w in enumerate(cw_arr)}
cw_dict[3] *= 2.0   # MCI_High: recall 개선 최우선
cw_dict[4] *= 1.5   # AD
print(f"\nClass weights (v4): { {label_names[k]: f'{v:.2f}' for k,v in cw_dict.items()} }")

loss_fn   = FocalLoss(gamma=2.0, name='focal_loss')
optimizer = keras.optimizers.Adam(learning_rate=0.0003, clipnorm=1.0)
model.compile(optimizer=optimizer, loss=loss_fn, metrics=['accuracy'])

best_ckpt = os.path.join(SAVE_DIR, 'best_stage2_ann_v4.keras')
cb_list = [
    callbacks.ReduceLROnPlateau(monitor='val_loss', mode='min',
                                factor=0.5, patience=12, min_lr=1e-6, verbose=1),
    callbacks.ModelCheckpoint(filepath=best_ckpt, monitor='val_loss', mode='min',
                              save_best_only=True, verbose=1),
    callbacks.EarlyStopping(monitor='val_loss', mode='min',
                            patience=40, restore_best_weights=True, verbose=1),
]

def to_onehot(y, n=5):
    return np.eye(n)[y.astype(int)]

history = model.fit(
    x=[X_tr_h, X_tr_c, X_tr_b, X_tr_e],
    y=to_onehot(y_train),
    validation_data=([X_va_h, X_va_c, X_va_b, X_va_e], to_onehot(y_val_r)),
    epochs=300, batch_size=64,
    class_weight=cw_dict,
    callbacks=cb_list,
    verbose=1
)

# ── 평가 ────────────────────────────────────────────────────
best_model = keras.models.load_model(best_ckpt,
    custom_objects={'FocalLoss': FocalLoss}, compile=False)

y_pred_prob = best_model.predict([X_te_h, X_te_c, X_te_b, X_te_e])
y_pred      = np.argmax(y_pred_prob, axis=1)
target_names = ['CN','MCI_Low','MCI_Mid','MCI_High','AD']

print("\n" + "="*60)
print("  최종 테스트 성능 (v4 - 엔지니어링 피처 포함)")
print("="*60)
print(classification_report(y_test, y_pred, target_names=target_names))

# 학습 곡선
fig, axes = plt.subplots(1, 2, figsize=(13, 5))
axes[0].plot(history.history['loss'],     label='Train', color='steelblue')
axes[0].plot(history.history['val_loss'], label='Val',   color='tomato')
axes[0].set_title('Loss Curve (v4)', fontsize=13)
axes[0].set_xlabel('Epoch'); axes[0].legend(); axes[0].grid(alpha=0.3)
axes[1].plot(history.history['accuracy'],     label='Train', color='steelblue')
axes[1].plot(history.history['val_accuracy'], label='Val',   color='tomato')
axes[1].set_title('Accuracy Curve (v4)', fontsize=13)
axes[1].set_xlabel('Epoch'); axes[1].legend(); axes[1].grid(alpha=0.3)
plt.tight_layout()
plt.savefig(os.path.join(SAVE_DIR, 'learning_curve_v4.png'), dpi=150)
plt.show()

# Confusion Matrix
cm = confusion_matrix(y_test, y_pred)
plt.figure(figsize=(9, 7))
sns.heatmap(cm, annot=True, fmt='d', cmap='Reds',
            xticklabels=target_names, yticklabels=target_names)
plt.title('Confusion Matrix: v4 (엔지니어링 피처 포함)', fontsize=14)
plt.xlabel('Predicted'); plt.ylabel('True')
plt.tight_layout()
plt.savefig(os.path.join(SAVE_DIR, 'confusion_matrix_v4.png'), dpi=150)
plt.show()

# ── 저장 ────────────────────────────────────────────────────
best_model.save(os.path.join(SAVE_DIR, 'stage2_ann_v4_final.keras'))
best_model.save(os.path.join(SAVE_DIR, 'stage2_ann_v4_final.h5'))
best_model.export(os.path.join(SAVE_DIR, 'stage2_ann_v4_savedmodel'))

with open(os.path.join(SAVE_DIR, 'stage2_scaler_v4.pkl'), 'wb') as f:
    pickle.dump(scaler, f)

# Feature extractor (3차 연결용)
feature_extractor = keras.Model(
    inputs=best_model.inputs,
    outputs=best_model.get_layer('fc_relu').output,
    name='stage2_feature_extractor_v4'
)
feature_extractor.save(os.path.join(SAVE_DIR, 'stage2_feature_extractor_v4.keras'))

meta = {
    'health_cols': HEALTH_COLS, 'cog_cols': COG_COLS,
    'bio_cols': BIO_COLS, 'eng_feats': ENG_FEATS,
    'all_feats': ALL_FEATS,
    'h_dim': h_dim, 'c_dim': c_dim, 'b_dim': b_dim, 'e_dim': e_dim,
    'label_map': label_names,
    'cdrsb_thresholds': {'MCI_Low': 0.5, 'MCI_Mid': 2.0},
    'engineering': {
        'FAQ_LDELTA_ratio':  'FAQTOTAL / (LDELTOTAL + 1)',
        'CDRSB_MMSE_ratio':  'CDRSB / (MMSCORE + 1)',
        'high_risk_score':   'CDRSB*2 + FAQTOTAL - LDELTOTAL',
        'cog_composite':     'MMSCORE - CDRSB*2 - FAQTOTAL*0.5',
        'APOE4_age_interact':'APOE4_Count * entry_age',
        'med_cog_risk':      'dementia_med + COG_DISORDER',
    },
    'version': 'v4',
}
with open(os.path.join(SAVE_DIR, 'stage2_feature_info_v4.json'), 'w', encoding='utf-8') as f:
    json.dump(meta, f, ensure_ascii=False, indent=2)

print("\n[저장 완료]")
print("  feature_heatmap.png")
print("  feature_importance.png")
print("  best_stage2_ann_v4.keras / stage2_ann_v4_final.keras/.h5")
print("  stage2_ann_v4_savedmodel/")
print("  stage2_feature_extractor_v4.keras")
print("  stage2_scaler_v4.pkl")
print("  stage2_feature_info_v4.json")