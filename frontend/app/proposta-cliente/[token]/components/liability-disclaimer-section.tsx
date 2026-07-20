interface LiabilityDisclaimerSectionProps {
  modal: string | null;
  tipoEmbarque: string | null;
}

export function LiabilityDisclaimerSection({ modal, tipoEmbarque }: LiabilityDisclaimerSectionProps) {
  const isMaritime = modal === 'MARITIMO';
  const isAir = modal === 'AEREO';
  const isFCL = isMaritime && tipoEmbarque === 'FCL';
  const isLCL = isMaritime && tipoEmbarque === 'LCL';

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="bg-brand-navy px-4 py-3">
        <p className="text-xs font-semibold text-white/90 uppercase tracking-wide">
          Termos e Responsabilidades
        </p>
      </div>
      <div className="px-4 py-3 flex flex-col gap-3 text-xs text-muted-foreground leading-relaxed">
        <p>
          Atuamos como intermediários na comunicação entre o cliente e o agente de carga/armador.
          A decisão final sobre frete, free time, transit time, coleta e entrega de contêiner, e
          outras obrigações relacionadas ao serviço de transporte e/ou agenciamento é de
          responsabilidade do contratante real (importador/exportador). Não nos responsabilizamos
          por custos decorrentes do descumprimento de obrigações por ambas as partes. Estamos
          disponíveis para esclarecer quaisquer dúvidas adicionais que possam surgir.
        </p>
        <p>
          A carga estará sujeita às condições gerais e à possibilidade de embarque conforme
          estabelecido pelo transportador. É importante fornecer informações detalhadas de
          logística, como possibilidade de empilhamento e/ou tombamento, necessidade de
          equipamento especial e/ou equipe para coleta, e restrições logísticas de origem e/ou
          entrega. A falta dessas informações pode resultar em tarifas adicionais de
          responsabilidade do contratante.
        </p>
        {isFCL && (
          <p>
            Quando se tratar de um FCL, conforme toda e qualquer cotação, o consignatário da
            mercadoria se responsabiliza, solidariamente, pelo pagamento de eventual sobre-estadia,
            caso os contêineres não sejam devolvidos dentro do prazo livre (free time). Portanto,
            solicitamos para que se atente ao prazo ofertado pelos agentes. Além disso, containers
            especiais como: Reefer, NOR, Flat Rack, Open Top usualmente possuem valores mais altos
            de demurrage se comparado com os containers standard/dry. Portanto, caso necessite de
            aumento do free time, sugerimos para que seja negociado no momento da cotação do frete,
            antes do fechamento do booking.
            <br />
            <br />
            Reforçamos que a contagem dos dias de sobre-estadia (&quot;days of demurrage&quot;) somente
            cessará com a efetiva devolução do contêiner desovado, sem avarias, limpo, sem odor de
            qualquer espécie, sem decalques, colantes, adesivos, pregos, pneus, marcas no assoalho
            ou quaisquer objetos estranhos ao equipamento, de forma que possa(m) ser imediatamente
            reutilizado(s) em outros transportes, sem a necessidade de reparos e/ou lavagens, nas
            mesmas condições em que fora recebido, no local acordado.
          </p>
        )}
        {isLCL && (
          <p>
            Quando se tratar de um LCL, gentileza ficar atento ao recinto secundário de destino da
            carga mencionado na planilha, visto que o valor de armazenagem do recinto pode impactar
            no custo total da operação, em alguns casos não compensando seguir com o menor valor de
            frete cotado. Sugerimos consultar se a empresa possui armazenagem negociada com o
            recinto, caso necessário, podemos auxiliar.
          </p>
        )}
        {isAir && (
          <p>
            Quando se tratar de um aéreo, gentileza se atentar a data de validade das cotações
            visto curto prazo de tarifas disponibilizadas pelas cias aéreas entre coleta e embarque
            da carga. Todas as embalagens, etiquetas e documentação devem atender aos padrões
            internacionais da IATA visto que estes requisitos garantem a segurança e o transporte
            adequado da carga. Todo e qualquer embarque, carga passará por uma análise da cia
            aérea quando recepcionada no aeroporto, podendo ser exigido Teste de Magnetismo e/ou
            Raio X, nos quais estão sujeitos a tarifas extras para a sua aprovação.
          </p>
        )}
      </div>
    </div>
  );
}
