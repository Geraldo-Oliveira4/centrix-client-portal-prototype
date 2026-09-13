# Cotação — guia de revisão para desenvolvimento

Direção confirmada por Vinicius em 13/09/2026: **manter o Kanban atual da main**, com Preencher detalhes, Aguardando agentes e Escolha sua proposta. Esta entrega revisa os detalhes abertos a partir dessas etapas. O catálogo de variações é uma ferramenta de revisão do protótipo, não uma proposta de substituição do Kanban.

**Entrada:** [abrir todas as variações](http://localhost:3014/portal/cotacoes/previa?variacoes=1). Links locais precisam do servidor na máquina de quem abre; configuração no [README](./README.md). Nenhuma URL pública foi publicada nesta entrega.

## Etapas e variações

| Etapa | Abrir | O que conferir |
|---|---|---|
| Preencher | [Rascunho](http://localhost:3014/portal/cotacoes/previa?cenario=rascunho) | Peso/volume pendentes; revisão antes do envio. |
| Preencher | [Pedido de complemento](http://localhost:3014/portal/cotacoes/previa?cenario=complementar) | Pedido da Freitas com responsável/data, campos específicos, dados existentes preservados. |
| Preencher | [Dados completos / revisão do envio](http://localhost:3014/portal/cotacoes/previa?cenario=envio) | Campos preenchidos; Revisar solicitação abre destinatários antes da confirmação. |
| Aguardar | [Sem propostas](http://localhost:3014/portal/cotacoes/previa?cenario=aguardando) | Envio efetuado, agentes, prazo esperado e pedido de atualização. |
| Aguardar | [Respostas parciais](http://localhost:3014/portal/cotacoes/previa?cenario=parciais) | Uma oferta consultável; escolha bloqueada até liberação. |
| Escolher | [Comparação](http://localhost:3014/portal/cotacoes/previa?cenario=comparar) | Necessidade destacada, tabela, custos/mercado, recomendação e Raio X. |
| Escolher | [Ofertas vencidas](http://localhost:3014/portal/cotacoes/previa?cenario=vencidas) | Bloqueio da seleção e solicitação de revisão nos detalhes. |
| Escolher | [Dados ausentes](http://localhost:3014/portal/cotacoes/previa?cenario=sem-dados) | Sem chegada/validade/necessidade: não inventar recomendação ou datas. |
| Escolher | [Escolha devolvida](http://localhost:3014/portal/cotacoes/previa?cenario=devolvida) | Motivo explícito e nova escolha. |
| Após escolha | [Em análise](http://localhost:3014/portal/cotacoes/previa?cenario=analise) | Cliente escolheu; Freitas ainda analisa. Não significa contratação. |
| Após escolha | [Liberada](http://localhost:3014/portal/cotacoes/previa?cenario=liberada) | Condição liberada e resumo de instrução. |
| Após escolha | [Fechada](http://localhost:3014/portal/cotacoes/previa?cenario=fechada) | Condição contratada e resumo do vínculo ao embarque. |
| Encerramento | [Propostas recusadas](http://localhost:3014/portal/cotacoes/previa?cenario=recusada) | Motivo preservado no histórico. |
| Encerramento | [Solicitação cancelada](http://localhost:3014/portal/cotacoes/previa?cenario=cancelada) | Motivo preservado e próxima ação explícita. |

## Roteiro rápido

1. Abra Complementar, envie vazio e confira a validação. Preencha peso `12400` e volume `52`, depois envie o complemento: os demais dados permanecem e a revisão do envio passa a estar disponível.
2. Abra Dados completos e clique em Revisar solicitação. Confira os agentes; teste nenhum destinatário (envio bloqueado) e um destinatário (contagem deve acompanhar o envio). Não há comunicação externa.
3. Abra Aguardando agentes. Peça atualização e confira o retorno visual. Em **Simular → Receber próxima proposta**, percorra ausência → parcial → comparação liberada. A liberação junto da última resposta é um atalho demonstrativo; na integração, usar o estado autorizado pelo backend.
4. Compare Alpha/Beta. Observe o Raio X acompanhando a escolha, inclusive ao consultar Gamma e selecionar novamente a mesma oferta. Gamma tem escopo incompleto e não pode ser escolhida. Mercado aparece apenas junto ao preço completo.
5. Em **Simular**, marque Falha na próxima confirmação, revise a escolha e confirme: erro preserva a seleção; nova tentativa continua. Confirmação leva à análise. Simule liberação/devolução e contratação como ações distintas.

**Estado salvo:** cada variação usa um registro próprio de localStorage (`centrix-quotation-preview-v1:<cenario>`). Voltar ao link não apaga ações feitas antes. Use **Reiniciar este cenário** para recuperar somente a variação aberta. Variar cenários é navegação entre exemplos independentes, não avanço de uma única cotação.

## Limites e pontos para integrar

- React nativo no shell do portal; código concentrado nesta pasta. `model.ts` define fixtures/regras e `review-guide.ts` organiza os acessos. Não transplantar o catálogo para a jornada do cliente.
- A rota `/portal/cotacoes/previa` permanece separada do detalhe existente `/portal/cotacao/[id]`. A integração dos cliques do Kanban ao detalhe revisado ainda está pendente. Preservar a main atual ao realizar essa integração.
- A API 8014 sustenta o shell com fixtures de embarque; não representa o conjunto de cotações do Kanban publicado. Não avaliar conteúdo/contagens da main usando essa API de apoio.
- Não há mutações de negócio por API, envio real aos agentes, banco, arquivos originais ou modelo de IA. As recomendações são regras demonstrativas; condições, mercado e histórico do agente são fictícios.
- Integração exige contrato de estados, pendências de campos com responsável/data, destinatários/envio, respostas por agente, validade/escopo/custos e autorização da escolha. Histórico/versionamento e erros devem vir de fontes persistentes.
- Mercado precisa de ofertas comparáveis, moeda/cobertura e data da base; Raio X precisa de amostra e evidências dos eventos/auditorias. Ausência não vira zero nem avaliação negativa.
- Necessidade e previsão referem-se ao **porto**. Não converter em promessa de entrega na fábrica. Instrução e embarque nesta prévia são resumos de continuidade, sem fluxos/documentos completos.

Verificação automatizada: `npm run test:quotation-preview` (14 testes) e `npm run build`. Complementar com o roteiro acima no navegador, inclusive celular, antes de integrar.
