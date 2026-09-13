# Auditoria — publicação de 13/09/2026

Base: cab6237 / código publicado 7f27704, incluindo Central 177892f e as últimas Cotações. Branch codex/auditoria-publicacao. Fonte da prévia aprovada: centrix-audit-review da tarefa 01a09ba6-42cf-7080-9c68-facdec70a212.

Escopo: preço e performance separados; frete por rubrica/versão e validação demonstrativa PTAX; 23 controles de performance; documentos/vínculos, trilha, atalhos de cotação/embarque; entrada em quatro etapas com origens independentes, histórico e contexto assistido com revisão seletiva. Avulsa secundária. Rotas e hash do portal preservados; novos assets somente de runtime e fontes originais, testes fora de public.

Limites: demonstração com fontes fictícias. IA usa parser rotulado local; não há LLM/OCR, upload, catálogo real, consulta BCB, envio, crédito ou novo backend. Dados declarados não geram conformidade. Persistência por sessão do navegador; atalhos de cotação/embarque são contexto demonstrativo. Nenhuma sincronização do Frame ou homologação operacional.

Verificação pré-deploy: 93 testes de domínio aprovados. Validação do build e navegador do candidato/publicação registrada após conclusão. Demais módulos preservados por diff contra cab6237. Origem GitHub ainda requer sincronização; futuras releases precisam incorporar este commit local.

## Resultado da publicação

Fonte publicada: 8d0968d. Deployment dpl_A2fY1PaQ6gbYH79nENXMsiecrfDG READY/promovido, candidato https://centrix-client-portal-prototype-pjxnbunru.vercel.app. Público: https://centrix-client-portal-prototype.vercel.app/portal/auditoria#auditoria/performance. Rollback dpl_8PbWCpWNQ2L9G2qoUG4LHeQtrCEB / 7f27704; ID anterior reconferido imediatamente antes da promoção e novo ID público verificado depois.

93 testes e sintaxe JS aprovados; TypeScript local aprovado; build remoto com 48 páginas aprovado (lint desativado pela configuração existente). Navegador integrado local: entrada por link direto, cotação → contexto assistido e frete/PTAX com docs/log/atalhos. Navegador público: lista Performance → Adicionar → Usar cotação → contexto assistido; hash do host atualizado e menu único preservado. Nenhum erro JS do módulo capturado; erro de autenticação Google pertencia à página de login Vercel visitada no candidato protegido. Candidato HTTP 200 autenticado via CLI; 11 rotas/assets públicos HTTP 200, incluindo módulos preservados. Sem E2E integral dos demais módulos ou nova auditoria de acessibilidade/mobile nesta publicação.

Código commitado localmente, sem push/PR/merge GitHub. Base remota continua pendente de sincronização: próximos deploys devem incorporar 8d0968d e ancestrais. Prévia original e sessão de revisão preservadas.
