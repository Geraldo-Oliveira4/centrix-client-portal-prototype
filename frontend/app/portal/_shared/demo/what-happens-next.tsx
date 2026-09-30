'use client';

// "O que acontece depois de enviar" — o painel lateral do RQ-3.
//
// Ele existe porque a V2 TIRA uma decisão do cliente (a escolha dos agentes) e
// uma tela que só remove um passo, sem dizer quem passou a fazê-lo, lê como
// funcionalidade perdida. Os quatro passos respondem exatamente isso.
//
// O prazo da revisão vem de `REVIEW_SLA_LABEL`, que sai da regra única de
// `review-sla.ts` (1 hora, decisão do Orsi em 29/09/2026).

import { Check, Info } from 'lucide-react';

import { REVIEW_SLA_LABEL } from './quotation-v2-labels';

const STEPS = [
  {
    title: 'Você envia',
    body: 'A solicitação entra na fila da Freitas.',
  },
  {
    title: 'A Freitas revisa',
    body: `Conferimos os dados e escolhemos os agentes da sua rota. Prazo estimado: ${REVIEW_SLA_LABEL}.`,
  },
  {
    title: 'Agentes cotam',
    body: 'Você acompanha o andamento em Minhas Cotações.',
  },
  {
    title: 'Você escolhe',
    body: 'Quando a Freitas liberar as propostas, você é avisado no portal.',
  },
];

export function WhatHappensNextPanel() {
  return (
    <div className="space-y-4">
      <section className="portal-card p-5">
        <h2 className="portal-h3">O que acontece depois de enviar</h2>
        <ol className="mt-4 space-y-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span
                aria-hidden="true"
                className={
                  index === 0
                    ? 'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-portal-success text-background'
                    : 'portal-small mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-portal-neutral'
                }
              >
                {index === 0 ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              <span className="min-w-0">
                <span className="portal-body block font-medium text-foreground">
                  {step.title}
                </span>
                <span className="portal-small block text-portal-neutral">
                  {step.body}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="flex gap-2.5 rounded-lg border border-brand-indigo-800/30 bg-brand-indigo-100 px-4 py-3">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-indigo" />
        <p className="portal-small text-foreground/80">
          Você não precisa escolher agentes. A Freitas indica os melhores para a
          sua rota.
        </p>
      </div>
    </div>
  );
}
