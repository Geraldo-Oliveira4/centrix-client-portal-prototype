# Camada de demonstração e feature flags — Protótipo V2

O que esta pasta faz: dá ao protótipo dois controles que o portal real vai ter
no servidor — **quais módulos a empresa enxerga** e **como a Freitas responde**
— e os coloca num painel que só quem apresenta consegue abrir.

**Não é controle de acesso.** As flags moram no `localStorage` deste navegador,
não há nada por cliente e nenhum endpoint recusa chamada de módulo desligado.
São adereços de palco: existem para que uma onda de liberação possa ser
*mostrada*. No produto integrado a flag é por cliente, fica no servidor, e
esconder na tela não basta.

## Como abrir o painel

Ele fica escondido por padrão — o cliente que está testando o portal não pode
encontrá-lo por engano:

| Ação | Efeito |
|---|---|
| `?demo=1` em qualquer URL do portal | liga e guarda a escolha na aba |
| `?demo=0` | desliga |
| `Ctrl+Shift+D` | alterna |

Ligado, aparece uma aba **Demonstração** no canto inferior esquerdo (o direito é o botão "Ajuda" do cliente); ela abre o
Sheet "Painel de demonstração · simulação da Freitas".

A escolha vive em `sessionStorage`, não em `localStorage`: ela sobrevive à
navegação dentro do portal e morre ao fechar a aba. Um painel que durasse dias
na máquina de quem uma vez apresentou acabaria sendo encontrado por outra
pessoa.

## Os arquivos

| Arquivo | O que é |
|---|---|
| `demo-store.ts` | núcleo do store local. **Puro**: storage e event target entram por parâmetro. Prefixo único `centrix-proto-v2:` e `resetPrefix()` |
| `use-demo-store.ts` | `useSyncExternalStore` em cima do núcleo, seguro para SSR |
| `feature-flags.ts` | módulos, presets de onda, mapa rota -> módulo. **Puro** |
| `use-feature-flags.ts` | os hooks que as telas usam |
| `freitas-simulation.ts` | ajustes do analista simulado. **Puro** |
| `use-freitas-simulation.ts` | hook correspondente |
| `module-not-released.tsx` | a tela de módulo fechado, montada pelo `portal/layout.tsx` |
| `use-demo-panel.ts` | visibilidade do painel (`?demo`, `Ctrl+Shift+D`, sessão) |
| `demo-sections.tsx` | **o registro de seções do painel** |
| `demo-panel.tsx` | a aba e o Sheet. Renderiza `DEMO_SECTIONS` e nada mais |
| `access-model.ts` · `access-csv.ts` | gestão de acessos simulada: convites, flags por empresa, onda em lote, registro e importação CSV. **Puros** |
| `use-access.ts` | estado de acessos e "ver como" (**interno**; só carregado em preview) |
| `demo-section-access.tsx` · `viewing-as-banner.tsx` | a porta para `/portal/admin/acessos` e a faixa do "ver como" (**internos**, import dinâmico atrás de `NEXT_PUBLIC_PROTO_INTERNAL`) |
| `client-profile.ts` · `use-client-profile.ts` | tipo de cliente do painel + retrato do "ver como"; **seguros para produção**. **Puro** + hook |
| `client-kind.ts` · `data-source-strip.tsx` | Cliente Freitas x SaaS puro: a regra "nada vem preenchido" e a faixa de origem do dado. **Puro** + desenho |

### Cotação V2 (HITL)

A jornada com as duas revisões da Freitas tem README próprio:
**[`README-cotacao-v2.md`](./README-cotacao-v2.md)**. Em uma linha: a flag
`cotacaoV2` liga um overlay local (`quotation-review.ts`) com as seis etapas, o
sino do cabeçalho, o painel lateral da Nova cotação e a seção "Cotação V2" do
painel de demonstração — que é a única Freitas que existe neste protótipo.

| Arquivo | O que é |
|---|---|
| `quotation-review.ts` | **puro** — etapas, transições, merge, contador, autorresposta |
| `quotation-review-notices.ts` | **puro** — as notificações, derivadas do histórico |
| `quotation-v2-scenarios.ts` | **puro** — "Carregar cenários de demonstração" |
| `use-quotation-review.ts` | hooks e escritores |
| `use-v2-auto-advance.ts` · `portal-v2-auto-advance.tsx` | a autorresposta, montada no layout |
| `quotation-v2-labels.tsx` | selos e `REVIEW_SLA_LABEL` |
| `what-happens-next.tsx` | o painel "O que acontece depois de enviar" |
| `portal-notifications-bell.tsx` | o sino do cabeçalho |
| `demo-section-cotacao-v2.tsx` | a seção do painel |
| `quotation-demo-proposals.ts` | **puro** — as propostas ilustrativas de uma cotação que não tem nenhuma |
| `review-sla.ts` | **puro** — o prazo das revisões (1 hora), uma regra para as duas jornadas |
| `quotation-hardblocks.ts` · `quotation-form-snapshot.ts` | **puros** — a lista de bloqueios do Orsi e o snapshot/diff do que o cliente enviou |
| `direct-close.ts` · `use-direct-close.ts` · `demo-section-direct-close.tsx` | o fechamento direto com o agente preferido da rota |

