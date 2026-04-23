from pydantic import BaseModel


class ExportRequest(BaseModel):
    proposal_id: str
