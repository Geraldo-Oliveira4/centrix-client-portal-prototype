'use strict';
// O que o CLIENTE vê nesta prévia (02/10/2026). Assistentes (conexão MCP) ficam
// para as ondas 2/3; os indicadores "Dados a confirmar" (dataHelp) são nota de
// revisão interna, não leitura do cliente. Ligar aqui volta tudo como era: as
// rotas e os textos continuam no código.
const CLIENT_FLAGS = Object.freeze({ assistants: false, dataHelp: false });
if (typeof window !== 'undefined') window.CLIENT_FLAGS = CLIENT_FLAGS;
