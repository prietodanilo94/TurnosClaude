from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    appwrite_endpoint: str
    appwrite_project_id: str
    appwrite_api_key: str
    appwrite_database_id: str = "main-v2"

    optimizer_time_limit_seconds: int = 30
    optimizer_default_num_proposals: int = 3

    model_config = SettingsConfigDict(
        env_file=("../../.env", "../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

settings = Settings()
