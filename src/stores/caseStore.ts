import { useEffect, useMemo } from "react";
import {
  STAGE3_RECONCILE_POLICY,
  getCaseEntity,
  reconcileCaseStage3,
  toStage3DomainCase,
  useCaseEntity,
} from "../components/local-center/v2/caseSSOT";
import { deriveStage3View } from "../domain/stage3/deriveStage3View";
import type { Stage3ReconcilePolicy, Stage3ViewModel } from "../domain/stage3/types";

function resolvePolicy(policy?: Stage3ReconcilePolicy): Stage3ReconcilePolicy {
  return policy ?? STAGE3_RECONCILE_POLICY;
}

export function getStage3CaseViewSync(
  caseId?: string | null,
  policy?: Stage3ReconcilePolicy,
): Stage3ViewModel | null {
  if (!caseId) return null;
  const entity = getCaseEntity(caseId);
  if (!entity || entity.stage !== 3) return null;
  const stage3Case = toStage3DomainCase(entity);
  if (!stage3Case) return null;
  return deriveStage3View(stage3Case, resolvePolicy(policy));
}

export function useStage3CaseView(
  caseId?: string | null,
  policy?: Stage3ReconcilePolicy,
): Stage3ViewModel | null {
  const entity = useCaseEntity(caseId);
  const resolvedPolicy = useMemo(
    () => resolvePolicy(policy),
    [policy?.autoCompleteStep1],
  );
  const autoCompleteStep1 = resolvedPolicy.autoCompleteStep1;

  useEffect(() => {
    if (!caseId) return;
    reconcileCaseStage3(caseId, resolvedPolicy);
  }, [autoCompleteStep1, caseId, resolvedPolicy]);

  return useMemo(() => {
    if (!entity || entity.stage !== 3) return null;
    const stage3Case = toStage3DomainCase(entity);
    if (!stage3Case) return null;
    return deriveStage3View(stage3Case, resolvedPolicy);
  }, [autoCompleteStep1, entity, resolvedPolicy]);
}
