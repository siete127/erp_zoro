#!/usr/bin/env python3
import requests
import json
from app.core.security import create_access_token

# Crear un token de prueba para SuperAdmin (User_Id = 1)
token = create_access_token({
    "id": 1,
    "rol": 1,
    "companies": [1]
})

print(f"Token: {token[:50]}...")

# Hacer request al endpoint
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

try:
    response = requests.get("http://localhost:8000/api/superadmin/dashboard", headers=headers)
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
except Exception as e:
    print(f"Error: {e}")
