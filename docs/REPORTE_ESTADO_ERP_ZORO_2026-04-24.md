# REPORTE DE ESTADO - ERP Zoro

Actualizado: 2026-04-24

Nota de alcance:
- Este reporte refleja el estado actual del codigo fuente en `Python/FastAPI + React`.
- Se verifico compilacion Python y `npm run build` del frontend.
- No incluye ejecucion real de migraciones sobre SQL Server remoto desde esta maquina, porque la validacion MSSQL local sigue bloqueada por el driver ODBC legado.

## RESUMEN EJECUTIVO

| Fase | Estado | Avance |
|------|--------|--------|
| Fase 1 - Funcionalidades requeridas | COMPLETA EN CODIGO | 100% |
| Fase 2.1 - Chat interno | COMPLETA EN CODIGO Y LOCAL/LAN | 100% |
| Fase 2.2 - Notificaciones in-app | COMPLETA EN CODIGO Y LOCAL/LAN | 100% |
| Fase 3 - Licencias SaaS + Auditoria | EN PROGRESO | 60% |
| Fase 4 - CRM avanzado + Modulos industriales | PENDIENTE | 0% |
| Fase 5 - Nomina + Asistencia | PENDIENTE | 0% |

## FASE 1 - COMPLETA EN CODIGO

### 1.1 Imagenes de productos
- BD: tabla `ERP_PRODUCTO_IMAGENES` versionada en `erp_zoro_python/sql/fase_1_python_migration.sql`
- Backend: `product_images.py` + `product_image_service.py`
- Frontend: `ProductoImagenes.jsx` integrado en `Productos.jsx`

### 1.2 Documentos de clientes
- BD: tabla `ERP_CLIENT_DOCUMENTOS` versionada en `erp_zoro_python/sql/fase_1_python_migration.sql`
- Backend: `client_docs.py` + `client_doc_service.py`
- Frontend: `ClienteDocumentos.jsx` integrado en `Clients.jsx`

### 1.3 Avisos de vencimiento de facturas
- BD: columna `FechaVencimiento` versionada en `erp_zoro_python/sql/fase_1_python_migration.sql`
- Backend: endpoint `GET /api/reporteria/facturas/vencimientos`
- Frontend: `FacturasVencidas.jsx` en Dashboard

### 1.4 Control de costos / rentabilidad por venta
- BD: columna `CostoUnitario` versionada en `erp_zoro_python/sql/fase_1_python_migration.sql`
- Backend: endpoint de rentabilidad en ventas ya portado a Python
- Frontend: seccion de rentabilidad en `DetalleVenta.jsx`

### 1.5 Tareas / Kanban
- BD: tabla `ERP_TAREAS` versionada en `erp_zoro_python/sql/fase_1_python_migration.sql`
- Backend: `tareas.py` + `tarea_service.py`
- Frontend: `frontend/src/pages/tareas/Tareas.jsx`
- Socket: evento `tarea:changed`

## FASE 2.1 - CHAT INTERNO COMPLETO EN CODIGO Y LOCAL/LAN

### 2.1 Sistema de mensajeria interna
- BD: tablas de chat versionadas en `erp_zoro_python/sql/fase_2_chat.sql`
- Backend Python:
  - `chat.py`
  - `chat_service.py`
  - `chat_handler.py`
  - `redis_chat.py`
- Frontend:
  - `chatSocket.js`
  - `useChat.js`
  - `ChatDrawer.jsx`
  - integracion en `DashboardHeader.jsx`, `Login.jsx` y `ProtectedLayout.jsx`

### Correcciones aplicadas para dejarlo funcional en local
- `get_contactos()` en `chat_service.py` corrigio el join de empresa a `ERP_USERCOMPANIES`
- `get_contactos()` corrigio el nombre de rol a `ERP_ROL.Name AS RolName`
- Socket.io quedo habilitado para pruebas locales y en red interna
- Vite quedo sirviendo en `0.0.0.0:5173`
- El frontend dejo de depender de URLs absolutas a `http://localhost:8000`

## FASE 2.2 - NOTIFICACIONES IN-APP COMPLETAS EN CODIGO Y LOCAL/LAN

### 2.2 Sistema de notificaciones in-app
- BD: tabla `ERP_NOTIFICACIONES` versionada en `erp_zoro_python/sql/fase_2_notificaciones.sql`
- Backend:
  - `erp_zoro_python/app/api/routes/notificaciones.py`
  - `erp_zoro_python/app/services/notificacion_service.py`
  - endpoints:
    - `GET /api/notificaciones`
    - `PATCH /api/notificaciones/{id}/leer`
    - `PATCH /api/notificaciones/leer-todas`
- Socket.io:
  - evento `notificacion:nueva`
  - entrega por sala privada `user_{id}`
- Frontend:
  - `frontend/src/components/Notificaciones/NotifBell.jsx`
  - `frontend/src/services/notificacionService.js`
  - campana integrada en `frontend/src/layouts/DashboardHeader.jsx`

### Correcciones aplicadas para local
- La llamada del frontend usa `/api/notificaciones/` para evitar redirect innecesario
- El backend tolera ausencia temporal de `ERP_NOTIFICACIONES` sin tumbar la UI
- CORS permite `localhost`, `127.0.0.1` e IPs de red interna
- El frontend local usa rutas relativas para que otra maquina no intente hablar con su propio `localhost`

