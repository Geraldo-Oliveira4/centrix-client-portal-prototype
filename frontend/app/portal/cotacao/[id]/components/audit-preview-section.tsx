'use client';

import { AlertTriangle, FlaskConical } from 'lucide-react';

import { formatBRL } from '@/lib/portal-formatters';
import { useAuditPreview } from '@/hooks/use-portal-audit-preview';

import { AuditResult } from '../../../_shared/audit-result';

/**
 * MOCK - Auditoria real (Camada de Auditoria de Frete/Fatura) é produto separado,
 * sequenciado após GE go-live. Este preview existe apenas para visualização
 * conceitual no debate de produto.
 *
 * Regra de honestidade desta seção: o valor cotado é real (proposta vencedora),
 * o valor "realizado" NÃO existe — não há fatura nem BL em lugar nenhum deste
 * protótipo. Por isso o bloco inteiro é emoldurado como ilustrativo (faixa
 * tracejada + selo "Pré-visualização"), o card do valor fabricado é rotulado
 * "Valor estimado — dado ilustrativo", e o disclaimer que fecha a seção vem do
 * próprio backend. Se alguém reaproveitar este componente, tem que reaproveitar
 * a moldura junto: sem ela a tela afirma um número que ninguém apurou.
 *
 * Hierarquia dos 3 blocos (não são 3 cards iguais):
 *   1. Valor cotado    — dado real, fundo branco, número em destaque
 *   2. Valor estimado  — fabricado, fundo tracejado e texto acinzentado, recua
 *   3. Diferença       — a leitura que importa, cor semântica só quando diverge
 */
export function AuditPreviewSection({ quotationId }: { quotationId: string }) {
  const { preview, isLoading, isError } = useAuditPreview(quotationId);

  // Falha silenciosa: é uma seção conceitual, não pode quebrar a tela da cotação.
  if (isLoading || isError || !preview) return null;

  const divergent = preview.mock_divergence_detected;
  const difference = preview.mock_difference_brl;

  return (
    <section className="space-y-4 rounded-xl border border-dashed border-border bg-muted/20 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="portal-h2 text-foreground">Auditoria</h2>
          <span className="portal-small inline-flex items-center gap-1.5 rounded border border-dashed border-primary/40 bg-primary/5 px-2 py-0.5 font-medium text-primary">
            <FlaskConical className="h-3.5 w-3.5" />
            Pré-visualização
          </span>
        </div>
        {divergent && (
          <span className="portal-small inline-flex items-center gap-1.5 rounded-md border border-portal-danger/30 bg-portal-danger/10 px-2.5 py-1 font-medium text-portal-danger">
            <AlertTriangle className="h-4 w-4" />
            Divergência detectada · {formatBRL(Math.abs(difference))}
          </span>
        )}
      </div>

      {/* Shared result component — identical to the one used in the Histórico
          conference expansion and after document submission (rule 2.3). */}
      <AuditResult preview={preview} />

      <p className="portal-small text-portal-neutral">{preview.disclaimer}</p>
    </section>
  );
}
