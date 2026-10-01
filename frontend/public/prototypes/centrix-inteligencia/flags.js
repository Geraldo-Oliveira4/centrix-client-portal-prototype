'use strict';
// O que o CLIENTE ve nesta previa (01/10/2026, Inteligencia em blocos).
// Desligado = escondido, com o codigo preservado. Nao e controle de acesso:
// e uma previa estatica, e tudo isso esta no repositorio.
//   assistants: bloco Assistentes (Skill + prompt, MCP, download de SKILL.md),
//               material de roadmap e de equipe.
//   dataHelp:   indicador "Dados a confirmar" e a secao "Dados a confirmar para
//               integracao" do relatorio, que citam Inova, ShipsGo e contrato.
const CLIENT_FLAGS = Object.freeze({ assistants: false, dataHelp: false });
if (typeof module !== 'undefined') module.exports = CLIENT_FLAGS;
