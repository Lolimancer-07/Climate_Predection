"""
backend/config.py
Centralised application configuration via pydantic-settings.
"""
import os
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── App ────────────────────────────────────────────────────
    app_env: str                    = "development"
    secret_key: str                 = "change-me-to-a-long-random-string"
    cors_origins: list[str]         = ["http://localhost:5173", "http://localhost:3000"]

    # ── Database ───────────────────────────────────────────────
    database_url: str               = "postgresql://cyclone:cyclone@localhost:5432/cyclone_platform"

    # ── Google Earth Engine ────────────────────────────────────
    gee_service_account: str        = ""
    gee_key_file: str               = "infra/gee-service-account-key.json"
    gee_project: str                = ""

    # ── Gemini ─────────────────────────────────────────────────
    gemini_api_key: str             = ""
    gemini_model: str               = "gemini-2.0-flash"
    vertex_project: str             = ""
    vertex_location: str            = "us-central1"

    # ── Twilio ─────────────────────────────────────────────────
    twilio_account_sid: str         = ""
    twilio_auth_token: str          = ""
    twilio_from_number: str         = "+15005550006"

    # ── WhatsApp ───────────────────────────────────────────────
    whatsapp_access_token: str      = ""
    whatsapp_phone_number_id: str   = ""

    # ── Weather APIs ───────────────────────────────────────────
    open_meteo_base_url: str        = "https://api.open-meteo.com/v1"
    gdacs_feed_url: str             = "https://www.gdacs.org/xml/rss.xml"

    # ── Supabase Auth ──────────────────────────────────────────
    supabase_url: str               = ""
    supabase_anon_key: str          = ""
    supabase_service_role_key: str  = ""

    # ── Insurer webhook ────────────────────────────────────────
    mock_insurer_webhook_url: str   = "http://localhost:9000/mock-insurer/trigger"
    insurer_webhook_url: str        = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def async_database_url(self) -> str:
        return self.database_url.replace("postgresql://", "postgresql+asyncpg://")

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
