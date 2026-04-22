from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.services.appwrite_jwt import validate_jwt, AppwriteUser

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> AppwriteUser:
    """Extrae y valida el JWT de Appwrite"""
    try:
        user = await validate_jwt(credentials.credentials)
        return user
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error validando auth: {str(e)}"
        )

async def require_admin(user: AppwriteUser = Depends(get_current_user)) -> AppwriteUser:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Permisos de administrador requeridos")
    return user

async def require_jefe(user: AppwriteUser = Depends(get_current_user)) -> AppwriteUser:
    if not user.is_jefe and not user.is_admin:
        raise HTTPException(status_code=403, detail="Permisos insuficientes")
    return user
