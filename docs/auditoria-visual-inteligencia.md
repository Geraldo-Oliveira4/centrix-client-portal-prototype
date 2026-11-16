# Auditoria visual da Inteligência (cores e contraste)

Levantamento feito ANTES de qualquer ajuste (branch `feat/inteligencia-subabas-v2`,
item 7a). Escopo: o protótipo embutido em
`frontend/public/prototypes/centrix-inteligencia` (todas as cores vivem em
`style.css`; os scripts não têm cor própria) e a ponte de tema
`frontend/public/prototypes/_shared/theme-sync.css`.

Método: contagem das cores no CSS e contraste WCAG calculado por script. O modo
escuro foi SIMULADO aplicando às cores o mesmo filtro da ponte
(`invert(0.9) hue-rotate(180deg)`); não é medição em tela.

## (i) Cores em uso

- **120 valores hexadecimais distintos** em 227 usos, mais 13 variáveis em dois
  blocos `:root`. Só 13 das cores são token; o resto é hex solto.
- **33 tintas de texto** e **53 fundos** distintos.

| Papel | Valores | Onde aparece |
|---|---|---|
| Tinta principal | `--ink #1a1c31` | corpo, títulos, valores |
| Marca / índigo | `--indigo #2c2e65` | números grandes, links, botão primário, barras e linha "Prontidão" dos gráficos, trilha do funil |
| Texto de apoio | `--muted #626a7c` (66 usos), `--muted-ink #51566b` (38), e mais ~12 cinzas e lilases próximos (`#555c71`, `#555d72`, `#555a70`, `#5a5880`, `#686a9a`, `#6a6596`, `#655181`, `#777d8d`…) | legendas, bases, cabeçalhos de tabela, telas internas |
| Fundo da página | `--bg #f4f5fa` | página |
| Superfícies | branco (`#fff`/`white`, 51 usos) e ~20 quase-brancos (`#fafafe`, `#f6f6fb`, `#f8f8fd`, `#fcfbff`, `#faf9fe`, `#f4f5fb`, `#fafaff`…) | cards, cabeçalho de tabela, hover, caixas |
| Bordas | `--line #e2e4ed` (76 usos) e ~10 vizinhas (`#d5d8e3`, `#d6d9e4`, `#c9cddd`, `#d4d6e3`, `#edeef5`…) | cards, campos, tabelas |
| Acento | `--orange #f59c27`, `#f3b355`, `--accent-bg #fff1e6`, `--accent-line #f0b98a`, `--accent-ink #8a3d08`, `#fff7ea`, `#7a4407` | aba ativa, faixa "maior queda", trechos com desvio, aviso do Simulador, CTA da introdução, passo ativo |
| Verde | `#136b42`, `#23754f`, `#e8f5ee`, `#eaf4ed`, `#e7f4ec` | variação "boa", pill "Sem desvio", "Cabe na data", caixa de sucesso |
| Vermelho | `#b42f2f`, `#fbeeee`, `#a32424`, `#925321` | variação "ruim" (classe existe; a tela usa âmbar), erro de formulário |
| Âmbar | `#8a5e00`, `#875810`, `#fff4dd`, `#fff3df`, `#fdf3e1` | variação "piora", pill de aviso, "Apertado" |
| Lilás | `#8b80b9` (foco, 14 usos), `#9b98b8`, `#efeaf7`, `#634581`, `#eeedf5` | contorno de foco, selos tracejados, telas internas |
| Gráficos | `#2c2e65` (cheia), `#b4580a` (tracejada), `#3f63c8` (pontilhada), `#c5c8e4` (mês em curso) | Evolução e fichas |
| Sombras | `#1a1c3120`…`#1a1c3140` | gavetas, menus, introdução |

## (ii) Onde a cor carrega significado

| Lugar | Cor | O que ela diz |
|---|---|---|
| Variação ↑↓ (Visão geral, destaque e funil) | verde = melhora, âmbar = piora, cinza = neutro | **juízo de bom/ruim** |
| Pill "Sem desvio" (Compromissos do serviço) | verde | **juízo** (sem desvio = bom) |
| Simulador: "Cabe na data" verde, "Apertado" âmbar, "Não cabe" cinza | semáforo | classificação do resultado |
| Trechos com desvio (nível 4) | fundo e número em laranja | destaque de onde há desvio |
| Faixa "A maior queda é de…" | fundo laranja claro + fio laranja | destaque de insight |
| Aviso do Simulador ("Estimativa… não é garantia") | fundo âmbar claro | aviso |
| Caixa de sucesso do relatório | verde | confirmação |
| Erro de formulário | vermelho | erro |
| Selos "Amostra pequena" e "Prévia" | lilás tracejado | qualidade/estado do dado |
| Séries dos gráficos | três matizes (índigo, laranja, azul) | identidade da série |

