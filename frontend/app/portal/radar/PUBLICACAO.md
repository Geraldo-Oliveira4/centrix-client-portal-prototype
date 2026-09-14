# Radar Beta — publicação em 13/09/2026

- URL: https://centrix-client-portal-prototype.vercel.app/portal/radar#radar/mercado
- Fonte publicada: 7532f73ad21a394a3281a158d0fbafdbe01d6fe3; implementação Radar 0cfa0c9.
- Branch local: codex/radar-publicacao.
- Deployment: dpl_8gnCPAT7r2MwDV2MH1MsVrxkEhEA, READY, promovido e conferido.
- Candidato: https://centrix-client-portal-prototype-j26pegwxr.vercel.app.
- Base preservada: Cotações 630142c + documentação 969242e, incorporadas por merge; inclui cd15780, Panorama/Alertas, Configurações e detalhes anteriores.
- Rollback anterior: dpl_g3dE1GACQjJ3yNLuk7ciUejxuEsD, https://centrix-client-portal-prototype-brs86d9f8.vercel.app.

## Escopo

Radar é módulo próprio no menu principal, com Beta. Mercado de fretes abre visão geral de rotas preferidas e detalhes com seletor, curva, fontes/amostra, registros próprios e avaliação do próximo passo. Adição de rota é local à sessão. Riscos, Parceiros e Abastecimento continuam Beta; contratação integra o fluxo de Mercado, sem aba separada. Não há área independente chamada Painel de fretes.

A página Next.js hospeda os assets aprovados em public/prototypes/centrix-radar via iframe, no padrão existente do portal. O modo embed esconde sidebar/topbar da prévia; a navegação principal usa a sidebar nativa. Hash do filho acompanha o endereço do portal, incluindo recarga de detalhe. A prévia original 8784 permanece intacta.

A única mudança de UI compartilhada é a entrada Radar/Beta na sidebar. Diff contra 969242e confirma zero alteração de código nos módulos Cotações, Embarques, Configurações, Inteligência, seus assets e backend. O primeiro candidato dpl_9up165N66LBojr6AzVfBsaYNQhCX não foi promovido porque a checagem detectou nova publicação concorrente de Cotações. O candidato final incorpora essa base. Estado do domínio foi revalidado imediatamente antes da promoção.

## Verificação

- 17 checagens de cálculo/cobertura/adição do Radar, 59 testes de regressão e 7 testes da apresentação do Kanban: 83 aprovados.
- TypeScript local passou após Next gerar next-env.d.ts; build remoto final completo passou.
- Navegador integrado local: menu Beta, visão geral, detalhe e retorno; recarga manteve Hamburgo; Abastecimento sem cobertura não conclui segurança/risco. Mobile 390×844: largura host 375/375 e conteúdo iframe 328/328, sem overflow horizontal do Radar.
- Domínio público: deployment ID final confirmado; HTTP 200 em nove rotas/assets (Radar, index/prices, Cotações, cards, habituais, Embarques, Configurações, Inteligência). Browser público confirmou Radar/Beta, exemplos e ida/volta ao detalhe de Shanghai com hash correto.
- Não foi feita homologação com clientes nem auditoria completa de acessibilidade. Outros módulos foram preservados por diff e smoke HTTP; não foi reexecutado seu E2E completo.

## Dados e integração

Todas as rotas preferidas, fontes, preços e necessidades do Radar são exemplos fictícios identificados. Acompanhamento não altera preferência comercial ou prioridade de embarque. Sem fonte: sem preço ou curva atual, sem inferência de estabilidade. Abastecimento exige necessidade/item/quantidade/data/local útil e previsão até entrega/recebimento, não apenas ETA portuária. Requisitos operacionais por bloco continuam em Fontes e dados necessários.

Conexões com Inteligência e Cotações são demonstrações; não abrem análises integradas nem criam solicitações. Nenhuma regra, canal, leitura ou resolução de Alertas foi implementada no Radar. Nenhum novo backend/API/IA, fonte externa ou migração. NEXT_PUBLIC_API preservada em https://centrix-client-portal-prototype.onrender.com para o portal existente. Frame não consultado nem sincronizado.

## Repositório e execução

Código commitado localmente e publicado na Vercel; sem push/PR/merge GitHub nesta rodada. A main pública continua 8a18f7e: futuras publicações devem incorporar 7532f73 e seus ancestrais para preservar Radar e demais releases. Não publicar main antiga diretamente.

Revisão automática bloqueou o segundo upload por questionar autorização do destino. Após comprovar mesmo projeto Vercel prj_yNfLK3Bsj7413F3Xi0SJuAaqlI3u, payload demonstrativo, base pública preservada e exclusão de backend/.env/.git/dependências, o mesmo comando foi liberado; nenhuma proteção foi contornada. A cópia inicial de dependências encontrou junction recursiva: cópia interrompida e removida somente na pasta gerada desta release, usando depois junction para as dependências já instaladas. Dev local usa 3044; houve fallback de fontes Google por bloqueio de rede local, sem impacto no build remoto.
