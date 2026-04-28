import React, { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import confirm from "../../services/confirm";
import { notify } from "../../services/notify";
import {
  OperationEmptyState,
  OperationHeader,
  OperationSectionTitle,
  OperationStat,
  operationContainerClass,
  operationDangerButtonClass,
  operationFieldClass,
  operationPageClass,
  operationPrimaryButtonClass,
  operationSecondaryButtonClass,
  operationTableShellClass,
} from "../../components/operation/OperationUI";

const ESTATUS_OC = {
  BORRADOR: "border-slate-200 bg-slate-50 text-slate-700",
  AUTORIZADA: "border-sky-200 bg-sky-50 text-sky-700",
  COMPRADA: "border-emerald-200 bg-emerald-50 text-emerald-700",
  RECHAZADA: "border-rose-200 bg-rose-50 text-rose-700",
  CANCELADA: "border-slate-200 bg-slate-100 text-slate-500",
};

const TERMINOS_OPCIONES = ["Contado", "7 días", "15 días", "30 días", "45 días", "60 días", "90 días"];

const defaultDatos = {
  LeadTimeEntrega: "",
  CalificacionProveedor: "",
  TerminosPago: "",
  NotasProveedor: "",
};

const defaultPrecio = {
  Producto_Id: "",
  MateriaPrima_Id: "",
  Descripcion: "",
  PrecioUnitario: "",
  Moneda: "MXN",
  Vigencia: "",
  tipo: "producto",
};

const fmtDate = (value) => (value ? new Date(value).toLocaleDateString("es-MX") : "-");
const fmtMoney = (value, moneda = "MXN") =>
  `${moneda} ${Number(value || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Field({ label, children, span = false }) {
  return (
    <div className={span ? "md:col-span-2" : ""}>
      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">
        {label}
      </label>
      {children}
    </div>
  );
}

function Stars({ value }) {
  if (!value) return <span className="text-sm text-slate-400">-</span>;
  const amount = Number.parseFloat(value);
  const rounded = Math.max(0, Math.min(5, Math.round(amount)));
  return (
    <span className="inline-flex items-center gap-2 text-sm font-semibold text-amber-600">
      <span>{"★".repeat(rounded)}{"☆".repeat(5 - rounded)}</span>
      <span className="text-slate-500">({amount.toFixed(1)})</span>
    </span>
  );
}

export default function Proveedores() {
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [ficha, setFicha] = useState(null);
  const [fichaTab, setFichaTab] = useState("info");
  const [datosForm, setDatosForm] = useState(defaultDatos);
  const [savingDatos, setSavingDatos] = useState(false);
  const [showPrecioForm, setShowPrecioForm] = useState(false);
  const [precioForm, setPrecioForm] = useState(defaultPrecio);
  const [editPrecioId, setEditPrecioId] = useState(null);
  const [savingPrecio, setSavingPrecio] = useState(false);
  const [companyIdFicha, setCompanyIdFicha] = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [provRes, compRes, prodRes, mpRes] = await Promise.all([
        api.get("/clients/?ClientType=PROVEEDOR"),
        api.get("/companies/"),
        api.get("/productos/"),
        api.get("/materias-primas/"),
      ]);
      setProveedores(Array.isArray(provRes.data) ? provRes.data : provRes.data?.data || []);
      setCompanies(Array.isArray(compRes.data) ? compRes.data : compRes.data?.data || []);
      setProductos(Array.isArray(prodRes.data) ? prodRes.data : prodRes.data?.data || []);
      setMateriasPrimas(Array.isArray(mpRes.data) ? mpRes.data : mpRes.data?.data || []);
    } catch {
      notify.error("No fue posible cargar proveedores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const lista = useMemo(() => {
    const query = busqueda.trim().toLowerCase();
    return proveedores.filter((prov) => {
      if (!query) return true;
      return [
        prov.LegalName,
        prov.CommercialName,
        prov.RFC,
        prov.TerminosPago,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [proveedores, busqueda]);

  const abrirFicha = async (prov) => {
    try {
      const response = await api.get(`/clients/${prov.Client_Id}`);
      const data = response.data;
      setFicha(data);
      setFichaTab("info");
      setCompanyIdFicha(data.companies?.[0]?.Company_Id || null);
      setDatosForm({
        LeadTimeEntrega: data.client?.LeadTimeEntrega || "",
        CalificacionProveedor: data.client?.CalificacionProveedor || "",
        TerminosPago: data.client?.TerminosPago || "",
        NotasProveedor: data.client?.NotasProveedor || "",
      });
    } catch {
      notify.error("No fue posible cargar la ficha del proveedor");
    }
  };

  const handleGuardarDatos = async (event) => {
    event.preventDefault();
    setSavingDatos(true);
    try {
      await api.patch(`/proveedores/${ficha.client.Client_Id}/datos`, {
        LeadTimeEntrega: datosForm.LeadTimeEntrega ? Number.parseInt(datosForm.LeadTimeEntrega, 10) : null,
        CalificacionProveedor: datosForm.CalificacionProveedor ? Number.parseFloat(datosForm.CalificacionProveedor) : null,
        TerminosPago: datosForm.TerminosPago || null,
        NotasProveedor: datosForm.NotasProveedor || null,
      });
      notify.success("Datos del proveedor actualizados");
      abrirFicha(ficha.client);
    } catch (error) {
      notify.error(error?.response?.data?.detail || "No fue posible guardar los datos");
    } finally {
      setSavingDatos(false);
    }
  };

  const handleGuardarPrecio = async (event) => {
    event.preventDefault();
    if (!precioForm.PrecioUnitario) {
      notify.error("El precio unitario es requerido");
      return;
    }
    setSavingPrecio(true);
    try {
      const payload = {
        Proveedor_Id: ficha.client.Client_Id,
        Company_Id: companyIdFicha || companies[0]?.Company_Id,
        Producto_Id: precioForm.tipo === "producto" && precioForm.Producto_Id ? Number.parseInt(precioForm.Producto_Id, 10) : null,
        MateriaPrima_Id:
          precioForm.tipo === "materia" && precioForm.MateriaPrima_Id
            ? Number.parseInt(precioForm.MateriaPrima_Id, 10)
            : null,
        Descripcion: precioForm.Descripcion || null,
        PrecioUnitario: Number.parseFloat(precioForm.PrecioUnitario),
        Moneda: precioForm.Moneda,
        Vigencia: precioForm.Vigencia || null,
      };
      if (editPrecioId) {
        await api.put(`/proveedores/${ficha.client.Client_Id}/precios/${editPrecioId}`, payload);
        notify.success("Precio actualizado");
      } else {
        await api.post(`/proveedores/${ficha.client.Client_Id}/precios`, payload);
        notify.success("Precio pactado agregado");
      }
      setShowPrecioForm(false);
      setPrecioForm(defaultPrecio);
      setEditPrecioId(null);
      abrirFicha(ficha.client);
    } catch (error) {
      notify.error(error?.response?.data?.detail || "No fue posible guardar el precio");
    } finally {
      setSavingPrecio(false);
    }
  };

  const handleEliminarPrecio = async (precio) => {
    const nombre = precio.ProductoNombre || precio.MateriaPrimaNombre || precio.Descripcion || "este precio";
    const ok = await confirm(`¿Eliminar el precio pactado para "${nombre}"?`);
    if (!ok) return;
    try {
      await api.delete(`/proveedores/${ficha.client.Client_Id}/precios/${precio.PrecioP_Id}`);
      notify.success("Precio eliminado");
      abrirFicha(ficha.client);
    } catch (error) {
      notify.error(error?.response?.data?.detail || "No fue posible eliminar el precio");
    }
  };

  const openEditPrecio = (precio) => {
    setEditPrecioId(precio.PrecioP_Id);
    setPrecioForm({
      tipo: precio.Producto_Id ? "producto" : precio.MateriaPrima_Id ? "materia" : "otro",
      Producto_Id: precio.Producto_Id || "",
      MateriaPrima_Id: precio.MateriaPrima_Id || "",
      Descripcion: precio.Descripcion || "",
      PrecioUnitario: precio.PrecioUnitario,
      Moneda: precio.Moneda || "MXN",
      Vigencia: precio.Vigencia ? precio.Vigencia.slice(0, 10) : "",
    });
    setShowPrecioForm(true);
  };

  const leadPromedio =
    lista.length > 0
      ? Math.round(
          lista.reduce((sum, prov) => sum + Number(prov.LeadTimeEntrega || 0), 0) /
            Math.max(1, lista.filter((prov) => prov.LeadTimeEntrega).length || 1),
        )
      : 0;
  const calificados = lista.filter((prov) => prov.CalificacionProveedor).length;

  return (
    <div className={operationPageClass}>
      <div className={operationContainerClass}>
        <OperationHeader
          eyebrow="Compras"
          title="Proveedores"
          description="Centraliza desempeño, condiciones comerciales, precios pactados e historial operativo por proveedor."
          stats={[
            <OperationStat key="total" label="Proveedores" value={lista.length} tone="blue" />,
            <OperationStat key="calificados" label="Con rating" value={calificados} tone="amber" />,
            <OperationStat key="lead" label="Lead time prom." value={leadPromedio ? `${leadPromedio} días` : "-"} tone="emerald" />,
            <OperationStat key="catalogos" label="Catálogos" value={productos.length + materiasPrimas.length} tone="slate" />,
          ]}
        />

        <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(246,249,253,0.97))] p-5 shadow-[0_18px_40px_rgba(15,45,93,0.08)]">
          <OperationSectionTitle
            eyebrow="Filtro"
            title="Búsqueda de proveedores"
            description="Encuentra rápido un proveedor por nombre comercial, razón social, RFC o condiciones de pago."
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Buscar">
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre, RFC o términos..."
                className={operationFieldClass}
              />
            </Field>
          </div>
        </div>

        <div className={operationTableShellClass}>
          <div className="border-b border-[#e7edf6] px-6 py-4">
            <OperationSectionTitle
              eyebrow="Relación comercial"
              title="Base de proveedores"
              description="Consulta desempeño, tiempos de entrega y abre la ficha completa para trabajar precios e historial."
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" />
            </div>
          ) : lista.length === 0 ? (
            <div className="p-6">
              <OperationEmptyState
                title="Sin proveedores"
                description="Cuando existan proveedores registrados aparecerán aquí con su condición comercial resumida."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#e7edf6]">
                    {["Proveedor", "RFC", "Términos de pago", "Tiempo de entrega", "Calificación", "Acciones"].map((header) => (
                      <th
                        key={header}
                        className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 last:pr-6"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lista.map((prov) => (
                    <tr key={prov.Client_Id} className="border-t border-[#eef2f8] transition hover:bg-[#f7faff]">
                      <td className="px-4 py-4 pl-6">
                        <div className="text-sm font-semibold text-slate-900">{prov.CommercialName || prov.LegalName}</div>
                        {prov.CommercialName ? <div className="text-xs text-slate-400">{prov.LegalName}</div> : null}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">{prov.RFC || "-"}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">{prov.TerminosPago || "-"}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        {prov.LeadTimeEntrega ? `${prov.LeadTimeEntrega} días` : "-"}
                      </td>
                      <td className="px-4 py-4">
                        <Stars value={prov.CalificacionProveedor} />
                      </td>
                      <td className="px-4 py-4 pr-6">
                        <button type="button" onClick={() => abrirFicha(prov)} className={operationPrimaryButtonClass}>
                          Ver ficha
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {ficha ? (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" onClick={(e) => e.target === e.currentTarget && setFicha(null)}>
          <div className="ml-auto flex h-full w-full max-w-[860px] flex-col overflow-hidden bg-[linear-gradient(180deg,#f9fbff_0%,#f2f6fc_100%)] shadow-[-18px_0_60px_rgba(15,45,93,0.22)]">
            <div className="bg-[linear-gradient(135deg,#0f2556,#1d417f_55%,#2e68b4)] px-6 py-5 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-blue-100/75">Proveedor</p>
                  <h3 className="mt-1 text-2xl font-semibold">{ficha.client.CommercialName || ficha.client.LegalName}</h3>
                  <p className="mt-1 text-sm text-blue-100/80">
                    RFC {ficha.client.RFC || "-"} · Términos {ficha.client.TerminosPago || "sin especificar"}
                  </p>
                </div>
                <button type="button" onClick={() => setFicha(null)} className="text-2xl leading-none text-white/70 transition hover:text-white">
                  {"\u00d7"}
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <OperationStat key="ocs" label="OCs realizadas" value={(ficha.historial_oc || []).length} tone="slate" />
                <OperationStat
                  key="lead"
                  label="Tiempo de entrega"
                  value={ficha.client.LeadTimeEntrega ? `${ficha.client.LeadTimeEntrega} días` : "-"}
                  tone="emerald"
                />
                <OperationStat
                  key="rating"
                  label="Calificación"
                  value={ficha.client.CalificacionProveedor ? Number(ficha.client.CalificacionProveedor).toFixed(1) : "-"}
                  tone="amber"
                />
                <OperationStat key="precios" label="Precios pactados" value={(ficha.precios_pactados || []).length} tone="blue" />
              </div>
            </div>

            <div className="border-b border-[#e7edf6] bg-white/80 px-6 py-4">
              <div className="inline-flex rounded-[18px] border border-[#dce4f0] bg-white p-1 shadow-[0_6px_18px_rgba(15,45,93,0.05)]">
                {[
                  ["info", "Información"],
                  ["precios", "Precios pactados"],
                  ["historial", "Historial OC"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFichaTab(key)}
                    className={`rounded-[14px] px-4 py-2 text-sm font-semibold transition ${
                      fichaTab === key
                        ? "bg-[linear-gradient(135deg,#1b3d86,#12336d)] text-white shadow-[0_10px_20px_rgba(15,45,93,0.2)]"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {fichaTab === "info" ? (
                <form onSubmit={handleGuardarDatos} className="space-y-6">
                  <div className="rounded-[24px] border border-[#e5ebf5] bg-white p-5 shadow-[0_12px_30px_rgba(15,45,93,0.05)]">
                    <OperationSectionTitle
                      eyebrow="Perfil"
                      title="Condiciones comerciales"
                      description="Ajusta lead time, score interno, términos y notas para el equipo de Compras."
                    />
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Tiempo de entrega (días)">
                        <input
                          type="number"
                          min="0"
                          value={datosForm.LeadTimeEntrega}
                          onChange={(e) => setDatosForm((current) => ({ ...current, LeadTimeEntrega: e.target.value }))}
                          className={operationFieldClass}
                        />
                      </Field>
                      <Field label="Calificación (1.0 a 5.0)">
                        <input
                          type="number"
                          min="1"
                          max="5"
                          step="0.1"
                          value={datosForm.CalificacionProveedor}
                          onChange={(e) => setDatosForm((current) => ({ ...current, CalificacionProveedor: e.target.value }))}
                          className={operationFieldClass}
                        />
                      </Field>
                      <Field label="Términos de pago" span>
                        <select
                          value={datosForm.TerminosPago}
                          onChange={(e) => setDatosForm((current) => ({ ...current, TerminosPago: e.target.value }))}
                          className={operationFieldClass}
                        >
                          <option value="">Sin especificar</option>
                          {TERMINOS_OPCIONES.map((termino) => (
                            <option key={termino} value={termino}>
                              {termino}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Notas internas" span>
                        <textarea
                          rows={4}
                          value={datosForm.NotasProveedor}
                          onChange={(e) => setDatosForm((current) => ({ ...current, NotasProveedor: e.target.value }))}
                          className={`${operationFieldClass} resize-none`}
                        />
                      </Field>
                    </div>
                  </div>

                  {ficha.contacts?.length ? (
                    <div className="rounded-[24px] border border-[#e5ebf5] bg-white p-5 shadow-[0_12px_30px_rgba(15,45,93,0.05)]">
                      <OperationSectionTitle
                        eyebrow="Contacto"
                        title="Personas vinculadas"
                        description="Referencia rápida de contactos disponibles para negociación y seguimiento."
                      />
                      <div className="space-y-3">
                        {ficha.contacts.map((contacto, index) => (
                          <div key={`${contacto.Email || contacto.Name}-${index}`} className="rounded-[18px] border border-[#edf2f9] bg-[#f8fbff] px-4 py-3">
                            <div className="text-sm font-semibold text-slate-900">
                              {[contacto.Name, contacto.Lastname].filter(Boolean).join(" ") || "Contacto sin nombre"}
                            </div>
                            <div className="mt-1 text-sm text-slate-500">
                              {[contacto.Email, contacto.Phone].filter(Boolean).join(" · ") || "Sin datos de contacto"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => setFicha(null)} className={operationSecondaryButtonClass}>
                      Cerrar
                    </button>
                    <button type="submit" disabled={savingDatos} className={operationPrimaryButtonClass}>
                      {savingDatos ? "Guardando..." : "Guardar cambios"}
                    </button>
                  </div>
                </form>
              ) : null}

              {fichaTab === "precios" ? (
                <div className="space-y-5">
                  <div className="rounded-[24px] border border-[#e5ebf5] bg-white p-5 shadow-[0_12px_30px_rgba(15,45,93,0.05)]">
                    <OperationSectionTitle
                      eyebrow="Convenios"
                      title="Precios pactados"
                      description="Administra acuerdos por producto, materia prima o servicio para este proveedor."
                      aside={
                        <button
                          type="button"
                          onClick={() => {
                            setEditPrecioId(null);
                            setPrecioForm(defaultPrecio);
                            setShowPrecioForm(true);
                          }}
                          className={operationPrimaryButtonClass}
                        >
                          + Agregar precio
                        </button>
                      }
                    />

                    {(ficha.precios_pactados || []).length === 0 ? (
                      <OperationEmptyState
                        title="Sin precios pactados"
                        description="Agrega el primer acuerdo para dejar trazabilidad de costos por proveedor."
                      />
                    ) : (
                      <div className="space-y-3">
                        {ficha.precios_pactados.map((precio) => (
                          <div
                            key={precio.PrecioP_Id}
                            className="rounded-[20px] border border-[#e9eef7] bg-[linear-gradient(180deg,#ffffff,#f8fbff)] p-4 shadow-[0_8px_22px_rgba(15,45,93,0.04)]"
                          >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                              <div>
                                <div className="text-sm font-semibold text-slate-900">
                                  {precio.ProductoNombre || precio.MateriaPrimaNombre || precio.Descripcion || "-"}
                                </div>
                                <div className="mt-1 text-sm text-slate-500">
                                  {fmtMoney(precio.PrecioUnitario, precio.Moneda)} ·{" "}
                                  {precio.Vigencia ? `vigente hasta ${fmtDate(precio.Vigencia)}` : "sin vencimiento"}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => openEditPrecio(precio)} className={operationSecondaryButtonClass}>
                                  Editar
                                </button>
                                <button type="button" onClick={() => handleEliminarPrecio(precio)} className={operationDangerButtonClass}>
                                  Quitar
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {fichaTab === "historial" ? (
                <div className="rounded-[24px] border border-[#e5ebf5] bg-white p-5 shadow-[0_12px_30px_rgba(15,45,93,0.05)]">
                  <OperationSectionTitle
                    eyebrow="Historial"
                    title="Órdenes de compra"
                    description="Consulta el desempeño histórico y el volumen movido con este proveedor."
                  />

                  {(ficha.historial_oc || []).length === 0 ? (
                    <OperationEmptyState
                      title="Sin órdenes de compra registradas"
                      description="Cuando existan compras vinculadas a este proveedor aparecerán aquí."
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-[#e7edf6]">
                            {["Número OC", "Empresa", "Fecha", "Total", "Estatus"].map((header) => (
                              <th
                                key={header}
                                className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-0 last:pr-0"
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {ficha.historial_oc.map((oc) => (
                            <tr key={oc.OC_Id} className="border-t border-[#eef2f8]">
                              <td className="py-4 pr-4 text-sm font-semibold text-slate-900">{oc.NumeroOC}</td>
                              <td className="py-4 pr-4 text-sm text-slate-600">{oc.NameCompany || "-"}</td>
                              <td className="py-4 pr-4 text-sm text-slate-600">{fmtDate(oc.FechaOC)}</td>
                              <td className="py-4 pr-4 text-sm font-semibold text-slate-800">{fmtMoney(oc.Total, oc.Moneda)}</td>
                              <td className="py-4 text-sm">
                                <span
                                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                                    ESTATUS_OC[oc.Estatus] || ESTATUS_OC.BORRADOR
                                  }`}
                                >
                                  {oc.Estatus}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {showPrecioForm ? (
        <div className="fixed inset-0 z-[60] bg-black/50 p-4 backdrop-blur-[2px]">
          <div className="flex min-h-full items-center justify-center">
            <div className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_30px_80px_rgba(15,45,93,0.28)]">
              <div className="bg-[linear-gradient(135deg,#0f2556,#1d417f_55%,#2e68b4)] px-6 py-5 text-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-blue-100/75">Catálogo</p>
                    <h3 className="mt-1 text-xl font-semibold">{editPrecioId ? "Editar precio pactado" : "Nuevo precio pactado"}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPrecioForm(false)}
                    className="text-2xl leading-none text-white/70 transition hover:text-white"
                  >
                    {"\u00d7"}
                  </button>
                </div>
              </div>

              <form onSubmit={handleGuardarPrecio} className="space-y-4 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Tipo de artículo">
                    <select
                      value={precioForm.tipo}
                      onChange={(e) =>
                        setPrecioForm((current) => ({
                          ...current,
                          tipo: e.target.value,
                          Producto_Id: "",
                          MateriaPrima_Id: "",
                        }))
                      }
                      className={operationFieldClass}
                    >
                      <option value="producto">Producto</option>
                      <option value="materia">Materia prima</option>
                      <option value="otro">Otro / servicio</option>
                    </select>
                  </Field>

                  {precioForm.tipo === "producto" ? (
                    <Field label="Producto">
                      <select
                        value={precioForm.Producto_Id}
                        onChange={(e) => setPrecioForm((current) => ({ ...current, Producto_Id: e.target.value }))}
                        className={operationFieldClass}
                      >
                        <option value="">Seleccionar...</option>
                        {productos.map((producto) => (
                          <option key={producto.Producto_Id} value={producto.Producto_Id}>
                            {producto.Description || producto.Nombre}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : precioForm.tipo === "materia" ? (
                    <Field label="Materia prima">
                      <select
                        value={precioForm.MateriaPrima_Id}
                        onChange={(e) => setPrecioForm((current) => ({ ...current, MateriaPrima_Id: e.target.value }))}
                        className={operationFieldClass}
                      >
                        <option value="">Seleccionar...</option>
                        {materiasPrimas.map((materia) => (
                          <option key={materia.MateriaPrima_Id} value={materia.MateriaPrima_Id}>
                            {materia.Nombre || materia.Description}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : (
                    <Field label="Descripción" span>
                      <input
                        value={precioForm.Descripcion}
                        onChange={(e) => setPrecioForm((current) => ({ ...current, Descripcion: e.target.value }))}
                        className={operationFieldClass}
                        placeholder="Nombre del artículo o servicio"
                      />
                    </Field>
                  )}

                  <Field label="Precio unitario *">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={precioForm.PrecioUnitario}
                      onChange={(e) => setPrecioForm((current) => ({ ...current, PrecioUnitario: e.target.value }))}
                      className={operationFieldClass}
                    />
                  </Field>
                  <Field label="Moneda">
                    <select
                      value={precioForm.Moneda}
                      onChange={(e) => setPrecioForm((current) => ({ ...current, Moneda: e.target.value }))}
                      className={operationFieldClass}
                    >
                      <option value="MXN">MXN</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </Field>
                  <Field label="Vigencia">
                    <input
                      type="date"
                      value={precioForm.Vigencia}
                      onChange={(e) => setPrecioForm((current) => ({ ...current, Vigencia: e.target.value }))}
                      className={operationFieldClass}
                    />
                  </Field>
                </div>

                <div className="flex flex-wrap justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowPrecioForm(false)} className={operationSecondaryButtonClass}>
                    Cancelar
                  </button>
                  <button type="submit" disabled={savingPrecio} className={operationPrimaryButtonClass}>
                    {savingPrecio ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
