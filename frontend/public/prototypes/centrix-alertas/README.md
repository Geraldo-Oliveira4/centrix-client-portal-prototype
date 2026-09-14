# Alertas Centrix — revisão local de 13/09/2026

Prévia: http://127.0.0.1:8793/. Executar `node server.cjs`. Testar `node --test alert-rules.test.cjs`.

## Regra central

Não pressupor equipe interna de operação Freitas. Todo alerta precisa de fonte identificada, campos capturáveis, regra de geração e dependência técnica. A possibilidade de captura não comprova integração ou cobertura por embarque.

## Oito cenários

- Documento solicitado sem upload: solicitação/destinatário/prazo explícitos + arquivo vinculado no Centrix. Captura a implementar; não inferir solicitação.
- Proposta de booking sem decisão: proposta recebida/cadastrada e versionada + decisão da empresa. Não deriva de BOOKED da ShipsGo.
- Prontidão preenchida e coleta sem data: data_pront_merc/data_coleta_ori do contrato proposto Inova. Homologação pendente.
- Descarga realizada: ShipsGo OceanMovement event DISC/status ACT/timestamp no destino. Não é chegada, desembaraço ou disponibilidade para retirada.
- ETA revisada: ARRV/EST no destino + snapshots próprios do mesmo evento/contêiner/local no Centrix.
- ETA indisponível: resposta válida sem ARRV estimado antes da chegada realizada. Falha de integração não equivale a campo vazio.
- Documento anexado: registro de upload, sem validação de conteúdo ou liberação.
- Partida realizada: DEPA/ACT no porto de origem, sem inferir da abertura do processo.

PO, carga, fornecedor e vínculos comerciais exigem cadastro/importação Centrix. `alert-data.js` contém exemplos, campos e dependências. Contrato ShipsGo reconsultado: https://api.shipsgo.com/docs/v2/specs/openapi.json. Não há payload autenticado homologado.

## UI e limites

Mantidas hierarquia, cores, filtro e detalhe lateral. Fonte no card; disclosure de origem/regra/dependência no painel. Lido não altera a situação. Upload simulado conclui somente envio; aprovação simula decisão da empresa, sem confirmação do armador. Estado volátil; reiniciar no rodapé. Nenhum arquivo ou mensagem real enviado.

Demurrage e preços removidos do feed até fonte definida, mantendo tipos indisponíveis com explicação nas preferências. Nenhuma conferência de documento ou reconciliação humana é presumida. Esta versão substitui os exemplos anteriores com essas premissas.

Nove testes aprovados e conferência em navegador de origem por campo, descarga, upload e tipos indisponíveis. Console sem erros na navegação conferida. Layout desktop/mobile havia sido verificado na revisão anterior; conteúdo da revisão atual conferido em desktop.

Prévia independente, sem deploy, integração, portabilidade para React ou sincronização com Configurações. Links de contexto usam o mesmo exemplo local; navegação principal aponta ao portal publicado. Banco Frame não consultado nem sincronizado.

## Acesso direto ao embarque

Cada card vinculado oferece Ver embarque com a referência, além da ação rápida. O destino é o detalhe demonstrativo do mesmo exemplo, com retorno aos alertas. Na integração, usar shipment_id real para o detalhe canônico. Vínculos EXEMPLO-01 e EXEMPLO-04 e layout mobile 429px conferidos em 13/09.


## Destino por contexto — correção posterior

O feed agora tem nove exemplos. context indica cotacao ou embarque; o link usa o vínculo correspondente, sem forçar shipment. Proposta recebida COT-DEMO-140 demonstra cotação sem embarque. Sem referência válida, não renderizar link inventado. Se ambos estiverem presentes, o contexto explícito define o destino primário. Doze testes passaram; navegação do novo exemplo conferida. Na integração, resolver IDs canônicos do registro correspondente.


## Filtros rápidos — 13/09

Todos, Minha ação, Atualizações, Não vistos e Concluídos. Alteram situação/responsável; preservam busca, tipo e prioridade. Contagens consideram os critérios preservados. Leitura não resolve pendência. Fluxos de contagem, busca/vazio e mobile conferidos. Indicadores gerais propostos para Panorama, sem novos KPIs na aba Alertas.


## Revisão JTBD — substitui os atalhos anteriores

Todos / Minha ação / Atrasos / Risco de custos. Histórico excluído da fila padrão e contador, disponível pelo rodapé e filtro. Não vistos/Atualizações no filtro detalhado. Atraso exige prazo registrado vencido, com corte fictício 11/09/2026 09h20 BRT; packing list é atraso de envio documental, sem inferir atraso físico. Risco de custos exibe Sem base: sem cálculo/casos por falta de condição comercial/marco/regra validados. Base ativa 8, ação 3, atraso 1; após upload 7/2/0 e histórico 2. 14 testes e fluxo browser aprovados. Nenhum deploy ou dado integrado.