### Novo embarque via PO

A jornada em que o cliente abre o embarque a partir do PO tem README próprio:
**[`README-embarque-po.md`](./README-embarque-po.md)**. Em uma linha: a flag
`embarqueViaPo` liga um overlay local (`shipment-po-review.ts`) com quatro
estados, o botão na Central e em Meus Embarques, a tela de upload e conferência
do PO, o dedup, a vinculação posterior de cotação e a seção "Embarque via PO" do
painel.

| Arquivo | O que é |
|---|---|
| `shipment-po-review.ts` | **puro** — estados, transições, dedup, referências, autorresposta |
| `shipment-po-read.ts` | **puro** — a leitura simulada do PO |
| `shipment-po-merge.ts` | **puro** — o overlay dobrado na carteira |
| `shipment-po-scenarios.ts` · `shipment-po-notices.ts` | **puros** — cenários e avisos do sino |
| `use-shipment-po-review.ts` | hooks e escritores |
| `shipment-po-labels.tsx` | selos, chips e `PO_REVIEW_SLA_LABEL` |
| `shipment-po-review-tab.tsx` | a aba "Em análise" (opção B) |
| `new-shipment-dialog.tsx` · `link-quotation-card.tsx` | o modal de escolha e a vinculação |
| `po-review-view.ts` | os toggles A/B e de falha de leitura |
| `demo-section-embarque-po.tsx` | a seção do painel |

Os arquivos marcados **Puro** rodam sob `node --test` (`npm run test:unit`) e por
isso não usam o alias `@/`, que o runner nativo não resolve — imports relativos
com extensão `.ts`, mesma regra de `embarques/lib/delay-risk.ts`.

## Como acrescentar um módulo

Quatro lugares, todos em `feature-flags.ts` menos o último:

1. O valor em `PORTAL_MODULES`.
2. `PORTAL_MODULE_LABELS` e `PORTAL_MODULE_DESCRIPTIONS` (o `Record` quebra o
   build se faltar) e `DEFAULT_MODULE_FLAGS`.
3. As ondas de `PORTAL_WAVE_PRESETS` em que ele entra. Elas são **cumulativas**:
   uma onda nunca tira o que a anterior deu.
4. `PORTAL_MODULE_ROUTES`, se o módulo tem rota própria. O prefixo **mais
   específico ganha** — é o que faz `/portal/embarques/novo` cair em
   `embarqueViaPo` e não na lista de embarques que divide o prefixo com ele.

E, se ele tem item de menu, o campo `module` da entrada em `NAV_ITEMS`
(`app/portal/components/portal-sidebar.tsx`).

Um módulo novo nasce **ligado**, inclusive num navegador que já tem flags
gravadas: `normalizeModuleFlags` preenche a chave ausente com o padrão. É o que
impede que acrescentar um módulo esconda uma tela na máquina de quem já abriu o
protótipo.

## Como acrescentar uma seção ao painel

Escreva um componente sem props em `demo-sections.tsx` e **acrescente** uma
entrada a `DEMO_SECTIONS`:

```tsx
function MinhaSecao() {
  const simulation = useFreitasSimulation();
  return <p className="portal-small">{simulation.delaySeconds}s</p>;
}

export const DEMO_SECTIONS: DemoSection[] = [
  /* ... */
  { id: 'minha-secao', title: 'Minha seção', Content: MinhaSecao },
];
```

`demo-panel.tsx` não muda. Acrescente ao fim, não insira no meio: quem apresenta
aprende onde um controle está pela posição dele.

Para guardar estado novo, use `useDemoValue(nome, parse)` e `setDemoValue(nome,
valor)`. O `parse` precisa ser uma constante de módulo (é dependência do memo) e
precisa tolerar lixo: o valor no disco foi escrito por uma versão anterior deste
código. `resetPrefix()` já vai apagar a chave nova, porque varre o prefixo em
vez de manter uma lista.

## Produção x Preview

Em produção (build sem `NEXT_PUBLIC_PROTO_INTERNAL=1`) o painel se chama
"Painel de demonstração" e tem **três** seções: Tipo de cliente, Boas-vindas e
Reiniciar demonstração. Tudo o que é conceito interno (Freitas/Ionix) só existe
em Preview e fica fora do bundle de produção: Módulos liberados (ondas), Freitas
simulada, as mesas de revisão da Cotação V2, do Embarque via PO e do Fechamento
direto (`demo-sections-internal.tsx` + os três `demo-section-*.tsx`) e a Gestão
de acessos. A condição é inline em volta de cada `import()` dinâmico em
`demo-sections.tsx`.

