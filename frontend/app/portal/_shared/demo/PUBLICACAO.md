# Protótipo V2 — escopo de publicação

- Frente: camada de demonstração com feature flags por módulo, Cotação V2 do
  cliente e Novo embarque via PO do cliente.
- Fonte: quatro commits sobre `42a16a2` (fundação, Cotação V2, Embarque via PO e
  este fechamento).
- Rota nova: `/portal/embarques/novo`. Todas as demais telas são acréscimos em
  rotas existentes.
- **Deploy não foi feito.** Este documento descreve o que sobe e como conferir;
  a promoção é de quem publica.

## O que sobe

**Camada de demonstração** (`app/portal/_shared/demo/`): store local com prefixo
`centrix-proto-v2:`, flags por módulo com presets de onda, e um painel escondido
que simula a Freitas. O painel só aparece com `?demo=1` ou `Ctrl+Shift+D`, e a
escolha vive em `sessionStorage` — ela morre ao fechar a aba.

**Cotação V2**: "Enviar para a Freitas" no lugar da escolha de agentes, seis
etapas de revisão como estado no cartão, comparação restrita às propostas
liberadas com o selo "Revisada pela Freitas", sino de notificações no cabeçalho
e aprovação simulada quando a cotação não tem proposta real.

**Novo embarque via PO**: botão na Central de trabalho e em Meus Embarques,
modal de escolha, upload com leitura simulada, conferência com confiança por
campo, alerta de PO duplicado, selo "Em análise" na carteira (ou aba própria,
conforme o seletor do painel), vínculo posterior de cotação e a aba "Visão por
PO".

**Documentos**: `ROTEIRO-DEMO.md`, `HANDOFF-BACKEND.md`, `README.md`,
`README-cotacao-v2.md` e `README-embarque-po.md`, todos em
`app/portal/_shared/demo/`.

## Flags padrão

**Todas ligadas.** Um navegador sem nada gravado vê o portal exatamente como ele
é publicado hoje, com as jornadas V2 ativas. Um módulo acrescentado depois
também nasce ligado, mesmo num navegador que já tem flags gravadas — é o que
impede que uma tela suma na máquina de quem já abriu o protótipo.

Para demonstrar uma onda, use os presets do painel. Eles valem só naquele
navegador.

## Como conferir na preview

1. `/portal/home` — a Home carrega com os cards dos temas escolhidos.
2. `/portal/cotacoes` — o Funil abre com as três colunas de sempre.
3. `/portal/embarques` — a carteira abre com as abas Panorama, Embarques, Visão
   por PO e Alertas.
4. `/portal/embarques/novo` — a tela de upload do PO responde 200.
5. `?demo=1` em qualquer uma delas revela a aba "Demonstração" no canto inferior
   esquerdo; `?demo=0` a esconde.
6. No painel: **Onda 0** deve deixar o menu com Início, Central de trabalho,
   Minhas Cotações e Configurações, e `/portal/embarques` deve mostrar "Este
   módulo ainda não está liberado para a sua empresa" com a sidebar intacta.
7. **Tudo liberado** devolve o menu completo.
8. **Reiniciar demonstração** deixa o portal no estado publicado.

O roteiro completo, com as jornadas, está em `ROTEIRO-DEMO.md`.

## Verificação feita localmente

- `npx tsc --noEmit`, `npm run test:unit`, `npm run test:quotation-cards`,
  `npm run test:quotation-preview` e `npm run build` passaram.
- Playwright com API stubada: as cinco ondas (0, 1, 2, 3 e Tudo liberado)
  conferidas em onze rotas cada, sem rota de módulo ligado caindo no guard e sem
  rota de módulo desligado escapando dele.
- Jornadas completas de Cotação V2 e de Embarque via PO, mais aprovação
  simulada, vínculo de cotação e Visão por PO.
- Mobile 390 px e tema escuro nas telas novas, sem overflow horizontal.
- Sem erro de página em nenhuma execução.

## Como reverter

A camada inteira está atrás de flags que moram no navegador, então **não há
rollback de dado a fazer**. Para tirar as jornadas do ar sem republicar, basta
não usá-las: um cliente que nunca abre o painel vê o portal com todos os módulos
ligados e as jornadas V2 ativas.

Para reverter de verdade, volte para `42a16a2` (a base anterior a esta frente).
Os quatro commits são aditivos: a rota `/portal/embarques/novo` desaparece, as
abas e os botões novos somem, e as telas existentes voltam ao comportamento
anterior. Nada no backend, em `shared/`, em `lambdas/` ou em `alembic/` foi
tocado, e nenhuma migration foi criada.

`docs/specs-prototipo/` continua fora do repositório — ver a regra em
`.gitignore`.

## Limites

Nenhuma jornada V2 tem backend: estados, devoluções, liberação por proposta, PO
como registro e dedup vivem no navegador. A aprovação de uma proposta
**ilustrativa** é simulada e cria o embarque localmente; a aprovação de uma
proposta **real** continua passando pela API, inalterada. O guard rail dos
"primeiros N embarques" não foi modelado, e os prazos de revisão são
placeholder. Todos os dados são fictícios.