### Disparadores implementados
- Tarea asignada o reasignada
- Factura vencida o proxima a vencer al consultar vencimientos
- Solicitud de cambio de precio aprobada
- Solicitud de cambio de precio rechazada
- Orden de produccion creada

## FASE 3 - EN PROGRESO

### 3.1 Licencias SaaS
- BD: tabla `ERP_LICENCIAS` versionada en `erp_zoro_python/sql/fase_3_licencias.sql`
- Backend:
  - `erp_zoro_python/app/services/licencia_service.py`
  - `erp_zoro_python/app/api/routes/licencias.py`
  - validacion de acceso en login cuando existen licencias configuradas
- Frontend:
  - `frontend/src/pages/admin/Licencias.jsx`
  - `frontend/src/services/licenciaService.js`
  - ruta `/licencias`

### 3.2 Auditoria
- BD: usa tabla existente `ERP_AUDIT_LOGS`
- Backend:
  - `erp_zoro_python/app/services/audit_service.py`
  - `erp_zoro_python/app/api/routes/auditoria.py`
  - endpoints:
    - `GET /api/auditoria`
    - `GET /api/auditoria/modulos`
- Frontend:
  - `frontend/src/pages/admin/Auditoria.jsx`
  - `frontend/src/services/auditoriaService.js`
  - ruta `/auditoria`

### Estado actual de Fase 3
- Licencias ya tiene CRUD, filtro por empresa, aviso de vencimiento y validacion tambien al refrescar sesion.
- El backend ya calcula usuarios activos por empresa y expone el cupo usado contra `MaxUsuarios`.
- Auditoria ya tiene consulta filtrable para administracion y ahora registra eventos de `LOGIN` y `LOGOUT`.
- Aun falta extender el registro automatico a mas modulos criticos y cerrar enforcement por modulo/licencia para completar Fase 3 al 100%.

## LIMPIEZA DE REPOSITORIO REALIZADA

- Se removieron residuos generados fuera del runtime actual:
  - `node_modules` raiz
  - `backend/node_modules`
  - `tmp`
  - `package.json` y `package-lock.json` de la raiz
- El SQL historico de Node se movio de `backend/sql` a `erp_zoro_python/sql/legacy_node_sql`.
- `install-permissions.bat` ya apunta al arbol SQL de Python.
- Se elimino la carpeta anidada `ERP_PROYECTO/`, que era un respaldo duplicado fuera del flujo activo.
- El backend Node principal aun se conserva como referencia de migracion, pero ya no es el runtime vigente.

## ESTADO BASE DEL SISTEMA

| Modulo | Estado |
|--------|--------|
| Auth + Roles + Permisos | Completo |
| Clientes | Completo |
| Productos + Inventario + Kardex | Completo |
| Ventas + Cotizaciones + Pricing | Completo |
| CRM base | Completo |
| Produccion + BOM + OP | Completo |
| Compras + Proveedores | Completo |
| Facturacion CFDI | Completo |
| Notas de credito + Complementos de pago | Completo |
| Contabilidad | Completo |
| RH | Completo |
| WebSockets tiempo real | Completo |
| Multi-empresa | Completo |

## VERIFICACION REALIZADA

- Python: compilacion correcta de `main.py`, `socketio.py`, `chat_service.py` y `notificacion_service.py`
- Frontend: `npm run build` exitoso en 2026-04-24
- Router FastAPI actualizado con `/api/chat` y `/api/notificaciones`
- Chat y notificaciones ya no dependen de `localhost` fijo en frontend
- Script raiz `start-backend.bat` actualizado para arrancar FastAPI en `0.0.0.0:8000`
- Vite sirve en `0.0.0.0:5173` y queda apto para pruebas en la misma red
- SQL Server remoto: validacion pendiente desde esta maquina por driver ODBC legado

## PLAN ACTUALIZADO DE FASES RESTANTES

### Fase 3 - Licencias SaaS
- Crear `ERP_LICENCIAS`
- Implementar `licencias.py` + `licencia_service.py`
- Agregar validacion de licencia al login y al refresco de sesion
- Crear pagina `/licencias`
- Activar auditoria sobre `ERP_AUDIT_LOGS`
- Crear pagina `/auditoria` para SuperAdmin
- Estimacion: 2 a 3 semanas

### Fase 4 - CRM avanzado + Modulos industriales
- Propuestas comerciales PDF
- Historial de compras en ficha del cliente
- Forecast por pipeline
- Ubicaciones fisicas de almacen
- QR por producto/lote
- Tracking logistico por venta
- Dashboard ejecutivo avanzado
- Estimacion: 4 a 5 semanas

### Fase 5 - Nomina + Asistencia
- Activar nomina con tablas `NOI_*`
- Timbrado CFDI nomina
- Crear `ERP_ASISTENCIA`
- Check-in / check-out desde app
- Reporte mensual de asistencia
- Estimacion: 3 a 4 semanas

## SIGUIENTE PASO RECOMENDADO

1. Ejecutar `fase_1_python_migration.sql`, `fase_2_chat.sql`, `fase_2_notificaciones.sql` y `fase_3_licencias.sql` en SQL Server con `ODBC Driver 18 for SQL Server`
2. Extender auditoria automatica a ventas, compras, produccion y configuracion
3. Definir enforcement por tipo de licencia/modulo para cerrar Fase 3
4. Iniciar Fase 4 con CRM avanzado y logistica
5. Iniciar Fase 5 con asistencia y nomina
