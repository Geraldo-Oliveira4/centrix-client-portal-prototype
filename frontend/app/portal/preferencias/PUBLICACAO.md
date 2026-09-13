# Configurações — publicação do protótipo

Pedido de deploy autorizado por Vinicius em 13/09/2026. Base: 95cc4d9 (última publicação de Cotações, incluindo Embarques 358895e); main consultada: 8a18f7e, já ancestral.

## Escopo

- `/portal/preferencias` apresenta a experiência aprovada de Configurações: visão geral, Perfil e operação, Alertas, Empresas, Rotas/Locais e Agentes.
- Assets e estilos isolados em `public/prototypes/centrix-configuracoes/`. Reaproveita o padrão de iframe de Auditoria/Visão Geral, com cabeçalho e menu do portal. Hash de entidade permanece na URL ao navegar/recarregar.
- Agentes são catálogo demonstrativo com personalização da empresa; inclusão apenas para teste. Preferências diretas e vínculo rota/agente.
- XLSX/CSV/TXT estruturado são lidos localmente, revisados e incorporados sem inventar papel, histórico ou score. Modelo XLSX disponível. Nenhum arquivo enviado a serviço externo. Não há IA/OCR conectada.
- A versão publicada usa a entrada analítica local com o mesmo ID. A ficha completa de Inteligência pertence a outra prévia ainda não publicada; não publica esse módulo nem deixa links localhost.
- Persistência exclusiva do navegador (`centrix-configuracoes-demo-v2`), sem copiar o estado pessoal da revisão local. Exemplos fictícios originais. Não sincroniza com API nem outras prévias.

## Preferências conectadas preservadas

A antiga página foi copiada sem alterações para `perfil-conectado.tsx`, reexportada em `/portal/preferencias/conectadas`. Seu hook, gravação, alertas compartilhados e bloqueios continuam como antes. Exportadores e agentes existentes mantêm as rotas `/portal/preferencias/exportadores` e `/portal/preferencias/agentes`. O acesso a esses controles fica abaixo da demonstração, com explicação do isolamento. Nenhum dado ou chave anterior foi migrado ou apagado.

A única edição em componente de navegação compartilhado é o rótulo deste item: Minhas Preferências → Configurações. Cotações, Embarques, hooks/API e demais componentes compartilhados não mudam.

## Validação

`node scripts/settings-preview/checks.cjs`, `checks-perfil.cjs` e `checks-contexto.cjs`: 45 verificações de cadastros, vínculos, isolamento dos formulários, sugestões revisáveis e importação. Expectativa de links analíticos adaptada à release sem localhost. Executar a partir de frontend.

Conferir build/TypeScript, testes de regressão do portal e navegação desktop/mobile antes de promover. Registrar SHA e deployment na memória viva após publicação. Recuperação anterior: deployment dpl_EKzKzXtGx4W1NUR6vwjdi7f7tKQj, commit 95cc4d950e5cd665bd1ea04fd9654d6e62db6e7e.

## Integração futura

Catálogo canônico de agentes, preferências por cliente/rota, identidade unificada, autoria/permissões, versionamento/precedência de regras e contexto compartilhado com Inteligência continuam pendentes. Publicação visual não é integração de produção nem validação com clientes. Banco Frame não consultado/sincronizado.

## Publicação concluída — 13/09/2026

Publicado no domínio https://centrix-client-portal-prototype.vercel.app/portal/preferencias. Código do deployment: 786d22999ac27fd1560d4b875372881c53ffd9c6. Deployment dpl_8jas9mccKrm1vBaYPmYquyTniF3P; candidato https://centrix-client-portal-prototype-8bwiao0t2.vercel.app, promovido e confirmado no domínio principal. PR #5: https://github.com/Geraldo-Oliveira4/centrix-client-portal-prototype/pull/5, branch codex/configuracoes-publicacao no fork público IonixAdmin. Merge pendente no original; preservar 786d229 até a main incorporar esta ancestralidade.

Build local e remoto/TypeScript: 45 rotas. Passaram 45 testes de Configurações, 275 do portal, 18 de Cotações e 10 de Embarques (348 no total). Identidade binária da antiga página de preferências preservada no novo componente. Zero diff nos módulos de cotação/embarque, hooks, backend e preferências compartilhadas contra 95cc4d9.

Browser: desktop da release integrada, hash/recarga, catálogo e painel de preferências; mobile 390 px com importação/revisão e links para preferências conectadas. Após promoção, domínio público conferido com catálogo, navegação até entrada analítica e Perfil e operação no mobile (conteúdo do iframe sem overflow horizontal). Oito rotas/assets públicos retornaram HTTP 200, incluindo modelo XLSX, preferências conectadas e Cotações/Embarques preservados. Não houve gravação nos controles conectados.

A revisão automática inicialmente bloqueou envio ao fork/PR por incerteza sobre destino; liberou após comprovar que original/fork são públicos e o payload contém a demonstração aprovada, sem dados de clientes. Candidato protegido redirecionou para vercel.com e o navegador bloqueou o dashboard; não foi acessado nem se criou bypass. Build conferido pela CLI e revisão visual concluída no domínio público após promoção.

Esta documentação pós-publicação não altera o código do deployment. Integrações futuras e ausência de sincronização Frame permanecem como descritas acima.
