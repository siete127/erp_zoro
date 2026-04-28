from typing import Optional
from pydantic import BaseModel


class AccountCreate(BaseModel):
    AccountCode: str
    Name: str
    Type: str
    Company_Id: int
    ParentAccount: Optional[str] = None
