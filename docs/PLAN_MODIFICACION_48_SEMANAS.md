# Plan de Modificación ERP – 48 Semanas
**Fecha**: 23 de abril de 2026  
**Estado actual**: Express + React + MSSQL  
**Objetivo**: Implementar cronograma de 8 fases para ERP completo

---

## 📋 Resumen Ejecutivo

Tu stack actual (Express.js + React + MSSQL) es viable. El cronograma requiere:
- **Fases 0-1** (Semanas 1-8): Solidificar roles/permisos y catálogo con imágenes
- **Fases 2-8** (Semanas 9-48): Compras → Producción → Ventas → Timbrado → RH → Pulido

**Cambios recomendados**:
1. Migrar a **Prisma ORM** (actualmente usas mssql directo) → mejor control de datos
2. Implementar **autenticación JWT mejorada** con roles granulares
3. Agregar **almacenamiento de archivos en S3/MinIO** para documentos y fotos
4. Estructura clara de **modelos + servicios + controladores**

---

## 🔧 Estado Actual del Proyecto

### Backend
- **Framework**: Express.js 5.2.1
- **BD**: MSSQL (con driver `mssql`)
- **Auth**: JWT (jsonwebtoken)
- **Upload**: express-fileupload (local)
- **ORM**: Ninguno (queries directas)

### Rutas/Módulos Existentes
```
auth, password, users, roles, permissions, clients, companies, 
productos, almacenes, inventario, sat, precios, config, 
constancia, ventas, crm, facturas, cotizaciones, produccion, 
bom, materias-primas, client-pricing, reporteria, notas-credito, 
complementos-pago, rh (básico), accounting, compras
```

### Frontend
- **Framework**: React 19.2.0
- **Bundler**: Vite 8.0-beta
- **UI**: Tailwind CSS
- **Routing**: React Router 7.1.3

### Problemas a Resolver
- ❌ Sin ORM → queries manuales, sin migraciones claras
- ❌ Sin almacenamiento en nube → fotos/docs en local `/uploads`
- ❌ Modelos de datos no documentados
- ❌ Sin tests automáticos
- ❌ Sin CI/CD configurado

---

## 📅 Desglose Técnico por Fase

### **FASE 0 – Preparación y Núcleo (Semanas 1-2)**

**Objetivo**: Preparar infraestructura, roles y permisos granulares.

#### Tareas Backend:

1. **Migrar a Prisma ORM**
   - Instalar Prisma, crear `schema.prisma` con modelos iniciales
   - Tablas: `User`, `Role`, `Permission`, `Company`, `RolePermission`
   - Migrations automáticas en lugar de scripts SQL manuales
   - **Archivo**: `prisma/schema.prisma`

2. **Refactorizar autenticación JWT**
   - Mejorar `authMiddleware.js` para validar permisos por endpoint
   - Implementar **RBAC (Role-Based Access Control)**:
     - Tabla `permissions`: `{ id, resource, action }` (ej: `factura.crear`, `inventario.ver`)
     - Tabla `rolePermissions`: mapeo role → permissions
   - **Archivos**: `middleware/authMiddleware.js`, `middleware/checkPermission.js`

3. **Seeds iniciales**
   - Rol `Administrador` con permisos ilimitados
   - Roles: `Director`, `Timbrador`, `Comprador`, `Vendedor`, `Operario`
   - **Archivo**: `prisma/seeds.ts`

4. **Validación de datos**
   - Implementar `joi` o `zod` para esquemas de validación
   - **Archivo**: `validators/schemas.js`

#### Tareas Frontend:

1. **Estructura base de carpetas**
   ```
   src/
   ├── pages/          (Page components)
   ├── components/     (Reusable UI)
   ├── hooks/          (Custom React hooks)
   ├── services/       (API calls)
   ├── store/          (State management - Zustand o Context)
   ├── types/          (TypeScript types o JSDoc)
   └── utils/          (Helpers)
   ```

2. **Autenticación en frontend**
   - Almacenar JWT en `httpOnly` cookie (backend) o sessionStorage
   - Context para estado global de usuario/roles
   - **Archivos**: `src/context/AuthContext.jsx`, `src/hooks/useAuth.js`

3. **Rutas protegidas**
   - Componente `PrivateRoute.jsx` que verifica rol/permiso
   - Redirigir a login si no autenticado
   - **Archivo**: `src/components/PrivateRoute.jsx`

#### Hito de Fase 0:
✅ Usuario puede loguearse con rol específico  
✅ Middleware backend valida permisos por ruta  
✅ Frontend muestra menú según rol  

---

### **FASE 1 – Catálogo, Imágenes e Inventario (Semanas 3-8)**

**Objetivo**: Productos con fotos, inventario multialmacén, movimientos y lotes.

#### Tareas Backend:

