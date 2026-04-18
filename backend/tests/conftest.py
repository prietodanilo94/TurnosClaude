"""
Overrides de dependencias de autenticación para todos los tests HTTP.
Los endpoints /optimize y /validate requieren JWT en producción;
en tests usamos un usuario admin falso via dependency_overrides.
"""
from app.api.deps import require_admin, require_auth
from app.main import app
from app.services.appwrite_jwt import AppwriteUser

_MOCK_ADMIN = AppwriteUser(id="test-admin", email="admin@test.cl", labels=["admin"])


def _mock_auth() -> AppwriteUser:
    return _MOCK_ADMIN


def _mock_admin() -> AppwriteUser:
    return _MOCK_ADMIN


app.dependency_overrides[require_auth] = _mock_auth
app.dependency_overrides[require_admin] = _mock_admin
