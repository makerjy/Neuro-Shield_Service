export type CopyTermKey =
  | 'unprocessedWork'
  | 'workQueue'
  | 'queuePressure'
  | 'deadlineOverdue'
  | 'sla'
  | 'examDelay'
  | 'conversionGap'
  | 'followupDelay'
  | 'contactUnsuccessful';

type CopyTerm = {
  user: string;
  technical: string;
};

const COPY_TERMS: Record<CopyTermKey, CopyTerm> = {
  unprocessedWork: {
    user: '미처리 업무(대기 건수)',
    technical: 'Queue backlog / 처리 대기 큐 잔량',
  },
  workQueue: {
    user: '업무 대기열',
    technical: '처리 Queue',
  },
  queuePressure: {
    user: '업무 적체 압력',
    technical: 'Queue pressure',
  },
  deadlineOverdue: {
    user: '기한 초과 대기',
    technical: 'Long-wait backlog',
  },
  sla: {
    user: '기한 준수(처리 기한)',
    technical: 'SLA (서비스 수준 협약)',
  },
  examDelay: {
    user: '검사 연결 지연(병목)',
    technical: 'Differential exam delay hotspot',
  },
  conversionGap: {
    user: '지역 간 전환 격차',
    technical: 'Screening-to-diagnostic conversion gap',
  },
  followupDelay: {
    user: '후속 연락 지연',
    technical: 'Recontact delay',
  },
  contactUnsuccessful: {
    user: '연락 미성공',
    technical: 'Contact failure',
  },
};

const COPY_REPLACEMENTS: Array<[RegExp, string]> = [
  [/처리 중\(큐 잔량\)/g, COPY_TERMS.unprocessedWork.user],
  [/처리큐/g, COPY_TERMS.workQueue.user],
  [/큐 잔량/g, '대기 건수'],
  [/큐 압력/g, COPY_TERMS.queuePressure.user],
  [/장기대기/g, COPY_TERMS.deadlineOverdue.user],
  [/병목\(검사 지연\)/g, COPY_TERMS.examDelay.user],
  [/격차\(전환\)/g, COPY_TERMS.conversionGap.user],
  [/재접촉 지연/g, COPY_TERMS.followupDelay.user],
  [/연락 실패/g, COPY_TERMS.contactUnsuccessful.user],
];

export function getCopyTerm(key: CopyTermKey): CopyTerm {
  return COPY_TERMS[key];
}

export function toUserCopy(input: string): string {
  return COPY_REPLACEMENTS.reduce(
    (acc, [pattern, replacement]) => acc.replace(pattern, replacement),
    input,
  );
}