1. **Modelos Prisma para Catálogo**
   ```prisma
   model Producto {
     id              Int       @id @default(autoincrement())
     codigo          String    @unique
     nombre          String
     descripcion     String?
     tipo            String    // "almacenable", "servicio", "consumible"
     unidad          String    // "pza", "kg", "m", etc
     costo           Decimal
     precioBase      Decimal
     activo          Boolean   @default(true)
     imagenes        Imagen[]
     variantes       Variante[]
     stockActual     StockActual[]
     createdAt       DateTime  @default(now())
     updatedAt       DateTime  @updatedAt
   }

   model Imagen {
     id              Int       @id @default(autoincrement())
     productId       Int
     url             String    // S3/MinIO URL
     alt             String?
     principal       Boolean   @default(false)
     createdAt       DateTime  @default(now())
   }

   model Almacen {
     id              Int       @id @default(autoincrement())
     nombre          String    @unique
     ubicacion       String?
     activo          Boolean   @default(true)
     stockActual     StockActual[]
     movimientos     MovimientoInventario[]
   }

   model Ubicacion {  // Pasillos, estantes, etc
     id              Int       @id @default(autoincrement())
     almacenId       Int
     codigo          String    // A-01-01 (pasillo-estante-nivel)
     descripcion     String?
     almacen         Almacen   @relation(fields: [almacenId], references: [id])
   }

   model StockActual {
     id              Int       @id @default(autoincrement())
     productId       Int
     almacenId       Int
     ubicacionId     Int?
     cantidad        Int
     reservado       Int       @default(0)
     disponible      Int       @updatedAt
     lotes           Lote[]
   }

   model Lote {
     id              Int       @id @default(autoincrement())
     numero          String    @unique
     productId       Int
     cantidad        Int
     fechaCaducidad  DateTime?
     numeroSerie     String?   // Para trazabilidad
     createdAt       DateTime  @default(now())
   }

   model MovimientoInventario {
     id              Int       @id @default(autoincrement())
     tipo            String    // "entrada", "salida", "transferencia"
     productId       Int
     almacenOrigen   Int?
     almacenDestino  Int?
     cantidad        Int
     loteId          Int?
     razon           String?   // "venta", "compra", "produccion", etc
     referencia      String?   // id de venta, compra, OF
     createdAt       DateTime  @default(now())
     usuario         String?
   }
   ```

2. **Controlador de Productos**
   - `POST /api/productos` → crear producto + cargar imágenes a S3
   - `GET /api/productos` → listar con filtros (nombre, tipo, almacén)
   - `PUT /api/productos/:id` → editar + actualizar imágenes
   - **Archivo**: `controllers/productoController.js`

3. **Controlador de Inventario**
   - `GET /api/inventario/stock` → stock actual por almacén + lotes + imagen miniatura
   - `POST /api/inventario/movimiento` → registrar entrada/salida/transferencia
   - `GET /api/inventario/movimientos` → historial de movimientos
   - `POST /api/inventario/conteo` → iniciar conteo física y ajustar stock
   - **Archivo**: `controllers/inventarioController.js`

4. **Integración S3/MinIO**
   - Servicio para subir fotos: `services/storageService.js`
   - Configuración en `.env`: `STORAGE_TYPE=s3`, `AWS_BUCKET`, `AWS_REGION`
   - Librería: `aws-sdk` o `minio`

#### Tareas Frontend:

1. **Página de Catálogo de Productos**
   - Grid o tabla con: código, nombre, **imagen principal**, precio, stock disponible
   - Filtros: nombre, tipo, almacén
   - Búsqueda por código de barras
   - **Archivo**: `src/pages/CatalogPage.jsx`

2. **Detalle de Producto**
   - **Galería de imágenes** (carousel o thumbnails)
   - Stock actual por almacén (tabla)
   - Histórico de movimientos (últimos 10)
   - Editar producto (form)
   - **Archivo**: `src/pages/ProductDetailPage.jsx`

3. **Dashboard "Almacén Virtual"**
   - Tabla: Producto | Almacén | A mano | Reservado | Disponible | Entrante | Saliente | Imagen
   - Filtros rápidos por almacén, estado de stock (bajo, óptimo, exceso)
   - Botones: "Hacer movimiento", "Conteo físico"
   - **Archivo**: `src/pages/AlmacenVirtualPage.jsx`

4. **Registro de Movimientos**
   - Modal/Form: Tipo movimiento | Producto | Almacén origen/destino | Cantidad | Lote | Motivo
   - Validar stock disponible antes de confirmar
   - **Archivo**: `src/components/MovimientoInventarioForm.jsx`

#### Hito de Fase 1:
✅ Veo catálogo con fotos de productos  
✅ Stock actualizado automáticamente al mover mercancía  
✅ Puedo rastrear lotes y números de serie  
✅ Dashboard "Almacén Virtual" operacional  

---

### **FASE 2 – Compras y Proveedores (Semanas 9-12)**

**Objetivo**: Gestión de proveedores, órdenes de compra, recepción.

#### Tareas Backend:

1. **Modelos Prisma**
   ```prisma
   model Proveedor {
     id              Int       @id @default(autoincrement())
     nombre          String
     rfc             String?
     email           String?
     telefono        String?
     direccion       String?
     ciudad          String?
     estado          String?
     cp              String?
     contactos       ContactoProveedor[]
     tarifas         TarifaProveedor[]
     ordenesCompra   OrdenCompra[]
     activo          Boolean   @default(true)
     createdAt       DateTime  @default(now())
   }

   model TarifaProveedor {
     id              Int       @id @default(autoincrement())
     proveedorId     Int
     productId       Int
     precioCompra    Decimal
     plazoEntrega    Int       // días
     cantidadMinima  Int?
     vigenciaDesde   DateTime
     vigenciaHasta   DateTime?
     proveedor       Proveedor @relation(fields: [proveedorId], references: [id])
   }

   model OrdenCompra {
     id              Int       @id @default(autoincrement())
     numero          String    @unique
     proveedorId     Int
     estado          String    // "borrador", "enviada", "parcialmente_recibida", "completada", "cancelada"
     fechaEmision    DateTime  @default(now())
     fechaEntregaEsperada DateTime?
     total           Decimal
     lineas          LineaOrdenCompra[]
     recepciones     RecepcionMercancia[]
     proveedor       Proveedor @relation(fields: [proveedorId], references: [id])
     createdAt       DateTime  @default(now())
     updatedAt       DateTime  @updatedAt
   }

   model LineaOrdenCompra {
     id              Int       @id @default(autoincrement())
     ordenCompraId   Int
     productId       Int
     cantidad        Int
     cantidadRecibida Int @default(0)
     precioUnitario  Decimal
     subtotal        Decimal
   }

   model RecepcionMercancia {
     id              Int       @id @default(autoincrement())
     ordenCompraId   Int
     numero          String    @unique
     fechaRecepcion  DateTime  @default(now())
     lineas          LineaRecepcion[]
     observaciones   String?
     createdAt       DateTime  @default(now())
   }

   model LineaRecepcion {
     id              Int       @id @default(autoincrement())
     recepcionId     Int
     lineaOrdenId    Int
     cantidadRecibida Int
     loteNumber      String?   // nuevo lote creado
     fechaCaducidad  DateTime?
   }
   ```

