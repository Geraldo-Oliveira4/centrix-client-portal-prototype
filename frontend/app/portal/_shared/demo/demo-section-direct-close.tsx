'use client';

// A seção "Fechamento direto" do painel — a Freitas simulada revisando os
// pedidos de fechamento direto (Orsi, 29/09/2026).
//
// Mesma revisão de entrada da cotação: entra no Inbox, a Freitas aprova (a
// instrução segue para o agente preferido) ou devolve com motivo. Devolver é
// sempre manual e exige motivo; não há autorresposta para este fluxo.

import { useState } from 'react';
import { Clock3, Send, Undo2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import {
  DIRECT_CLOSE_ROUTES,
  DIRECT_CLOSE_STAGE_LABELS,
  approveDirectClose,
  returnDirectClose,
  routeLabel,
} from './direct-close';
import { reviewDueAt } from './review-sla';
import {
  clearDirectCloseStore,
  updateDirectClose,
  useDirectCloseStore,
} from './use-direct-close';
import { usePortalModuleReleased } from './use-feature-flags';

export function DirectCloseSection() {
  const released = usePortalModuleReleased('cotacaoV2');
  const store = useDirectCloseStore();
  const [returning, setReturning] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const requests = Object.values(store).sort((a, b) =>
    a.reference.localeCompare(b.reference),
  );

  if (!released) {
    return (
      <p className="portal-small text-portal-neutral">
        Ligue o módulo “Cotação V2” acima para usar estes controles.
      </p>
    );
  }
  if (requests.length === 0) {
    return (
      <p className="portal-small text-portal-neutral">
        Nenhum pedido. O cliente abre um em Nova cotação → “Fechar direto com
        agente preferido”.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {requests.map((request) => {
          const route = DIRECT_CLOSE_ROUTES.find(
            (r) => r.id === request.routeId,
          );
          const due =
            request.stage === 'entry_review'
              ? reviewDueAt(request.stageEnteredAt)
              : null;
          return (
            <li
              key={request.id}
              className="space-y-2 rounded-lg border border-border p-3"
            >
              <div className="min-w-0">
                <p className="portal-body font-medium text-foreground">
                  {request.reference} ·{' '}
                  {DIRECT_CLOSE_STAGE_LABELS[request.stage]}
                </p>
                <p className="portal-small text-portal-neutral">
                  {request.stage === 'entry_review'
                    ? 'Inbox · revisão de entrada (Para Cotar) · Fechamento direto'
                    : request.stage === 'returned'
                      ? 'Fora da fila · devolvido ao cliente'
                      : 'Instrução enviada ao agente'}
                </p>
                <p className="portal-small text-portal-neutral">
                  {route ? routeLabel(route) : request.routeId} ·{' '}
                  {request.agent} · {request.form.incoterm} ·{' '}
                  {request.form.cargo}
                </p>
                {due && (
                  <p className="portal-small inline-flex items-center gap-1 text-portal-neutral">
                    <Clock3 className="h-4 w-4" /> Prazo da revisão: até{' '}
                    {due.toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                )}
              </div>

              {request.stage === 'entry_review' && returning !== request.id && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      updateDirectClose(request.id, (entry) =>
                        approveDirectClose(entry, new Date().toISOString()),
                      )
                    }
                  >
                    <Send className="mr-1.5 h-4 w-4" />
                    Aprovar e instruir o agente
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setReturning(request.id);
                      setReason('');
                    }}
                  >
                    <Undo2 className="mr-1.5 h-4 w-4" />
                    Devolver ao cliente
                  </Button>
                </div>
              )}

              {returning === request.id && (
                <div className="space-y-2">
                  <Label
                    htmlFor={`fd-motivo-${request.id}`}
                    className="portal-small"
                  >
                    Motivo da devolução (obrigatório)
                  </Label>
                  <Input
                    id={`fd-motivo-${request.id}`}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Ex.: Incoterm diverge do acordo da rota"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={!reason.trim()}
                      onClick={() => {
                        updateDirectClose(request.id, (entry) =>
                          returnDirectClose(
                            entry,
                            reason,
                            new Date().toISOString(),
                          ),
                        );
                        setReturning(null);
                      }}
                    >
                      Devolver
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setReturning(null)}
                    >
                      Voltar
                    </Button>
                  </div>
                </div>
              )}

              {request.stage === 'returned' && (
                <p className="portal-small text-portal-neutral">
                  A bola está com o cliente: “{request.returnReason}”.
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <Button
        size="sm"
        variant="ghost"
        className="text-portal-neutral"
        onClick={() => clearDirectCloseStore()}
      >
        Limpar pedidos de fechamento direto
      </Button>
    </div>
  );
}
