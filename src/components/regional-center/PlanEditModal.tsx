/**
 * PlanEditModal.tsx
 * ─────────────────────────────────────────────────────────
 * InterventionPlan 편집/추가 모달
 * - 기존 Radix Dialog 재사용
 * - createdBy: AI plan 수정 시 자동 ADMIN_EDIT 전환
 * - status 변경은 이 모달에서 불가(HOW 영역에서만)
 * ─────────────────────────────────────────────────────────
 */
import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import type { InterventionPlan, InterventionType, Impact, BottleneckSignal } from '../../lib/interventionStore';
import {
  TYPE_LABELS,
  IMPACT_LABELS,
  IMPACT_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
  genId,
} from '../../lib/interventionStore';

interface PlanEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: InterventionPlan | null;          // null = 신규
  bottlenecks: BottleneckSignal[];        // 연결 가능 병목 목록
  region: string;
  onSave: (plan: InterventionPlan) => void;
}

const INTERVENTION_TYPES: InterventionType[] = ['TRAINING', 'STAFFING', 'PROCESS'];
const PRIORITIES: Impact[] = ['HIGH', 'MEDIUM', 'LOW'];
const KPI_OPTIONS = ['이탈률', '접촉률', '노쇼율', '연계 지연', '상담 완료율', '재접촉 성공률', '우수'];

