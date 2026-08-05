"""Add portal client preferences — agentes pausados e DNA operacional do cliente

Revision ID: 094
Revises: 093
Create Date: 2026-08-05

PROTOTYPE-ONLY migration (does not exist in Centrix).

Guarda o que o CLIENTE escolhe sobre a própria operação, em duas frentes que a
tela separa mas o dado une:

  - `paused_agent_ids` — quais dos agentes pré-aprovados pela Freitas o cliente
    NÃO quer nas próximas RFQs (tela "Meus Agentes", toggle ativo/pausado; e a
    lista "Agentes bloqueados" de "Minhas Preferências" é a MESMA coluna, não
    uma segunda lista — ver nota abaixo);
  - o perfil de operação editável pelo cliente: porto/aeroporto preferido,
    incoterm padrão, uso de seguro e particularidades de carga.

POR QUE UMA TABELA NOVA, E NÃO COLUNAS EM centrix_quotation_client_dna
---------------------------------------------------------------------
O DNA do Cliente é do ANALISTA: a Freitas o preenche e ele carrega dado interno
(contato responsável, analista designado, acordos) que o cliente não edita nem
enxerga. Escrever nele a partir do portal faria o portal sobrescrever campo de
analista e divergiria de um model copiado do Centrix — exatamente o que o
protótipo evita (ver CLAUDE.md, "não alterar o código copiado do Centrix").

Esta tabela é a camada do CLIENTE, ao lado do DNA e sem tocá-lo. Quando a
arquitetura do DNA editável for de fato implementada no Centrix, o merge das
duas fontes é uma decisão de produto — aqui as duas ficam distinguíveis.

UMA LISTA DE AGENTE, NÃO DUAS
-----------------------------
"Pausado" (Meus Agentes) e "bloqueado" (blacklist em Minhas Preferências) são a
mesma afirmação: não use este agente nas minhas próximas cotações. Duas colunas
para isso criariam um estado contraditório sem desempate possível ("pausado mas
não bloqueado" — vale qual?). Por isso existe UMA coluna, exposta em duas telas.

Tudo nullable: um cliente sem linha nesta tabela é o estado normal (nenhum
agente pausado, nenhuma preferência declarada), e nenhum seed popula isso.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "094"
down_revision = "093"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "centrix_portal_client_preferences",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "client_id",
            UUID(as_uuid=True),
            sa.ForeignKey("centrix_quotation_clients.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        # Agentes que o cliente tirou das próximas RFQs. Lista de UUIDs em texto,
        # mesmo formato de QuotationClientDna.default_agents (a lista de onde
        # estes saem), para as duas serem comparáveis sem conversão.
        sa.Column("paused_agent_ids", JSONB, nullable=True),
        # Perfil de operação editável pelo cliente. Texto livre de propósito:
        # não há catálogo de portos nem enum de incoterm no schema do portal, e
        # inventar um aqui seria fingir uma validação que o backend não faz.
        sa.Column("preferred_port", sa.String(), nullable=True),
        sa.Column("default_incoterm", sa.String(), nullable=True),
        sa.Column("uses_insurance", sa.Boolean(), nullable=True),
        sa.Column("cargo_particularities", sa.Text(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade():
    op.drop_table("centrix_portal_client_preferences")
