import os
from typing import Dict
from data_ingestion.providers.base import CycloneDataProvider
from data_ingestion.providers.mock_cyclone_provider import MockCycloneProvider
from data_ingestion.providers.imd_provider import IMDProvider
from data_ingestion.providers.jtwc_provider import JTWCProvider
from data_ingestion.providers.gdacs_provider import GDACSProvider

PROVIDER_REGISTRY: Dict[str, CycloneDataProvider] = {
    "mock": MockCycloneProvider(),
    "imd": IMDProvider(),
    "jtwc": JTWCProvider(),
    "gdacs": GDACSProvider(),
}

def get_active_cyclone_provider() -> CycloneDataProvider:
    # Use environment variable or fallback to mock
    provider_mode = os.getenv("PROVIDER_MODE", "mock").lower()
    if provider_mode not in PROVIDER_REGISTRY:
        raise ValueError(f"Unknown provider mode: {provider_mode}")
    return PROVIDER_REGISTRY[provider_mode]