export function PlanEditModal({ open, onOpenChange, plan, bottlenecks, region, onSave }: PlanEditModalProps) {
  const isNew = !plan;

  const [title, setTitle] = useState('');
  const [type, setType] = useState<InterventionType>('TRAINING');
  const [priority, setPriority] = useState<Impact>('MEDIUM');
  const [linkedKpis, setLinkedKpis] = useState<string[]>([]);
  const [durationDays, setDurationDays] = useState(30);
  const [description, setDescription] = useState('');
  const [trainingAction, setTrainingAction] = useState('');
  const [staffingAction, setStaffingAction] = useState('');
  const [processAction, setProcessAction] = useState('');
  const [adminMemo, setAdminMemo] = useState('');
  const [centerId, setCenterId] = useState('');
  const [centerName, setCenterName] = useState('');
  const [linkedBottleneckId, setLinkedBottleneckId] = useState('');

  // 모달 열릴 때 초기화
  useEffect(() => {
    if (open && plan) {
      setTitle(plan.title);
      setType(plan.type);
      setPriority(plan.priority);
      setLinkedKpis([...plan.linkedKpis]);
      setDurationDays(plan.durationDays ?? 30);
      setDescription(plan.description);
      setTrainingAction(plan.trainingAction ?? '');
      setStaffingAction(plan.staffingAction ?? '');
      setProcessAction(plan.processAction ?? '');
      setAdminMemo(plan.adminMemo ?? '');
      setCenterId(plan.centerId);
      setCenterName(plan.centerName);
      setLinkedBottleneckId(plan.linkedBottleneckId ?? '');
    } else if (open && !plan) {
      setTitle(''); setType('TRAINING'); setPriority('MEDIUM');
      setLinkedKpis([]); setDurationDays(30); setDescription('');
      setTrainingAction(''); setStaffingAction(''); setProcessAction('');
      setAdminMemo(''); setCenterId(''); setCenterName('');
      setLinkedBottleneckId('');
    }
  }, [open, plan]);

  const handleBottleneckSelect = (bnId: string) => {
    setLinkedBottleneckId(bnId);
    const bn = bottlenecks.find(b => b.id === bnId);
    if (bn) {
      setCenterId(bn.centerId);
      setCenterName(bn.centerName);
      setLinkedKpis([...bn.weakKpis]);
    }
  };

  const toggleKpi = (kpi: string) => {
    setLinkedKpis(prev => prev.includes(kpi) ? prev.filter(k => k !== kpi) : [...prev, kpi]);
  };

  const handleSave = () => {
    if (!title.trim() || !centerId) return;
    const now = new Date().toISOString();
    const saved: InterventionPlan = {
      id: plan?.id ?? genId('PLAN'),
      region,
      centerId,
      centerName,
      linkedBottleneckId: linkedBottleneckId || undefined,
      linkedKpis,
      type,
      title: title.trim(),
      description: description.trim(),
      trainingAction: trainingAction.trim() || undefined,
      staffingAction: staffingAction.trim() || undefined,
      processAction: processAction.trim() || undefined,
      durationDays: durationDays > 0 ? durationDays : undefined,
      priority,
      status: plan?.status ?? 'DRAFT',
      createdBy: isNew ? 'ADMIN_MANUAL' : (plan?.createdBy === 'AI' ? 'ADMIN_EDIT' : plan!.createdBy),
      adminMemo: adminMemo.trim() || undefined,
      approvedAt: plan?.approvedAt,
      dueAt: plan?.dueAt,
      updatedAt: now,
    };
    onSave(saved);
    onOpenChange(false);
  };

  const inputCls = 'w-full bg-gray-50 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent';
  const labelCls = 'block text-sm font-semibold text-gray-700 mb-1';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[780px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? '신규 조치 추가' : '조치 계획 편집'}</DialogTitle>
          <DialogDescription>
            {isNew ? '새 개입 조치를 DRAFT 상태로 추가합니다.' : `${plan?.centerName} — ${STATUS_LABELS[plan!.status]}`}
            {plan?.createdBy === 'AI' && (
              <span className="ml-2 text-amber-600 text-xs">(AI 초안 → 수정 시 ADMIN_EDIT로 전환)</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 병목 연결 (신규 시) */}
          {isNew && (
            <div>
              <label className={labelCls}>병목 시그널 연결 (선택)</label>
              <select className={inputCls} value={linkedBottleneckId} onChange={e => handleBottleneckSelect(e.target.value)}>
                <option value="">— 직접 입력 —</option>
                {bottlenecks.map(bn => (
                  <option key={bn.id} value={bn.id}>{bn.centerName} — {bn.weakKpis.join(', ')}</option>
                ))}
              </select>
            </div>
          )}

          {/* 센터 (병목 미연결 시 직접 입력) */}
          {isNew && !linkedBottleneckId && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>센터 ID *</label>
                <input className={inputCls} value={centerId} onChange={e => setCenterId(e.target.value)} placeholder="CENTER-XXX" />
              </div>
              <div>
                <label className={labelCls}>센터명 *</label>
                <input className={inputCls} value={centerName} onChange={e => setCenterName(e.target.value)} placeholder="OO구 치매안심센터" />
              </div>
            </div>
          )}
          {!isNew && (
            <div className="text-sm text-gray-600">
              센터: <span className="font-medium text-gray-900">{centerName}</span> ({centerId})
            </div>
          )}

          {/* 제목 */}
          <div>
            <label className={labelCls}>제목 *</label>
            <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} placeholder="조치 제목" />
          </div>

          {/* 유형 + 우선순위 + 기간 */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>유형 *</label>
              <select className={inputCls} value={type} onChange={e => setType(e.target.value as InterventionType)}>
                {INTERVENTION_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>우선순위 *</label>
              <select className={inputCls} value={priority} onChange={e => setPriority(e.target.value as Impact)}>
                {PRIORITIES.map(p => <option key={p} value={p}>{IMPACT_LABELS[p]}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>기간 (일)</label>
              <input className={inputCls} type="number" min={1} value={durationDays} onChange={e => setDurationDays(Number(e.target.value))} />
            </div>
          </div>

          {/* 연결 KPI 멀티 토글 */}
          <div>
            <label className={labelCls}>연결 KPI</label>
            <div className="flex flex-wrap gap-1.5">
              {KPI_OPTIONS.map(kpi => (
                <button key={kpi} onClick={() => toggleKpi(kpi)}
                  className={`px-2 py-1 rounded-full text-xs font-medium border transition-colors ${
                    linkedKpis.includes(kpi) ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {kpi}
                </button>
              ))}
            </div>
          </div>

          {/* 설명 */}
          <div>
            <label className={labelCls}>설명</label>
            <textarea className={inputCls + ' h-20 resize-none'} value={description} onChange={e => setDescription(e.target.value)} placeholder="조치 상세 내용" />
          </div>

          {/* 유형별 액션 */}
          {type === 'TRAINING' && (
            <div>
              <label className={labelCls}>교육 조치 내용</label>
              <textarea className={inputCls + ' h-16 resize-none'} value={trainingAction} onChange={e => setTrainingAction(e.target.value)} placeholder="교육 프로그램, 일정, 대상 등" />
            </div>
          )}
          {type === 'STAFFING' && (
            <div>
              <label className={labelCls}>인력 조치 내용</label>
              <textarea className={inputCls + ' h-16 resize-none'} value={staffingAction} onChange={e => setStaffingAction(e.target.value)} placeholder="파견, 증원, 재배치 내용" />
            </div>
          )}
          {type === 'PROCESS' && (
            <div>
              <label className={labelCls}>프로세스 조치 내용</label>
              <textarea className={inputCls + ' h-16 resize-none'} value={processAction} onChange={e => setProcessAction(e.target.value)} placeholder="SOP 변경, 자동화, 체크리스트 등" />
            </div>
          )}

          {/* 관리자 메모 */}
          <div>
            <label className={labelCls}>관리자 메모</label>
            <textarea className={inputCls + ' h-14 resize-none'} value={adminMemo} onChange={e => setAdminMemo(e.target.value)} placeholder="추가 메모 (내부용)" />
          </div>

          {/* 현재 상태 안내 */}
          {plan && (
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded px-3 py-2 text-xs text-gray-500">
              현재 상태: <Badge variant="outline" className={STATUS_COLORS[plan.status]}>{STATUS_LABELS[plan.status]}</Badge>
              <span>· 상태 변경은 목록에서 가능합니다</span>
              {plan.createdBy === 'AI' && <span className="text-amber-600">· 저장 시 AI→ADMIN_EDIT 전환</span>}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={handleSave} disabled={!title.trim() || !centerId}>
            {isNew ? '추가 (DRAFT)' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
