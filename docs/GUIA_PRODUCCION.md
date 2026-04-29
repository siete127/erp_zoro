# GUÍA COMPLETA - MÓDULO DE PRODUCCIÓN
## Sistema ERP - Gestión de Producción

---

## 📋 ÍNDICE
1. Flujo de Trabajo de Producción
2. Datos de Ejemplo para Agregar
3. Paso a Paso con Ejemplos Reales

---

## 🔄 FLUJO DE TRABAJO DE PRODUCCIÓN

### Secuencia Completa:
```
1. MATERIAS PRIMAS → 2. PRODUCTOS → 3. BOM → 4. ORDEN DE PRODUCCIÓN → 5. CIERRE
```

**Explicación del Flujo:**

1. **Materias Primas**: Registrar todos los materiales que se usan (papel, adhesivo, tintas, etc.)
2. **Productos**: Crear los productos terminados que se fabrican
3. **BOM (Bill of Materials)**: Definir la "receta" de cada producto (qué materiales y en qué cantidad)
4. **Orden de Producción**: Crear orden para fabricar X cantidad de un producto
5. **Cierre de Orden**: Registrar consumos reales y resultado final

---

## 📦 DATOS DE EJEMPLO PARA AGREGAR

### EJEMPLO 1: FABRICACIÓN DE CAJAS DE CARTÓN

#### PASO 1: Crear Materias Primas

**Materia Prima 1 - Papel Kraft**
```
Código: PAP-001
Nombre: Papel Kraft 120g
Descripción: Papel kraft para cajas corrugadas
Tipo: PAPEL
Unidad de Compra: TONELADA
Unidad de Consumo: KG
Factor de Conversión: 1000 (1 tonelada = 1000 kg)
Gramaje: 120
Costo Unitario: 25.50 (por KG)
Moneda: MXN
Activo: ✓
```

**Materia Prima 2 - Adhesivo**
```
Código: ADH-001
Nombre: Adhesivo Industrial PVA
Descripción: Adhesivo base agua para cartón
Tipo: ADHESIVO
Unidad de Compra: LITRO
Unidad de Consumo: ML
Factor de Conversión: 1000 (1 litro = 1000 ml)
Gramaje: (dejar vacío)
Costo Unitario: 0.15 (por ML)
Moneda: MXN
Activo: ✓
```

**Materia Prima 3 - Tinta**
```
Código: TINT-001
Nombre: Tinta Flexográfica Negra
Descripción: Tinta para impresión de cajas
Tipo: OTRO
Unidad de Compra: LITRO
Unidad de Consumo: ML
Factor de Conversión: 1000
Gramaje: (dejar vacío)
Costo Unitario: 0.35 (por ML)
Moneda: MXN
Activo: ✓
```

#### PASO 2: Crear Producto (si no existe)

**Producto: Caja de Cartón Mediana**
```
SKU: CAJA-MED-001
Nombre: Caja Cartón Corrugado 40x30x20cm
Categoría: Embalaje
Precio: 45.00 MXN
```

#### PASO 3: Crear BOM (Lista de Materiales)

**BOM para Caja de Cartón**
```
Información General:
- Producto: CAJA-MED-001 - Caja Cartón Corrugado 40x30x20cm
- Código BOM: (auto-generado o dejar vacío)
- Versión: 1
- Merma Esperada: 5%
- Descripción: BOM para fabricación de caja corrugada mediana
- BOM Vigente: ✓

Materiales:
┌─────────────────────────────────────────────────────────────────┐
│ Material          │ Cantidad │ Tipo       │ Merma % │ Notas    │
├─────────────────────────────────────────────────────────────────┤
│ PAP-001 Papel     │ 0.850    │ Principal  │ 3       │ Láminas  │
│ ADH-001 Adhesivo  │ 25       │ Secundario │ 2       │ Pegado   │
│ TINT-001 Tinta    │ 15       │ Secundario │ 1       │ Impresión│
└─────────────────────────────────────────────────────────────────┘

Operaciones (opcional):
┌──────────────────────────────────────────────────────────────────┐
│ Descripción    │ Tipo Costo  │ Min/Unidad │ Costo/Unidad │ $/Hora│
├──────────────────────────────────────────────────────────────────┤
│ Corte          │ MAQUINA     │ 2          │ 1.50         │ 45    │
│ Doblado        │ MANO_OBRA   │ 3          │ 2.00         │ 40    │
│ Pegado         │ MAQUINA     │ 1.5        │ 1.00         │ 40    │
│ Impresión      │ MAQUINA     │ 2.5        │ 2.50         │ 60    │
└──────────────────────────────────────────────────────────────────┘
```