2. **Controlador de Compras**
   - `POST /api/compras/proveedores` → crear proveedor
   - `GET /api/compras/proveedores` → listar con tarifas agregadas
   - `GET /api/compras/comparador` → comparador de proveedores por producto
   - `POST /api/compras/ordenes` → crear orden de compra
   - `PUT /api/compras/ordenes/:id` → editar (solo si borrador)
   - `POST /api/compras/ordenes/:id/enviar` → cambiar estado a "enviada"
   - `POST /api/compras/recepcion` → registrar recepción + movimiento de inventario
   - **Archivo**: `controllers/comprasController.js`

3. **Notificaciones**
   - Tarea programada (cron) que verifica stock mínimo diariamente
   - Genera notificación interna si producto < stock mínimo
   - **Archivo**: `services/notificacionService.js`

4. **Validación de Permisos**
   - Rol `Comprador`: puede crear ordenes, recibir, ver proveedores
   - Rol `Administrador`: acceso completo

#### Tareas Frontend:

1. **Módulo de Proveedores**
   - Tabla: Nombre | RFC | Email | Teléfono | Acciones (ver, editar, eliminar)
   - Form crear/editar proveedor
   - **Archivo**: `src/pages/ProveedoresPage.jsx`

2. **Comparador de Proveedores**
   - Seleccionar producto → mostrar tabla de tarifas por proveedor
   - Columnas: Proveedor | Precio | Plazo | Cantidad mínima
   - Botón "Crear orden de compra" desde aquí
   - **Archivo**: `src/pages/ComparadorProveedoresPage.jsx`

3. **Órdenes de Compra**
   - Listar con filtros (estado, proveedor, fecha)
   - Crear nueva: seleccionar proveedor → agregar líneas (producto, cantidad, precio)
   - Cambiar estado: borrador → enviada → recibida
   - **Archivo**: `src/pages/OrdenesCompraPage.jsx`

4. **Recepción de Mercancía**
   - Listar órdenes pendientes de recepción
   - Registrar recepción línea por línea
   - Asignar lotes y fechas de caducidad
   - Al confirmar → actualizar stock en inventario
   - **Archivo**: `src/pages/RecepcionMercanciaPage.jsx`

#### Hito de Fase 2:
✅ Comprador crea orden de compra y la envía  
✅ Recibe mercancía y stock se actualiza automáticamente  
✅ Puede ver tarifas de múltiples proveedores  
✅ Notificación cuando producto está bajo stock mínimo  

---

### **FASE 3 – Producción Industrial (Semanas 13-18)**

**Objetivo**: BOM, órdenes de fabricación, costo real, mano de obra.

#### Tareas Backend:

1. **Modelos Prisma**
   ```prisma
   model BOM {  // Lista de Materiales
     id              Int       @id @default(autoincrement())
     productId       Int       // producto terminado
     numero          String    @unique
     version         Int       @default(1)
     activo          Boolean   @default(true)
     lineas          LineaBOM[]
     createdAt       DateTime  @default(now())
     updatedAt       DateTime  @updatedAt
   }

   model LineaBOM {
     id              Int       @id @default(autoincrement())
     bomId           Int
     componenteId    Int       // producto componente
     cantidad        Decimal   // cantidad del componente
     secuencia       Int       // orden de ensamble
     merma           Decimal   @default(0)  // % de pérdida en fabricación
   }

   model CentroTrabajo {
     id              Int       @id @default(autoincrement())
     nombre          String    @unique
     tipo            String    // "mecanizado", "ensamble", "pintura", etc
     capacidadHora   Decimal   // unidades/hora
     costoHora       Decimal
     calendario      CalendarioCentro[]
     operarios       Operario[]
     rutasAprobadas  Ruta[]
   }

   model Ruta {  // Ruta de fabricación (secuencia de centros)
     id              Int       @id @default(autoincrement())
     productId       Int
     numero          String    @unique
     version         Int       @default(1)
     pasos           PasoRuta[]
     activo          Boolean   @default(true)
   }

   model PasoRuta {
     id              Int       @id @default(autoincrement())
     rutaId          Int
     centroTrabajoId Int
     secuencia       Int
     tiempoEstándar  Decimal   // minutos
     descripcion     String?
   }

   model OrdenFabricacion {
     id              Int       @id @default(autoincrement())
     numero          String    @unique
     productId       Int
     cantidad        Decimal
     fechaInicio     DateTime?
     fechaFin        DateTime?
     estado          String    // "planeada", "en_progreso", "completada", "cancelada"
     costo           CostoOrdenFabricacion?
     consumos        ConsumoMaterial[]
     horasMO         HoraManoObra[]
     createdAt       DateTime  @default(now())
     updatedAt       DateTime  @updatedAt
   }

   model ConsumoMaterial {
     id              Int       @id @default(autoincrement())
     ordenFabId      Int
     productId       Int
     cantidadEstandar Decimal
     cantidadReal    Decimal
     loteId          Int?
     fechaConsumption DateTime @default(now())
   }

   model HoraManoObra {
     id              Int       @id @default(autoincrement())
     ordenFabId      Int
     operarioId      Int
     centroTrabajoId Int
     horas           Decimal
     costoPorHora    Decimal
     fecha           DateTime
     observaciones   String?
   }

   model CostoOrdenFabricacion {
     id              Int       @id @default(autoincrement())
     ordenFabId      Int
     costoMaterialEstandar  Decimal
     costoMaterialReal      Decimal
     costoManoObraEstandar  Decimal
     costoManoObraReal      Decimal
     costoTotal             Decimal
     margenMO               Decimal  // % variación
     margenMaterial         Decimal
   }
   ```

