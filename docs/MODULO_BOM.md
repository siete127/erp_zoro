# 📋 MÓDULO DE GESTIÓN DE BOM (LISTA DE MATERIALES)

## 🎯 OBJETIVO
Gestionar las listas de materiales (Bill of Materials) que definen qué materias primas y operaciones se requieren para fabricar cada producto terminado.

---

## 🚀 FUNCIONALIDADES IMPLEMENTADAS

### 1. **Lista de BOM**
- Ruta: `/produccion/bom`
- Visualización de todos los BOM registrados
- Filtros por estado (Vigente/Obsoleto)
- Información resumida: Código, Producto, Versión, Cantidad de materiales y operaciones
- Acciones: Ver detalle, Editar, Clonar, Eliminar

### 2. **Crear BOM**
- Ruta: `/produccion/bom/nuevo`
- Formulario completo para crear nueva lista de materiales
- Campos principales:
  - Producto (selección de catálogo)
  - Código BOM (auto-generado si se deja vacío)
  - Versión
  - Merma esperada (%)
  - Descripción
  - Estado vigente

#### **Materiales (Obligatorio)**
- Agregar múltiples materias primas
- Campos por material:
  - Materia Prima (selección de catálogo)
  - Cantidad teórica por unidad de producto
  - Tipo de componente (Principal/Secundario)
  - Merma específica (%)
  - Notas

#### **Operaciones (Opcional)**
- Agregar múltiples operaciones de producción
- Campos por operación:
  - Descripción de la operación
  - Tipo de costo (Mano de obra/Maquinaria/Indirecto/Otro)
  - Minutos por unidad
  - Costo por unidad
  - Costo hora de referencia

### 3. **Editar BOM**
- Ruta: `/produccion/bom/:id/editar`
- Modificar BOM existente
- Actualizar materiales y operaciones
- Cambiar estado de vigencia

### 4. **Ver Detalle de BOM**
- Ruta: `/produccion/bom/:id`
- Visualización completa del BOM
- Información general del producto
- Lista de materiales con cantidades y unidades
- Lista de operaciones con costos y tiempos
- Acciones: Editar, Clonar

### 5. **Clonar BOM (Nueva Versión)**
- Crear nueva versión de un BOM existente
- Copia todos los materiales y operaciones
- Marca el BOM anterior como no vigente
- Útil para actualizar recetas sin perder historial

### 6. **Eliminar BOM**
- Validación: No se puede eliminar si tiene órdenes de producción asociadas
- Elimina materiales y operaciones relacionadas

---

## 📊 ESTRUCTURA DE DATOS

### **Tabla: ERP_BOM**
```sql
- BOM_Id: ID único
- Producto_Id: Producto terminado
- Company_Id: Empresa
- CodigoBOM: Código identificador
- Version: Número de versión
- Vigente: 1 = activo, 0 = obsoleto
- MermaPct: % de merma esperada
- Descripcion: Descripción opcional
- FechaCreacion: Fecha de creación
- CreadoPor: Usuario creador
```

### **Tabla: ERP_BOM_MATERIALES**
```sql
- BOM_Material_Id: ID único
- BOM_Id: BOM al que pertenece
- MateriaPrima_Id: Materia prima requerida
- CantidadTeorica: Cantidad por unidad de producto
- TipoComponente: Principal/Secundario
- MermaPct: % de merma del material
- Notas: Observaciones
```

### **Tabla: ERP_BOM_OPERACIONES**
```sql
- BOM_Operacion_Id: ID único
- BOM_Id: BOM al que pertenece
- TipoCosto: MANO_OBRA/MAQUINA/INDIRECTO
- CostoPorUnidad: Costo por unidad de producto
- MinutosPorUnidad: Tiempo de fabricación
- CostoHoraReferencia: Costo hora estándar
- Notas: Descripción de la operación
```

### **Tabla: ERP_MATERIA_PRIMA**
```sql
- MateriaPrima_Id: ID único
- Codigo: Código de la materia prima
- Nombre: Nombre descriptivo
- Tipo: PAPEL/ADHESIVO/REVENTA
- UnidadCompra: Unidad de compra
- UnidadConsumo: Unidad de consumo
- CostoUnitario: Costo actual
- Activo: 1 = activo, 0 = inactivo
```

---

## 🔄 FLUJO DE TRABAJO

### **Paso 1: Crear Materias Primas**
Antes de crear BOM, debe tener materias primas registradas en `ERP_MATERIA_PRIMA`.

### **Paso 2: Crear BOM para Producto**
1. Ir a **Producción → BOM (Lista de Materiales)**
2. Click en **"+ Nuevo BOM"**
3. Seleccionar producto terminado
4. Agregar materiales necesarios con cantidades
5. (Opcional) Agregar operaciones con costos
6. Guardar

### **Paso 3: Usar BOM en Órdenes de Producción**
Cuando se crea una orden de producción, el sistema:
- Busca el BOM vigente del producto
- Calcula materiales necesarios según cantidad planificada
- Muestra operaciones y costos estimados

### **Paso 4: Actualizar BOM (Nueva Versión)**
Cuando cambia la receta:
1. Ir al detalle del BOM actual
2. Click en **"Clonar"**
3. Ingresar nueva versión
4. Sistema crea copia y marca anterior como obsoleto
5. Editar la nueva versión según cambios

