"""
data-ingestion/gee/auth.py
Google Earth Engine service-account authentication.
"""
import os
import ee


def initialize_gee() -> None:
    """
    Authenticate and initialize the GEE Python API.
    Tries service-account auth first (production / CI), then
    falls back to interactive auth (local dev).
    """
    key_file = os.getenv("GEE_KEY_FILE")
    service_account = os.getenv("GEE_SERVICE_ACCOUNT")
    project = os.getenv("GEE_PROJECT")

    if key_file and service_account and os.path.exists(key_file):
        credentials = ee.ServiceAccountCredentials(service_account, key_file)
        ee.Initialize(credentials, project=project)
    else:
        # Interactive auth for local development
        ee.Authenticate()
        ee.Initialize(project=project)

    print(f"[GEE] Initialized. Project: {project}")
