# Minuta ERP 07-03-26 — Seguimiento de Implementación

## Estado general

- ✅ **Implementado en esta fase (14-03-2026):**
  - Producción: resumen previo de cierre con costos teóricos.
  - Producción: validación estricta para evitar sobreproducción al cerrar OP.

- 🟡 **Parcial / siguiente fase inmediata:**
  - Planeación avanzada por listado y capacidad por máquina.
  - Reporte de piezas fabricadas y reanudación controlada de OP pendientes.
  - Alerta de calidad automática que dispare OP.

- ⏳ **Pendiente (no implementado aún):**
  - Control total de almacén por clasificación completa y recepción asistida.
  - Módulo integral de compras con autorización doble y PDF.
  - Módulo de costos mensual, factores de productividad y candados de merma en BOM.
  - Reglas avanzadas en ventas (autorización y cotización externa con cálculo).
  - Reportería extendida de inventario/valor/desperdicio.

---

## 1) Producción

- ✅ Antes de finalizar proceso, mostrar resultados de producción (consumos y costos).
- ✅ Empresa productora considerada en flujo actual (PTC como productora).
- ✅ Planeación básica por máquina y prioridad.
- 🟡 Reporte de piezas fabricadas con reanudación de pendientes (base existente, falta reporte formal dedicado).
- 🟡 Producción teórica por número de piezas (base en preview/cálculos; falta tablero dedicado).
- ✅ Límite de producción para evitar sobreproducción (validación backend al cierre).
- ⏳ Alerta de calidad automática para solicitud de OP.
- ⏳ Registro en OP: fecha de embarque, cantidad reservada, orden de trabajo.

## 2) Control de Almacén

- 🟡 Existe control de almacenes, inventario, kardex y transferencias.
- ⏳ Lista específica de productos listos para recepción.
- ✅ Entrada a almacén como producto terminado al cerrar producción.
- ⏳ Clasificación formal en entrada (materia prima / terminado / reventa).
- 🟡 Inventario por almacén y transferencias existe; falta vista consolidada por estados (máquina/proceso/producción).
- 🟡 Número de almacén por producto depende de stock por almacén; falta normalización explícita por producto maestro.

## 3) Compras

- ⏳ Alta de compra con proveedor.
- ⏳ Producto pre-registrado con costo inicial y precio de compra.
- ⏳ PDF de orden de compra automático.
- ⏳ Doble autorización de OC.
- ⏳ Flujo de OC obligatoria previa a compra.
- ⏳ Registro por OC o compra directa con factura para revisión.
- ⏳ Regla REMA/SER para levantar OC.

## 4) Costos

- ⏳ Módulo de costos dedicado.
- ⏳ Variaciones de costos por materia prima.
- ⏳ Actualización de costos de papel.
- ⏳ Cálculo por kilos + desperdicio.
- ⏳ Factor de productividad para precios.
- ⏳ Costeo fin de mes.
- ⏳ Registro de mermas con reglas de negocio.
- ⏳ Candado BOM para mermas < 10% (según regla definida).

## 5) Recetas / BOM

- ⏳ Filtro de producto en recetas (UI dedicada pendiente).
- 🟡 Quitar operaciones existe vía edición completa de BOM; falta acción rápida puntual.
- ⏳ Variaciones de costo por materia prima dentro de recetas (auditoría histórica pendiente).

## 6) Ventas

- 🟡 Hay integración parcial con órdenes de producción.
- ⏳ Bloqueo total de facturación sin existencia.
- ⏳ Autorización de venta.
- ⏳ Cotización externa con cálculo automático.
- ⏳ Creación/flujo integral de orden de venta con reglas nuevas.

## 7) Reportería

- ⏳ Reportes de inventario ampliados.
- ⏳ Inventario total, valor total, costo unitario, precio total de almacén.
- ⏳ Seguimiento materiales: comprada / almacén / máquina / entregada a producción.
- ⏳ Desperdicio total generado en fabricación.

---

## Notas técnicas de la fase implementada

### Backend
- `backend/routes/produccion.routes.js`
  - `GET /api/produccion/ordenes/:id/preview-cierre`

- `backend/controllers/produccionController.js`
  - Preview de cierre con costos teóricos (materiales + operaciones + margen teórico).
  - Bloqueo de sobreproducción al cerrar OP.

### Frontend
- `frontend/src/pages/produccion/DetalleOrdenProduccion.jsx`
  - Bloque de resumen teórico de producción.

- `frontend/src/pages/produccion/ModalCerrarOrden.jsx`
  - Resumen previo de cierre con costos teóricos/reales estimados.
  - Validación UI para impedir cierre con sobreproducción.

- `frontend/src/pages/produccion/OrdenesProduccion.jsx`
  - Sin cambios de esquema BD; vista actual de OP se mantiene.

---

## Siguiente entrega sugerida (Fase 2)

1. Planeación avanzada por máquina (cola por capacidad/tiempo disponible).
2. Reporte de piezas fabricadas y reanudación de OP parcial.
3. Recepción de terminado en almacén con clasificación formal.
4. Reporte de inventario valorizado + desperdicio.
