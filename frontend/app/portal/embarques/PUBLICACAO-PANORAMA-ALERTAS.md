# Panorama e Alertas — publicação de 13/09/2026

Base preservada: ebab8e7, incluindo a fonte pública cd1bd72 (detalhes de Cotações) e Configurações. Escopo: três indicadores acima do mapa, navegação Panorama / Embarques / Alertas e revisão aprovada do feed. Mapa, lista, detalhe de embarque e demais módulos preservados.

O Panorama usa registros do endpoint de embarques: estados de negócio abertos; ETA estimada válida de destino, hoje e seis dias seguintes em Brasília; atenção parcial limitada às exceções estruturadas postergado/booking_divergente. Cobertura ausente e parcial explícitas. Nenhuma operação Freitas presumida.

Alertas é a demonstração aprovada, incorporada por iframe na aba existente; cenários fictícios separados dos registros da API. Contém cores por situação, ação rápida, contexto correto de embarque/cotação, filtros Todos / Minha ação / Pendências documentais / Atrasos / Risco de custos, histórico e fontes/dependências. Documentos/propostas exigem captura Centrix; tracking exige homologação ShipsGo; risco de custos sem base não vira zero. Simulações e preferências permanecem na memória da sessão, sem envio ou integração real. Registros relacionados abrem detalhes demonstrativos do mesmo exemplo, nunca outro registro real por semelhança.

Arquivos: components/shipment-map-workspace.*, lib/panorama-summary.*, components/shipment-alerts-preview.tsx, page.tsx; public/prototypes/centrix-alertas. O shell duplicado da prévia é ocultado somente quando incorporada.

Validação pré-publicação: 30 testes de regras/mapa/alertas, TypeScript, navegação e filtro documental com abertura do embarque relacionado no navegador. Build de produção e verificação do domínio serão registrados após promover a candidata. Logs, ambiente local e node_modules excluídos do upload.

Rollback anterior: dpl_J2UnFSmUxgYAgyXWNkWvR9hbo67H. Não substituir esta release por branches anteriores sem incorporar as alterações já publicadas.
