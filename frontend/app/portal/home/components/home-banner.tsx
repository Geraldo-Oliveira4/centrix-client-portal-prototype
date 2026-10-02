'use client';

import type { ReactNode } from 'react';

import { useMyClient } from '@/hooks/use-portal-quotations';

import { ShipmentIndicatorStrip } from '../../embarques/components/shipment-indicator-strip';
import type { ShipmentIndicators } from '../../embarques/lib/shipment-indicators';

/**
 * Banner navy da Home. Desenho validado com o Victor Orsi no Claude Design.
 *
 * BANNER INFORMATIVO PURO, sem nenhuma funcao de navegacao. Ele diz tres coisas
 * e para: quem esta logado, quantos itens exigem atencao hoje, e os cinco
 * indicadores dos embarques (so leitura). Uma versao anterior levava uma fileira de abas no rodape e chegou a
 * substituir a sidebar nesta rota; as duas ideias sairam em 03/09/2026.
 *
 * NAVEGACAO VIVE SO NA SIDEBAR. E a razao de nao existir link nenhum aqui, nem
 * discreto: dois lugares para ir ao mesmo lugar dao ao cliente duas respostas
 * para "onde eu clico?", e a sidebar ja responde em todas as telas do portal —
 * inclusive nesta, que nao e mais excecao de rota.
 *
 * DUAS REGRAS DE COR, e as duas vem do guia de marca (ver "Client Portal design
 * system" no CLAUDE.md do frontend):
 *
 *   1. Navy Profundo #1A1C31 (`brand-navy`) e IDENTIDADE. Ele emoldura, nunca
 *      convida a clicar — e agora isso e literal, porque nao ha o que clicar
 *      aqui. Laranja (`primary`, #F59C27) e a unica cor de acao da Home desde a
 *      migracao de marca v1.0, e ela aparece uma vez so: no CTA do card "Sua
 *      acao mais urgente".
 *   2. Nos indicadores, so "Precisam de voce" ganha cor (o tom de atencao,
 *      `portal-warning`, que le a 5.7:1 sobre o navy), e so quando ha algo: e
 *      o unico que pede acao do cliente. Os outros quatro sao informacao.
 *
 * NO TEMA ESCURO O BANNER TROCA DE SUPERFICIE, e nao e concessao: o canvas da
 * pagina passa a ser o PROPRIO Navy Profundo, entao um banner `bg-brand-navy`
 * ficaria invisivel — navy sobre navy, sem faixa nenhuma. Pintar so uma borda em
 * volta nao resolveria: um bloco da cor do fundo com um fio em volta e um fio,
 * nao uma placa.
 *
 * Ele vai para `--fc-dark-surface` #23253F (`bg-card`, a superficie elevada do
 * guia) com um fio inferior em `--fc-dark-line`. O PAPEL fica intacto — uma
 * faixa distinta no topo da area de conteudo — e a identidade nao se perde: no
 * escuro o navy deixa de ser o banner e passa a ser a tela inteira, que e a
 * proporcao 75/15/10 do guia aplicada a um layout escuro.
 *
 * O BANNER NAO CONTA NADA. `indicators` chega pronto, da fonte unica de
 * indicadores de embarque (`embarques/lib/shipment-indicators.ts`), a mesma do
 * Panorama, da lista e da Visao por PO — e e isso que impede as telas de
 * discordarem. Ate 02/10/2026 aqui ficava o farol (`countBySemaforo`), um
 * terceiro vocabulario para a mesma pergunta; ele saiu a pedido do Orsi.
 *
 * Full-bleed (as margens negativas cancelam o padding de `portal/layout.tsx`)
 * porque ele e uma FAIXA no topo da area de conteudo, nao um card sobre o
 * canvas. Recuado, ele viraria mais um cartao entre outros e perderia o papel de
 * cabecalho da tela.
 */

function greetingFor(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function HomeBanner({
  headline,
  detail,
  indicators,
  now,
}: {
  /** A frase dominante da tela, em branco sobre o navy. */
  headline: ReactNode;
  /** Uma linha de interpretacao sob a frase (como o numero se compoe). */
  detail?: ReactNode;
  indicators: ShipmentIndicators;
  /** O mesmo `now` do resto da tela — uma leitura de relogio por render. */
  now: Date;
}) {
  const { client } = useMyClient();

  return (
    <div className="-mx-6 -mt-6 border-b border-transparent bg-brand-navy px-6 py-8 dark:border-white/[.28] dark:bg-card md:-mx-8 md:-mt-8 md:px-8">
      {/* Boas-vindas em cima, indicadores dos embarques logo abaixo. */}
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="portal-small font-medium uppercase tracking-wide text-white/60">
            {greetingFor(now)}
            {client?.name ? `, ${client.name}` : ''}
          </p>
          <div className="portal-h1 text-white">{headline}</div>
          {detail ? (
            // white/80: 12.2:1 sobre o navy e 9:1 sobre o card escuro.
            <p className="portal-body text-white/80">{detail}</p>
          ) : null}
        </div>
        <ShipmentIndicatorStrip indicators={indicators} variant="navy" />
      </div>
    </div>
  );
}
