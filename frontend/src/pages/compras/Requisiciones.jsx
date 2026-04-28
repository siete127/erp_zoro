import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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

const STATUS_STYLES = {
  BORRADOR: "border-slate-200 bg-slate-50 text-slate-700",
  PENDIENTE_APROBACION: "border-amber-200 bg-amber-50 text-amber-700",
  APROBADA: "border-emerald-200 bg-emerald-50 text-emerald-700",
  RECHAZADA: "border-rose-200 bg-rose-50 text-rose-700",
  CONVERTIDA: "border-sky-200 bg-sky-50 text-sky-700",
  CANCELADA: "border-slate-200 bg-slate-100 text-slate-500",
};

const STATUS_LABELS = {
  BORRADOR: "Borrador",
  PENDIENTE_APROBACION: "Pendiente aprobación",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
  CONVERTIDA: "Convertida a OC",
  CANCELADA: "Cancelada",
};

const defaultForm = {
  Company_Id: "",
  FechaRequerida: "",
  Notas: "",
  lineas: [],
};

const defaultLinea = {
  Producto_Id: "",
  MateriaPrima_Id: "",
  Descripcion: "",
  CantidadSolicitada: 1,
  UnidadMedida: "",
  CostoEstimado: "",
  tipo: "producto",
};

const fmtDate = (value) => (value ? new Date(value).toLocaleDateString("es-MX") : "-");
const fmtMoney = (value) =>
  Number(value || 0).toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  });

