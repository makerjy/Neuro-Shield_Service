from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from server_fastapi.app.db.session import SessionLocal
from server_fastapi.app.models.local_center import (
    CaseStageState,
    Center,
    ExamResult,
    Followup,
    LocalCase,
    LocalUser,
    RefusalCode,
)


REFUSAL_CODES = [
    ('R1_SELF_REJECT', '본인 거부'),
    ('R2_GUARDIAN_REJECT', '보호자 거부'),
    ('R3_OTHER_INSTITUTION', '타 기관 이용'),
    ('R4_ALREADY_DIAGNOSED', '이미 진단/관리 중'),
    ('R5_CONTACT_INVALID', '연락처 오류'),
    ('R6_EMOTIONAL_BACKLASH', '감정 반응 우려'),
    ('R7_OTHER', '기타'),
]


def seed(db: Session) -> None:
    center = db.get(Center, 'LC-001')
    if not center:
        center = Center(id='LC-001', name='강남구 치매안심센터', region_code='11')
        db.add(center)

    owner = db.get(LocalUser, 'u-local-001')
    if not owner:
        owner = LocalUser(id='u-local-001', center_id='LC-001', name='담당상담사', email='local.001@neuro.local')
        db.add(owner)

    for code, label in REFUSAL_CODES:
        if not db.get(RefusalCode, code):
            db.add(RefusalCode(code=code, label=label, is_active=True))

    case = db.get(LocalCase, 'LC-DEMO-0001')
    if not case:
        case = LocalCase(
            case_id='LC-DEMO-0001',
            center_id='LC-001',
            owner_id='u-local-001',
            owner_type='counselor',
            stage=1,
            status='CONTACT_READY',
            operational_status='TRACKING',
            priority_tier='P1',
            alert_level='MID',
            subject_json={'maskedName': '대상자-0001', 'age': 76, 'maskedPhone': '010-****-1001', 'pseudonymKey': 'PS-0001'},
            communication_json={'recommendedTimeSlot': '평일 14:00~16:00', 'history': []},
            referral_json={'organization': '지역 협력기관', 'status': 'in_progress', 'ownerNote': '연계 검토 중'},
            metrics_json={'scoreZ': -1.7, 'scoreChangePct': -6, 'dataQualityPct': 92, 'contactSuccessRatePct': 68, 'contactFailStreak': 2, 'trendByQuarter': [{'quarter': '24-Q4', 'value': -1.4}, {'quarter': '25-Q1', 'value': -1.7}], 'threshold': -1.8},
            raw_json=None,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(case)

    if not db.query(CaseStageState).filter(CaseStageState.case_id == 'LC-DEMO-0001').first():
        db.add(CaseStageState(case_id='LC-DEMO-0001', stage=1, state='CONTACT_READY', is_current=True))

    if not db.get(ExamResult, 'ER-DEMO-0001'):
        db.add(ExamResult(id='ER-DEMO-0001', case_id='LC-DEMO-0001', status='valid', result_json={'score': 72}, validated_at=datetime.now(timezone.utc)))
    if not db.get(ExamResult, 'ER-DEMO-0002'):
        db.add(ExamResult(id='ER-DEMO-0002', case_id='LC-DEMO-0001', status='pending', result_json={}, validated_at=None))

    if not db.get(Followup, 'FU-DEMO-0001'):
        db.add(Followup(id='FU-DEMO-0001', case_id='LC-DEMO-0001', followup_at=datetime.now(timezone.utc) - timedelta(days=5), status='DONE', note='1차 추적 완료'))
    if not db.get(Followup, 'FU-DEMO-0002'):
        db.add(Followup(id='FU-DEMO-0002', case_id='LC-DEMO-0001', followup_at=datetime.now(timezone.utc) - timedelta(days=2), status='DONE', note='2차 추적 완료'))

    db.commit()


if __name__ == '__main__':
    session = SessionLocal()
    try:
        seed(session)
        print('local center seed complete')
    finally:
        session.close()
