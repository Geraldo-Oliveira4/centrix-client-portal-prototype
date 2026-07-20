"""Keeper Quotes alignment: new enums, new fields on quotations, volumes/equipments/container_specs tables.

Revision ID: 015
Revises: 014
Create Date: 2026-04-07

Changes:
- Migrate Modal enum from 4-value (MARITIMO_FCL/LCL/REEFER/AEREO) to 2-value (AEREO/MARITIMO)
- Add new enum types: servicetype, tipoembarque, cargaperigosa, tipocontainer, tipoembalagem, pesounidade, dimensaounidade
- Add columns to centrix_quotation_quotations: service_type, tipo_embarque, carga_perigosa, temperatura_min, temperatura_max, client_reference, bl_consolidado
- Create table centrix_quotation_equipments (FCL container lines)
- Create table centrix_quotation_volumes (LCL/air package lines)
- Create table centrix_quotation_container_specs (reference specs per container type)
"""

from alembic import op
import sqlalchemy as sa

revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. Migrate modal enum (3 tables use it: quotations, client_dna, transit_time_references)
    #    MARITIMO_FCL / MARITIMO_LCL / MARITIMO_REEFER -> MARITIMO
    # ------------------------------------------------------------------

    # Temporarily convert all three modal columns to TEXT
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_quotations ALTER COLUMN modal TYPE TEXT USING modal::TEXT"
    ))
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_client_dna ALTER COLUMN modality TYPE TEXT USING modality::TEXT"
    ))
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_transit_time_references ALTER COLUMN modal TYPE TEXT USING modal::TEXT"
    ))

    # Normalise existing values
    op.execute(sa.text(
        "UPDATE centrix_quotation_quotations "
        "SET modal = 'MARITIMO' WHERE modal IN ('MARITIMO_FCL', 'MARITIMO_LCL', 'MARITIMO_REEFER')"
    ))
    op.execute(sa.text(
        "UPDATE centrix_quotation_client_dna "
        "SET modality = 'MARITIMO' WHERE modality IN ('MARITIMO_FCL', 'MARITIMO_LCL', 'MARITIMO_REEFER')"
    ))
    op.execute(sa.text(
        "UPDATE centrix_quotation_transit_time_references "
        "SET modal = 'MARITIMO' WHERE modal IN ('MARITIMO_FCL', 'MARITIMO_LCL', 'MARITIMO_REEFER')"
    ))

    # Drop and recreate the enum with only AEREO and MARITIMO
    op.execute(sa.text("DROP TYPE modal"))
    op.execute(sa.text("CREATE TYPE modal AS ENUM ('AEREO', 'MARITIMO')"))

    # Restore columns to the new enum
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_quotations "
        "ALTER COLUMN modal TYPE modal USING modal::modal"
    ))
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_client_dna "
        "ALTER COLUMN modality TYPE modal USING modality::modal"
    ))
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_transit_time_references "
        "ALTER COLUMN modal TYPE modal USING modal::modal"
    ))

    # ------------------------------------------------------------------
    # 2. Create new enum types
    # ------------------------------------------------------------------

    op.execute(sa.text(
        "CREATE TYPE servicetype AS ENUM ('IMPORTACAO', 'EXPORTACAO')"
    ))
    op.execute(sa.text(
        "CREATE TYPE tipoembarque AS ENUM ('FCL', 'LCL', 'BREAK_BULK')"
    ))
    op.execute(sa.text(
        "CREATE TYPE cargaperigosa AS ENUM ('NAO', 'RA', 'IMO')"
    ))
    op.execute(sa.text(
        "CREATE TYPE tipocontainer AS ENUM ("
        "  'STANDARD_20', 'STANDARD_40', 'HIGH_CUBE_40', 'NOR_40',"
        "  'HARDTOP_20', 'HARDTOP_40', 'HARDTOP_HIGH_CUBE_40',"
        "  'OPEN_TOP_20', 'OPEN_TOP_40', 'OPEN_TOP_HIGH_CUBE_40',"
        "  'FLATRACK_20', 'FLATRACK_40', 'PLATFORM_20', 'PLATFORM_40',"
        "  'REFRIGERATED_20', 'REFRIGERATED_40', 'BULK_20', 'TANK_20'"
        ")"
    ))
    op.execute(sa.text(
        "CREATE TYPE tipoembalagem AS ENUM ("
        "  'BARRICA_FIBRA_VIDRO', 'BARRICA_METAL', 'BARRICA_OUTROS', 'BARRICA_PAPELAO', 'BARRICA_PLASTICO',"
        "  'BAU_MADEIRA', 'BAU_METAL', 'BAU_OUTROS',"
        "  'BIG_BAG', 'BLOCO', 'BOBINA', 'BOMBONA', 'BOTIJAO',"
        "  'CAIXA', 'CAIXA_ISOPOR', 'CAIXA_MADEIRA', 'CAIXA_METAL', 'CAIXA_OUTROS',"
        "  'CAIXA_PAPELAO', 'CAIXA_PAPELAO_CORRUGADO', 'CAIXA_PLASTICO',"
        "  'CARGA_SOLTA', 'CARRETEL', 'CILINDRO', 'CINTADO',"
        "  'ENGRADADO_MADEIRA', 'ENGRADADO_OUTROS', 'ENGRADADO_PLASTICO',"
        "  'ENVELOPE', 'ESTOJO', 'ESTRADO', 'FARDO', 'FRASCO',"
        "  'GALAO_METAL', 'GALAO_OUTROS', 'GALAO_PLASTICO',"
        "  'GRANEL', 'LATA', 'MALA', 'MALETA', 'MODAL_OCTABIN', 'OUTRO',"
        "  'PACOTE', 'PALLET', 'PECA', 'ROLO',"
        "  'SACA', 'SACA_ANIAGEM', 'SACA_COURO', 'SACA_LONA',"
        "  'SACO_NYLON', 'SACO_OUTROS', 'SACO_PAPEL', 'SACO_PAPELAO', 'SACO_PLASTICO',"
        "  'SACOLA', 'SAND_BAG',"
        "  'TAMBOR_METAL', 'TAMBOR_OUTROS', 'TAMBOR_PAPELAO', 'TAMBOR_PLASTICO',"
        "  'TUBO'"
        ")"
    ))
    op.execute(sa.text(
        "CREATE TYPE pesounidade AS ENUM ('KG', 'LB')"
    ))
    op.execute(sa.text(
        "CREATE TYPE dimensaounidade AS ENUM ('CM', 'M', 'MM', 'POL')"
    ))

    # ------------------------------------------------------------------
    # 3. Add new columns to centrix_quotation_quotations
    # ------------------------------------------------------------------

    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_quotations "
        "ADD COLUMN service_type servicetype"
    ))
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_quotations "
        "ADD COLUMN tipo_embarque tipoembarque"
    ))
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_quotations "
        "ADD COLUMN carga_perigosa cargaperigosa"
    ))
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_quotations "
        "ADD COLUMN temperatura_min NUMERIC(5, 1)"
    ))
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_quotations "
        "ADD COLUMN temperatura_max NUMERIC(5, 1)"
    ))
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_quotations "
        "ADD COLUMN client_reference TEXT"
    ))
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_quotations "
        "ADD COLUMN bl_consolidado BOOLEAN"
    ))

    # ------------------------------------------------------------------
    # 4. Create centrix_quotation_equipments
    # ------------------------------------------------------------------

    op.execute(sa.text("""
        CREATE TABLE centrix_quotation_equipments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            quotation_id UUID NOT NULL
                REFERENCES centrix_quotation_quotations(id) ON DELETE CASCADE,
            quantity INTEGER NOT NULL DEFAULT 1,
            tipo_container tipocontainer NOT NULL,
            volume_m3 NUMERIC(10, 3),
            peso_bruto NUMERIC(12, 3),
            peso_unidade pesounidade NOT NULL DEFAULT 'KG',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """))
    op.execute(sa.text(
        "CREATE INDEX ix_equipments_quotation_id ON centrix_quotation_equipments (quotation_id)"
    ))

    # ------------------------------------------------------------------
    # 5. Create centrix_quotation_volumes
    # ------------------------------------------------------------------

    op.execute(sa.text("""
        CREATE TABLE centrix_quotation_volumes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            quotation_id UUID NOT NULL
                REFERENCES centrix_quotation_quotations(id) ON DELETE CASCADE,
            quantity INTEGER NOT NULL DEFAULT 1,
            embalagem tipoembalagem,
            peso_bruto NUMERIC(12, 3),
            peso_unidade pesounidade NOT NULL DEFAULT 'KG',
            comprimento NUMERIC(10, 3),
            largura NUMERIC(10, 3),
            altura NUMERIC(10, 3),
            dimensao_unidade dimensaounidade NOT NULL DEFAULT 'CM',
            volume_m3 NUMERIC(10, 3),
            inspecao_iof BOOLEAN,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """))
    op.execute(sa.text(
        "CREATE INDEX ix_volumes_quotation_id ON centrix_quotation_volumes (quotation_id)"
    ))

    # ------------------------------------------------------------------
    # 6. Create centrix_quotation_container_specs
    # ------------------------------------------------------------------

    op.execute(sa.text("""
        CREATE TABLE centrix_quotation_container_specs (
            tipo_container tipocontainer PRIMARY KEY,
            comprimento_interno_mm INTEGER,
            largura_interna_mm INTEGER,
            altura_interna_mm INTEGER,
            capacidade_m3 NUMERIC(8, 2),
            carga_maxima_kg INTEGER,
            tara_kg INTEGER,
            peso_max_total_kg INTEGER,
            updated_at TIMESTAMPTZ
        )
    """))


