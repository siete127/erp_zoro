# ERP Zoro Python

Migracion del backend Node/Express a Python usando FastAPI.

## Que incluye

- Base de API en Python con la misma idea de rutas del backend actual.
- Modulos portados con logica real:
  - `auth`
  - `users`
  - `roles`
  - `permissions`
  - `companies` (CRUD base y actualizacion fiscal)
  - `clients` (CRUD, direcciones, contactos, financiero, recurrentes)
  - `productos` (CRUD, multiempresa, configuracion de inventario)
  - `almacenes`
  - `sat`
  - `config`
  - `precios`
  - `cotizaciones`
  - `ventas` (confirmacion, facturacion, produccion y PDF de factura)
  - `notas-credito` (creacion, timbrado, consulta y PDF)
  - `complementos-pago` (creacion, timbrado y consulta)
  - `facturacion` (timbrado directo y cancelacion)
  - `inventario` (stock, consolidado, recepcion, kardex, MP y transferencias)
  - `produccion` (ordenes, preview, confirmacion, cierre y estados)
  - `bom` (CRUD, clone, variacion de costos y materias primas disponibles)
  - `materias-primas` (CRUD base)
  - `compras` (OC, autorizaciones, recepciones, registro directo, analisis de hoja y PDF)
  - `crm` (etapas, oportunidades, actividades, cierre a venta y envio a produccion)
  - `reporteria` (listado de facturas, descarga PDF/XML, estadisticas)
  - `rh` (perfiles, foto, contactos de emergencia, cuentas bancarias, documentos)
  - `accounting` (catalogo de cuentas, balanzas, estado de resultados, reportes operativos)
  - `password` (solicitar reset, verificar token, restablecer contraseña + email)
  - `constancia` (parseo de constancia SAT en PDF o XML, extraccion de RFC/razon social/domicilio)
  - `client-pricing` (precios por cliente, solicitudes de cambio con doble aprobacion por email)
  - `cp` (proxy a Sepomex para busqueda de datos por codigo postal)
- Los mounts principales del backend Node.js ya tienen equivalente en Python.
- Se agregaron rutas nuevas especificas para Python:
  - `tareas`
  - `product-images`
  - `client-docs`
- Script para generar y opcionalmente crear la base `ERP_Zoro` copiando la estructura de la base `ERP`.

## Estructura

```text
erp_zoro_python/
  app/
    api/
    core/
    db/
    schemas/
    services/
    utils/
  scripts/
```

## Configuracion

1. Copia `.env.example` a `.env`.
2. Ajusta credenciales y secretos.
3. Instala dependencias.
4. En Windows, instala `ODBC Driver 18 for SQL Server` y configura:

```env
ERP_SQLSERVER_DRIVER=ODBC Driver 18 for SQL Server
```

El driver legado `SQL Server` suele fallar con conexiones remotas/TLS.

5. Instala dependencias Python:

```bash
pip install -r requirements.txt
```

## Ejecutar API

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --app-dir erp_zoro_python
```

La API queda disponible en `http://localhost:8000`, en la IP local del equipo host y la documentacion en `/docs`.

Desde la raiz del proyecto tambien puedes usar:

```bat
start-backend.bat
```

Tambien expone archivos subidos en:

- `/uploads/...`
- `/api/uploads/...` (alias de compatibilidad con Node.js)

## Frontend local

Para desarrollar contra FastAPI local:

1. Usa `frontend/.env.local.example` como base para `frontend/.env.local`.
2. Asegura `VITE_USE_PROD=false`.
3. Levanta Vite normalmente; el proxy local ya redirige:
   - `/api`
   - `/uploads`
   - `/api/uploads`
   - `/socket.io`

## Pruebas en la misma red local

Para que otra persona en la misma red pueda probar chat y notificaciones:

1. Levanta el backend Python con `start-backend.bat`.
2. Levanta el frontend con:

```bash
cd frontend
npm run dev
```

3. Comparte la URL del host, por ejemplo `http://192.168.1.25:5173`.
4. Si Windows muestra aviso de firewall para Python o Node, permite acceso en redes privadas.

Notas:

- El frontend local ahora usa rutas relativas (`/api` y `/socket.io`) para que otra maquina no intente conectarse a su propio `localhost`.
- El proxy de Vite escucha en `0.0.0.0:5173`, asi que el navegador remoto solo entra a la IP del host.
- El puerto `8000` solo necesita abrirse si quieres consumir el backend directamente o usar `/docs`.

## Crear el esquema ERP_Zoro

Generar el script SQL sin ejecutarlo:

```bash
python erp_zoro_python/scripts/create_erp_zoro_database.py
```

Generar y ejecutar la creacion de la base:

```bash
python erp_zoro_python/scripts/create_erp_zoro_database.py --execute
```

El script crea un archivo en `erp_zoro_python/sql/ERP_Zoro_schema.sql`.

Si existe `erp_zoro_python/sql/fase_1_python_migration.sql`, el generador lo anexa automaticamente al esquema exportado.
Tambien agrega cualquier archivo `fase_*.sql`, incluyendo chat y notificaciones.

## Migracion SQL complementaria

El archivo `erp_zoro_python/sql/fase_1_python_migration.sql` agrega las piezas que no vienen de la copia base:

- `ERP_TAREAS`
- `ERP_PRODUCTO_IMAGENES`
- `ERP_CLIENT_DOCUMENTOS`
- `ERP_FACTURAS.FechaVencimiento`
- `ERP_VENTA_DETALLE.CostoUnitario`
- `ERP_CHAT_CANALES`
- `ERP_CHAT_MIEMBROS`
- `ERP_CHAT_MENSAJES`
- `ERP_CHAT_LECTURAS`
- `ERP_NOTIFICACIONES`

## Nota de alcance

El frontend actual sigue siendo React/Vite. La migracion del backend a Python ya cubre la mayoria de rutas principales, pero la validacion final depende de:

- contar con el driver ODBC correcto en el entorno
- aplicar la migracion SQL complementaria cuando la base destino aun no tiene las tablas/columnas nuevas
- probar el flujo completo frontend + FastAPI + MSSQL
