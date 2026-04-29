# 📖 CÓMO FUNCIONA EL MÓDULO DE PRODUCCIÓN

## 🎯 OBJETIVO
Gestionar órdenes de producción desde su creación hasta el cierre, controlando materiales, operaciones, consumos y resultados.

---

## 📊 FLUJO COMPLETO DEL MÓDULO

### **FASE 1: CREACIÓN DE ORDEN DE PRODUCCIÓN**

#### **Opción A: Desde CRM (Automática)**
1. Cliente solicita productos en una **Oportunidad CRM**
2. Se crea una **Actividad de tipo "Visita"**
3. En la descripción se agregan productos en formato JSON:
   ```json
   [{"Producto_Id":1,"Cantidad":50}]
   ```
4. Click en botón **"🏭 Enviar a producción"**
5. Sistema crea automáticamente:
   - Orden de producción (ERP_OP_PRODUCCION)
   - Estado: EN_ESPERA
   - Prioridad: NORMAL
   - Vincula a la venta/oportunidad

#### **Opción B: Manual (Desde el módulo)**
1. Ir a **Producción → Órdenes de Producción**
2. Click en **"+ Nueva OP"** (pendiente implementar)
3. Llenar formulario:
   - Empresa
   - Producto
   - Cantidad planificada
   - Prioridad (ALTA, NORMAL, BAJA)
   - Fecha compromiso
4. Sistema busca BOM vigente del producto
5. Crea la orden en estado EN_ESPERA

---

### **FASE 2: PREPARACIÓN (EN_ESPERA)**

**¿Qué sucede en esta fase?**
- La orden está creada pero no ha iniciado producción
- Se puede revisar el BOM (lista de materiales)
- Se verifica disponibilidad de materias primas
- Se asigna operador principal (opcional)

**Acciones disponibles:**
- ✅ **Ver Detalle**: Revisar BOM, materiales requeridos, operaciones
- ✅ **Iniciar**: Cambiar estado a EN_PROCESO
- ❌ **Cancelar**: Marcar como CANCELADA

**Información visible:**
- Número de OP (ej: OP-2024-12345)
- Producto a fabricar
- Cantidad planificada
- BOM asociado
- Materiales necesarios (de ERP_BOM_MATERIALES)
- Operaciones de producción (de ERP_BOM_OPERACIONES)

---

### **FASE 3: PRODUCCIÓN (EN_PROCESO)**

**¿Cómo iniciar?**
1. En la lista de órdenes, click en **"Iniciar"**
2. Sistema cambia estado a EN_PROCESO
3. Se registra FechaInicio

**Durante la producción:**
- Operadores fabrican el producto
- Se consumen materias primas
- Se registran tiempos y costos
- Se identifican piezas buenas y merma

**Acciones disponibles:**
- ✅ **Ver Detalle**: Monitorear progreso
- ✅ **Terminar**: Cambiar a TERMINADA cuando se complete
- ❌ **Cancelar**: Si hay problemas graves

---

### **FASE 4: TERMINADA (Registro de Consumos)**

**¿Qué hacer cuando termina la producción?**
1. Click en **"Terminar"** (cambia estado a TERMINADA)
2. Ir a **Ver Detalle** de la orden
3. Registrar consumos reales de materiales:

**Endpoint para registrar consumos:**
```http
POST /api/produccion/ordenes/:id/cerrar
{
  "consumos": [
    {
      "MateriaPrima_Id": 1,
      "CantidadTeorica": 50,    // Lo que debía consumir según BOM
      "CantidadReal": 52,       // Lo que realmente se consumió
      "UnidadConsumo": "KG"
    }
  ],
  "PiezasBuenas": 95,           // Productos terminados OK
  "PiezasMerma": 5,             // Productos defectuosos
  "Comentarios": "Producción normal",
  "OperadorCierre": "Juan Pérez"
}
```

**Sistema registra en:**
- **ERP_OP_CONSUMO_MATERIAL**: Cada material consumido
- **ERP_OP_RESULTADO**: Resultado final (buenas, merma)
- Calcula merma automáticamente: `MermaCantidad = CantidadReal - CantidadTeorica`

---

### **FASE 5: CERRADA (Entrada a Inventario)**

**¿Qué sucede al cerrar?**
1. Sistema actualiza:
   - Estado → CERRADA
   - CantidadProducida = PiezasBuenas
   - MermaUnidades = PiezasMerma
   - FechaFin = Ahora

2. **IMPORTANTE**: Registrar entrada al inventario:
```http
POST /api/ventas/entrada-produccion
{
  "OP_Id": 501,
  "Almacen_Id": 1
}
```

3. Sistema crea movimiento en kardex:
   - Tipo: ENTRADA
   - Cantidad: PiezasBuenas
   - Referencia: NumeroOP
   - Actualiza stock disponible

---

## 📋 TABLAS INVOLUCRADAS

### **1. ERP_OP_PRODUCCION (Orden Principal)**
```sql
- OP_Id: ID único
- NumeroOP: OP-2024-12345
- Company_Id: Empresa
- Producto_Id: Producto a fabricar
- BOM_Id: Lista de materiales
- CantidadPlanificada: Cantidad objetivo
- CantidadProducida: Cantidad real producida
- MermaUnidades: Piezas defectuosas
- Estado: EN_ESPERA | EN_PROCESO | TERMINADA | CERRADA | CANCELADA
- Prioridad: ALTA | NORMAL | BAJA
- Venta_Id: Venta vinculada (si aplica)
```