2. **Controlador de Producción**
   - `POST /api/produccion/bom` → crear BOM multinivel
   - `GET /api/produccion/bom/:productId` → obtener BOM activo
   - `POST /api/produccion/ordenes` → crear OF desde BOM
   - `PUT /api/produccion/ordenes/:id` → cambiar estado
   - `POST /api/produccion/ordenes/:id/consumir-material` → descontar inventario
   - `POST /api/produccion/ordenes/:id/registrar-mano-obra` → registrar horas
   - `GET /api/produccion/ordenes/:id/costos` → obtener costos reales
   - **Archivo**: `controllers/produccionController.js`

3. **Cálculo de Costos**
   - Servicio que calcula costo real vs. estándar
   - Real = materiales consumidos + horas MO * tarifa
   - Estándar = BOM * costo unitario + ruta * costo hora
   - **Archivo**: `services/costeoService.js`

4. **Planificador (MVP)**
   - Endpoint: `GET /api/produccion/planificador` → visualizar carga de centros
   - Tabla: Centro trabajo | Capacidad | Carga actual | Disponible

#### Tareas Frontend:

1. **Gestión de BOM**
   - Crear BOM: seleccionar producto terminado → agregar componentes (cantidad, merma)
   - Vista en árbol de componentes multinivel
   - Versionado (BOM v1, v2, etc)
   - **Archivo**: `src/pages/GestionBOMPage.jsx`

2. **Órdenes de Fabricación**
   - Crear OF: seleccionar producto + cantidad → genera automáticamente lineas de consumo de BOM
   - Estados: planeada → en_progreso → completada
   - Consumir materiales manualmente (si no es automático)
   - Registrar horas de MO por operario/centro
   - **Archivo**: `src/pages/OrdenesTransformacionPage.jsx`

3. **Dashboard de Costos**
   - Tabla: OF | Producto | Costo Estándar | Costo Real | Varianza | %
   - Gráfico: comparativa estándar vs. real
   - **Archivo**: `src/pages/AnalisisCostosPage.jsx`

4. **Planificador Visual**
   - Gantt o timeline de centros de trabajo
   - Mostrar carga de cada centro
   - **Archivo**: `src/pages/PlanificadorPage.jsx`

#### Hito de Fase 3:
✅ Crear BOM y OF para fabricar producto  
✅ Stock se descuenta automáticamente al consumir  
✅ Registrar horas de mano de obra en OF  
✅ Ver costo real vs. estándar con varianzas  

---

### **FASE 4 – Tareas, Procesos y Hojas de Tiempo (Semanas 19-24)**

**Objetivo**: Gestión operativa interna, registro de horas en tareas y OF.

#### Tareas Backend:

1. **Modelos Prisma**
   ```prisma
   model Proyecto {
     id              Int       @id @default(autoincrement())
     nombre          String
     descripcion     String?
     tareas          Tarea[]
     estado          String    // "activo", "pausado", "completado"
     activo          Boolean   @default(true)
     createdAt       DateTime  @default(now())
   }

   model Tarea {
     id              Int       @id @default(autoincrement())
     titulo          String
     descripcion     String?
     proyectoId      Int?
     asignadoA       Int       // userId
     estado          String    // "por_hacer", "en_progreso", "revision", "hecho"
     prioridad       String    // "baja", "media", "alta"
     fechaLimite     DateTime?
     horasTrabajadas Decimal   @default(0)
     hojasTiempo     HojaTiempo[]
     createdAt       DateTime  @default(now())
     updatedAt       DateTime  @updatedAt
   }

   model HojaTiempo {
     id              Int       @id @default(autoincrement())
     usuarioId       Int
     fecha           DateTime
     tipo            String    // "tarea", "orden_fabricacion"
     tareaId         Int?
     ordenFabId      Int?
     horas           Decimal
     descripcion     String?
     estado          String    // "pendiente_validacion", "validada", "rechazada"
     validadoPor     Int?      // supervisorId
     validadoEn      DateTime?
     observaciones   String?
     createdAt       DateTime  @default(now())
   }

   model NotificacionTarea {
     id              Int       @id @default(autoincrement())
     usuarioId       Int
     tareaId         Int
     tipo            String    // "asignada", "comentario", "vencimiento"
     leida           Boolean   @default(false)
     createdAt       DateTime  @default(now())
   }
   ```

2. **Controlador de Tareas**
   - `POST /api/tareas` → crear tarea (con o sin proyecto)
   - `GET /api/tareas` → listar (filtro: usuario, estado, proyecto)
   - `PUT /api/tareas/:id` → editar estado, asignar, etc
   - `DELETE /api/tareas/:id` → eliminar
   - **Archivo**: `controllers/tareasController.js`

3. **Controlador de Hojas de Tiempo**
   - `POST /api/hojas-tiempo` → registrar horas en tarea u OF
   - `GET /api/hojas-tiempo` → listar (filtro: usuario, rango fechas, estado)
   - `PUT /api/hojas-tiempo/:id` → validar (supervisor)
   - `GET /api/reporteria/horas` → reporte consolidado
   - **Archivo**: `controllers/hojaTiempoController.js`

4. **Validación de Permisos**
   - Usuario registra sus propias horas
   - Supervisor (gerente/jefe) valida horas de su equipo
   - Admin puede ver todas

#### Tareas Frontend:

