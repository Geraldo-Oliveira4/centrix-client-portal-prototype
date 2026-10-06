'use client';

import { setDemoValue, useDemoValue } from '../../../_shared/demo/use-demo-store';
import {
  ANALYST_APPROVAL_STORE_NAME,
  parseAnalystApproval,
} from './analyst-approval';

/**
 * Se o analista (simulado) aprovou a recomendação. Fora do build interno é
 * sempre `false`: a condição fica inline para o compilador dobrá-la, e um valor
 * que tenha sobrado no localStorage não acende nada em produção.
 */
export function useAnalystApproval(): boolean {
  const stored = useDemoValue(ANALYST_APPROVAL_STORE_NAME, parseAnalystApproval);
  return process.env.NEXT_PUBLIC_PROTO_INTERNAL === '1' ? stored : false;
}

export function setAnalystApproval(approved: boolean): void {
  setDemoValue(ANALYST_APPROVAL_STORE_NAME, approved);
}
