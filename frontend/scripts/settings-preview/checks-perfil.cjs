const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
class Form {constructor(values){this.values=values}get(k){return this.values[k]??null}has(k){return Object.hasOwn(this.values,k)}}
const ctx=vm.createContext({structuredClone,crypto:require('node:crypto'),FormData:Form,localStorage:{getItem:()=>null},document:{querySelector:()=>({addEventListener(){}}),addEventListener(){}},window:{addEventListener(){}}});
for(const f of ['base.js','configuracoes.js','perfil-operacao.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../../public/prototypes/centrix-configuracoes',f),'utf8').replace(/render\(\);\s*$/,''),ctx);
const run=s=>vm.runInContext(s,ctx);let total=0;
function check(name,s){assert.ok(run(s),name);total++;console.log('PASS '+name)}
run(`const oldAlerts=JSON.stringify(alertKeys.map(k=>state.settings[k]));applySettings({name:'Demo',company:'aurora',incoterm:'FCA',insurance:'Solicitar na cotação',notes:'Exemplo'},profileKeys)`);
check('saving profile preserves all alerts',`oldAlerts===JSON.stringify(alertKeys.map(k=>state.settings[k]))`);
run(`const oldProfile=JSON.stringify(profileKeys.map(k=>state.settings[k]));applySettings({market:'on',tolerance:'A partir de 2 dias',digest:'No portal'},alertKeys)`);
check('saving alerts preserves all profile fields',`oldProfile===JSON.stringify(profileKeys.map(k=>state.settings[k]))`);
check('unchecked alert is saved as false',`state.settings.booking===false && state.settings.market===true`);
check('example creates review-only drafts',`draftRules(operationExample).length===3 && draftRules(operationExample).every(r=>r.status==='review')`);
check('free text does not invent a trigger',`draftRules('Receber mercadoria conforme combinado.')[0].when===''`);
check('free text source and effect preserved',`draftRules('Entregar apenas com agendamento.')[0].effect==='Entregar apenas com agendamento.' && draftRules('Entregar apenas com agendamento.')[0].source==='Entregar apenas com agendamento.'`);
run(`operationState().rules=draftRules(operationExample);const originalRule=JSON.stringify(operationState().rules[0]);operationState().instructions='Outra orientação'`);
check('editing instructions does not rewrite existing rule',`JSON.stringify(operationState().rules[0])===originalRule`);
check('no history is synthesized by drafting rules',`operations.length===5`);
console.log(`${total} profile checks passed`);
