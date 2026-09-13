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