#### PASO 4: Crear Orden de Producción

**Orden de Producción**
```
Producto: CAJA-MED-001 - Caja Cartón Corrugado 40x30x20cm
Cantidad Planificada: 1000 (cajas)
Prioridad: ALTA
Fecha Entrega Compromiso: (seleccionar fecha)
Notas: Pedido urgente para cliente ABC
```

**El sistema automáticamente:**
- Asigna el BOM vigente del producto
- Calcula materiales necesarios:
  * Papel: 850 kg (0.850 kg × 1000 cajas)
  * Adhesivo: 25,000 ml (25 ml × 1000 cajas)
  * Tinta: 15,000 ml (15 ml × 1000 cajas)
- Estado inicial: EN_ESPERA

#### PASO 5: Cambiar Estado de la Orden

**Estados disponibles:**
- EN_ESPERA → EN_PROCESO (cuando inicia producción)
- EN_PROCESO → TERMINADA (cuando termina producción)
- TERMINADA → CERRADA (al registrar consumos y resultado)

#### PASO 6: Cerrar Orden (cuando está TERMINADA)

**Registrar Consumos Reales:**
```
Consumos de Material:
┌────────────────────────────────────────────────────┐
│ Material          │ Teórico  │ Real     │ Unidad  │
├────────────────────────────────────────────────────┤
│ PAP-001 Papel     │ 850.000  │ 875.500  │ KG      │
│ ADH-001 Adhesivo  │ 25000.00 │ 25800.00 │ ML      │
│ TINT-001 Tinta    │ 15000.00 │ 15200.00 │ ML      │
└────────────────────────────────────────────────────┘

Resultado de Producción:
- Piezas Buenas: 980
- Piezas Merma: 20
- Operador de Cierre: Juan Pérez
- Comentarios: Producción normal, merma dentro de lo esperado

Análisis Automático:
- Eficiencia: 98% (980/1000)
- Tasa de Merma: 2% (20/1000)
```

---

## 🏭 EJEMPLO 2: FABRICACIÓN DE CUADERNOS

### Materias Primas

**1. Papel Bond**
```
Código: PAP-002
Nombre: Papel Bond 75g Blanco
Tipo: PAPEL
Unidad Compra: TONELADA
Unidad Consumo: KG
Factor Conversión: 1000
Gramaje: 75
Costo Unitario: 18.00
Moneda: MXN
```

**2. Espiral Metálico**
```
Código: ESP-001
Nombre: Espiral Metálico 1/2"
Tipo: OTRO
Unidad Compra: CAJA (100 piezas)
Unidad Consumo: PIEZA
Factor Conversión: 100
Costo Unitario: 2.50
Moneda: MXN
```

**3. Cartulina**
```
Código: CART-001
Nombre: Cartulina Couché 300g
Tipo: PAPEL
Unidad Compra: KILO
Unidad Consumo: GRAMO
Factor Conversión: 1000
Gramaje: 300
Costo Unitario: 0.045
Moneda: MXN
```

### BOM Cuaderno 100 Hojas

