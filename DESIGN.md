---
name: Freitas Centrix
description: Central de controle de logística internacional. Previsibilidade e controle em cada etapa.
colors:
  navy: "#1A1C31"
  indigo: "#2C2E65"
  orange: "#F59C27"
  white: "#FFFFFF"
  mist: "#F4F5FA"
  indigo-700: "#464A78"
  indigo-600: "#686A9A"
  indigo-300: "#C1C3F3"
  indigo-100: "#EAECFC"
  orange-800: "#7A4407"
  orange-100: "#FDE8B8"
  border: "#DDE0EE"
  success: "#1E9E63"
  warning: "#C98A00"
  danger: "#D64545"
  info: "#4C6FD1"
typography:
  display:
    fontFamily: "New Black, Source Sans Pro, sans-serif"
    fontSize: "clamp(2.75rem, 5vw, 4.5rem)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  h1:
    fontFamily: "New Black, Source Sans Pro, sans-serif"
    fontSize: "clamp(2.25rem, 4vw, 3.5rem)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  h2:
    fontFamily: "New Black, Source Sans Pro, sans-serif"
    fontSize: "clamp(1.75rem, 3vw, 2.5rem)"
    fontWeight: 600
    lineHeight: 1.15
  h3:
    fontFamily: "New Black, Source Sans Pro, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
  lead:
    fontFamily: "Source Sans Pro, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Source Sans Pro, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Source Sans Pro, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.08em"
    textTransform: uppercase
rounded:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "40px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "16px"
  md: "24px"
  lg: "48px"
  xl: "96px"
components:
  button-primary:
    backgroundColor: "{colors.orange}"
    textColor: "{colors.navy}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "#FEB93C"
  button-secondary:
    backgroundColor: "{colors.indigo}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "44px"
  button-outline:
    borderColor: "{colors.indigo}"
    textColor: "{colors.indigo}"
    rounded: "{rounded.md}"
  button-chevron:
    backgroundColor: "{colors.orange}"
    textColor: "{colors.navy}"
    rounded: "{rounded.md}"
    iconChip: "{colors.indigo}"
    iconColor: "{colors.orange}"
  input:
    backgroundColor: "{colors.white}"
    borderColor: "{colors.indigo-300}"
    textColor: "{colors.navy}"
    rounded: "{rounded.md}"
    height: "44px"
  input-focus:
    borderColor: "{colors.orange}"
    ring: "0 0 0 3px rgba(245,156,39,0.45)"
  card:
    backgroundColor: "{colors.white}"
    borderColor: "{colors.border}"
    rounded: "{rounded.lg}"
    padding: "24px"
  card-dark:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.white}"
    rounded: "{rounded.xl}"
  hero-dark:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.white}"
    accentColor: "{colors.orange}"
    rounded: "{rounded.2xl}"
---

## Overview

Freitas Centrix é a central de controle de logística internacional da Freitas, empresa de comércio exterior com mais de 30 anos, sediada em Itajaí (SC). A marca fala com quem gerencia importação e exportação e precisa de previsibilidade, controle e visibilidade. O sistema visual é sóbrio e técnico, com um único ponto de energia: o laranja. Três palavras de voz: **preciso, confiante, em movimento**.

A composição segue a regra 75/15/10. Cerca de 75% de cada peça é estrutural (Navy Profundo em layouts escuros, Branco e Cinza Névoa em layouts claros), 15% é Índigo (títulos, botões secundários, ícones) e no máximo 10% é Laranja (CTA, números, palavras-chave, símbolo). O laranja é teto, não meta.

## Colors

- **Navy Profundo `#1A1C31`**: superfície escura. É o fundo dos heros, posts e seções de impacto. Nunca use como cor de texto sobre índigo.
- **Índigo `#2C2E65`**: cor da marca. Logo, títulos em fundo claro, botões secundários, ícones, links. Sobre branco tem contraste 12,5:1.
- **Laranja `#F59C27`**: destaque. CTA primário (texto Navy Profundo por cima, 7,7:1), números de impacto, palavras-chave em headlines escuras, nós das linhas de rota, símbolo. Nunca como texto pequeno sobre branco: use `orange-800 #7A4407` para isso.
- **Branco / Cinza Névoa `#F4F5FA`**: base dos layouts claros. Névoa em grandes áreas, Branco em cards.
- **Rampas**: índigo 50–950 e laranja 50–800 para estados, superfícies secundárias e gráficos. Rampas nunca substituem as cores oficiais em elementos de marca.
- **Semânticas**: sucesso, aviso, erro e info aparecem só em feedback de interface, sempre com ícone ou texto além da cor.
- **Gradientes**: permitidos apenas de Navy Profundo para Índigo (`#1A1C31 → #2C2E65`) e como véu duotone sobre fotografia. Nunca gradiente laranja em grandes áreas.

