"""
modeling/insurance_trigger/policy_schemas.py
Pydantic schemas for parametric insurance policies and trigger records.
"""
from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field


TriggerType = Literal["surge_height", "rainfall_total", "wind_speed", "composite_loss_index"]
Confidence  = Literal["forecast", "observed"]


class PolicyZoneSchema(BaseModel):
    """Schema for a single insured zone within a parametric policy."""
    policy_id: str                                  = Field(..., description="Unique policy identifier")
    zone_id: str                                    = Field(..., description="Geographic zone covered")
    trigger_type: TriggerType                       = Field(..., description="Physical parameter that triggers payout")
    threshold: float                                = Field(..., gt=0, description="Contracted trigger level")
    currency: str                                   = Field(default="USD")
    payout_amount: float                            = Field(default=0.0, ge=0, description="Notional payout on trigger")
    coverage_start: Optional[datetime]              = None
    coverage_end: Optional[datetime]                = None
    notes: str                                      = ""

    class Config:
        json_schema_extra = {
            "example": {
                "policy_id": "POL-ODISHA-2024-001",
                "zone_id": "IN-OD-PURI",
                "trigger_type": "surge_height",
                "threshold": 2.0,
                "currency": "USD",
                "payout_amount": 500000,
            }
        }


class TriggerEvaluationRequest(BaseModel):
    """Request to evaluate trigger conditions for an event."""
    event_id: str
    hazard_values: dict[str, float] = Field(
        ...,
        description="Dict of {trigger_type: observed_value}",
        example={
            "surge_height": 2.6,
            "rainfall_total": 280.0,
            "wind_speed": 215.0,
        },
    )
    confidence: Confidence = "forecast"


class TriggerRecordSchema(BaseModel):
    """Full trigger evaluation record — the audit artifact."""
    trigger_id: str
    policy_id: str
    zone_id: str
    event_id: str
    trigger_type: TriggerType
    threshold: float
    observed_or_forecast_value: float
    confidence: Confidence
    triggered: bool
    trigger_timestamp: str           # ISO 8601
    payout_amount: float
    currency: str
    source_model_version: str
    audit_hash: str                  # SHA-256 of deterministic inputs
    disclaimer: str

    class Config:
        json_schema_extra = {
            "example": {
                "trigger_id": "550e8400-e29b-41d4-a716-446655440000",
                "policy_id": "POL-ODISHA-2024-001",
                "zone_id": "IN-OD-PURI",
                "event_id": "CYCLONE-FANI-2019",
                "trigger_type": "surge_height",
                "threshold": 2.0,
                "observed_or_forecast_value": 2.6,
                "confidence": "forecast",
                "triggered": True,
                "trigger_timestamp": "2019-05-02T06:00:00+00:00",
                "payout_amount": 500000,
                "currency": "USD",
                "source_model_version": "trigger-engine-v0.1",
                "audit_hash": "a3f2...",
                "disclaimer": "Parametric trigger notification for demonstration purposes only.",
            }
        }