function statusBadge(status) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
        STATUS_STYLES[status] || STATUS_STYLES.BORRADOR
      }`}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}

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

export default function Requisiciones() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reqIdFocus = searchParams.get("req_id");

  const [requisiciones, setRequisiciones] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [productos, setProductos] = useState([]);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEmpresa, setFiltroEmpresa] = useState("all");
  const [filtroEstatus, setFiltroEstatus] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [convertirModal, setConvertirModal] = useState(null);
  const [convertirProveedorId, setConvertirProveedorId] = useState("");
  const [convertirMoneda, setConvertirMoneda] = useState("MXN");
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reqRes, compRes, prodRes, mpRes, provRes] = await Promise.all([
        api.get("/requisiciones/"),
        api.get("/companies/"),
        api.get("/productos/"),
        api.get("/materias-primas/"),
        api.get("/clients/?ClientType=PROVEEDOR"),
      ]);
      setRequisiciones(Array.isArray(reqRes.data) ? reqRes.data : []);
      setCompanies(Array.isArray(compRes.data) ? compRes.data : compRes.data?.data || []);
      setProductos(Array.isArray(prodRes.data) ? prodRes.data : prodRes.data?.data || []);
      setMateriasPrimas(Array.isArray(mpRes.data) ? mpRes.data : mpRes.data?.data || []);
      setProveedores(Array.isArray(provRes.data) ? provRes.data : provRes.data?.data || []);
    } catch {
      notify.error("No fue posible cargar las requisiciones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const requisicionesFiltradas = useMemo(
    () =>
      requisiciones.filter((item) => {
        if (reqIdFocus && String(item.Req_Id) !== String(reqIdFocus)) return false;
        if (filtroEmpresa !== "all" && String(item.Company_Id) !== filtroEmpresa) return false;
        if (filtroEstatus && item.Estatus !== filtroEstatus) return false;
        return true;
      }),
    [requisiciones, reqIdFocus, filtroEmpresa, filtroEstatus],
  );

  const pendientes = requisicionesFiltradas.filter((item) => item.Estatus === "PENDIENTE_APROBACION").length;
  const aprobadas = requisicionesFiltradas.filter((item) => item.Estatus === "APROBADA").length;
  const totalEstimado = requisicionesFiltradas.reduce(
    (sum, item) => sum + Number(item.TotalEstimado || item.Total || 0),
    0,
  );

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const addLinea = () =>
    setForm((current) => ({
      ...current,
      lineas: [...current.lineas, { ...defaultLinea }],
    }));

  const removeLinea = (index) =>
    setForm((current) => ({
      ...current,
      lineas: current.lineas.filter((_, currentIndex) => currentIndex !== index),
    }));

  const handleLineaChange = (index, field, value) => {
    setForm((current) => {
      const lineas = [...current.lineas];
      lineas[index] = { ...lineas[index], [field]: value };
      if (field === "tipo") {
        lineas[index].Producto_Id = "";
        lineas[index].MateriaPrima_Id = "";
        lineas[index].Descripcion = "";
      }
      if (field === "Producto_Id" && value) {
        const producto = productos.find((item) => String(item.Producto_Id) === String(value));
        if (producto) lineas[index].Descripcion = producto.Description || producto.Nombre || "";
      }
      if (field === "MateriaPrima_Id" && value) {
        const materia = materiasPrimas.find((item) => String(item.MateriaPrima_Id) === String(value));
        if (materia) lineas[index].Descripcion = materia.Nombre || materia.Description || "";
      }
      return { ...current, lineas };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.Company_Id) {
      notify.error("Selecciona una empresa");
      return;
    }
    if (form.lineas.length === 0) {
      notify.error("Agrega al menos una línea");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        Company_Id: Number.parseInt(form.Company_Id, 10),
        FechaRequerida: form.FechaRequerida || null,
        Notas: form.Notas || null,
        lineas: form.lineas.map((linea) => ({
          Producto_Id: linea.tipo === "producto" && linea.Producto_Id ? Number.parseInt(linea.Producto_Id, 10) : null,
          MateriaPrima_Id:
            linea.tipo === "materia" && linea.MateriaPrima_Id
              ? Number.parseInt(linea.MateriaPrima_Id, 10)
              : null,
          Descripcion: linea.Descripcion || null,
          CantidadSolicitada: Number.parseFloat(linea.CantidadSolicitada) || 1,
          UnidadMedida: linea.UnidadMedida || null,
          CostoEstimado: linea.CostoEstimado ? Number.parseFloat(linea.CostoEstimado) : null,
        })),
      };
      await api.post("/requisiciones/", payload);
      notify.success("Requisición creada");
      setShowForm(false);
      setForm(defaultForm);
      fetchData();
    } catch (error) {
      notify.error(error?.response?.data?.detail || "No fue posible crear la requisición");
    } finally {
      setSaving(false);
    }
  };

  const handleEnviar = async (req) => {
    const ok = await confirm(`¿Enviar la requisición ${req.NumeroReq} a aprobación?`);
    if (!ok) return;
    try {
      await api.post(`/requisiciones/${req.Req_Id}/enviar`);
      notify.success("Requisición enviada a aprobación");
      fetchData();
    } catch (error) {
      notify.error(error?.response?.data?.detail || "No fue posible enviar la requisición");
    }
  };

  const handleAprobar = async (req, aprobado) => {
    const accion = aprobado ? "aprobar" : "rechazar";
    const ok = await confirm(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} la requisición ${req.NumeroReq}?`);
    if (!ok) return;
    try {
      await api.post(`/requisiciones/${req.Req_Id}/aprobacion`, { aprobado });
      notify.success(aprobado ? "Requisición aprobada" : "Requisición rechazada");
      fetchData();
    } catch (error) {
      notify.error(error?.response?.data?.detail || "No fue posible procesar la requisición");
    }
  };

  const handleConvertir = async () => {
    if (!convertirProveedorId) {
      notify.error("Selecciona un proveedor");
      return;
    }
    setSaving(true);
    try {
      const response = await api.post(`/requisiciones/${convertirModal.Req_Id}/convertir-oc`, {
        Proveedor_Id: Number.parseInt(convertirProveedorId, 10),
        Moneda: convertirMoneda,
      });
      notify.success("Requisición convertida a orden de compra");
      setConvertirModal(null);
      fetchData();
      if (response.data?.OC_Id) navigate(`/compras/${response.data.OC_Id}`);
    } catch (error) {
      notify.error(error?.response?.data?.detail || "No fue posible convertir la requisición");
    } finally {
      setSaving(false);
    }
  };

  const handlePrepararOC = (req) => {
    navigate(`/compras/nueva?requisicion_id=${req.Req_Id}`);
  };

  const handleDelete = async (req) => {
    const ok = await confirm(`¿Cancelar la requisición ${req.NumeroReq}? Esta acción no se puede deshacer.`);
    if (!ok) return;
    try {
      await api.delete(`/requisiciones/${req.Req_Id}`);
      notify.success("Requisición cancelada");
      fetchData();
    } catch (error) {
      notify.error(error?.response?.data?.detail || "No fue posible cancelar la requisición");
    }
  };

  return (
    <div className={operationPageClass}>
      <div className={operationContainerClass}>
        <OperationHeader
          eyebrow="Compras"
          title="Requisiciones"
          description="Captura solicitudes internas, envíalas a aprobación y conviértelas en órdenes de compra sin salir del flujo operativo."
          actions={
            <button
              type="button"
              onClick={() => {
                setForm(defaultForm);
                setShowForm(true);
              }}
              className={operationPrimaryButtonClass}
            >
              + Nueva requisición
            </button>
          }
          stats={[
            <OperationStat key="total" label="Requisiciones" value={requisicionesFiltradas.length} tone="blue" />,
            <OperationStat key="pendientes" label="Pendientes" value={pendientes} tone="amber" />,
            <OperationStat key="aprobadas" label="Aprobadas" value={aprobadas} tone="emerald" />,
            <OperationStat key="monto" label="Monto estimado" value={fmtMoney(totalEstimado)} tone="slate" />,
          ]}
        />

        {reqIdFocus ? (
          <div className="rounded-[20px] border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 shadow-[0_8px_24px_rgba(15,45,93,0.05)]">
            Mostrando la requisición #{reqIdFocus} desde la bandeja de aprobaciones.
          </div>
        ) : null}

        <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(246,249,253,0.97))] p-5 shadow-[0_18px_40px_rgba(15,45,93,0.08)]">
          <OperationSectionTitle
            eyebrow="Filtro"
            title="Vista de requisiciones"
            description="Refina por empresa o etapa del proceso para trabajar solo sobre el frente activo."
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Empresa">
              <select className={operationFieldClass} value={filtroEmpresa} onChange={(e) => setFiltroEmpresa(e.target.value)}>
                <option value="all">Todas las empresas</option>
                {companies.map((company) => (
                  <option key={company.Company_Id} value={String(company.Company_Id)}>
                    {company.NameCompany}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Estatus">
              <select className={operationFieldClass} value={filtroEstatus} onChange={(e) => setFiltroEstatus(e.target.value)}>
                <option value="">Todos los estatus</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <div className={operationTableShellClass}>
          <div className="border-b border-[#e7edf6] px-6 py-4">
            <OperationSectionTitle
              eyebrow="Control"
              title="Seguimiento de solicitudes"
              description="Gestiona el ciclo completo desde el borrador hasta la conversión a orden de compra."
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" />
            </div>
          ) : requisicionesFiltradas.length === 0 ? (
            <div className="p-6">
              <OperationEmptyState
                title="Sin requisiciones para mostrar"
                description="Cuando captures o filtres requisiciones activas aparecerán aquí con su flujo de aprobación."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#e7edf6]">
                    {["Número", "Empresa", "Solicitante", "Fecha requerida", "Estatus", "Acciones"].map((header) => (
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
                  {requisicionesFiltradas.map((req) => (
                    <tr key={req.Req_Id} className="border-t border-[#eef2f8] transition hover:bg-[#f7faff]">
                      <td className="px-4 py-4 pl-6">
                        <div className="text-sm font-semibold text-slate-900">{req.NumeroReq}</div>
                        <div className="text-xs text-slate-400">ID #{req.Req_Id}</div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">{req.NameCompany || req.Company_Id}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">{req.SolicitanteNombre || "-"}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">{fmtDate(req.FechaRequerida)}</td>
                      <td className="px-4 py-4">{statusBadge(req.Estatus)}</td>
                      <td className="px-4 py-4 pr-6">
                        <div className="flex flex-wrap gap-2">
                          {req.Estatus === "BORRADOR" ? (
                            <button type="button" onClick={() => handleEnviar(req)} className={operationPrimaryButtonClass}>
                              Enviar
                            </button>
                          ) : null}
                          {req.Estatus === "PENDIENTE_APROBACION" ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleAprobar(req, true)}
                                className="inline-flex items-center justify-center rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                              >
                                Aprobar
                              </button>
                              <button type="button" onClick={() => handleAprobar(req, false)} className={operationDangerButtonClass}>
                                Rechazar
                              </button>
                            </>
                          ) : null}
                          {req.Estatus === "APROBADA" ? (
                            <>
                              <button type="button" onClick={() => handlePrepararOC(req)} className={operationSecondaryButtonClass}>
                                Preparar OC
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setConvertirModal(req);
                                  setConvertirProveedorId("");
                                  setConvertirMoneda("MXN");
                                }}
                                className="inline-flex items-center justify-center rounded-[16px] border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
                              >
                                Conversión rápida
                              </button>
                            </>
                          ) : null}
                          {req.Estatus === "CONVERTIDA" && req.OC_Id ? (
                            <button
                              type="button"
                              onClick={() => navigate(`/compras/${req.OC_Id}`)}
                              className={operationSecondaryButtonClass}
                            >
                              Ver OC
                            </button>
                          ) : null}
                          {["BORRADOR", "RECHAZADA"].includes(req.Estatus) ? (
                            <button type="button" onClick={() => handleDelete(req)} className={operationDangerButtonClass}>
                              Cancelar
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showForm ? (
        <div className="fixed inset-0 z-50 bg-black/50 p-4 backdrop-blur-[2px]">
          <div className="flex min-h-full items-center justify-center">
            <div className="w-full max-w-6xl overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_30px_80px_rgba(15,45,93,0.28)]">
              <div className="bg-[linear-gradient(135deg,#0f2556,#1d417f_55%,#2e68b4)] px-6 py-5 text-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-blue-100/75">Compras</p>
                    <h3 className="mt-1 text-xl font-semibold">Nueva requisición</h3>
                    <p className="mt-1 text-sm text-blue-100/80">Configura la empresa, agrega líneas y envía la solicitud al flujo interno.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="text-2xl leading-none text-white/70 transition hover:text-white"
                  >
                    {"\u00d7"}
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="max-h-[88vh] overflow-y-auto bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-6">
                <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                  <div className="space-y-5">
                    <div className="rounded-[24px] border border-[#e5ebf5] bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,45,93,0.05)]">
                      <OperationSectionTitle
                        eyebrow="Cabecera"
                        title="Datos generales"
                        description="Define empresa, fecha comprometida y observaciones para Compras."
                      />
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Empresa *">
                          <select
                            name="Company_Id"
                            value={form.Company_Id}
                            onChange={handleFormChange}
                            required
                            className={operationFieldClass}
                          >
                            <option value="">Seleccionar...</option>
                            {companies.map((company) => (
                              <option key={company.Company_Id} value={company.Company_Id}>
                                {company.NameCompany}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Fecha requerida">
                          <input
                            type="date"
                            name="FechaRequerida"
                            value={form.FechaRequerida}
                            onChange={handleFormChange}
                            className={operationFieldClass}
                          />
                        </Field>
                        <Field label="Notas" span>
                          <textarea
                            name="Notas"
                            value={form.Notas}
                            onChange={handleFormChange}
                            rows={4}
                            className={`${operationFieldClass} resize-none`}
                          />
                        </Field>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-[#e5ebf5] bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,45,93,0.05)]">
                      <OperationSectionTitle
                        eyebrow="Resumen"
                        title="Vista rápida"
                        description="Controla el volumen antes de guardar."
                      />
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4">
                          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Líneas</p>
                          <p className="mt-2 text-2xl font-semibold text-slate-900">{form.lineas.length}</p>
                        </div>
                        <div className="rounded-[18px] border border-sky-200 bg-sky-50 px-4 py-4">
                          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Cantidad total</p>
                          <p className="mt-2 text-2xl font-semibold text-sky-800">
                            {form.lineas.reduce((sum, linea) => sum + Number(linea.CantidadSolicitada || 0), 0)}
                          </p>
                        </div>
                        <div className="rounded-[18px] border border-violet-200 bg-violet-50 px-4 py-4">
                          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Costo estimado</p>
                          <p className="mt-2 text-2xl font-semibold text-violet-800">
                            {fmtMoney(form.lineas.reduce((sum, linea) => sum + Number(linea.CostoEstimado || 0), 0))}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-[#e5ebf5] bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,45,93,0.05)]">
                    <OperationSectionTitle
                      eyebrow="Detalle"
                      title="Líneas de requisición"
                      description="Agrega productos, materias primas o conceptos libres con cantidad y costo estimado."
                      aside={
                        <button type="button" onClick={addLinea} className={operationPrimaryButtonClass}>
                          + Agregar línea
                        </button>
                      }
                    />

                    {form.lineas.length === 0 ? (
                      <OperationEmptyState
                        title="Aún no hay líneas"
                        description='Haz clic en "Agregar línea" para comenzar a capturar artículos.'
                      />
                    ) : (
                      <div className="space-y-4">
                        {form.lineas.map((linea, index) => (
                          <div
                            key={`${linea.tipo}-${index}`}
                            className="rounded-[22px] border border-[#e6edf7] bg-[linear-gradient(180deg,#ffffff,#f7faff)] p-4 shadow-[0_8px_24px_rgba(15,45,93,0.04)]"
                          >
                            <div className="mb-4 flex items-center justify-between gap-3">
                              <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96]">Línea {index + 1}</p>
                                <p className="text-sm text-slate-500">Define tipo, artículo, cantidad y referencia de costo.</p>
                              </div>
                              <button type="button" onClick={() => removeLinea(index)} className={operationDangerButtonClass}>
                                Quitar
                              </button>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                              <Field label="Tipo">
                                <select
                                  value={linea.tipo}
                                  onChange={(e) => handleLineaChange(index, "tipo", e.target.value)}
                                  className={operationFieldClass}
                                >
                                  <option value="producto">Producto</option>
                                  <option value="materia">Materia prima</option>
                                  <option value="otro">Otro</option>
                                </select>
                              </Field>

                              <div className="md:col-span-2 xl:col-span-2">
                                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">
                                  {linea.tipo === "producto"
                                    ? "Producto"
                                    : linea.tipo === "materia"
                                      ? "Materia prima"
                                      : "Descripción"}
                                </label>
                                {linea.tipo === "producto" ? (
                                  <select
                                    value={linea.Producto_Id}
                                    onChange={(e) => handleLineaChange(index, "Producto_Id", e.target.value)}
                                    className={operationFieldClass}
                                  >
                                    <option value="">Seleccionar...</option>
                                    {productos.map((producto) => (
                                      <option key={producto.Producto_Id} value={producto.Producto_Id}>
                                        {producto.Description || producto.Nombre}
                                      </option>
                                    ))}
                                  </select>
                                ) : linea.tipo === "materia" ? (
                                  <select
                                    value={linea.MateriaPrima_Id}
                                    onChange={(e) => handleLineaChange(index, "MateriaPrima_Id", e.target.value)}
                                    className={operationFieldClass}
                                  >
                                    <option value="">Seleccionar...</option>
                                    {materiasPrimas.map((materia) => (
                                      <option key={materia.MateriaPrima_Id} value={materia.MateriaPrima_Id}>
                                        {materia.Nombre || materia.Description}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    value={linea.Descripcion}
                                    onChange={(e) => handleLineaChange(index, "Descripcion", e.target.value)}
                                    className={operationFieldClass}
                                    placeholder="Descripción del artículo o servicio"
                                  />
                                )}
                              </div>

                              <Field label="Cantidad">
                                <input
                                  type="number"
                                  min="0.001"
                                  step="any"
                                  value={linea.CantidadSolicitada}
                                  onChange={(e) => handleLineaChange(index, "CantidadSolicitada", e.target.value)}
                                  className={operationFieldClass}
                                />
                              </Field>
                              <Field label="Unidad">
                                <input
                                  value={linea.UnidadMedida}
                                  onChange={(e) => handleLineaChange(index, "UnidadMedida", e.target.value)}
                                  className={operationFieldClass}
                                  placeholder="PZA, KG, LT..."
                                />
                              </Field>
                              <Field label="Costo estimado">
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={linea.CostoEstimado}
                                  onChange={(e) => handleLineaChange(index, "CostoEstimado", e.target.value)}
                                  className={operationFieldClass}
                                  placeholder="0.00"
                                />
                              </Field>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-[#e6edf7] pt-5">
                  <button type="button" onClick={() => setShowForm(false)} className={operationSecondaryButtonClass}>
                    Cancelar
                  </button>
                  <button type="submit" disabled={saving} className={operationPrimaryButtonClass}>
                    {saving ? "Guardando..." : "Crear requisición"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {convertirModal ? (
        <div className="fixed inset-0 z-50 bg-black/50 p-4 backdrop-blur-[2px]">
          <div className="flex min-h-full items-center justify-center">
            <div className="w-full max-w-xl overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_30px_80px_rgba(15,45,93,0.28)]">
              <div className="bg-[linear-gradient(135deg,#4f2d8f,#6b46c1_55%,#8b5cf6)] px-6 py-5 text-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-violet-100/75">Conversión</p>
                    <h3 className="mt-1 text-xl font-semibold">Convertir a orden de compra</h3>
                    <p className="mt-1 text-sm text-violet-100/80">
                      Requisición <span className="font-semibold">{convertirModal.NumeroReq}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConvertirModal(null)}
                    className="text-2xl leading-none text-white/70 transition hover:text-white"
                  >
                    {"\u00d7"}
                  </button>
                </div>
              </div>

              <div className="space-y-4 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-6">
                <Field label="Proveedor *">
                  <select
                    value={convertirProveedorId}
                    onChange={(e) => setConvertirProveedorId(e.target.value)}
                    className={operationFieldClass}
                  >
                    <option value="">Seleccionar proveedor...</option>
                    {proveedores.map((proveedor) => (
                      <option key={proveedor.Client_Id} value={proveedor.Client_Id}>
                        {proveedor.CommercialName || proveedor.LegalName || proveedor.NameClient || proveedor.Nombre}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Moneda">
                  <select value={convertirMoneda} onChange={(e) => setConvertirMoneda(e.target.value)} className={operationFieldClass}>
                    <option value="MXN">MXN</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </Field>

                <div className="flex flex-wrap justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setConvertirModal(null)} className={operationSecondaryButtonClass}>
                    Cancelar
                  </button>
                  <button type="button" onClick={handleConvertir} disabled={saving} className={operationPrimaryButtonClass}>
                    {saving ? "Procesando..." : "Convertir"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