1. **Tablero Kanban de Tareas**
   - 4 columnas: Por hacer | En progreso | Revisión | Hecho
   - Drag & drop entre columnas
   - Cards: título, asignado, plazo, prioridad, horas acumuladas
   - Filtro: asignadoA mí, proyecto, prioridad
   - **Archivo**: `src/pages/TareasKanbanPage.jsx`

2. **Vista de Lista de Tareas**
   - Tabla: Título | Asignado | Estado | Plazo | Horas | Acciones
   - Crear/editar tarea desde modal
   - **Archivo**: `src/pages/TareasListPage.jsx`

3. **Registro de Horas**
   - Formulario: Seleccionar tarea/OF → Fecha → Horas → Descripción → Guardar
   - Validación: no permite duplicados en la misma fecha/tarea
   - **Archivo**: `src/components/RegistroHorasForm.jsx`

4. **Reporte de Horas**
   - Tabla: Empleado | Semana | Horas Tarea | Horas OF | Total | Estado validación
   - Filtros: usuario, rango fechas, proyecto
   - Estado visual de validación (pendiente/validada/rechazada)
   - **Archivo**: `src/pages/ReporteHorasPage.jsx`

#### Hito de Fase 4:
✅ Crear tareas y organizarlas en Kanban  
✅ Registrar horas en tareas y OF  
✅ Supervisor valida horas del equipo  
✅ Reporte consolidado de horas por empleado/tarea  

---

### **FASE 5 – Ventas, Facturación y Control de Costos (Semanas 25-32)**

**Objetivo**: Ciclo completo: cliente → propuesta → pedido → factura → cobro + aviso vencimiento.

#### Tareas Backend:

1. **Modelos Prisma (ampliación)**
   ```prisma
   model Cliente {
     id              Int       @id @default(autoincrement())
     nombre          String
     rfc             String?   @unique
     email           String?
     telefono        String?
     direccion       String?
     ciudad          String?
     estado          String?
     cp              String?
     documentosCSF   DocumentoCliente[]
     propuestas      Propuesta[]
     pedidos         PedidoVenta[]
     facturas        Factura[]
     activo          Boolean   @default(true)
     createdAt       DateTime  @default(now())
   }

   model DocumentoCliente {
     id              Int       @id @default(autoincrement())
     clienteId       Int
     tipo            String    // "CSF", "INE", "CURP", "RFC", "contrato"
     archivo         String    // S3 URL
     fechaExpiracion DateTime?
     createdAt       DateTime  @default(now())
   }

   model Propuesta {
     id              Int       @id @default(autoincrement())
     numero          String    @unique
     clienteId       Int
     vendedorId      Int
     estado          String    // "borrador", "enviada", "aceptada", "rechazada"
     fechaEmision    DateTime  @default(now())
     fechaVencimiento DateTime?
     total           Decimal
     lineas          LineaPropuesta[]
     emailEnvios     EmailEnvio[]  // historial de envíos
     pedido          PedidoVenta?  // conversión a pedido
     createdAt       DateTime  @default(now())
     updatedAt       DateTime  @updatedAt
   }

   model LineaPropuesta {
     id              Int       @id @default(autoincrement())
     propuestaId     Int
     productId       Int
     cantidad        Decimal
     precioUnitario  Decimal
     descuento       Decimal   @default(0)
     subtotal        Decimal
   }

   model PedidoVenta {
     id              Int       @id @default(autoincrement())
     numero          String    @unique
     propuestaId     Int?
     clienteId       Int
     vendedorId      Int
     estado          String    // "borrador", "confirmado", "parcialmente_entregado", "completado", "cancelado"
     fechaEmision    DateTime  @default(now())
     fechaEntregaEsperada DateTime?
     total           Decimal
     lineas          LineaPedido[]
     factura         Factura?
     movimientos     MovimientoInventario[]  // link a inventario
     createdAt       DateTime  @default(now())
     updatedAt       DateTime  @updatedAt
   }

   model LineaPedido {
     id              Int       @id @default(autoincrement())
     pedidoId        Int
     productId       Int
     cantidad        Decimal
     cantidadEntregada Decimal @default(0)
     precioUnitario  Decimal
     costo           Decimal   // costo del producto
     descuento       Decimal   @default(0)
     subtotal        Decimal
   }

   model Factura {
     id              Int       @id @default(autoincrement())
     numero          String    @unique
     folio           Int?
     serieCSV        String?   // para SAT
     pedidoId        Int?
     clienteId       Int
     vendedorId      Int
     estado          String    // "borrador", "emitida", "pagada", "vencida", "cancelada"
     fechaEmision    DateTime  @default(now())
     fechaVencimiento DateTime?
     fechaPago       DateTime?
     total           Decimal
     lineas          LineaFactura[]
     timbrado        TimbradoFiscal?
     pagos           Pago[]
     notificaciones  NotificacionFactura[]
     createdAt       DateTime  @default(now())
     updatedAt       DateTime  @updatedAt
   }

   model LineaFactura {
     id              Int       @id @default(autoincrement())
     facturaId       Int
     productId       Int
     cantidad        Decimal
     precioUnitario  Decimal
     costo           Decimal   // costo de COGS
     descuento       Decimal   @default(0)
     subtotal        Decimal
   }

   model Pago {
     id              Int       @id @default(autoincrement())
     facturaId       Int
     monto           Decimal
     fecha           DateTime  @default(now())
     metodo          String    // "transferencia", "cheque", "efectivo", "tarjeta"
     referencia      String?
   }

   model NotificacionFactura {
     id              Int       @id @default(autoincrement())
     facturaId       Int
     tipo            String    // "emitida", "vencimiento", "pagada"
     enviada         Boolean   @default(false)
     fechaEnvio      DateTime?
     createdAt       DateTime  @default(now())
   }

   model EmailEnvio {
     id              Int       @id @default(autoincrement())
     propuestaId     Int?
     facturaId       Int?
     destinatario    String
     asunto          String
     cuerpo          String
     enviado         Boolean   @default(false)
     fechaEnvio      DateTime?
     respuesta       String?
     createdAt       DateTime  @default(now())
   }

   model ControlarCostos {  // Vista consolidada de márgenes
     id              Int       @id @default(autoincrement())
     facturaId       Int
     costoTotal      Decimal   // suma de costo de líneas
     ingresoTotal    Decimal   // total factura
     margenBruto     Decimal   // ingreso - costo
     margenPorcentaje Decimal  // (margen / ingreso) * 100
   }
   ```