```
Producto: CUAD-100 - Cuaderno Profesional 100 Hojas
Versión: 1
Merma: 3%

Materiales:
- PAP-002 Papel Bond: 0.375 KG (100 hojas × 2 caras × 75g/m²)
- ESP-001 Espiral: 1 PIEZA
- CART-001 Cartulina: 150 GRAMO (portada y contraportada)

Operaciones:
- Corte de hojas: 1.5 min/unidad, $1.20
- Perforado: 1 min/unidad, $0.80
- Ensamble espiral: 2 min/unidad, $1.50
```

### Orden de Producción

```
Cantidad: 500 cuadernos
Prioridad: NORMAL

Materiales Necesarios:
- Papel: 187.5 kg
- Espirales: 500 piezas
- Cartulina: 75,000 gramos (75 kg)
```

---

## 🎯 EJEMPLO 3: PRODUCCIÓN DE ETIQUETAS

### Materias Primas

**1. Papel Adhesivo**
```
Código: PAP-ADH-001
Nombre: Papel Adhesivo Blanco Brillante
Tipo: PAPEL
Unidad Compra: ROLLO
Unidad Consumo: METRO
Factor Conversión: 100 (1 rollo = 100 metros)
Costo Unitario: 12.50
Moneda: MXN
```

**2. Tinta de Impresión**
```
Código: TINT-002
Nombre: Tinta UV Color
Tipo: OTRO
Unidad Compra: LITRO
Unidad Consumo: ML
Factor Conversión: 1000
Costo Unitario: 0.45
Moneda: MXN
```

### BOM Etiquetas

```
Producto: ETI-001 - Etiqueta Producto 10x5cm
Versión: 1
Merma: 8%

Materiales por cada 1000 etiquetas:
- PAP-ADH-001: 50 METRO
- TINT-002: 200 ML

Operaciones:
- Impresión digital: 15 min/1000 piezas, $25.00
- Corte y troquelado: 10 min/1000 piezas, $18.00
```

---

## 📊 RESUMEN DE COSTOS (Ejemplo Caja de Cartón)

```
COSTO POR UNIDAD (1 caja):

Materiales:
- Papel Kraft: 0.850 kg × $25.50 = $21.68
- Adhesivo: 25 ml × $0.15 = $3.75
- Tinta: 15 ml × $0.35 = $5.25
Subtotal Materiales: $30.68

Operaciones:
- Corte: $1.50
- Doblado: $2.00
- Pegado: $1.00
- Impresión: $2.50
Subtotal Operaciones: $7.00

COSTO TOTAL: $37.68 por caja
Precio Venta: $45.00
Margen: $7.32 (16.3%)
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### Orden de Configuración:
```
☐ 1. Crear todas las Materias Primas
☐ 2. Verificar que existan Productos
☐ 3. Crear BOM para cada producto
     ☐ Agregar materiales con cantidades
     ☐ Agregar operaciones (opcional)
☐ 4. Crear Orden de Producción
☐ 5. Cambiar estado a EN_PROCESO
☐ 6. Cambiar estado a TERMINADA
☐ 7. Cerrar orden registrando consumos reales
```

---

## 🔍 TIPS Y MEJORES PRÁCTICAS

### Códigos de Materias Primas:
```
PAP-XXX: Papeles
ADH-XXX: Adhesivos
TINT-XXX: Tintas
ESP-XXX: Espirales
CART-XXX: Cartulinas
PLAS-XXX: Plásticos
```

### Unidades Comunes:
```
Papel: TONELADA → KG (factor 1000)
Líquidos: LITRO → ML (factor 1000)
Piezas: CAJA → PIEZA (factor según caja)
Rollos: ROLLO → METRO (factor según rollo)
```

### Cálculo de Merma:
```
Merma Normal: 2-5%
Merma Alta: 5-10%
Productos Complejos: 10-15%
```

---

## 📞 SOPORTE

Para más información sobre el módulo de producción:
- Revisa los ejemplos anteriores
- Sigue el flujo paso a paso
- Verifica que cada paso esté completo antes de continuar

**¡Listo para producir!** 🚀
