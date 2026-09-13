# Detalhe de cotação — prévia local

Implementação React no layout nativo Centrix, em `/portal/cotacoes/previa?cenario=comparar`. Base: main `8a18f7e` (PR #2 integrado). Branch `codex/cotacao-hierarquia`. O detalhe público existente não é substituído por esta rota de revisão.

## Executar

Na pasta `frontend`, instalar as dependências do lockfile com `npm ci`. Em um terminal PowerShell:

```powershell
$env:PREVIEW_API_PORT = '8014'
$env:PREVIEW_ORIGIN = 'http://localhost:3014'
npm run preview:api
```

Em outro terminal:

```powershell
$env:NEXT_PUBLIC_API = 'http://localhost:8014'
$env:NEXT_TELEMETRY_DISABLED = '1'
npm run dev -- -H 127.0.0.1 -p 3014
```

Abrir `http://localhost:3014/portal/cotacoes/previa?cenario=comparar`. A API local atende apenas o shell e as fixtures anteriores de embarques; esta nova experiência de cotação não envia requests de negócio. Selecionar cenários pelo controle discreto no topo. Voltar a Minhas cotações dentro da prévia abre uma lista dos cenários; menu global conserva as rotas anteriores.

## Escopo e dados

13 cenários: comparação, complemento, rascunho, espera, parciais, escolha em análise, liberada, devolvida, fechada, vencidas, falta de dados, recusada e cancelada. Relógio demonstrativo fixo em 13/09/2026. Empresas, ofertas, documentos e métricas são fictícios. Chegadas provêm das datas nas fixtures; não são hoje + trânsito. Valores em BRL por contêiner, cobertura explícita; custos ausentes não viram zero.

Comparação por oferta, seleção explícita, composição expansível, recomendação pelo menor valor completo que atende à necessidade no porto, histórico e referência de mercado. Validade/escopo/estado são rechecados na confirmação. Escolha leva à revisão; liberar, devolver, fechar e receber respostas são controles de simulação. Formulário valida peso/volume, mantém campos preenchidos e permite revisar destinatários antes do envio simulado. Recusa/cancelamento guardam motivo e histórico. Falha simulada conserva escolha.

Persistência por cenário no localStorage, prefixo `centrix-quotation-preview-v1:`. Reiniciar remove somente o registro do cenário atual, sem apagar sessões ou outras aplicações. Não há banco, LLM, envio de e-mail, upload, cobrança ou sincronização multiusuário. Documentos mostram metadados demonstrativos sem arquivo. Instrução e embarque são resumos locais de continuidade; a integração com os fluxos completos permanece para a próxima etapa.

Raio X do agente: seção final da comparação com pontualidade, divergências confirmadas entre cotado e cobrado e experiência na rota, usando as mesmas amostras de cada oferta. Acompanha a escolha (ou a recomendação inicial); consultar outro agente pelo seletor não altera a escolha nem o contexto de mercado. Uma nova escolha volta a orientar o Raio X. Expansão informa critérios, período e limites das evidências; registros individuais, causas/duração dos atrasos e atendimento ainda não estão conectados.

## Verificação

Mercado fica junto ao preço de cada oferta completa, sem faixa isolada. Os detalhes de custos mostram mediana, amostra/período, rota e cobertura; ofertas incompletas não exibem percentual. Percentuais são arredondados, calculados sobre a mesma mediana demonstrativa de R$ 24.100.

Regressão de seleção: escolher Beta → consultar Gamma no Raio X → clicar novamente no rádio de Beta deve restaurar o perfil de Beta. Clicar no nome/área da linha de Alpha deve selecionar Alpha e atualizar o perfil; abrir Detalhes não deve alterar a escolha. Ofertas inválidas/incompletas continuam bloqueadas. A necessidade de chegada tem destaque próprio no contexto e referência na coluna de chegada, mantendo a distinção entre porto e fábrica.

`npm run test:quotation-preview` verifica regras de recomendação, validade/escopo, estados e datas. `npm run build` verifica a rota nativa e tipos. Revisão por navegador: comparação/seleção, erro/repetição, persistência, complemento/envio com destinatário único, chegada de propostas, detalhes e responsividade. Registrar resultados efetivos no esquema vivo do vault.

Plano canônico: `C:\SecondBrain_local\SB_Vini\03_Projetos\Cliente\Ativos\Freitas_Comex\Centrix_SaaS\Plano_Telas_Detalhe_Cotacao.md`. Estado e evidências: `Esquema_Vivo_Portal.md` no mesmo diretório. Nenhum deploy autorizado nesta rodada local.
