# 📘 DOCUMENTACIÓN COMPLETA - SISTEMA ERP

## 📑 ÍNDICE

1. [Descripción General](#descripción-general)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Tecnologías Utilizadas](#tecnologías-utilizadas)
4. [Estructura del Proyecto](#estructura-del-proyecto)
5. [Módulos del Sistema](#módulos-del-sistema)
6. [Base de Datos](#base-de-datos)
7. [Instalación y Configuración](#instalación-y-configuración)
8. [API Endpoints](#api-endpoints)
9. [Guías de Uso](#guías-de-uso)
10. [Seguridad](#seguridad)

---

## 📋 DESCRIPCIÓN GENERAL

Sistema ERP (Enterprise Resource Planning) completo desarrollado para la gestión integral de empresas manufactureras, con enfoque en:

- **Gestión de Clientes y CRM**
- **Cotizaciones y Ventas**
- **Facturación Electrónica (CFDI 4.0)**
- **Inventario y Almacenes**
- **Producción y Manufactura**
- **BOM (Bill of Materials)**
- **Control de Materias Primas**
- **Gestión de Usuarios y Roles**

### Empresas Soportadas
- **CALI** - Empresa de distribución
- **REMA** - Empresa de distribución
- **PTC** - Empresa de manufactura

---

## 🏗️ ARQUITECTURA DEL SISTEMA

### Arquitectura General
```
┌─────────────────┐
│   FRONTEND      │
│   React + Vite  │
│   Port: 5173    │
└────────┬────────┘
         │ HTTP/REST
         │ WebSocket
┌────────▼────────┐
│    BACKEND      │
│   Node.js +     │
│   Express       │
│   Port: 5000    │
└────────┬────────┘
         │ SQL
┌────────▼────────┐
│  SQL SERVER     │
│   Database      │
└────────┬────────┘
         │
┌────────▼────────┐
│   FACTURAMA     │
│   API (PAC)     │
└─────────────────┘
```

### Patrón de Diseño
- **Frontend**: Arquitectura de componentes con React
- **Backend**: API RESTful con patrón MVC
- **Comunicación en tiempo real**: WebSocket (Socket.IO)

---

## 💻 TECNOLOGÍAS UTILIZADAS

### Frontend
```json
{
  "framework": "React 19.2.0",
  "build": "Vite 8.0.0-beta.13",
  "routing": "React Router DOM 7.1.3",
  "styling": "Tailwind CSS 3.4.7",
  "http": "Axios 1.13.5",
  "icons": "React Icons 5.5.0",
  "realtime": "Socket.IO Client 4.8.3",
  "phone": "libphonenumber-js 1.12.36"
}
```

### Backend
```json
{
  "runtime": "Node.js",
  "framework": "Express 5.2.1",
  "database": "MSSQL 12.2.0",
  "auth": "JWT (jsonwebtoken 9.0.3)",
  "encryption": "bcrypt 6.0.0",
  "email": "Nodemailer 6.9.7",
  "files": "express-fileupload 1.5.1",
  "pdf": "pdf-parse 1.1.1",
  "excel": "xlsx 0.18.5",
  "xml": "xml2js 0.6.2",
  "realtime": "Socket.IO 4.8.3",
  "security": "Helmet 7.0.0, CORS 2.8.6"
}
```

### Base de Datos
- **SQL Server** (Microsoft SQL Server)

### Servicios Externos
- **Facturama** - PAC para facturación electrónica CFDI 4.0

---

## 📁 ESTRUCTURA DEL PROYECTO

```
ERP_PROYECTO/
├── backend/
│   ├── config/
│   │   └── db.js                    # Configuración de base de datos
│   ├── controllers/                 # Lógica de negocio
│   │   ├── authController.js
│   │   ├── clientController.js
│   │   ├── productoController.js
│   │   ├── ventaController.js
│   │   ├── facturaController.js
│   │   ├── cotizacionController.js
│   │   ├── crmController.js
│   │   ├── produccionController.js
│   │   ├── bomController.js
│   │   ├── materiaPrimaController.js
│   │   └── ... (20 controladores)
│   ├── middleware/
│   │   └── authMiddleware.js        # Autenticación JWT
│   ├── models/
│   │   └── userModel.js
│   ├── routes/                      # Rutas API
│   │   ├── auth.routes.js
│   │   ├── client.routes.js
│   │   ├── producto.routes.js
│   │   └── ... (20 archivos de rutas)
│   ├── services/
│   │   ├── emailService.js          # Envío de emails
│   │   └── facturamaService.js      # Integración Facturama
│   ├── sql/                         # Esquemas de base de datos
│   │   ├── manufactura_ptc_schema.sql
│   │   ├── crm_schema.sql
│   │   └── cotizaciones_schema.sql
│   ├── scripts/                     # Scripts de utilidad
│   ├── .env                         # Variables de entorno
│   ├── package.json
│   └── server.js                    # Punto de entrada
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/              # Componentes reutilizables
│   │   │   ├── Card.jsx
│   │   │   ├── Modal.jsx
│   │   │   ├── Notification.jsx
│   │   │   └── ...
│   │   ├── layouts/                 # Layouts de página
│   │   │   ├── AuthLayout.jsx
│   │   │   ├── DashboardLayout.jsx
│   │   │   └── ProtectedLayout.jsx
│   │   ├── pages/                   # Páginas de la aplicación
│   │   │   ├── auth/
│   │   │   ├── clients/
│   │   │   ├── productos/
│   │   │   ├── ventas/
│   │   │   ├── produccion/
│   │   │   ├── crm/
│   │   │   └── ...
│   │   ├── services/                # Servicios API
│   │   │   ├── api.js
│   │   │   ├── ventaService.js
│   │   │   ├── bomService.js
│   │   │   └── ...
│   │   ├── styles/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env                         # Variables de entorno
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.cjs
│
├── DOCUMENTACION_COMPLETA.md        # Este archivo
├── MODULO_BOM.md                    # Documentación BOM
├── MODULO_VENTAS.md                 # Documentación Ventas
├── GUIA_PRODUCCION.md               # Guía de Producción
├── CONSTANCIA_FISCAL.md             # Carga de constancias
├── start-backend.bat                # Script inicio backend
└── rebuild-frontend.bat             # Script build frontend
```

---

## 🧩 MÓDULOS DEL SISTEMA

### 1. 👤 AUTENTICACIÓN Y USUARIOS

#### Funcionalidades
- Login con JWT
- Recuperación de contraseña por email
- Gestión de usuarios
- Roles y permisos
- Multi-empresa (Company_Id)

#### Endpoints Principales
```
POST   /api/auth/login
POST   /api/auth/register
POST   /api/password/forgot
POST   /api/password/reset/:token
GET    /api/users
POST   /api/users
PUT    /api/users/:id
DELETE /api/users/:id
```

---

### 2. 👥 CLIENTES Y CRM

#### Funcionalidades
- Catálogo de clientes
- Direcciones múltiples por cliente
- Carga de constancia fiscal (XML/PDF)
- Gestión de oportunidades comerciales
- Pipeline de ventas (14 etapas)
- Actividades y seguimiento

#### Etapas del CRM
1. Prospección
2. Detección de necesidades
3. Solicitud de cotización
4. Costeo
5. Envío de cotización
6. Negociación
7. Confirmación de pedido
8. Planeación de producción
9. Producción
10. Control de calidad
11. Entrega
12. Facturación
13. Cobranza
14. Postventa

#### Endpoints Principales
```
GET    /api/clients
POST   /api/clients
PUT    /api/clients/:id
DELETE /api/clients/:id
POST   /api/constancia/parse
GET    /api/crm/oportunidades
POST   /api/crm/oportunidades
PUT    /api/crm/oportunidades/:id
```

---

### 3. 💰 COTIZACIONES

#### Funcionalidades
- Crear cotizaciones multi-producto
- Cálculo automático de costos y márgenes
- Estados: BORRADOR, ENVIADA, APROBADA, RECHAZADA, CONVERTIDA
- Conversión a pedido/venta
- Vigencia de cotización
- Productos de catálogo y PTC

#### Endpoints Principales
```
GET    /api/cotizaciones
POST   /api/cotizaciones
PUT    /api/cotizaciones/:id
DELETE /api/cotizaciones/:id
POST   /api/cotizaciones/:id/convertir
```

---

### 4. 🛒 VENTAS

#### Funcionalidades
- Crear ventas con múltiples productos
- Selector de clientes
- Búsqueda de productos
- Cálculo automático de IVA (16%)
- Estados: Pendiente, Completada, Facturada, Cancelada
- Integración con facturación

#### Flujo de Trabajo
```
1. Crear Venta (Pendiente)
2. Agregar Productos
3. Guardar Venta (Completada)
4. Facturar Venta (Facturada)
```

#### Endpoints Principales
```
GET    /api/ventas
POST   /api/ventas
GET    /api/ventas/:id
POST   /api/ventas/:id/productos
POST   /api/ventas/:id/facturar
PUT    /api/ventas/:id/cancelar
```

---

### 5. 📄 FACTURACIÓN ELECTRÓNICA (CFDI 4.0)

#### Funcionalidades
- Integración con Facturama (PAC)
- Generación de CFDI 4.0
- Catálogos SAT (productos, servicios, uso CFDI)
- Multi-emisor (CALI, REMA, PTC)
- Descarga de XML y PDF
- Envío por email

#### Configuración Facturama
```env
FACTURAMA_BASE_URL=https://apisandbox.facturama.mx
FACTURAMA_USER=usuario
FACTURAMA_PASSWORD=contraseña
```

#### Endpoints Principales
```
POST   /api/facturas
GET    /api/facturas/:id
GET    /api/facturas/:id/xml
GET    /api/facturas/:id/pdf
POST   /api/facturas/:id/email
DELETE /api/facturas/:id
GET    /api/sat/productos
GET    /api/sat/uso-cfdi
```

---

### 6. 📦 PRODUCTOS E INVENTARIO

#### Funcionalidades
- Catálogo de productos
- Múltiples almacenes
- Control de inventario por lote
- Movimientos de inventario
- Transferencias entre almacenes
- Importación masiva (Excel)
- Gestión de precios

#### Endpoints Principales
```
GET    /api/productos
POST   /api/productos
PUT    /api/productos/:id
DELETE /api/productos/:id
POST   /api/productos/importar
GET    /api/almacenes
GET    /api/inventario
POST   /api/inventario/movimiento
POST   /api/inventario/transferencia
```

---

### 7. 🏭 PRODUCCIÓN Y MANUFACTURA

#### Funcionalidades
- Órdenes de producción
- Estados: EN_ESPERA, EN_PROCESO, TERMINADA, CERRADA, CANCELADA
- Consumo de materiales (teórico vs real)
- Registro de merma
- Análisis de eficiencia
- Integración con BOM

#### Flujo de Producción
```
1. Crear Orden de Producción
2. Asignar BOM vigente
3. Calcular materiales necesarios
4. Cambiar a EN_PROCESO
5. Cambiar a TERMINADA
6. Cerrar orden (registrar consumos reales)
```

#### Endpoints Principales
```
GET    /api/produccion
POST   /api/produccion
GET    /api/produccion/:id
PUT    /api/produccion/:id/estado
POST   /api/produccion/:id/cerrar
```

---

### 8. 📋 BOM (BILL OF MATERIALS)

#### Funcionalidades
- Listas de materiales por producto
- Materiales con cantidades teóricas
- Operaciones y costos
- Versionamiento de BOM
- Clonación de BOM
- Cálculo de merma
- BOM vigente por producto

#### Estructura BOM
```
BOM
├── Información General
│   ├── Producto
│   ├── Código BOM
│   ├── Versión
│   └── Merma esperada
├── Materiales (obligatorio)
│   ├── Materia Prima
│   ├── Cantidad teórica
│   ├── Tipo componente
│   └── Merma específica
└── Operaciones (opcional)
    ├── Descripción
    ├── Tipo de costo
    ├── Minutos por unidad
    └── Costo por unidad
```

#### Endpoints Principales
```
GET    /api/bom
POST   /api/bom
GET    /api/bom/:id
PUT    /api/bom/:id
DELETE /api/bom/:id
POST   /api/bom/:id/clonar
```

---

### 9. 🧱 MATERIAS PRIMAS

#### Funcionalidades
- Catálogo de materias primas
- Tipos: PAPEL, ADHESIVO, REVENTA, OTRO
- Unidades de compra y consumo
- Factor de conversión
- Control de costos
- Gramaje (para papel)

#### Tipos de Unidades
```
Compra:    TONELADA, KILO, LITRO, PIEZA, ROLLO, CAJA
Consumo:   KG, GRAMO, LITRO, ML, PIEZA, METRO
```

#### Endpoints Principales
```
GET    /api/materias-primas
POST   /api/materias-primas
PUT    /api/materias-primas/:id
DELETE /api/materias-primas/:id
```

---

### 10. ⚙️ CONFIGURACIÓN

#### Funcionalidades
- Configuración de empresa
- Datos fiscales
- Lugares de expedición
- Configuración de costos PTC
- Reglas de margen
- Parámetros de producción

#### Endpoints Principales
```
GET    /api/config
PUT    /api/config
GET    /api/companies
POST   /api/companies
```

---

## 🗄️ BASE DE DATOS

### Tablas Principales

#### Autenticación y Usuarios
```sql
- ERP_USERS
- ERP_ROLES
- ERP_USER_ROLES
```

#### Clientes y CRM
```sql
- ERP_CLIENTS
- ERP_CLIENT_ADDRESSES
- ERP_CRM_ETAPA
- ERP_CRM_OPORTUNIDADES
- ERP_CRM_ACTIVIDADES
```

#### Ventas y Facturación
```sql
- ERP_VENTAS
- ERP_VENTA_DETALLE
- ERP_VENTA_STATUS
- ERP_FACTURAS
```

#### Cotizaciones
```sql
- ERP_COTIZACIONES
- ERP_COTIZACION_DETALLE
- ERP_COTIZACION_STATUS
```

#### Productos e Inventario
```sql
- ERP_PRODUCTOS
- ERP_ALMACENES
- ERP_INVENTARIO
- ERP_LOTES
- ERP_MOVIMIENTOS_INVENTARIO
```

#### Producción y Manufactura
```sql
- ERP_MATERIA_PRIMA
- ERP_BOM
- ERP_BOM_MATERIALES
- ERP_BOM_OPERACIONES
- ERP_OP_PRODUCCION
- ERP_OP_CONSUMO_MATERIAL
- ERP_OP_RESULTADO
- ERP_PRODUCTO_PTC
- ERP_CONFIG_COSTOS_PTC
```

#### Catálogos SAT
```sql
- ERP_SAT_PRODUCTOS_SERVICIOS
- ERP_SAT_USO_CFDI
- ERP_SAT_FORMA_PAGO
- ERP_SAT_METODO_PAGO
```

---

## 🚀 INSTALACIÓN Y CONFIGURACIÓN

### Requisitos Previos
- Node.js 18+ 
- SQL Server 2019+
- NPM o Yarn

### 1. Clonar Repositorio
```bash
cd C:\Users\Administrador\Desktop\ERP_PROYECTO
```

### 2. Configurar Base de Datos

Ejecutar scripts SQL en orden:
```sql
1. backend/sql/manufactura_ptc_schema.sql
2. backend/sql/crm_schema.sql
3. backend/sql/cotizaciones_schema.sql
```

### 3. Configurar Backend

#### Instalar dependencias
```bash
cd backend
npm install
```

#### Configurar .env
```env
# Base de datos
DB_SERVER=localhost
DB_DATABASE=ERP
DB_USER=sa
DB_PASSWORD=tu_password
DB_PORT=1433

# JWT
JWT_SECRET=tu_secret_key_segura

# Facturama
FACTURAMA_BASE_URL=https://apisandbox.facturama.mx
FACTURAMA_USER=usuario
FACTURAMA_PASSWORD=password

# Email
EMAIL_APROBACION_PRECIOS=email@ejemplo.com

# Puerto
PORT=5000
```

#### Iniciar backend
```bash
npm start
# o usar el script
start-backend.bat
```

### 4. Configurar Frontend

#### Instalar dependencias
```bash
cd frontend
npm install
```

#### Configurar .env
```env
# Desarrollo
VITE_USE_PROD=false
VITE_API_BASE_DEV=http://localhost:5000/api
VITE_API_URL=http://localhost:5000/api

# Producción
#VITE_USE_PROD=true
#VITE_API_BASE_PROD=https://qaerp.ardabytec.vip/api
#VITE_API_URL=https://qaerp.ardabytec.vip/api
```

#### Iniciar frontend
```bash
npm run dev
# o usar el script
rebuild-frontend.bat
```

### 5. Acceder al Sistema
```
URL: http://localhost:5173
Usuario: admin@ejemplo.com
Password: (configurar en base de datos)
```

---

## 📡 API ENDPOINTS

### Resumen de Endpoints por Módulo

#### Autenticación
```
POST   /api/auth/login
POST   /api/auth/register
POST   /api/password/forgot
POST   /api/password/reset/:token
```

#### Usuarios
```
GET    /api/users
POST   /api/users
PUT    /api/users/:id
DELETE /api/users/:id
```

#### Clientes
```
GET    /api/clients
POST   /api/clients
PUT    /api/clients/:id
DELETE /api/clients/:id
POST   /api/constancia/parse
```

#### CRM
```
GET    /api/crm/oportunidades
POST   /api/crm/oportunidades
PUT    /api/crm/oportunidades/:id
GET    /api/crm/etapas
POST   /api/crm/actividades
```

#### Cotizaciones
```
GET    /api/cotizaciones
POST   /api/cotizaciones
PUT    /api/cotizaciones/:id
DELETE /api/cotizaciones/:id
```

#### Ventas
```
GET    /api/ventas
POST   /api/ventas
GET    /api/ventas/:id
POST   /api/ventas/:id/productos
POST   /api/ventas/:id/facturar
```

#### Facturación
```
POST   /api/facturas
GET    /api/facturas/:id
GET    /api/facturas/:id/xml
GET    /api/facturas/:id/pdf
```

#### Productos
```
GET    /api/productos
POST   /api/productos
PUT    /api/productos/:id
DELETE /api/productos/:id
POST   /api/productos/importar
```

#### Inventario
```
GET    /api/inventario
POST   /api/inventario/movimiento
POST   /api/inventario/transferencia
GET    /api/almacenes
```

#### Producción
```
GET    /api/produccion
POST   /api/produccion
GET    /api/produccion/:id
PUT    /api/produccion/:id/estado
POST   /api/produccion/:id/cerrar
```

#### BOM
```
GET    /api/bom
POST   /api/bom
GET    /api/bom/:id
PUT    /api/bom/:id
DELETE /api/bom/:id
POST   /api/bom/:id/clonar
```

#### Materias Primas
```
GET    /api/materias-primas
POST   /api/materias-primas
PUT    /api/materias-primas/:id
DELETE /api/materias-primas/:id
```

---

## 📖 GUÍAS DE USO

### Flujo Completo: De Cotización a Factura

#### 1. Crear Cliente
```
Clientes → Nuevo Cliente
- Ingresar datos fiscales
- Opción: Cargar constancia fiscal (XML/PDF)
- Agregar direcciones
```

#### 2. Crear Oportunidad CRM
```
CRM → Nueva Oportunidad
- Seleccionar cliente
- Definir monto estimado
- Asignar etapa inicial
```

#### 3. Crear Cotización
```
Cotizaciones → Nueva Cotización
- Seleccionar cliente
- Agregar productos
- Sistema calcula costos y márgenes
- Guardar como BORRADOR
- Enviar al cliente (ENVIADA)
```

#### 4. Convertir a Venta
```
Cotizaciones → Ver Detalle → Convertir a Pedido
- Sistema crea venta automáticamente
- Estado: Completada
```

#### 5. Facturar Venta
```
Ventas → Ver Detalle → Facturar
- Configurar datos CFDI
- Uso CFDI, Forma Pago, Método Pago
- Sistema genera CFDI en Facturama
- Descarga XML/PDF
```

### Flujo de Producción

#### 1. Crear Materias Primas
```
Producción → Materias Primas → Nueva
- Código, Nombre, Tipo
- Unidades de compra/consumo
- Factor de conversión
- Costo unitario
```

#### 2. Crear BOM
```
Producción → BOM → Nuevo BOM
- Seleccionar producto
- Agregar materiales con cantidades
- Agregar operaciones (opcional)
- Guardar
```

#### 3. Crear Orden de Producción
```
Producción → Órdenes → Nueva Orden
- Seleccionar producto
- Cantidad planificada
- Sistema asigna BOM vigente
- Calcula materiales necesarios
```

#### 4. Procesar Orden
```
Estado: EN_ESPERA → EN_PROCESO → TERMINADA
```

#### 5. Cerrar Orden
```
Orden TERMINADA → Cerrar Orden
- Registrar consumos reales
- Piezas buenas y merma
- Sistema calcula eficiencia
```

---

## 🔒 SEGURIDAD

### Autenticación
- JWT (JSON Web Tokens)
- Tokens con expiración
- Refresh tokens

### Autorización
- Roles y permisos
- Middleware de autenticación
- Validación por Company_Id

### Protección de Datos
- Bcrypt para passwords
- Helmet.js para headers HTTP
- CORS configurado
- Validación de inputs
- SQL parametrizado (prevención SQL injection)

### Variables Sensibles
```
Nunca commitear:
- .env (backend y frontend)
- Credenciales de Facturama
- Secrets de JWT
- Passwords de base de datos
```

---

## 🔧 MANTENIMIENTO

### Logs
- Morgan para logs HTTP
- Console logs en desarrollo
- Logs de errores en producción

### Backups
- Backup diario de base de datos
- Versionamiento de código
- Carpetas de respaldo (ERP BACK V, ERP FRONT V)

### Actualizaciones
- Mantener dependencias actualizadas
- Revisar vulnerabilidades: `npm audit`
- Probar en ambiente de desarrollo

---

## 📞 SOPORTE Y CONTACTO

### Documentación Adicional
- `MODULO_BOM.md` - Documentación detallada de BOM
- `MODULO_VENTAS.md` - Documentación de ventas
- `GUIA_PRODUCCION.md` - Guía completa de producción
- `CONSTANCIA_FISCAL.md` - Carga de constancias

### Scripts de Utilidad
- `start-backend.bat` - Iniciar servidor backend
- `rebuild-frontend.bat` - Compilar frontend

---

## 📝 NOTAS FINALES

### Versiones del Sistema
- Backend: Versiones en `ERP BACK V/`
- Frontend: Versiones en `ERP FRONT V/`

### Ambientes
- **Desarrollo**: localhost:5173 (frontend) + localhost:5000 (backend)
- **Producción**: https://qaerp.ardabytec.vip

### Próximas Mejoras
- Dashboard con métricas
- Reportes avanzados
- Exportación a Excel/PDF
- Notificaciones push
- App móvil
- Integración con más PACs
- Módulo de compras
- Módulo de nómina

---

**Última actualización**: 2024
**Versión**: 1.3
