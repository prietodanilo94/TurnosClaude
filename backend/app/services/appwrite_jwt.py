from dataclasses import dataclass

import httpx

from app.core.config import settings


@dataclass
class AppwriteUser:
    id: str
    email: str
    labels: list[str]

    @property
    def is_admin(self) -> bool:
        return "admin" in self.labels

    @property
    def is_jefe(self) -> bool:
        return "jefesucursal" in self.labels


async def validate_jwt(token: str) -> AppwriteUser:
    """Valida un JWT de Appwrite llamando a GET /account y retorna el usuario."""
    url = f"{settings.appwrite_endpoint}/account"
    headers = {
        "X-Appwrite-Project": settings.appwrite_project_id,
        "X-Appwrite-JWT": token,
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)

    if response.status_code == 401:
        raise ValueError("JWT inválido o expirado")
    if response.status_code != 200:
        raise RuntimeError(f"Appwrite error {response.status_code}: {response.text}")

    data = response.json()
    return AppwriteUser(
        id=data["$id"],
        email=data["email"],
        labels=data.get("labels", []),
    )