2. **Controlador de Clientes**
   - `POST /api/clientes` → crear cliente
   - `GET /api/clientes` → listar
   - `PUT /api/clientes/:id` → editar
   - `POST /api/clientes/:id/documentos` → cargar documento (CSF, INE) → S3
   - **Archivo**: `controllers/clienteController.js`

3. **Controlador de Ventas**
   - `POST /api/ventas/propuestas` → crear propuesta
   - `PUT /api/ventas/propuestas/:id` → editar
   - `POST /api/ventas/propuestas/:id/enviar-email` → enviar propuesta por email (plantilla HTML)
   - `PUT /api/ventas/propuestas/:id/aceptar` → cambiar a "aceptada" + crear pedido
   - `POST /api/ventas/pedidos` → crear pedido (manual o desde propuesta)
   - `POST /api/ventas/factura` → crear factura desde pedido (o manual)
   - `GET /api/ventas/facturas` → listar con filtros
   - `GET /api/ventas/facturas/:id/costos` → obtener margen bruto
   - **Archivo**: `controllers/ventasController.js`

4. **Servicio de Email**
   - Plantillas HTML para propuestas y facturas
   - Usar `nodemailer`
   - **Archivo**: `services/emailService.js`

5. **Tarea Programada (Cron)**
   - Diariamente: buscar facturas con vencimiento hoy/mañana
   - Si no está pagada → crear notificación + enviar email al cliente
   - Si vencida → cambiar estado a "vencida"
   - **Archivo**: `services/tareaVencimientosService.js`

6. **Reportes**
   - `GET /api/reporteria/ventas` → ventas por período, vendedor, cliente
   - `GET /api/reporteria/margenes` → margen bruto por factura/vendedor/cliente
   - `GET /api/reporteria/cuentas-por-cobrar` → facturas impagadas con vencimiento
   - **Archivo**: `controllers/reporteriaController.js`

#### Tareas Frontend:

1. **Gestión de Clientes**
   - Tabla: Nombre | RFC | Email | Teléfono | Documentos | Acciones
   - Modal crear/editar cliente
   - Subida de documentos CSF, INE (drag & drop)
   - **Archivo**: `src/pages/ClientesPage.jsx`

2. **Propuestas Comerciales**
   - Crear propuesta: seleccionar cliente + agregar líneas (producto, cantidad, precio)
   - Vista previa: total con impuestos
   - Botón "Enviar por email": modal con destinatario personalizado
   - Historial de envíos
   - Cambiar estado: aceptada → crea automáticamente pedido
   - **Archivo**: `src/pages/PropuestasPage.jsx`

3. **Pedidos de Venta**
   - Listar pedidos (filtro: estado, vendedor, cliente)
   - Crear pedido: manual o desde propuesta aceptada
   - Cambiar estado: confirmado → entregado
   - Botón "Crear factura"
   - **Archivo**: `src/pages/PedidosVentaPage.jsx`

4. **Facturación**
   - Listar facturas (filtro: estado, rango fechas, vendedor)
   - Crear factura desde pedido o manual
   - Estados: borrador → emitida → pagada
   - Registrar pagos (monto, fecha, método)
   - Visualización de aviso de vencimiento (rojo si vencida)
   - Descarga de PDF
   - **Archivo**: `src/pages/FacturacionPage.jsx`

5. **Dashboard de Costos y Márgenes**
   - Tabla: Factura | Cliente | Total | Costo | Margen | %
   - Filtro por período, vendedor
   - Gráfico de margen bruto por vendedor
   - **Archivo**: `src/pages/AnalisisMargensPage.jsx`

6. **Reporte de Cuentas por Cobrar**
   - Tabla: Factura | Cliente | Monto | Vencimiento | Días vencida | Estado
   - Alertas visuales (amarillo: próximo a vencer, rojo: vencida)
   - Exportar a Excel
   - **Archivo**: `src/pages/CuentasPorCobrarPage.jsx`

#### Hito de Fase 5:
✅ Envío de propuesta por email con plantilla personalizada  
✅ Conversión automática propuesta aceptada → pedido  
✅ Facturación con control de costos y margen bruto visible  
✅ Notificaciones automáticas de vencimiento  
✅ Reporte de cuentas por cobrar  

---

### **FASE 6 – Timbrado Fiscal (México) (Semanas 33-36)**

**Objetivo**: Integración con PAC, CFDI, complementos de pago.

#### Tareas Backend:

1. **Modelo Prisma**
   ```prisma
   model TimbradoFiscal {
     id              Int       @id @default(autoincrement())
     facturaId       Int       @unique
     uuid            String?   // folio fiscal
     estado          String    // "pendiente_timbrado", "timbrada", "cancelada"
     xmlSellado      String?   // S3 URL
     pdfSellado      String?   // S3 URL
     respuestaPAC    String?   // JSON de respuesta del PAC
     timbradorId     Int       // userId del rol Timbrador
     fechaTimbrado   DateTime?
     motivoCancelacion String?
     createdAt       DateTime  @default(now())
     updatedAt       DateTime  @updatedAt
   }

   model ComplementoPago {
     id              Int       @id @default(autoincrement())
     numero          String    @unique
     facturaId       Int
     monto           Decimal
     fechaPago       DateTime
     metodoPago      String    // "03" = transferencia, "01" = efectivo, etc
     numOperacion    String?
     estado          String    // "pendiente_timbrado", "timbrada", "cancelada"
     xmlSellado      String?
     pdfSellado      String?
     timbradorId     Int
     fechaTimbrado   DateTime?
     createdAt       DateTime  @default(now())
   }

   model BitacoraFiscal {
     id              Int       @id @default(autoincrement())
     documento       String    // "factura", "complemento", "cancelacion"
     documentoId     Int
     accion          String    // "timbrado", "cancelado", "error"
     detalleError    String?
     respuestaPAC    String?
     timbradorId     Int
     createdAt       DateTime  @default(now())
   }
   ```

