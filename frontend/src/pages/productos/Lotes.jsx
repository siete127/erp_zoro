import React from "react";
import {
  OperationHeader,
  OperationSectionTitle,
  OperationStat,
  operationContainerClass,
  operationPageClass,
  operationSecondaryButtonClass,
} from "../../components/operation/OperationUI";

const pendientes = [
  "Definir tablas ERP_LOTES y sus relaciones con inventario, movimientos y recepciones.",
  "Registrar lotes por producto y almacén con trazabilidad de entradas y salidas.",
  "Controlar caducidades, alertas preventivas y disponibilidad por lote.",
  "Vincular lotes a recepciones, transferencias y ajustes para auditoría completa.",
];

export default function Lotes() {
  return (
    <div className={operationPageClass}>
      <div className={operationContainerClass}>
        <OperationHeader
          eyebrow="Inventario"
          title="Lotes y Caducidad"
          description="Vista reservada para el control fino de trazabilidad por lote, caducidad y disponibilidad por almacén."
          actions={
            <button type="button" className={operationSecondaryButtonClass} disabled>
              Configuración pendiente
            </button>
          }
          stats={[
            <OperationStat key="status" label="Estado" value="Pendiente" tone="amber" />,
            <OperationStat key="scope" label="Cobertura" value="Trazabilidad" tone="blue" />,
            <OperationStat key="alerts" label="Alertas" value="Caducidad" tone="emerald" />,
            <OperationStat key="flow" label="Integración" value="Inventario" tone="slate" />,
          ]}
        />

        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(246,249,253,0.97))] p-6 shadow-[0_18px_40px_rgba(15,45,93,0.08)]">
            <OperationSectionTitle
              eyebrow="Planeación"
              title="Qué falta para activar este módulo"
              description="El diseño ya quedó alineado al sistema premium, pero la funcionalidad depende de la base de datos y del flujo de inventario."
            />

            <div className="space-y-3">
              {pendientes.map((item, index) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-[20px] border border-[#e7edf6] bg-white/90 px-4 py-4 shadow-[0_8px_22px_rgba(15,45,93,0.04)]"
                >
                  <div className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1b3d86] text-xs font-bold text-white">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-6 text-slate-600">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-[28px] border border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.98),rgba(255,247,214,0.96))] p-6 shadow-[0_18px_40px_rgba(180,120,0,0.08)]">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-700">Estado actual</p>
              <h2 className="mt-2 text-xl font-semibold text-amber-950">Módulo pendiente de configuración</h2>
              <p className="mt-3 text-sm leading-6 text-amber-800">
                Esta pantalla ya no se ve como placeholder básico, pero aún necesita estructura transaccional para operar
                con datos reales y no solo con diseño.
              </p>
            </div>

            <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(246,249,253,0.97))] p-6 shadow-[0_18px_40px_rgba(15,45,93,0.08)]">
              <OperationSectionTitle
                eyebrow="Alcance"
                title="Cuando quede activo"
                description="La meta es que este módulo se conecte de forma natural con el resto de Operación."
              />
              <ul className="space-y-3 text-sm leading-6 text-slate-600">
                <li>Control de existencia por lote y ubicación física.</li>
                <li>Alertas visuales por vencimiento próximo o stock comprometido.</li>
                <li>Historial completo de movimientos por lote específico.</li>
                <li>Recepciones y transferencias enlazadas a trazabilidad de inventario.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