Nas tabelas de Agentes, Exportadores e Rotas não há cor de bom/ruim hoje.

## (iii) Contraste (AA: 4,5:1 em texto; 3:1 em elementos)

Razões calculadas; "escuro" é a simulação do filtro.

| Par | Cores | Claro | Escuro |
|---|---|---|---|
| variação ↑ "boa" (.variation.good) | `#136b42` sobre `#e8f5ee` | 5.83 | 6.23 |
| variação "ruim" (.variation.bad) | `#b42f2f` sobre `#fbeeee` | 5.48 | 7.10 |
| variação âmbar (.variation.warn) | `#8a5e00` sobre `#fff4dd` | 5.22 | 5.69 |
| variação neutra | `#4b4d74` sobre `#eeeef6` | 6.96 | 6.18 |
| selo Amostra pequena | `#4b4a70` sobre `#f6f5fb` | 7.71 | 6.79 |
| selo Prévia | `#5a5880` sobre `#ffffff` | 6.68 | 6.43 |
| selo Exemplo ilustrativo | `#2c2e65` sobre `#eef0fb` | 10.97 | 8.25 |
| texto de apoio --muted-ink | `#51566b` sobre `#ffffff` | 7.26 | 6.73 |
| texto --muted (legado) | `#626a7c` sobre `#ffffff` | 5.42 | 5.56 |
| --muted sobre fundo da página | `#626a7c` sobre `#f4f5fa` | 4.98 | 5.09 |
| pill "Sem desvio" (.pill.good) | `#23754f` sobre `#eaf4ed` | 5.00 | 5.55 |
| pill aviso (.pill.warn) | `#875810` sobre `#fff3df` | 5.57 | 5.84 |
| pill neutra | `#555d72` sobre `#eff0f5` | 5.78 | 5.51 |
| Simulador: Cabe | `#23754f` sobre `#e7f4ec` | 4.97 | 5.50 |
| Simulador: Apertado | `#875810` sobre `#fdf3e1` | 5.56 | 5.83 |
| Simulador: Não cabe | `#4a5163` sobre `#eef0f4` | 6.95 | 6.17 |
| trecho com desvio (número) | `#8a3d08` sobre `#fff1e6` | 6.90 | 7.03 |
| trecho sem desvio (número) | `#5d6079` sobre `#ffffff` | 6.15 | 6.06 |
| botão primário | `#ffffff` sobre `#2c2e65` | 12.46 | 9.45 |
| botão da introdução (CTA) | `#1a1c31` sobre `#f59c27` | 7.71 | 3.46 |
| link/índigo sobre branco | `#2c2e65` sobre `#ffffff` | 12.46 | 9.45 |
| opção de filtro desabilitada | `#a3a6b8` sobre `#ffffff` | 2.41 | 2.79 |
| gráfico: linha Chegada (laranja escuro) | `#b4580a` sobre `#ffffff` | 4.84 | 6.18 |
| gráfico: linha Entrega (azul) | `#3f63c8` sobre `#ffffff` | 5.48 | 6.18 |
| gráfico: linha Prontidão / barras | `#2c2e65` sobre `#ffffff` | 12.46 | 9.45 |
| foco (contorno) | `#8b80b9` sobre `#ffffff` | 3.57 | 4.11 |
| borda de campo | `#c9cddd` sobre `#ffffff` | 1.58 | 1.72 |
| borda de card --line | `#e2e4ed` sobre `#ffffff` | 1.27 | 1.31 |
| trilho do funil | `#e9ebf5` sobre `#ffffff` | 1.19 | 1.21 |
| acento laranja (faixa/aba ativa) | `#f59c27` sobre `#ffffff` | 2.17 | 3.22 |
| erro de formulário | `#b42f2f` sobre `#ffffff` | 6.20 | 8.11 |
| sucesso (.success) | `#136b42` sobre `#e8f5ee` | 5.83 | 6.23 |
| rodapé/faixa demo | `#4a5066` sobre `#eeeef5` | 6.91 | 6.11 |
O que falha:

- **CTA da introdução no escuro: 3,46:1** (o laranja vira marrom `#9f5800` e a
  tinta fica clara em cima dele).
- **Opção de filtro desabilitada: 2,41:1** (claro) e 2,79:1 (escuro). Estado
  desabilitado é isento pela WCAG, mas o texto "0 no recorte" ao lado usa a
  mesma tinta e precisa ser lido.
- **Bordas de campo e de card: 1,3 a 1,6:1.** Abaixo de 3:1 para o contorno de
  campos de formulário (período, filtros, datas, switches desligados).