### **2. ERP_BOM (Bill of Materials)**
```sql
- BOM_Id: ID único
- Producto_Id: Producto final
- CodigoBOM: Código de la receta
- Version: Versión del BOM
- Vigente: 1 = activo, 0 = obsoleto
- MermaPct: % de merma esperada
```

### **3. ERP_BOM_MATERIALES (Materias Primas)**
```sql
- BOM_Material_Id: ID único
- BOM_Id: BOM al que pertenece
- MateriaPrima_Id: Materia prima necesaria
- CantidadTeorica: Cantidad por unidad
- TipoComponente: Principal | Secundario
- MermaPct: % merma del material
```

### **4. ERP_BOM_OPERACIONES (Costos y Tiempos)**
```sql
- BOM_Operacion_Id: ID único
- BOM_Id: BOM al que pertenece
- TipoCosto: Mano de obra | Maquinaria | Energía
- CostoPorUnidad: Costo unitario
- MinutosPorUnidad: Tiempo de fabricación
- CostoHoraReferencia: Costo hora estándar
```

### **5. ERP_OP_CONSUMO_MATERIAL (Consumos Reales)**
```sql
- OP_Consumo_Id: ID único
- OP_Id: Orden de producción
- MateriaPrima_Id: Material consumido
- CantidadTeorica: Lo que debía consumir
- CantidadReal: Lo que realmente consumió
- MermaCantidad: Diferencia (desperdicio)
- FechaRegistro: Cuándo se registró
- RegistradoPor: Usuario que registró
```

### **6. ERP_OP_RESULTADO (Resultado Final)**
```sql
- OP_Result_Id: ID único
- OP_Id: Orden de producción
- PiezasBuenas: Productos OK
- PiezasMerma: Productos defectuosos
- Comentarios: Observaciones
- OperadorCierre: Quién cerró
- FechaCierre: Cuándo se cerró
```

---

## 🔄 ESTADOS DE LA ORDEN

```
┌─────────────┐
│ EN_ESPERA   │ ← Orden creada, esperando inicio
└──────┬──────┘
       │ [Iniciar]
       ↓
┌─────────────┐
│ EN_PROCESO  │ ← Producción en curso
└──────┬──────┘
       │ [Terminar]
       ↓
┌─────────────┐
│ TERMINADA   │ ← Producción completa, registrar consumos
└──────┬──────┘
       │ [Cerrar + Registrar Consumos]
       ↓
┌─────────────┐
│ CERRADA     │ ← Orden finalizada, entrada a inventario
└─────────────┘

       ↓ [Cancelar] (desde cualquier estado)
┌─────────────┐
│ CANCELADA   │ ← Orden cancelada
└─────────────┘
```

---

## 📊 INDICADORES Y MÉTRICAS

### **Progreso de Producción**
```
Progreso = (CantidadProducida / CantidadPlanificada) × 100
```

### **Eficiencia**
```
Eficiencia = (PiezasBuenas / CantidadPlanificada) × 100
```

### **Tasa de Merma**
```
Merma % = (PiezasMerma / (PiezasBuenas + PiezasMerma)) × 100
```

### **Variación de Consumo**
```
Variación = ((CantidadReal - CantidadTeorica) / CantidadTeorica) × 100
```

---

## 🎯 CASOS DE USO

### **Caso 1: Producción Normal**
1. Cliente pide 100 sillas
2. Se crea OP por 100 unidades
3. Se inicia producción
4. Se producen 98 buenas, 2 merma
5. Se cierra OP
6. Se registra entrada de 98 al inventario
7. Se factura venta con las 98 disponibles

### **Caso 2: Producción con Faltante**
1. Cliente pide 100 sillas, hay 20 en stock
2. Se crea OP por 80 unidades
3. Se produce: 78 buenas, 2 merma
4. Stock total: 20 + 78 = 98
5. Falta 2 para completar pedido
6. Opción A: Crear nueva OP por 2
7. Opción B: Ajustar venta a 98 unidades

### **Caso 3: Producción con Alta Merma**
1. Se planifican 100 unidades
2. Se producen 85 buenas, 15 merma (15%)
3. Sistema alerta: merma alta
4. Se investiga causa
5. Se ajusta BOM o proceso
6. Se registra en comentarios

---

## ✅ CHECKLIST DE PRODUCCIÓN

**Antes de iniciar:**
- [ ] BOM vigente configurado
- [ ] Materias primas disponibles
- [ ] Operador asignado
- [ ] Prioridad definida

**Durante producción:**
- [ ] Monitorear progreso
- [ ] Registrar incidencias
- [ ] Controlar calidad

**Al terminar:**
- [ ] Registrar consumos reales
- [ ] Contar piezas buenas y merma
- [ ] Agregar comentarios
- [ ] Cerrar orden

**Después del cierre:**
- [ ] Registrar entrada a inventario
- [ ] Verificar stock actualizado
- [ ] Notificar a ventas
- [ ] Facturar pedido

---

## 🚀 PRÓXIMAS MEJORAS

1. **Descontar materia prima automáticamente** al cerrar OP
2. **Registrar entrada automática** al inventario
3. **Alertas de merma alta** (>10%)
4. **Dashboard de producción** con KPIs
5. **Planificación de producción** (calendario)
6. **Control de calidad** integrado
7. **Trazabilidad por lote**
8. **Costos reales vs teóricos**
