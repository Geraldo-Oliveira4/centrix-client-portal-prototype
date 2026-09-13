# Solicitações habituais — prévia local

Base de código: release cd1bd72/ebab8e7. Branch codex/cotacao-habituais. Não publicada. Fonte: decisão de Vinicius em 13/09 após leitura da thread Geraldo–Orsi de 10–11/09 (arquivo literal e decisões no Esquema_Vivo_Portal do vault).

## Entradas para revisar

- Nova cotação: http://localhost:3036/portal/cotacoes/previa-habituais
- Histórico: http://localhost:3036/portal/cotacoes/previa-habituais?entrada=historico
- Fornecedor: http://localhost:3036/portal/cotacoes/previa-habituais?entrada=fornecedor
- Rota preferida: http://localhost:3036/portal/cotacoes/previa-habituais?entrada=rota

O seletor de entrada pertence à prévia para o dev. Não altera a Nova Cotação normal, o histórico real, Configurações nem Kanban. Há link na barra da prévia de detalhes para esta experiência.

## Fluxos e regras

Usar solicitação abre o DraftRequestForm/ManualForm existente. Três modelos iniciais demonstram dois fornecedores numa rota e um fornecedor em duas rotas. Rota isolada preenche apenas modal/portos. Histórico separa nova remessa de consulta ao detalhe demonstrativo da carga existente; nova rodada de propostas não foi implementada.

Salvar como habitual captura os campos atuais do formulário, incluindo edições ainda não salvas no rascunho. Cria modelo separado, exige nome/fornecedor/produto e uma das duas rotas do catálogo; nome repetido por fornecedor é recusado. Alterar a ocorrência não altera o modelo original. Campos estáveis são selecionados por allow-list; PO, datas, preço/PTAX/valor de carga, observações transacionais, equipamentos/dimensões, arquivos, ofertas, escolhas e destinatários não são herdados. Tipo de embarque é mantido; equipamento/quantidade atual deve ser informado no formulário.

Salvar rascunho aceita incompletos e guarda snapshot separado do modelo. Retomada preserva os campos e equipamentos/volumes já digitados. Revisão exige os dados básicos da remessa, peso/volume positivo, necessidade e prazo de resposta, e confirmação dos destinatários; envio final apenas encerra a demonstração, sem RFQ por API. O armazenamento local comporta um rascunho nesta prévia. Não há calendário recorrente, IA, sincronização multiempresa, arquivo persistente ou integração do catálogo com Configurações. Fornecedor é ilustrativo, não um vínculo com o cadastro do backend.

## Verificação realizada

28 testes (6 de reaproveitamento + 22 de cotação), TypeScript e compilação da rota Next aprovados. Navegador conferiu lista, recorte de rota com dois fornecedores, campos reaproveitados/limpos, edição e salvamento de modelo, persistência após reload, retomada do rascunho com Observações e inclusão de equipamento. A validação obrigatória de prontidão bloqueou revisão incompleta. O navegador interno não propagou preenchimento automatizado de datas ao estado React e travou ao abrir o calendário nativo; revisão/envio completos e mobile ainda não foram validados por navegador nesta rodada. Não alterar o formulário compartilhado para mascarar essa limitação do teste. Sem build de produção ou deploy nesta rodada.

Roteiro manual restante: preencher as datas pelo navegador, revisar, testar nenhum agente selecionado e confirmação, concluir simulação. No histórico, escolher Nova remessa e conferir ausência de PO/datas/ofertas; por fornecedor, variar Hanwha/Daehan. Acessibilidade integral ainda não auditada.

## Publicação posterior — 13/09/2026

Publicado por autorização explícita de Vinicius: https://centrix-client-portal-prototype.vercel.app/portal/cotacoes/previa-habituais. Fonte cd15780, base de Panorama/Alertas incorporada, build de produção e 47 testes aprovados. Lista e formulário conferidos em 390×844 com correção de largura; browser público confirmou rota/modelo/formulário. A revisão final com datas permanece pendente. Detalhes de implantação, preservação, rollback e bloqueio do push ao fork em [PUBLICACAO.md](./PUBLICACAO.md). As notas anteriores descrevem a rodada local, agora sucedida por esta publicação do protótipo.
