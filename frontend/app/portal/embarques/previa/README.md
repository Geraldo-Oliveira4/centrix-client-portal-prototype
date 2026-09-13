# Detalhamento de embarque — protótipo para desenvolvimento

Implementação aprovada por Vinicius em 13/09/2026. Publicação restrita ao detalhe: `/portal/embarques/[id]` e catálogo direto `/portal/embarques/previa?cenario=booking`. Ambos renderizam a mesma experiência. A lista e os demais módulos permanecem na base main `8a18f7e2b91a2969e210801e55a4ff69698d32e3`.

## Explorar cenários

O seletor fica no topo da tela. Cenários: `transito`, `regular`, `booking`, `parcial`, `vencida`, `sem-dados` e `chegada`. As URLs aceitam `?cenario=<nome>`; identificador inválido usa trânsito. Restaurar cenário limpa somente o exemplo selecionado. Todos os dados são fictícios: esta tela não reproduz o embarque escolhido na lista. Não implementar a integração real copiando dados ou regras das fixtures.

## Roteiro de revisão

- Booking: revisar versão e aprovar; orientação passa ao agente sem confirmar coleta ou partida.
- Trânsito: enviar documento na simulação; envio fica Em análise e a pendência de envio é resolvida. Ler ocorrência não a resolve.
- Parcial: duas POs/fornecedores/moedas, alocação parcial e item sem part number. Valores separados por moeda.
- Vencida: previsão vencida pede confirmação, não confirma chegada nem baixo risco.
- Sem dados: fonte e cobertura ausentes; não declarar normalidade.
- Chegada: navio chegou, descarga e saída do terminal ainda sem confirmação.
- Origem dos dados: toggle expõe fontes necessárias junto de cada marco/ETA/contexto; clicar no marco detalha campos e limites.

## Fontes e limites

Centrix: solicitação, aprovação de booking, tarefas/responsáveis e histórico. Inova/operação: prontidão/coleta e condições contratadas, conforme cobertura a validar. ShipsGo: DEPA, ARRV, DISC e GTOT com local, contêiner, horário e EST/ACT. Chegada e descarga são eventos distintos: ETA de chegada usa ARRV no destino; a primeira previsão exige histórico desse mesmo evento persistido pelo Centrix. `date_of_discharge` é descarga. Nunca derivar descarga ou saída somando dias à ETA. Gate-out não é liberação aduaneira nem entrega ao cliente.

Contrato oficial: https://api.shipsgo.com/docs/v2/specs/openapi.json. Fontes Inova e decisões no plano do vault `Centrix_SaaS/Plano_Telas_Detalhe_Embarque.md`. Cobertura documental não é integração autenticada ou homologação por armador.

Estado somente em sessionStorage por cenário/aba. Nenhum arquivo é lido/enviado: o seletor usa apenas o nome e o download é uma amostra TXT explícita. Solicitações de atualização não enviam mensagens. Preferências desta tela não sincronizam com preferências globais. A API existente permanece usada pelo layout; nenhuma nova escrita operacional é implementada.

## Verificação

Na pasta frontend: `node --test app/portal/embarques/previa/model.test.ts`, `npm run test:unit` e `npm run build`. Build inclui TypeScript. Conferir também seleção de cenários, painel por marco, foco/Esc, ações e largura móvel. Dados fixos de referência em 13/09/2026.
