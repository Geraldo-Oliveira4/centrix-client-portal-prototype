# Cotação — guia de revisão para desenvolvimento

Direção atualizada por Vinicius em 13/09/2026: publicar também a revisão de hierarquia dos cards aprovada a partir do feedback de Orsi. Mantém as colunas Preencher detalhes, Aguardando agentes e Escolha sua proposta; fornecedor/carga identificam a demanda e cada etapa determina a informação de decisão. [Nove exemplos de cards](https://centrix-client-portal-prototype.vercel.app/portal/cotacoes/previa-cards) dão acesso aos detalhes/status e solicitações habituais. Os registros de preservação integral do Kanban abaixo descrevem publicações anteriores.

**Entrada:** [abrir todas as variações](https://centrix-client-portal-prototype.vercel.app/portal/cotacoes/previa?variacoes=1). URLs destinadas à publicação do protótipo. Para revisão local, substitua o domínio por http://localhost:3014; configuração no [README](./README.md).

## Etapas e variações

| Etapa | Abrir | O que conferir |
|---|---|---|
| Preencher | [Rascunho](https://centrix-client-portal-prototype.vercel.app/portal/cotacoes/previa?cenario=rascunho) | Peso/volume pendentes; revisão antes do envio. |
| Preencher | [Pedido de complemento](https://centrix-client-portal-prototype.vercel.app/portal/cotacoes/previa?cenario=complementar) | Pedido da Freitas com responsável/data, campos específicos, dados existentes preservados. |
| Preencher | [Dados completos / revisão do envio](https://centrix-client-portal-prototype.vercel.app/portal/cotacoes/previa?cenario=envio) | Campos preenchidos; Revisar solicitação abre destinatários antes da confirmação. |
| Aguardar | [Sem propostas](https://centrix-client-portal-prototype.vercel.app/portal/cotacoes/previa?cenario=aguardando) | Envio efetuado, agentes, prazo esperado e pedido de atualização. |
| Aguardar | [Respostas parciais](https://centrix-client-portal-prototype.vercel.app/portal/cotacoes/previa?cenario=parciais) | Uma oferta consultável; escolha bloqueada até liberação. |
| Escolher | [Comparação](https://centrix-client-portal-prototype.vercel.app/portal/cotacoes/previa?cenario=comparar) | Necessidade destacada, tabela, custos/mercado, recomendação e Raio X. |
| Escolher | [Ofertas vencidas](https://centrix-client-portal-prototype.vercel.app/portal/cotacoes/previa?cenario=vencidas) | Bloqueio da seleção e solicitação de revisão nos detalhes. |
| Escolher | [Dados ausentes](https://centrix-client-portal-prototype.vercel.app/portal/cotacoes/previa?cenario=sem-dados) | Sem chegada/validade/necessidade: não inventar recomendação ou datas. |
| Escolher | [Escolha devolvida](https://centrix-client-portal-prototype.vercel.app/portal/cotacoes/previa?cenario=devolvida) | Motivo explícito e nova escolha. |
| Após escolha | [Em análise](https://centrix-client-portal-prototype.vercel.app/portal/cotacoes/previa?cenario=analise) | Cliente escolheu; Freitas ainda analisa. Não significa contratação. |
| Após escolha | [Liberada](https://centrix-client-portal-prototype.vercel.app/portal/cotacoes/previa?cenario=liberada) | Condição liberada e resumo de instrução. |
| Após escolha | [Fechada](https://centrix-client-portal-prototype.vercel.app/portal/cotacoes/previa?cenario=fechada) | Condição contratada e resumo do vínculo ao embarque. |
| Encerramento | [Propostas recusadas](https://centrix-client-portal-prototype.vercel.app/portal/cotacoes/previa?cenario=recusada) | Motivo preservado no histórico. |
| Encerramento | [Solicitação cancelada](https://centrix-client-portal-prototype.vercel.app/portal/cotacoes/previa?cenario=cancelada) | Motivo preservado e próxima ação explícita. |

## Roteiro rápido

1. Abra Complementar, envie vazio e confira a validação. Preencha peso `12400` e volume `52`, depois envie o complemento: os demais dados permanecem e a revisão do envio passa a estar disponível.
2. Abra Dados completos e clique em Revisar solicitação. Confira os agentes; teste nenhum destinatário (envio bloqueado) e um destinatário (contagem deve acompanhar o envio). Não há comunicação externa.
3. Abra Aguardando agentes. Peça atualização e confira o retorno visual. Em **Simular → Receber próxima proposta**, percorra ausência → parcial → comparação liberada. A liberação junto da última resposta é um atalho demonstrativo; na integração, usar o estado autorizado pelo backend.
4. Compare Alpha/Beta. Observe o Raio X acompanhando a escolha, inclusive ao consultar Gamma e selecionar novamente a mesma oferta. Gamma tem escopo incompleto e não pode ser escolhida. Mercado aparece apenas junto ao preço completo.
5. Em **Simular**, marque Falha na próxima confirmação, revise a escolha e confirme: erro preserva a seleção; nova tentativa continua. Confirmação leva à análise. Simule liberação/devolução e contratação como ações distintas.

**Estado salvo:** cada variação usa um registro próprio de localStorage (`centrix-quotation-preview-v1:<cenario>`). Voltar ao link não apaga ações feitas antes. Use **Reiniciar este cenário** para recuperar somente a variação aberta. Variar cenários é navegação entre exemplos independentes, não avanço de uma única cotação.

## Limites e pontos para integrar

- React nativo no shell do portal; código concentrado nesta pasta. `model.ts` define fixtures/regras e `review-guide.ts` organiza os acessos. Não transplantar o catálogo para a jornada do cliente.
- A rota `/portal/cotacoes/previa` permanece separada do detalhe existente `/portal/cotacao/[id]`. Os cartões continuam usando /portal/cotacao/[id], agora com o novo layout sobre os dados de cada cotação. O Kanban foi preservado integralmente.
- A API 8014 sustenta o shell com fixtures de embarque; não representa o conjunto de cotações do Kanban publicado. Não avaliar conteúdo/contagens da main usando essa API de apoio.
- Nas 14 variações não há mutações de negócio por API, envio real aos agentes, banco, arquivos originais ou modelo de IA. As recomendações são regras demonstrativas; condições, mercado e histórico do agente são fictícios.
- Integração exige contrato de estados, pendências de campos com responsável/data, destinatários/envio, respostas por agente, validade/escopo/custos e autorização da escolha. Histórico/versionamento e erros devem vir de fontes persistentes.
- Mercado precisa de ofertas comparáveis, moeda/cobertura e data da base; Raio X precisa de amostra e evidências dos eventos/auditorias. Ausência não vira zero nem avaliação negativa.
- Necessidade e previsão referem-se ao **porto**. Não converter em promessa de entrega na fábrica. Instrução e embarque nesta prévia são resumos de continuidade, sem fluxos/documentos completos.

Verificação automatizada: `npm run test:quotation-preview` (14 testes) e `npm run build`. Complementar com o roteiro acima no navegador, inclusive celular, antes de integrar.

## Detalhe aberto pelos cartões — 13/09/2026

A rota /portal/cotacao/[id] usa o ID e os valores do backend existente, seleção explícita e o endpoint de recomendação do portal. Aprovação, recusa, cancelamento, RFQ, documentos, histórico, auditoria e SI conservam seus componentes e endpoints. Não foi feita nova integração com o Centrix de produção.

O contrato atual não fornece ETA, saída, free time nem pendências estruturadas com responsável/data: o detalhe não inventa essas informações e mantém o complemento pelo fluxo existente. As 14 variações mostram a experiência futura completa para o dev. Mercado usa o fator ilustrativo existente (1,08) sobre uma referência única da cotação; métricas do Raio X são amostras demonstrativas estáveis por agente. A lista de embarques é consultada separadamente e informa seu recorte. A validade na rota dos cartões usa o dia atual; as variações preservam o relógio fixo.

Verificação desta conexão: 18 testes de cotação, 275 de regressão e build/TypeScript. Revisão visual automatizada pendente: navegador do Codex falhou ao abrir nesta rodada.

## Revisão local de 13/09 — preparo, espera e programação

Agora são 15 variações. [Rascunho preenchido](http://localhost:3014/portal/cotacoes/previa?cenario=envio), [dados pendentes](http://localhost:3014/portal/cotacoes/previa?cenario=complementar), [espera](http://localhost:3014/portal/cotacoes/previa?cenario=aguardando), [parciais](http://localhost:3014/portal/cotacoes/previa?cenario=parciais) e [envio programado](http://localhost:3014/portal/cotacoes/previa?cenario=programado).

O rascunho preserva e permite editar dados comerciais, coleta, datas, peso e volume. Continuar depois não envia; Revisar abre destinatários e escolha entre enviar agora e programar. Programar exige data futura no relógio demonstrativo (13/09/2026, 10:30 Brasília). Estado programado mantém sentAt vazio; editar/cancelar preserva dados. Nenhum job real é criado e a prévia não envia mensagens. Integração requer persistência do rascunho, agendamento com timezone, revalidação no disparo, resultado de envio e cancelamento idempotente.

No detalhe alimentado pela API, o preparo usa dados disponíveis e a ação de complemento existente; montagem RFQ mantém os endpoints originais. Não interpretar AGUARDANDO_DADOS como garantia de não envio nem ocultação ao cliente. Espera e parciais usam tabela compartilhada; condições recebidas ficam recolhidas. Verificadas edição/reload, programação/cancelamento, espera/parciais e detalhes correspondentes com API. 27 testes e TypeScript passaram. Revisão local ainda não publicada.

## Respostas progressivas e convites adicionais — revisão local de 13/09/2026

Direção proposta por solicitação de Vinicius: consultar cada oferta assim que recebida e avançar com as disponíveis sem aguardar todos. Na prévia, Ver proposta abre valor, prazo/chegada, validade, free time e limites de escopo; não seleciona nem contrata. Revisar proposta disponível/Comparar disponíveis abre a decisão por ação explícita, mantendo os agentes pendentes visíveis. Receber todas deixa de liberar automaticamente a etapa. Validade e completude continuam condicionando a escolha.

Convidar mais agentes lista somente os nomes do catálogo demonstrativo ainda não convidados (inclui Delta Freight e Atlas Cargo). Confirmação registra apenas os novos destinatários, sem reenviar convites, apagar propostas ou alterar o prazo anterior. Novos agentes aparecem aguardando. Catálogo e convites são locais; o simulador tem ofertas apenas para Alpha/Beta/Gamma e não presume resposta dos demais.

Limite de integração: rotas atuais do portal oferecem listagem, montagem e disparo inicial de RFQ, mas não uma ação adicional de convite nesta implementação. Fluxo de liberação antecipada é proposta de UX na prévia, não alteração da máquina de estados ou permissão do backend. Integração exige elegibilidade real, snapshot/versionamento da solicitação, envio apenas aos adicionados, resultado por destinatário e proteção contra duplicidade. Nenhum e-mail foi enviado; sem deploy. 29 testes e TypeScript aprovados; browser conferiu oferta, novo convite com preservação e decisão com agente pendente.


## Pacote de publicação dos detalhes — 13/09/2026

Base: 786d229 (Configurações já publicadas). Inclui preparo/espera, respostas progressivas, convites adicionais demonstrativos e rascunho com o componente ManualForm de Nova Cotação. Kanban, navegação de Configurações e embarques permanecem como na base. Os estados ilustrativos são 15; o catálogo está em /portal/cotacoes/previa?variacoes=1.

O rascunho usa as mesmas seções Embarque, Carga e Observações, campos condicionais, equipamentos/volumes e validação do formulário de criação. Salvar rascunho aceita dados incompletos; Revisar solicitação valida e abre a revisão de destinatários. A criação normal permanece intacta. Dados do formulário, equipamentos/volumes e opções condicionais ficam no navegador e são restaurados antes de montar o formulário. Exportador é um nome ilustrativo; cadastro e anexos persistentes não estão integrados na prévia.

Roteiro atualizado: em envio, altere Observações, salve, recarregue e confirme a retenção; revise e confira carga, rota e necessidade. Em complementar/rascunho, complete o mesmo formulário, incluindo equipamentos ou volumes conforme modal. Siga aguardando/parciais para consultar uma oferta e convidar um agente adicional. A ação explícita de comparar permite avançar com pendentes; receber a última oferta não avança automaticamente. Nos detalhes abertos pelos cartões, os dados e ações de RFQ continuam vinculados ao backend existente. Programação, persistência do novo rascunho, liberação antecipada e convites adicionais são demonstrações locais, não novas integrações de envio.
