"""
geo/__init__.py
All-India administrative hierarchy & geospatial registry.
"""
from geo.states import STATES_REGISTRY, get_state, list_states
from geo.districts import DISTRICTS_REGISTRY, get_district, list_districts, get_districts_by_state

__all__ = [
    "STATES_REGISTRY",
    "DISTRICTS_REGISTRY",
    "get_state",
    "list_states",
    "get_district",
    "list_districts",
    "get_districts_by_state",
]
