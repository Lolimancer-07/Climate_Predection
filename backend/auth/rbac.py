"""
backend/auth/rbac.py
Role-Based Access Control for the platform.

Roles:
  - ddma_operator : DDMA officers — can generate, review, and dispatch advisories
  - insurer_viewer: Insurance partners — can view triggers and trigger notifications only
  - admin         : Full access
  - readonly      : Read-only access to risk data and maps

DDMA operators never see raw citizen contact data used for SMS/WhatsApp dispatch.
Insurer viewers never see citizen contact lists or advisory draft content.
"""
from __future__ import annotations
from enum import Enum
from functools import wraps
from typing import Callable, Any
from fastapi import HTTPException, Header
from typing import Optional


class Role(str, Enum):
    ADMIN            = "admin"
    DDMA_OPERATOR    = "ddma_operator"
    INSURER_VIEWER   = "insurer_viewer"
    READONLY         = "readonly"


# Permission map: role → set of allowed actions
PERMISSIONS: dict[Role, set[str]] = {
    Role.ADMIN: {
        "read:risk", "write:advisory", "dispatch:advisory",
        "read:insurance", "dispatch:insurance",
        "read:assets", "admin:all",
    },
    Role.DDMA_OPERATOR: {
        "read:risk", "write:advisory", "dispatch:advisory",
        "read:insurance", "read:assets",
    },
    Role.INSURER_VIEWER: {
        "read:insurance",
    },
    Role.READONLY: {
        "read:risk", "read:assets",
    },
}


def get_current_role(x_role: Optional[str] = Header(default="ddma_operator")) -> Role:
    """
    FastAPI dependency: extract the user role from the X-Role header.
    In production, replace with JWT/OAuth2 token validation.
    Defaults to ddma_operator for demo convenience.
    """
    try:
        return Role(x_role or "ddma_operator")
    except ValueError:
        raise HTTPException(status_code=403, detail=f"Unknown role: {x_role}")


def require_permission(action: str):
    """
    FastAPI dependency factory: verify the current role has a specific permission.

    Usage:
        @router.post("/advisory/{id}/dispatch")
        async def dispatch(
            ...,
            role: Role = Depends(require_permission("dispatch:advisory"))
        ): ...
    """
    from fastapi import Depends

    def dependency(role: Role = Depends(get_current_role)) -> Role:
        if action not in PERMISSIONS.get(role, set()):
            raise HTTPException(
                status_code=403,
                detail=(
                    f"Role '{role.value}' does not have permission '{action}'. "
                    f"Required for this operation."
                ),
            )
        return role

    return dependency


def role_can(role: Role, action: str) -> bool:
    """Simple boolean check (for use outside FastAPI)."""
    return action in PERMISSIONS.get(role, set())
