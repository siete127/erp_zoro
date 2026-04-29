# ERP Zoro

Sistema ERP completo con módulos de Ventas, Compras, RH, Nómina, Vacaciones, CRM, Producción y más.

## Estructura

```
ERP_PROYECTO/
├── erp_zoro_python/   # Backend FastAPI (Python)
├── frontend/          # Frontend React + Vite
├── docs/              # Documentación del proyecto
├── sql/               # Scripts SQL sueltos / migraciones legacy
└── scripts/           # Scripts de setup y utilidades
```

## Inicio rápido — desarrollo local

### Backend

```bash
cd erp_zoro_python
cp .env.example .env          # Editar con tus credenciales
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API disponible en `http://localhost:8000/api` — Docs en `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

## Tests

```bash
cd erp_zoro_python
# Configurar TEST_USERNAME, TEST_PASSWORD, TEST_USER_ID, TEST_COMPANY_ID en .env
python -m pytest -v
```

## Producción

Ver `erp_zoro_python/.env.production.example` para la configuración mínima requerida.
Generar `ERP_SECRET_KEY` con:

```bash
python -c "import secrets; print(secrets.token_hex(64))"
```
