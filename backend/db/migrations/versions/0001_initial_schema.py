"""Initial database schema with PostGIS

Revision ID: 0001_initial
Revises: 
Create Date: 2026-09-28 01:50:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geometry

# revision identifiers, used by Alembic.
revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable PostGIS extension
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    op.create_table(
        "districts",
        sa.Column("district_id", sa.String(), primary_key=True),
        sa.Column("country", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("geom", Geometry(geometry_type="MULTIPOLYGON", srid=4326), nullable=True),
    )

    op.create_table(
        "wards",
        sa.Column("ward_id", sa.String(), primary_key=True),
        sa.Column("district_id", sa.String(), sa.ForeignKey("districts.district_id"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("population", sa.Integer(), nullable=True),
        sa.Column("geom", Geometry(geometry_type="MULTIPOLYGON", srid=4326), nullable=True),
    )

    op.create_table(
        "cyclone_events",
        sa.Column("event_id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("source", sa.String(), nullable=True),
        sa.Column("category", sa.String(), nullable=True),
        sa.Column("eta", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("track_geom", Geometry(geometry_type="LINESTRING", srid=4326), nullable=True),
        sa.Column("ingested_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "hazard_polygons",
        sa.Column("hazard_id", sa.String(), primary_key=True),
        sa.Column("event_id", sa.String(), sa.ForeignKey("cyclone_events.event_id"), nullable=True),
        sa.Column("ward_id", sa.String(), sa.ForeignKey("wards.ward_id"), nullable=True),
        sa.Column("hazard_type", sa.String(), nullable=True),
        sa.Column("severity_class", sa.String(), nullable=True),
        sa.Column("attribute_value", sa.Numeric(), nullable=True),
        sa.Column("geom", Geometry(geometry_type="MULTIPOLYGON", srid=4326), nullable=True),
        sa.Column("model_version", sa.String(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "infrastructure_assets",
        sa.Column("asset_id", sa.String(), primary_key=True),
        sa.Column("ward_id", sa.String(), sa.ForeignKey("wards.ward_id"), nullable=True),
        sa.Column("asset_type", sa.String(), nullable=True),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("criticality", sa.Numeric(), nullable=True),
        sa.Column("geom", Geometry(geometry_type="GEOMETRY", srid=4326), nullable=True),
    )

    op.create_table(
        "exposure_scores",
        sa.Column("score_id", sa.String(), primary_key=True),
        sa.Column("event_id", sa.String(), sa.ForeignKey("cyclone_events.event_id"), nullable=True),
        sa.Column("asset_id", sa.String(), sa.ForeignKey("infrastructure_assets.asset_id"), nullable=True),
        sa.Column("exposure_score", sa.Numeric(), nullable=True),
        sa.Column("priority_score", sa.Numeric(), nullable=True),
        sa.Column("computed_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "advisories",
        sa.Column("advisory_id", sa.String(), primary_key=True),
        sa.Column("event_id", sa.String(), sa.ForeignKey("cyclone_events.event_id"), nullable=True),
        sa.Column("ward_id", sa.String(), sa.ForeignKey("wards.ward_id"), nullable=True),
        sa.Column("severity_tier", sa.String(), nullable=True),
        sa.Column("content_en", sa.Text(), nullable=True),
        sa.Column("content_local", sa.Text(), nullable=True),
        sa.Column("generated_by", sa.String(), server_default="gemini-3.7-flash"),
        sa.Column("reviewed_by", sa.String(), nullable=True),
        sa.Column("dispatched_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )

    op.create_table(
        "insurance_triggers",
        sa.Column("trigger_id", sa.String(), primary_key=True),
        sa.Column("policy_id", sa.String(), nullable=True),
        sa.Column("zone_id", sa.String(), nullable=True),
        sa.Column("event_id", sa.String(), sa.ForeignKey("cyclone_events.event_id"), nullable=True),
        sa.Column("trigger_type", sa.String(), nullable=True),
        sa.Column("threshold_value", sa.Numeric(), nullable=True),
        sa.Column("observed_value", sa.Numeric(), nullable=True),
        sa.Column("triggered", sa.Boolean(), nullable=True),
        sa.Column("trigger_timestamp", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("audit_hash", sa.String(), nullable=True),
    )

    op.create_table(
        "dispatch_log",
        sa.Column("dispatch_id", sa.String(), primary_key=True),
        sa.Column("advisory_id", sa.String(), sa.ForeignKey("advisories.advisory_id"), nullable=True),
        sa.Column("channel", sa.String(), nullable=True),
        sa.Column("recipient", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("dispatched_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("dispatch_log")
    op.drop_table("insurance_triggers")
    op.drop_table("advisories")
    op.drop_table("exposure_scores")
    op.drop_table("infrastructure_assets")
    op.drop_table("hazard_polygons")
    op.drop_table("cyclone_events")
    op.drop_table("wards")
    op.drop_table("districts")
