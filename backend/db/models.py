"""
backend/db/models.py
SQLAlchemy ORM models matching the database schema from the implementation plan.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Boolean, Numeric, Integer,
    ForeignKey, TIMESTAMP, func,
)
from sqlalchemy.dialects.postgresql import UUID
from geoalchemy2 import Geometry
from backend.db.session import Base


def _uuid():
    return str(uuid.uuid4())


class District(Base):
    __tablename__ = "districts"

    district_id = Column(String, primary_key=True, default=_uuid)
    country = Column(String, nullable=False)
    name = Column(String, nullable=False)
    geom = Column(Geometry("MULTIPOLYGON", srid=4326), nullable=True)


class Ward(Base):
    __tablename__ = "wards"

    ward_id = Column(String, primary_key=True, default=_uuid)
    district_id = Column(String, ForeignKey("districts.district_id"), nullable=False)
    name = Column(String, nullable=False)
    population = Column(Integer, nullable=True)
    geom = Column(Geometry("MULTIPOLYGON", srid=4326), nullable=True)


class CycloneEvent(Base):
    __tablename__ = "cyclone_events"

    event_id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=True)
    source = Column(String, nullable=True)          # IMD | JTWC | GDACS
    category = Column(String, nullable=True)
    eta = Column(TIMESTAMP(timezone=True), nullable=True)
    track_geom = Column(Geometry("LINESTRING", srid=4326), nullable=True)
    ingested_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class HazardPolygon(Base):
    __tablename__ = "hazard_polygons"

    hazard_id = Column(String, primary_key=True, default=_uuid)
    event_id = Column(String, ForeignKey("cyclone_events.event_id"), nullable=False)
    ward_id = Column(String, ForeignKey("wards.ward_id"), nullable=True)
    hazard_type = Column(String, nullable=False)    # surge | rainfall_flood
    severity_class = Column(String, nullable=True)
    attribute_value = Column(Numeric, nullable=True)  # surge height (m) or rainfall (mm)
    geom = Column(Geometry("MULTIPOLYGON", srid=4326), nullable=True)
    model_version = Column(String, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class InfrastructureAsset(Base):
    __tablename__ = "infrastructure_assets"

    asset_id = Column(String, primary_key=True, default=_uuid)
    ward_id = Column(String, ForeignKey("wards.ward_id"), nullable=True)
    asset_type = Column(String, nullable=False)    # hospital | shelter | road | power_line | substation
    name = Column(String, nullable=True)
    criticality = Column(Numeric, nullable=True)
    geom = Column(Geometry(srid=4326), nullable=True)


class ExposureScore(Base):
    __tablename__ = "exposure_scores"

    score_id = Column(String, primary_key=True, default=_uuid)
    event_id = Column(String, ForeignKey("cyclone_events.event_id"), nullable=False)
    asset_id = Column(String, ForeignKey("infrastructure_assets.asset_id"), nullable=False)
    exposure_score = Column(Numeric, nullable=True)
    priority_score = Column(Numeric, nullable=True)
    computed_at = Column(TIMESTAMP(timezone=True), server_default=func.now())


class Advisory(Base):
    __tablename__ = "advisories"

    advisory_id = Column(String, primary_key=True, default=_uuid)
    event_id = Column(String, ForeignKey("cyclone_events.event_id"), nullable=False)
    ward_id = Column(String, ForeignKey("wards.ward_id"), nullable=True)
    severity_tier = Column(String, nullable=True)   # Watch | Warning | Evacuation Order
    content_en = Column(Text, nullable=True)
    content_local = Column(Text, nullable=True)
    generated_by = Column(String, default="gemini-2.0-flash")
    reviewed_by = Column(String, nullable=True)
    dispatched_at = Column(TIMESTAMP(timezone=True), nullable=True)


class InsuranceTrigger(Base):
    __tablename__ = "insurance_triggers"

    trigger_id = Column(String, primary_key=True, default=_uuid)
    policy_id = Column(String, nullable=True)
    zone_id = Column(String, nullable=True)
    event_id = Column(String, ForeignKey("cyclone_events.event_id"), nullable=False)
    trigger_type = Column(String, nullable=True)
    threshold_value = Column(Numeric, nullable=True)
    observed_value = Column(Numeric, nullable=True)
    triggered = Column(Boolean, nullable=True)
    trigger_timestamp = Column(TIMESTAMP(timezone=True), nullable=True)
    audit_hash = Column(String, nullable=True)


class DispatchLog(Base):
    __tablename__ = "dispatch_log"

    dispatch_id = Column(String, primary_key=True, default=_uuid)
    advisory_id = Column(String, ForeignKey("advisories.advisory_id"), nullable=False)
    channel = Column(String, nullable=True)    # sms | whatsapp | cap_xml | pdf | insurer_webhook
    recipient = Column(String, nullable=True)
    status = Column(String, nullable=True)
    dispatched_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