def downgrade() -> None:
    # Drop new tables
    op.execute(sa.text("DROP TABLE IF EXISTS centrix_quotation_container_specs"))
    op.execute(sa.text("DROP TABLE IF EXISTS centrix_quotation_volumes"))
    op.execute(sa.text("DROP TABLE IF EXISTS centrix_quotation_equipments"))

    # Drop new columns from quotations
    for col in ("service_type", "tipo_embarque", "carga_perigosa",
                "temperatura_min", "temperatura_max", "client_reference", "bl_consolidado"):
        op.execute(sa.text(
            f"ALTER TABLE centrix_quotation_quotations DROP COLUMN IF EXISTS {col}"
        ))

    # Drop new enum types
    for enum_type in ("dimensaounidade", "pesounidade", "tipoembalagem", "tipocontainer",
                      "cargaperigosa", "tipoembarque", "servicetype"):
        op.execute(sa.text(f"DROP TYPE IF EXISTS {enum_type}"))

    # Restore modal enum to original 4-value form
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_quotations ALTER COLUMN modal TYPE TEXT USING modal::TEXT"
    ))
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_client_dna ALTER COLUMN modality TYPE TEXT USING modality::TEXT"
    ))
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_transit_time_references ALTER COLUMN modal TYPE TEXT USING modal::TEXT"
    ))
    op.execute(sa.text("DROP TYPE modal"))
    op.execute(sa.text(
        "CREATE TYPE modal AS ENUM ('MARITIMO_FCL', 'MARITIMO_LCL', 'MARITIMO_REEFER', 'AEREO')"
    ))
    op.execute(sa.text(
        "UPDATE centrix_quotation_quotations SET modal = 'MARITIMO_FCL' WHERE modal = 'MARITIMO'"
    ))
    op.execute(sa.text(
        "UPDATE centrix_quotation_client_dna SET modality = 'MARITIMO_FCL' WHERE modality = 'MARITIMO'"
    ))
    op.execute(sa.text(
        "UPDATE centrix_quotation_transit_time_references SET modal = 'MARITIMO_FCL' WHERE modal = 'MARITIMO'"
    ))
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_quotations "
        "ALTER COLUMN modal TYPE modal USING modal::modal"
    ))
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_client_dna "
        "ALTER COLUMN modality TYPE modal USING modality::modal"
    ))
    op.execute(sa.text(
        "ALTER TABLE centrix_quotation_transit_time_references "
        "ALTER COLUMN modal TYPE modal USING modal::modal"
    ))
