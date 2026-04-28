#!/usr/bin/env python3
import sys
import os

# Agregar el directorio del proyecto al path
sys.path.insert(0, '/Users/diazj/OneDrive/Escritorio/ERP_PROYECTO/erp_zoro_python')
sys.path.insert(0, 'c:/Users/diazj/OneDrive/Escritorio/ERP_PROYECTO/erp_zoro_python')

# Configurar variables de entorno
os.chdir('c:/Users/diazj/OneDrive/Escritorio/ERP_PROYECTO/erp_zoro_python')

from app.core.security import get_password_hash
from app.db.session import get_transaction
from sqlalchemy import text

password = "SuperAdmin123"
hashed = get_password_hash(password)

print(f"Contraseña: {password}")
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
