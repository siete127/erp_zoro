#!/usr/bin/env python3
"""
Script para verificar drivers ODBC disponibles en el sistema.
Uso: python check-odbc-drivers.py
"""

import sys
import pyodbc

print("\n" + "="*70)
print("🔍 VERIFICACIÓN DE DRIVERS ODBC SQL SERVER")
print("="*70 + "\n")

# Obtener todos los drivers disponibles
all_drivers = pyodbc.drivers()

print(f"Total de drivers ODBC: {len(all_drivers)}\n")

# Filtrar drivers SQL Server
sql_server_drivers = [d for d in all_drivers if 'SQL Server' in d]

if sql_server_drivers:
    print("✅ Drivers SQL Server encontrados:\n")
    for driver in sql_server_drivers:
        print(f"   • {driver}")
    print()
else:
    print("❌ NO hay drivers SQL Server instalados\n")
    print("Solución: Descarga e instala ODBC Driver 18 for SQL Server")
    print("URL: https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server\n")
    sys.exit(1)

# Verificar preferencias
print("🎯 Preferencia de drivers (en orden):\n")
print("   1. ODBC Driver 18 for SQL Server (recomendado)")
print("   2. ODBC Driver 17 for SQL Server (compatible)")
print("   3. Cualquier driver SQL Server disponible\n")

# Verificar cuál se usaría
preferred = None
for driver in sql_server_drivers:
    if "18" in driver:
        preferred = driver
        break

if not preferred:
    for driver in sql_server_drivers:
        if "17" in driver:
            preferred = driver
            break

if not preferred and sql_server_drivers:
    preferred = sql_server_drivers[0]

if preferred:
    print(f"🔧 Se usaría: {preferred}\n")
else:
    print("❌ No se encontró driver compatible\n")

print("="*70 + "\n")