2. **Servicio de Integración PAC**
   - Soportar múltiples PAC: Facturama, Finkok, SW Sapien (vía API keys en `.env`)
   - Función: generar XML de factura → enviar a PAC → recibir XML + PDF sellados
   - Almacenar en S3
   - **Archivo**: `services/pacIntegrationService.js`

3. **Controlador de Timbrado**
   - `POST /api/timbrado/facturas/:id/timbrar` → validar datos, enviar a PAC
   - `GET /api/timbrado/facturas/:id/status` → obtener estado
   - `POST /api/timbrado/complementos` → timbrar complemento de pago
   - `POST /api/timbrado/facturas/:id/cancelar` → cancelar CFDI en SAT (requiere API SAT)
   - `GET /api/timbrado/bitacora` → historial de operaciones
   - **Archivo**: `controllers/timbradoController.js`

4. **Validación de Permisos**
   - Solo roles `Timbrador 1` y `Timbrador 2` pueden timbrar
   - Timbrador 1: facturas + complementos pago
   - Timbrador 2: nóminas + complementos
   - Log de quién timbró qué y cuándo

#### Tareas Frontend:

1. **Panel de Timbrado**
   - Listar facturas sin timbrar
   - Botón "Timbrar": validar datos → enviar a PAC (llamada async)
   - Spinner durante timbrado
   - Resultado: mostrar UUID, links para descargar XML y PDF
   - **Archivo**: `src/pages/PanelTimbradoPage.jsx`

2. **Complementos de Pago**
   - Crear complemento: seleccionar factura + ingresar datos pago
   - Timbrar complemento
   - **Archivo**: `src/pages/ComplementosPagoPage.jsx`

3. **Bitácora Fiscal**
   - Tabla: Documento | Acción | Resultado | Timbrador | Fecha
   - Filtros: tipo documento, período, usuario
   - Descargar bitácora en Excel
   - **Archivo**: `src/pages/BitacoraFiscalPage.jsx`

#### Hito de Fase 6:
✅ Timbrar facturas vía PAC (Facturama/Finkok/SW)  
✅ Descargar XML y PDF sellados  
✅ Registro de operaciones en bitácora  
✅ Complementos de pago timbrados  

---

### **FASE 7 – Recursos Humanos Base (Semanas 37-42)**

**Objetivo**: Empleados, documentos, ausencias, base para nómina.

#### Tareas Backend:

1. **Modelos Prisma**
   ```prisma
   model Empleado {
     id              Int       @id @default(autoincrement())
     usuarioId       Int       @unique
     numeroEmpleado  String    @unique
     rfc             String?   @unique
     curp            String?   @unique
     email           String?
     telefono        String?
     direccion       String?
     ciudad          String?
     estado          String?
     cp              String?
     puesto          String
     departamento    String
     salarioBruto    Decimal
     fechaIngreso    DateTime
     fechaBaja       DateTime?
     estatus         String    // "activo", "baja_temporal", "despedido"
     documentos      DocumentoEmpleado[]
     ausencias       Ausencia[]
     vacaciones      Vacacion[]
     createdAt       DateTime  @default(now())
     updatedAt       DateTime  @updatedAt
   }

   model DocumentoEmpleado {
     id              Int       @id @default(autoincrement())
     empleadoId      Int
     tipo            String    // "contrato", "INE", "RFC", "CURP", "diploma", etc
     archivo         String    // S3 URL
     fechaExpiracion DateTime?
     createdAt       DateTime  @default(now())
   }

   model Ausencia {
     id              Int       @id @default(autoincrement())
     empleadoId      Int
     tipo            String    // "falta", "permiso", "incapacidad"
     fechaInicio     DateTime
     fechaFin        DateTime
     motivo          String?
     estado          String    // "pendiente", "aprobada", "rechazada"
     createdAt       DateTime  @default(now())
   }

   model Vacacion {
     id              Int       @id @default(autoincrement())
     empleadoId      Int
     año             Int
     diasDisponibles Int
     diasUsados      Int       @default(0)
     diasRestantes   Int
     periodos        PeriodoVacacion[]
   }

   model PeriodoVacacion {
     id              Int       @id @default(autoincrement())
     vacacionId      Int
     fechaInicio     DateTime
     fechaFin        DateTime
     estado          String    // "solicitada", "aprobada", "disfrutada"
   }
   ```

2. **Controlador de RH**
   - `POST /api/rh/empleados` → crear empleado + usuario asociado
   - `GET /api/rh/empleados` → listar
   - `PUT /api/rh/empleados/:id` → editar
   - `POST /api/rh/empleados/:id/documentos` → subir documentos
   - `POST /api/rh/ausencias` → registrar ausencia
   - `GET /api/rh/ausencias` → listar (filtro: periodo, empleado)
   - `POST /api/rh/vacaciones` → solicitar vacaciones
   - **Archivo**: `controllers/rhController.js`

3. **Reportes RH**
   - Plantilla de empleados (nombre, puesto, salario, antigüedad)
   - Ausencias por período
   - Vacaciones pendientes

#### Tareas Frontend:

