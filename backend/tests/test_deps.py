import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.api.deps import require_auth, require_admin
from app.services.appwrite_jwt import AppwriteUser


# App mínima para testear las dependencias
test_app = FastAPI()


@test_app.get("/protected")
async def protected(user: AppwriteUser = Depends(require_auth)):
    return {"user_id": user.id}


@test_app.get("/admin-only")
async def admin_only(user: AppwriteUser = Depends(require_admin)):
    return {"user_id": user.id}


client = TestClient(test_app, raise_server_exceptions=False)


def test_require_auth_sin_token_da_401():
    response = client.get("/protected")
    assert response.status_code == 401


def test_require_admin_sin_token_da_401():
    response = client.get("/admin-only")
    assert response.status_code == 401


def test_require_auth_token_invalido_da_401():
    response = client.get("/protected", headers={"Authorization": "Bearer token-falso"})
    assert response.status_code == 401
