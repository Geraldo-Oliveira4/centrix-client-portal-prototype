"""Add portal home layout experiment — temas e cards da Home personalizavel

Revision ID: 095
Revises: 094
Create Date: 2026-09-11

PROTOTYPE-ONLY migration (does not exist in Centrix).

Guarda a escolha do cliente na rota de DEMONSTRACAO INTERNA
`/portal/home-personalizada`: quais TEMAS ele escolheu no onboarding (ate tres) e
quais CARDS desses temas ele deixou ligados no modal "Personalizar".

POR QUE UMA TABELA NOVA, E NAO centrix_portal_client_preferences
---------------------------------------------------------------
A 094 e a camada de preferencia OPERACIONAL do cliente: porto preferido,
incoterm, seguro, agentes pausados. Aquilo tem efeito (ou efeito prometido)
sobre a proxima cotacao, e o handler que a escreve tem uma lista fechada de
campos que sustenta a REGRA GERAL 2 (o cliente nao edita dado interno da
Freitas).

Isto aqui e outra coisa: layout de uma rota de teste que nao existe para o
cliente final. Misturar as duas faria um experimento de UI dividir tabela,
handler e validacao com o caminho que a Freitas ja validou — e apagar o
experimento passaria a significar mexer num endpoint em uso. Tabela separada e
endpoint proprio: apagar o experimento e apagar esta tabela e um arquivo em
`app/`, sem tocar em nada da 094.

Nao ha FK para a 094 nem vice-versa: as duas sao linhas por cliente e nenhuma
depende da outra.

Tudo nullable menos o dono: um cliente sem linha aqui e o estado normal — e o
que faz o onboarding abrir. Nenhum seed popula esta tabela.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "095"
down_revision = "094"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "centrix_portal_home_layout_experiment",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "client_id",
            UUID(as_uuid=True),
            sa.ForeignKey("centrix_quotation_clients.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        # Temas escolhidos no onboarding, em lista de texto (ate tres). JSONB e
        # nao ARRAY(String) para espelhar `paused_agent_ids` da 094 — uma unica
        # forma de guardar lista curta no schema do portal.
        sa.Column("themes", JSONB, nullable=True),
        # Cards ligados. Guardado explicitamente, e nao derivado de `themes`, por
        # causa do modal "Personalizar": desligar um card de um tema escolhido e
        # uma segunda decisao, e deriva-la do tema perderia essa escolha.
        sa.Column("enabled_cards", JSONB, nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    op.drop_table("centrix_portal_home_layout_experiment")
