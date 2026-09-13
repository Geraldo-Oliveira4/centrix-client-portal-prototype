# Panorama e Alertas — publicação de 13/09/2026

Base preservada: ebab8e7, incluindo a fonte pública cd1bd72 (detalhes de Cotações) e Configurações. Escopo: três indicadores acima do mapa, navegação Panorama / Embarques / Alertas e revisão aprovada do feed. Mapa, lista, detalhe de embarque e demais módulos preservados.

O Panorama usa registros do endpoint de embarques: estados de negócio abertos; ETA estimada válida de destino, hoje e seis dias seguintes em Brasília; atenção parcial limitada às exceções estruturadas postergado/booking_divergente. Cobertura ausente e parcial explícitas. Nenhuma operação Freitas presumida.

Alertas é a demonstração aprovada, incorporada por iframe na aba existente; cenários fictícios separados dos registros da API. Contém cores por situação, ação rápida, contexto correto de embarque/cotação, filtros Todos / Minha ação / Pendências documentais / Atrasos / Risco de custos, histórico e fontes/dependências. Documentos/propostas exigem captura Centrix; tracking exige homologação ShipsGo; risco de custos sem base não vira zero. Simulações e preferências permanecem na memória da sessão, sem envio ou integração real. Registros relacionados abrem detalhes demonstrativos do mesmo exemplo, nunca outro registro real por semelhança.

Arquivos: components/shipment-map-workspace.*, lib/panorama-summary.*, components/shipment-alerts-preview.tsx, page.tsx; public/prototypes/centrix-alertas. O shell duplicado da prévia é ocultado somente quando incorporada.

Validação pré-publicação: 30 testes de regras/mapa/alertas, TypeScript, navegação e filtro documental com abertura do embarque relacionado no navegador. Build de produção e verificação do domínio serão registrados após promover a candidata. Logs, ambiente local e node_modules excluídos do upload.

Rollback anterior: dpl_J2UnFSmUxgYAgyXWNkWvR9hbo67H. Não substituir esta release por branches anteriores sem incorporar as alterações já publicadas.

## Publicado e verificado

Fonte: 6b181f96215972189aea3c83cdd273ccf7a089e4.
Deployment READY/promovido: dpl_Eq5NCRPrXwQhSjtQ22b9UuBFzNEP.
Candidata: https://centrix-client-portal-prototype-r5r9mqssq.vercel.app.
Público: https://centrix-client-portal-prototype.vercel.app/portal/embarques?tab=mapa e ?tab=alertas.

Build remoto aprovado; candidata HTTP 200; domínio conferido pelo ID após promoção. Cinco rotas públicas HTTP 200: Panorama, Alertas, conteúdo incorporado, rascunho de Cotação e Configurações. Navegador público confirmou o feed revisado e os três cards: 15/4/2 e quatro sem ETA na base pública demonstrativa (distinta da fixture local 15/4/1). Revisão local conferiu filtro documental, abertura de embarque e de cotação e visual responsivo. Comparação com ebab8e7 confirmou os demais módulos sem alterações de código. Sem novo backend, envio externo ou integração homologada.

Commit salvo no checkout local centrix-panorama-alerts-release, branch codex/panorama-alertas-publicacao. Esta rodada publicou diretamente no Vercel; não houve push/PR/merge no GitHub. Para próximos deploys, incorporar esta fonte; rollback: dpl_J2UnFSmUxgYAgyXWNkWvR9hbo67H.