---

## 🔗 INTEGRACIÓN CON OTROS MÓDULOS

### **Con Órdenes de Producción**
- Las OP usan el BOM vigente del producto
- Calculan consumo teórico de materiales
- Muestran operaciones y tiempos estimados

### **Con Inventario**
- Las materias primas del BOM se consultan del inventario
- Al cerrar OP, se pueden descontar materiales automáticamente

### **Con Costos**
- Los costos de materiales y operaciones se usan para calcular costo de producción
- Útil para determinar precios de venta

---

## 📡 API ENDPOINTS

### **Backend Routes**
```javascript
GET    /api/bom                    // Listar BOM
GET    /api/bom/:id                // Detalle de BOM
POST   /api/bom                    // Crear BOM
PUT    /api/bom/:id                // Actualizar BOM
DELETE /api/bom/:id                // Eliminar BOM
POST   /api/bom/:id/clonar         // Clonar BOM (nueva versión)
GET    /api/bom/materias-primas    // Listar materias primas
```

### **Ejemplo: Crear BOM**
```json
POST /api/bom
{
  "Company_Id": 1,
  "Producto_Id": 10,
  "CodigoBOM": "BOM-SILLA-001",
  "Version": 1,
  "MermaPct": 5,
  "Descripcion": "Lista de materiales para silla de madera",
  "materiales": [
    {
      "MateriaPrima_Id": 1,
      "CantidadTeorica": 2.5,
      "TipoComponente": "Principal",
      "MermaPct": 3,
      "Notas": "Madera MDF 18mm"
    },
    {
      "MateriaPrima_Id": 2,
      "CantidadTeorica": 12,
      "TipoComponente": "Secundario",
      "MermaPct": 0,
      "Notas": "Tornillos 4x40mm"
    }
  ],
  "operaciones": [
    {
      "NombreOperacion": "Corte de madera",
      "TipoCosto": "MANO_OBRA",
      "MinutosPorUnidad": 15,
      "CostoPorUnidad": 5.00,
      "CostoHoraReferencia": 20.00
    }
  ]
}
```

---

## ✅ VALIDACIONES

### **Al Crear BOM**
- ✅ Producto es obligatorio
- ✅ Debe tener al menos un material
- ✅ Cantidades deben ser mayores a 0
- ✅ Materias primas deben existir y estar activas

### **Al Eliminar BOM**
- ✅ No puede tener órdenes de producción asociadas
- ✅ Se eliminan materiales y operaciones relacionadas

### **Al Clonar BOM**
- ✅ BOM original debe existir
- ✅ Nueva versión no debe duplicarse
- ✅ BOM anterior se marca como no vigente

---

## 🎨 INTERFAZ DE USUARIO

### **Menú de Navegación**
```
Producción
  ├── Órdenes de Producción
  └── BOM (Lista de Materiales)  ← NUEVO
```

### **Colores y Estados**
- 🟢 **Verde**: BOM Vigente
- ⚪ **Gris**: BOM Obsoleto
- 🔵 **Azul**: Componente Principal
- ⚪ **Gris**: Componente Secundario

---

## 🚀 PRÓXIMAS MEJORAS

1. **Cálculo automático de costos**: Sumar costos de materiales + operaciones
2. **Validación de stock**: Verificar disponibilidad de materias primas
3. **Historial de versiones**: Ver cambios entre versiones de BOM
4. **Importación masiva**: Cargar BOM desde Excel
5. **Copia de BOM entre productos**: Duplicar BOM para productos similares
6. **Alertas de costo**: Notificar cuando costos de materiales cambian
7. **Simulador de producción**: Calcular costos antes de crear OP

---

## 📝 NOTAS IMPORTANTES

- **Un producto puede tener múltiples BOM** (diferentes versiones), pero solo uno debe estar vigente
- **Las materias primas** deben estar registradas en `ERP_MATERIA_PRIMA` antes de crear BOM
- **Al clonar un BOM**, el anterior se marca automáticamente como no vigente
- **Las operaciones son opcionales**, pero útiles para calcular costos totales
- **La unidad de consumo** se obtiene de la materia prima, no se define en el BOM

---

## 🔧 ARCHIVOS IMPLEMENTADOS

### **Backend**
- `backend/controllers/bomController.js` - Lógica de negocio
- `backend/routes/bom.routes.js` - Rutas API
- `backend/server.js` - Registro de rutas

### **Frontend**
- `frontend/src/pages/produccion/GestionBOM.jsx` - Lista de BOM
- `frontend/src/pages/produccion/FormularioBOM.jsx` - Crear/Editar BOM
- `frontend/src/pages/produccion/DetalleBOM.jsx` - Ver detalle
- `frontend/src/services/bomService.js` - Servicios API
- `frontend/src/App.jsx` - Rutas
- `frontend/src/layouts/DashboardLayout.jsx` - Menú navegación

---

## ✅ MÓDULO COMPLETAMENTE FUNCIONAL

El módulo de gestión de BOM está **100% implementado** y listo para usar. Permite crear, editar, visualizar, clonar y eliminar listas de materiales con todos los controles necesarios.