- **Trilho do funil: 1,19:1** contra o card (a barra preenchida passa; o trilho
  vazio quase some).
- **Acento laranja como elemento: 2,17:1** sobre branco (fio da aba ativa, fio
  da faixa de insight, passo ativo da introdução). Não é texto, mas é o único
  sinal da aba ativa além da cor do rótulo.
- Telas internas (fora do escopo desta PR, registradas): `#8e8ba7` (3,28),
  `#a0a5b2` (2,46) e `#777d8d` (4,12) como texto.

Todo o texto das telas novas da v4 passa AA no claro; no escuro simulado, o
único texto novo que falha é o CTA da introdução.

## (iv) Cores fixas que não seguem o tema do portal

O iframe não usa os tokens do portal: o escuro é uma **inversão de luminância
da página inteira**. Consequências medidas:

- superfície de card vira `#191919` e o fundo `#202125`: **cinza neutro**, não o
  Navy Profundo do portal (`#1A1C31` no canvas, `#23253F` nos cards);
- o laranja da marca vira `#9f5800` (marrom): o acento deixa de ser o da marca;
- o índigo vira `#b9bbe7` e a tinta `#cccdde`, próximos dos do portal por
  coincidência do filtro, não por token;
- as 107 cores que não são variável não podem ser ajustadas por tema: qualquer
  correção de contraste no escuro exigiria mexer no filtro, que é compartilhado
  com Auditoria, Radar, Central de trabalho e Configurações.

## (v) Estados que dependem só de cor

| Estado | Hoje | Tem outro sinal? |
|---|---|---|
| Tema escolhido (chips Prazo/Custo/Volume) | fundo lilás claro | **não** (só `aria-pressed`) |
| Trecho com desvio × sem desvio | fundo e cor do número | parcial (o número "5/18" diz, o destaque é só cor) |
| Opção de filtro desabilitada | tinta clara | parcial ("0 no recorte") |
| Linha da tabela sob o mouse / ficha aberta | fundo | **não** para a linha cuja ficha está aberta |
| Séries do gráfico de prazo | cor + traço + marcador | sim |
| Mês em curso no gráfico de frete | barra clara tracejada + rótulo | sim |
| Variação | cor + seta + texto | sim |
| Selos do Simulador | cor + ícone + texto | sim |
| Coluna ordenada | cor + seta | sim |
| Submódulo/aba ativa | cor + fio | sim (`aria-current`) |
| Switch ligado/desligado | cor + posição | sim |

## O que a etapa 7b vai fazer com isto

1. Um bloco único de tokens (tinta, superfícies, bordas, acento, aviso, série) e
   substituição dos hex soltos por eles.
2. Variação em tinta neutra, com seta e sinal; verde e vermelho saem como
   "bom/ruim". "Amostra pequena" em cinza.
3. Séries dos gráficos em tons de um só matiz, mantendo traço e marcador.
4. Bordas de campo e trilho do funil a 3:1; sinal não cromático nos estados da
   tabela (v) que hoje não têm.
5. Tema escuro por tokens próprios, com as superfícies e tintas do portal, no
   lugar da inversão para esta tela.

## Depois dos ajustes (7b)

Medido no navegador (Chromium), no claro e no escuro, sobre a Visão geral, a
ficha de um agente e o Simulador: nenhum texto abaixo de 4,5:1 e nenhuma tinta
verde ou vermelha. Pares de token calculados:

| Par | Claro | Escuro |
|---|---|---|
| tinta sobre superfície | 16,74 | 12,89 |
| tinta secundária sobre superfície | 7,26 | 6,39 |
| tinta secundária sobre a superfície mais tingida | 6,19 | 4,73 |
| tinta terciária (desabilitado, "0 no recorte") sobre superfície | 5,12 | 5,46 |
| índigo (links, títulos) sobre superfície | 12,46 | 8,78 |
| texto do botão primário | 12,46 | 4,73 |
| texto do CTA sobre o acento | 7,71 | 7,71 |
| aviso sobre o fundo de aviso | 5,60 | 6,02 |
| contorno de campo sobre superfície (3:1) | 3,74 | 3,88 |
| séries do gráfico sobre superfície (3:1) | 12,46 · 5,71 · 3,20 | 8,78 · 5,88 · 4,12 |

O que ficou como estava, de propósito: o acento laranja como fio (coluna líder,
aba ativa, faixa de insight) tem 2,17:1 sobre branco no claro. Ele nunca é o
único sinal: a coluna líder também tem peso, a aba ativa tem `aria-current` e
tinta própria, e a faixa de insight é texto.
