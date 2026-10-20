# Cotação com várias cargas: o que o backend precisa receber

Para o Mauro conferir. Origem: revisão do Vitor (20/10/2026). Regra confirmada
pelo Mauro: **uma cotação é um embarque; o embarque tem N cargas; cada carga
tem N volumes.**

Todos os exemplos abaixo são fictícios.

## O que o protótipo faz hoje (e o que não faz)

A Nova cotação do portal (`/portal/nova-cotacao`) mostra a coluna **Carga**
como uma lista de cartões "Carga 1", "Carga 2"... com "+ Adicionar carga". A
primeira carga não pode ser removida. O banner "Faltam N itens" conta por carga
("Produto (Carga 2)") e cada item leva ao campo certo.

O backend deste repositório **não conhece cargas**. Por isso a criação manda:

| Campo de hoje | O que vai |
|---|---|
| `product` | Com uma carga, o produto. Com várias, um rótulo composto: `"Peças de reposição + 2 outras cargas"`. Kanban, detalhe e histórico leem esse campo e já mostram que há mais de uma carga. |
| `carga_perigosa`, `un_number`, `imo_class`, `stackability`, `carga_tombavel`, `temperatura_*`, `declared_value*`, `ncm` | Os da **Carga 1** |
| `volumes` | **Todos** os volumes de todas as cargas, numa lista só (o total de volumes fica certo) |
| `observations` | O texto digitado + um bloco `Cargas adicionais:` com uma linha por carga extra (produto, volumes, valor) |

A lista completa, por carga, fica no snapshot da revisão da Freitas (camada de
demonstração, no navegador), não no servidor.

**Risco do formato provisório:** um analista que lê só os campos de topo vê
`carga_perigosa = NAO` mesmo que a Carga 2 seja perigosa. O bloco nas
observações diz isso, mas o formato abaixo é o que resolve.

## Formato proposto

```jsonc
POST /portal/quotations
{
  "source": "manual",

  // ---- Do EMBARQUE (uma vez só) ----
  "exporter_id": "exp-demo-01",
  "tipo_cotacao": "REAL",
  "service_type": "IMPORTACAO",
  "modal": "MARITIMO",
  "tipo_embarque": "LCL",
  "incoterm": "FCA",
  "price_or_performance": "PRECO",
  "origin": "Rua Fictícia 100, Busan",
  "porto_embarque": "Busan, South Korea (KRPUS)",
  "porto_destino": ["Santos, Brazil (BRSSZ)"],
  "aeroporto_embarque": null,
  "aeroporto_destino": null,
  "incluir_entrega_destino_final": null,
  "endereco_entrega_final": null,
  "agente_define_local_coleta": false,
  "agente_define_porto_embarque": false,
  "agente_define_porto_destino": false,
  "insurance_required": true,          // ambíguo: ver "Pontos a decidir"
  "equipments": [],                    // FCL: contêineres são do embarque
  "desired_deadline": "2026-10-22T21:00:00Z",
  "data_prontidao": "2026-11-03",
  "data_limite_necessidade": "2026-12-15",
  "destination_yard": null,
  "client_reference": "PO-DEMO-0001",
  "observations": "Texto livre do cliente",
  "files": ["invoice-demo.pdf"],

  // ---- Das CARGAS (1..N, a ordem é a da tela) ----
  "cargos": [
    {
      "product": "Peças de reposição (fictício)",
      "ncm": "8708.99.90",
      "carga_perigosa": "NAO",          // NAO | RA | IMO
      "un_number": null,                 // obrigatório se RA/IMO
      "imo_class": null,                 // só IMO
      "stackability": true,
      "carga_tombavel": false,
      "temperatura_min": null,           // só carga refrigerada
      "temperatura_max": null,
      "declared_value": 12500.00,
      "declared_value_currency": "USD",
      "volumes": [
        { "quantity": 4, "embalagem": "PALLET", "peso_bruto": 820, "peso_unidade": "KG",
          "comprimento": 120, "largura": 100, "altura": 110, "dimensao_unidade": "CM",
          "volume_m3": 5.28 }
      ]
    },
    {
      "product": "Rolamentos (fictício)",
      "carga_perigosa": "NAO",
      "stackability": true,
      "carga_tombavel": true,
      "declared_value": 4000.00,
      "declared_value_currency": "USD",
      "volumes": [{ "quantity": 2, "embalagem": "CAIXA", "peso_bruto": 90, "peso_unidade": "KG" }]
    }
  ]
}
```

Um volume tem a mesma forma do `CreateVolumeItem` de hoje
(`frontend/types/quotation.ts`). O formato de cada carga está tipado em
`CargoPayload` (`frontend/app/portal/_shared/demo/quotation-cargos.ts`), e
`cargoPayload()` monta uma carga nesse formato a partir do que o cliente digitou
(coberto por teste unitário).

## Regras que o backend precisaria aplicar por carga

As mesmas da lista do Orsi (`quotation-hardblocks.ts`), avaliadas **para cada
carga**:

- `product` obrigatório.
- `carga_perigosa` obrigatório e sem padrão. Com `RA`/`IMO`, `un_number` no
  formato `UN` + 4 dígitos.
- `stackability` e `carga_tombavel` obrigatórios.
- Carga refrigerada exige `temperatura_min`.
- Incoterm `CIF`/`CIP`/`DAP`/`DDP`: `declared_value > 0` em cada carga.
- Incoterm `DAP`/`DDP`: `ncm` com 8 dígitos em cada carga.

As regras do embarque (rota, incoterm, fator de escolha, PO...) seguem como
estão, uma vez por cotação.

## Compatibilidade

- `cargos` ausente = cotação antiga de uma carga: os campos de topo continuam
  valendo como hoje.
- Com `cargos` presente, os campos de carga de topo (`product`, `carga_perigosa`,
  ..., `volumes`) deixam de ser fonte. O backend pode preenchê-los a partir da
  `cargos[0]` para quem ainda lê o formato antigo (Kanban do analista, e-mail de
  RFQ).

## Pontos a decidir (não decididos no protótipo)

1. **Seguro obrigatório**: por embarque (como está) ou por carga? Ficou no
   embarque, abaixo dos cartões.
2. **Equipamentos FCL**: tratados como do embarque (um contêiner pode levar
   várias cargas). No FCL o formulário não pede volume por carga, só os
   contêineres do embarque. Confirmar se cada carga precisa de volumes também
   no FCL.
3. **Temperatura**: está por carga. Num contêiner reefer a temperatura é uma só
   para o contêiner: confirmar se o backend valida cargas refrigeradas com
   faixas incompatíveis no mesmo equipamento.
4. **Valor da carga em moedas diferentes**: cada carga tem a sua moeda. O total
   do embarque, se for necessário, precisa de regra de conversão (PTAX de qual
   data).
5. **RFQ para agentes**: como o e-mail de cotação lista N cargas.
