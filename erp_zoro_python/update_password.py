#!/usr/bin/env python3
import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))
os.chdir(BASE_DIR)

from app.core.security import get_password_hash
from app.db.session import get_transaction
from sqlalchemy import text

password = (os.getenv("SUPERADMIN_PASSWORD") or "").strip()
if not password:
    raise SystemExit("Missing required environment variable: SUPERADMIN_PASSWORD")

hashed = get_password_hash(password)

print("Actualizando hash del superadmin con la contraseña provista en entorno.")
print(f"Hash: {hashed}")

try:
    with get_transaction() as conn:
        result = conn.execute(
            text("UPDATE ERP_USERS SET Password = :pwd WHERE Username = 'superadmin' AND RolId = 1"),
            {"pwd": hashed}
        )
        print(f"✓ Actualizado {result.rowcount} usuario(s)")
except Exception as e:
    print(f"✗ Error: {e}")

