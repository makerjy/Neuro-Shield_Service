const FORBIDDEN_WORDS = ['판단', '결정', '진단', '판정', '확정', '평가'] as const;

const REPLACEMENTS: Record<(typeof FORBIDDEN_WORDS)[number], string> = {
  판단: '운영 신호',
  결정: '운영 선택',
  진단: '신호 요약',
  판정: '기준 충족 여부',
  확정: '확인',
  평가: '변화 확인',
};

export function findForbiddenUiWords(text: string): string[] {
  return FORBIDDEN_WORDS.filter((word) => text.includes(word));
}

export function sanitizeOpsText(text: string): string {
  let next = text;
  FORBIDDEN_WORDS.forEach((word) => {
    next = next.split(word).join(REPLACEMENTS[word]);
  });
  return next;
}

export function assertOpsTextSafe(text: string): void {
  if (import.meta.env?.DEV !== true) return;
  const found = findForbiddenUiWords(text);
  if (!found.length) return;
  throw new Error(`Forbidden ops words detected: ${found.join(', ')}`);
}

export function safeOpsText(text: string): string {
  const next = sanitizeOpsText(text);
  assertOpsTextSafe(next);
  return next;
}