## Typography

- **New Black** é a fonte de títulos (display, h1–h4) e de números de impacto. Pesos 600 para títulos, 500 para h4, 300 para display editorial leve. Tracking -0,02em acima de 36px.
- **Source Sans Pro** é a fonte de corpo, UI, labels e formulários. 400 corpo, 600 rótulos e botões, 700 ênfase. Itálico só em citações.
- Escala fluida com `clamp()`. Corpo mínimo 16px. Largura de linha entre 60 e 75 caracteres.
- Headlines de impacto seguem o padrão do post: o benefício ou número em Laranja, o restante em Branco (fundo escuro) ou Índigo (fundo claro). Uma única frase, sem ponto de exclamação.
- Labels de seção em caixa alta, 12px, tracking 0,08em, Índigo 600. Use um kicker por seção, não em todo bloco.

## Layout

- Grid de 12 colunas, container 1280px, gutter 24px (16px no mobile), margens fluidas de 16 a 48px.
- Breakpoints: 640, 768, 1024, 1280, 1440. Mobile-first.
- Espaçamento em múltiplos de 4px. Seções separadas por 80 a 128px no desktop e 48 a 64px no mobile.
- Formas de marca: cantos generosos (24 a 40px) em painéis e molduras; 12px em botões e inputs; 16px em cards.
- Grafismo de rota: molduras de linha fina (1px, branco a 28%) com um canto muito arredondado e nós laranja de 8px nas extremidades. Use no máximo duas molduras por tela.
- Fotografia sempre em duotone Navy Profundo para Laranja, com temas de porto, navio, contêiner, guindaste e mapa.

## Elevation & Depth

- Superfícies claras: bordas de 1px `#DDE0EE` antes de sombra. Sombra `md` só em elementos flutuantes (dropdown, popover) e `lg` em modais.
- Superfícies escuras: sem sombra. A profundidade vem de camadas (`#1A1C31` → `#23253F`) e das linhas de rota.
- O CTA laranja pode receber `glow-orange` no hover em fundos escuros. Nunca em fundos claros.

## Shapes

- Raio padrão 12px (botões, inputs, chips grandes). Cards 16px. Painéis e imagens 24px. Molduras de hero e formas de marca 40px ou mais.
- O chevron do símbolo é a única forma decorativa da marca. Aparece como bullet e seta de CTA. Nunca como padrão de fundo ou textura. Nunca redesenhe o chevron: use o SVG oficial.
- Botão de assinatura: barra laranja com chip índigo à esquerda contendo o chevron duplo laranja. Reservado para o CTA principal de heros e posts. Um por tela.

## Components

- **Botões**: primário laranja/navy, secundário índigo/branco, outline índigo, ghost, link, destrutivo. Alturas 36/44/56. Um primário por dobra. Ícone Lucide 20px à direita quando indicar avanço.
- **Inputs**: 44px, borda `indigo-300`, foco com anel laranja de 3px. Label sempre visível acima. Erro em `danger` com texto abaixo do campo.
- **Cards**: brancos com borda em fundo claro; navy `#23253F` com borda branca a 12% em fundo escuro. Título em New Black 600 20–24px.
- **Stat tile**: número em New Black 600 48–64px Laranja (fundo escuro) ou Índigo (fundo claro), label em Source Sans 600 12px caixa alta.
- **Badges**: fundo `indigo-100`/texto índigo; `orange-100`/texto `orange-800`; semânticos com fundo suave.
- **Header**: 72px, logo vertical (versão principal) à esquerda com 48px de altura, navegação Source Sans 600 16px, CTA primário à direita. Versão escura sobre hero navy.
- **Footer**: Navy Profundo, logo negativo, colunas de links em `indigo-300`, sem grafismo.
- **Ícones**: Lucide, stroke 1,75, 16px inline, 20px em botões, 24px em cards. Sem emojis.