Sem essas seções, o cliente não pode travar. Por isso, **só em produção**:

- **Módulos fixos, todos visíveis** (`useGlobalModuleFlags` devolve
  `DEFAULT_MODULE_FLAGS` e ignora o que estiver guardado no navegador). Em
  Preview o padrão também é tudo ligado, e o painel muda.
- **A Freitas responde sozinha, sempre, 8 s por etapa**
  (`PRODUCTION_FREITAS_SIMULATION`; `useFreitasSimulation` ignora o store). Em
  Preview o padrão continua desligado, ligado pelo painel.
- **O fechamento direto entrou na autorresposta** (`msUntilDirectCloseAutoAdvance`,
  no mesmo temporizador de `use-v2-auto-advance.ts`): revisão de entrada →
  instrução enviada. Antes ele só andava pelo clique no painel.
- A autorresposta nunca devolve; devolução é só Preview.

## Tipo de cliente (existe em produção)

Seção **"Tipo de cliente"** do painel: *Com operação Freitas* (padrão, o portal de
sempre) ou *SaaS puro*. Com SaaS puro, Nova cotação, Fechamento direto e Embarque
via PO não preenchem nada sozinhos e o detalhe do embarque mostra de onde vem
cada dado. A regra mora em `client-kind.ts`; o seletor em `client-profile.ts` +
`use-client-profile.ts` (store `client-kind`). **Não depende da gestão de
acessos.**

## Gestão de acessos — INTERNA, só em preview

Conceito interno (Freitas/Ionix): `/portal/admin/acessos`, a seção "Gestão de
acessos (interno)" do painel, o "ver como", o registro de alterações e a
importação de CSV. Só existem em build com **`NEXT_PUBLIC_PROTO_INTERNAL=1`**
(na Vercel, ligada só no escopo **Preview**). O padrão é desligado.

- **Sem a variável** (produção): `/portal/admin/*` responde 404 no
  `middleware.ts`, igual a uma URL que não existe; a seção do painel e a faixa
  do "ver como" nem renderizam, e o código delas fica fora do bundle — a
  condição é escrita inline (`process.env.NEXT_PUBLIC_PROTO_INTERNAL === '1'`)
  em volta de cada `import()` dinâmico, e `next.config.mjs` sempre define a
  variável (`'1'` ou `'0'`) para o compilador eliminar o ramo. Um retrato de
  "ver como" que tenha ficado num navegador é ignorado.
- **Com a variável** (preview): a rota ainda exige o modo de demonstração
  ligado nesta aba; sem ele, 404.
- **Ver como** grava um retrato pequeno da empresa (id, nome, tipo, exceções) no
  store `viewing-as`; `usePortalModuleFlags` e `useClientKind` só leem esse
  retrato, nunca o modelo da gestão de acessos. Enquanto ativo, ele manda sobre o
  seletor "Tipo de cliente". O painel "Módulos liberados" edita o **padrão
  global**.
- **Não é controle de acesso.** No produto real esta tela mora no Centrix
  interno (modal de DNA), não no portal.

## O que o reset apaga

Só o que está sob `centrix-proto-v2:`. O login (`@centrix:session`), os
rascunhos de cotação (`centrix-preparation-v1:`, `centrix-repeat-requests-v1:`) e
o tema (`portal:theme`) não são tocados, e o painel continua aberto — quem
acabou de reiniciar ainda está apresentando.

## Documentos desta pasta

| Documento | Para quê |
|---|---|
| [`README-cotacao-v2.md`](./README-cotacao-v2.md) | as seis etapas da revisão da cotação |
| [`README-embarque-po.md`](./README-embarque-po.md) | a jornada do embarque a partir do PO |
| [`ROTEIRO-DEMO.md`](./ROTEIRO-DEMO.md) | **como apresentar** — ondas, jornadas, reset e limites |
| [`HANDOFF-BACKEND.md`](./HANDOFF-BACKEND.md) | o que a versão integrada precisa ter de verdade |
| [`PUBLICACAO.md`](./PUBLICACAO.md) | o que sobe, como conferir e como reverter |

## Selos

Nenhuma tela do portal ganha marca de "real x ilustrativo" por causa desta
camada. A decisão de 12/08/2026 (ver o `CLAUDE.md` da raiz) é dado ilustrativo
rico, sem `ProvenanceBadge` nas telas novas; a honestidade fica no painel, que se
declara simulação no título e na aba.