1. **Gestión de Empleados**
   - Tabla: Número empleado | Nombre | RFC | Puesto | Departamento | Salario | Estado | Acciones
   - Crear/editar empleado
   - Subida de documentos (contrato, INE, RFC, etc.)
   - **Archivo**: `src/pages/EmpleadosPage.jsx`

2. **Registro de Ausencias**
   - Formulario: Empleado | Tipo | Fechas | Motivo
   - Validación: no permitir ausencias en domingos/festivos
   - Estados: pendiente → aprobada
   - **Archivo**: `src/pages/AusenciasPage.jsx`

3. **Solicitud de Vacaciones**
   - Mostrar días disponibles por empleado
   - Solicitar período de vacaciones
   - Historial de vacaciones disfrutadas
   - **Archivo**: `src/pages/VacacionesPage.jsx`

4. **Reporte de Plantilla**
   - Tabla: Empleado | RFC | Puesto | Salario | Antigüedad | Estado
   - Exportar a Excel
   - **Archivo**: `src/pages/ReportePlantillaPage.jsx`

#### Hito de Fase 7:
✅ Crear ficha de empleado con documentos  
✅ Registrar ausencias y vacaciones  
✅ Reporte de plantilla y antigüedad  
✅ Base lista para nómina (en siguiente fase)  

---

### **FASE 8 – Pulido, Reportes y MVP Completo (Semanas 43-48)**

**Objetivo**: Dashboards ejecutivos, reportes integrados, optimización, deploy.

#### Tareas Backend:

1. **Dashboard Ejecutivo**
   - Endpoint: `GET /api/dashboard/ejecutivo` → métricas principales
   - KPIs: ingresos MES, costos MES, margen, órdenes pendientes, facturas sin pagar, inventario valorizado
   - **Archivo**: `controllers/dashboardController.js`

2. **Reportes Integrados**
   - Inventario valorizado (stock * costo promedio)
   - Compras por proveedor (período, cantidad, monto)
   - Eficiencia de producción (tiempo real vs. estándar)
   - Horas trabajadas por proyecto/proceso
   - Ventas por período/vendedor/cliente
   - Análisis de márgenes
   - Cuentas por cobrar con vencimientos
   - **Archivo**: `controllers/reporteriaController.js` (ampliación)

3. **Optimizaciones**
   - Índices en BD (productId, clienteId, fechaEmision, estado)
   - Caché con Redis para reportes pesados
   - Paginación en listados
   - Queries optimizadas en Prisma

4. **Tests Automáticos**
   - Tests unitarios: servicios críticos (costeo, cálculos)
   - Tests de integración: flujo de compra → producción → venta
   - Librería: Jest

5. **Documentación**
   - README con setup, variables env, estructura
   - Swagger/OpenAPI para API
   - Guía de usuario para cada módulo

6. **Dockerización**
   - `Dockerfile` para backend
   - `docker-compose.yml`: backend + BD + frontend
   - Scripts de deploy

#### Tareas Frontend:

1. **Dashboard Ejecutivo**
   - Cards KPI: Ingresos, Costos, Margen, Órdenes pendientes, Facturas vencidas, Stock valorizado
   - Gráficos: Ventas por mes, Margen por vendedor, Top 5 productos
   - **Archivo**: `src/pages/DashboardEjecutivoPage.jsx`

2. **Reportes**
   - Módulo de reportería integrada
   - Filtros: período, entidad (vendedor/proveedor/proyecto)
   - Descarga en Excel/PDF
   - **Archivo**: `src/pages/ReportesPage.jsx`

3. **Optimizaciones**
   - Lazy loading de componentes
   - Memoización de cálculos pesados
   - Optimización de bundle (tree-shaking)

4. **Tests**
   - Tests de componentes principales
   - Librería: Vitest + React Testing Library

#### Hito de Fase 8:
✅ Dashboard ejecutivo operacional  
✅ Todos los reportes integrados y exportables  
✅ Sistema en Docker, listo para deploy  
✅ Tests automatizados funcionando  
✅ MVP 100% completo en producción  

---

## 📊 Cronograma Visual

| Semana | Fase | Componente Principal | Estado |
|--------|------|----------------------|--------|
| 1-2    | 0    | Roles, Autenticación | 🚀 Inicio |
| 3-8    | 1    | Catálogo + Inventario | 📦 Diseño |
| 9-12   | 2    | Compras + Proveedores | 📋 Diseño |
| 13-18  | 3    | Producción + BOM | 🔧 Diseño |
| 19-24  | 4    | Tareas + Hojas de tiempo | 📌 Diseño |
| 25-32  | 5    | Ventas + Facturación | 💰 Diseño |
| 33-36  | 6    | Timbrado fiscal | 🎫 Diseño |
| 37-42  | 7    | RH Base | 👥 Diseño |
| 43-48  | 8    | Dashboards + Deploy | 📊 Diseño |

---

## ✅ Próximos Pasos

1. **Validar el stack**: ¿Migramos Express a NestJS o continuamos con Express?
2. **Elegir ORM**: ¿Prisma o mantener mssql directo?
3. **Almacenamiento**: ¿S3 real o MinIO local?
4. **PAC para timbrado**: ¿Qué proveedor (Facturama, Finkok, SW)?
5. **Iniciar Fase 0**: Setup Prisma + migrations + seeds de roles

**¿Confirmamos estas decisiones y comenzamos con Fase 0?**

---

## 🔗 Referencias Rápidas

- **Documentación**: DOCUMENTACION_COMPLETA.md (revisar)
- **Stack actual**: backend/package.json + frontend/package.json
- **Rutas existentes**: backend/routes/ (29 archivos listados)
- **Controladores**: backend/controllers/ (27+ archivos)

Ajusta el plan según tus prioridades. Podemos desglosar cada fase en tasks técnicas detalladas conforme avancemos.
