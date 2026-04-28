import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import confirm from "../../services/confirm";
import { notify } from "../../services/notify";

const MODULOS = ["REQUISICION", "COTIZACION"];

const MODULO_LABELS = {
  REQUISICION: "Requisicion",
  COTIZACION: "Cotizacion",
};

const ESTATUS_COLORS = {
  PENDIENTE: "#fd7e14",
  APROBADO: "#198754",
  RECHAZADO: "#dc3545",
};

const defaultReglaForm = () => ({
  Regla_Id: null,
  Company_Id: "",
  Modulo: "REQUISICION",
  MontoMinimo: "",
  NivelesReq: 1,
  Aprobador1_Id: "",
  Aprobador2_Id: "",
  Activo: true,
});

const fmtDate = (value) => (value ? new Date(value).toLocaleDateString("es-MX") : "-");

function getDocumentoRoute(aprobacion) {
  if (aprobacion.Modulo === "COTIZACION") {
    return `/cotizaciones/${aprobacion.Documento_Id}`;
  }
  if (aprobacion.Modulo === "REQUISICION") {
    return `/compras/requisiciones?req_id=${aprobacion.Documento_Id}`;
  }
  return null;
}

export default function Aprobaciones() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("bandeja");
  const [aprobaciones, setAprobaciones] = useState([]);
  const [reglas, setReglas] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroModulo, setFiltroModulo] = useState("");
  const [filtroEstatus, setFiltroEstatus] = useState("PENDIENTE");
  const [filtroEmpresa, setFiltroEmpresa] = useState("all");
  const [reglaEmpresa, setReglaEmpresa] = useState("");
  const [showReglaForm, setShowReglaForm] = useState(false);
  const [reglaForm, setReglaForm] = useState(defaultReglaForm());
  const [savingDecision, setSavingDecision] = useState(null);
  const [comentariosModal, setComentariosModal] = useState(null);
  const [comentarioTexto, setComentarioTexto] = useState("");
  const [decisionPendiente, setDecisionPendiente] = useState(null);

  const fetchBandeja = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroModulo) params.append("Modulo", filtroModulo);
      if (filtroEstatus) params.append("Estatus", filtroEstatus);
      if (filtroEmpresa !== "all") params.append("Company_Id", filtroEmpresa);
      const res = await api.get(`/aprobaciones/?${params.toString()}`);
      setAprobaciones(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error(error);
      notify("Error al cargar la bandeja de aprobaciones", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchReglas = async () => {
    if (!reglaEmpresa) return;
    try {
      const res = await api.get(`/aprobaciones/reglas?company_id=${reglaEmpresa}`);
      setReglas(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error(error);
      notify("Error al cargar reglas de aprobacion", "error");
    }
  };

  const fetchCatalogos = async () => {
    try {
      const [compRes, usrRes] = await Promise.all([api.get("/companies/"), api.get("/users/")]);
      const comps = Array.isArray(compRes.data) ? compRes.data : compRes.data?.data || [];
      setCompanies(comps);
      setUsuarios(Array.isArray(usrRes.data) ? usrRes.data : usrRes.data?.data || []);
      if (comps.length > 0 && !reglaEmpresa) {
        setReglaEmpresa(String(comps[0].Company_Id));
      }
    } catch (error) {
      console.error(error);
      notify("Error al cargar catalogos", "error");
    }
  };

  useEffect(() => {
    fetchCatalogos();
  }, []);

  useEffect(() => {
    if (tab === "bandeja") fetchBandeja();
  }, [tab, filtroModulo, filtroEstatus, filtroEmpresa]);

  useEffect(() => {
    if (tab === "reglas") fetchReglas();
  }, [tab, reglaEmpresa]);

  const handleVerDocumento = (aprobacion) => {
    const route = getDocumentoRoute(aprobacion);
    if (!route) {
      notify("No hay ruta configurada para este modulo", "error");
      return;
    }
    navigate(route);
  };

  const handleDecidir = async (aprobacion, aprobado) => {
    if (!aprobado) {
      setDecisionPendiente({ aprobacion, aprobado });
      setComentariosModal(aprobacion);
      setComentarioTexto("");
      return;
    }
    const ok = await confirm(
      `Aprobar la solicitud de ${MODULO_LABELS[aprobacion.Modulo] || aprobacion.Modulo} #${aprobacion.Documento_Id}?`,
    );
    if (!ok) return;
    await ejecutarDecision(aprobacion.Aprobacion_Id, true, null);
  };

  const handleConfirmarRechazo = async () => {
    if (!decisionPendiente) return;
    await ejecutarDecision(
      decisionPendiente.aprobacion.Aprobacion_Id,
      false,
      comentarioTexto || null,
    );
    setComentariosModal(null);
    setDecisionPendiente(null);
  };

  const ejecutarDecision = async (id, aprobado, comentarios) => {
    setSavingDecision(id);
    try {
      await api.post(`/aprobaciones/${id}/decidir`, { aprobado, comentarios });
      notify("Solicitud procesada", "success");
      fetchBandeja();
    } catch (error) {
      notify(error?.response?.data?.detail || "Error al procesar la decision", "error");
    } finally {
      setSavingDecision(null);
    }
  };

  const handleGuardarRegla = async (event) => {
    event.preventDefault();
    try {
      const payload = {
        ...reglaForm,
        Company_Id: parseInt(reglaForm.Company_Id, 10),
        MontoMinimo: reglaForm.MontoMinimo !== "" ? parseFloat(reglaForm.MontoMinimo) : null,
        NivelesReq: parseInt(reglaForm.NivelesReq, 10),
        Aprobador1_Id: reglaForm.Aprobador1_Id ? parseInt(reglaForm.Aprobador1_Id, 10) : null,
        Aprobador2_Id: reglaForm.Aprobador2_Id ? parseInt(reglaForm.Aprobador2_Id, 10) : null,
      };
      await api.post("/aprobaciones/reglas", payload);
      notify("Regla guardada", "success");
      setShowReglaForm(false);
      setReglaForm(defaultReglaForm());
      fetchReglas();
    } catch (error) {
      notify(error?.response?.data?.detail || "Error al guardar regla", "error");
    }
  };

  const handleEliminarRegla = async (regla) => {
    const ok = await confirm(
      `Eliminar la regla de ${MODULO_LABELS[regla.Modulo] || regla.Modulo} para esta empresa?`,
    );
    if (!ok) return;

    try {
      await api.delete(`/aprobaciones/reglas/${regla.Regla_Id}`);
      notify("Regla eliminada", "success");
      fetchReglas();
    } catch (error) {
      notify(error?.response?.data?.detail || "Error al eliminar regla", "error");
    }
  };

  const pendientes = aprobaciones.filter((item) => item.Estatus === "PENDIENTE").length;

  return (
    <div style={{ padding: "1.5rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ margin: 0 }}>
          Aprobaciones
          {pendientes > 0 && (
            <span
              style={{
                marginLeft: 10,
                background: "#fd7e14",
                color: "#fff",
                borderRadius: 12,
                padding: "2px 10px",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {pendientes} pendiente{pendientes !== 1 ? "s" : ""}
            </span>
          )}
        </h2>
        <div style={{ display: "flex", gap: 8 }}>
          {["bandeja", "reglas"].map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              style={{ ...btnStyle(tab === item ? "#0d6efd" : "#6c757d"), padding: "0.4rem 1rem" }}
            >
              {item === "bandeja" ? "Bandeja" : "Configurar reglas"}
            </button>
          ))}
        </div>
      </div>

      {tab === "bandeja" && (
        <>
          <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
            <select
              value={filtroEmpresa}
              onChange={(event) => setFiltroEmpresa(event.target.value)}
              style={selectStyle}
            >
              <option value="all">Todas las empresas</option>
              {companies.map((company) => (
                <option key={company.Company_Id} value={String(company.Company_Id)}>
                  {company.NameCompany}
                </option>
              ))}
            </select>
            <select
              value={filtroModulo}
              onChange={(event) => setFiltroModulo(event.target.value)}
              style={selectStyle}
            >
              <option value="">Todos los modulos</option>
              {MODULOS.map((modulo) => (
                <option key={modulo} value={modulo}>
                  {MODULO_LABELS[modulo]}
                </option>
              ))}
            </select>
            <select
              value={filtroEstatus}
              onChange={(event) => setFiltroEstatus(event.target.value)}
              style={selectStyle}
            >
              <option value="">Todos los estatus</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="APROBADO">Aprobado</option>
              <option value="RECHAZADO">Rechazado</option>
            </select>
          </div>

          {loading ? (
            <p>Cargando...</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ background: "#f1f3f5" }}>
                    {[
                      "Modulo",
                      "Documento #",
                      "Empresa",
                      "Aprobador",
                      "Fecha Solicitud",
                      "Estatus",
                      "Acciones",
                    ].map((header) => (
                      <th key={header} style={thStyle}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {aprobaciones.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: "#888" }}>
                        Sin solicitudes
                      </td>
                    </tr>
                  ) : (
                    aprobaciones.map((aprobacion) => (
                      <tr key={aprobacion.Aprobacion_Id} style={{ borderBottom: "1px solid #dee2e6" }}>
                        <td style={tdStyle}>
                          <strong>{MODULO_LABELS[aprobacion.Modulo] || aprobacion.Modulo}</strong>
                        </td>
                        <td style={tdStyle}>#{aprobacion.Documento_Id}</td>
                        <td style={tdStyle}>{aprobacion.NameCompany || aprobacion.Company_Id}</td>
                        <td style={tdStyle}>{aprobacion.AprobadorNombre || "-"}</td>
                        <td style={tdStyle}>{fmtDate(aprobacion.FechaSolicitud)}</td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              background: ESTATUS_COLORS[aprobacion.Estatus] || "#adb5bd",
                              color: "#fff",
                              borderRadius: 4,
                              padding: "2px 8px",
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            {aprobacion.Estatus}
                          </span>
                          {aprobacion.Comentarios && (
                            <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                              {aprobacion.Comentarios}
                            </div>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button
                              onClick={() => handleVerDocumento(aprobacion)}
                              style={btnStyle("#0d6efd")}
                            >
                              Ver documento
                            </button>
                            {aprobacion.Estatus === "PENDIENTE" && (
                              <>
                                <button
                                  disabled={savingDecision === aprobacion.Aprobacion_Id}
                                  onClick={() => handleDecidir(aprobacion, true)}
                                  style={btnStyle("#198754")}
                                >
                                  Aprobar
                                </button>
                                <button
                                  disabled={savingDecision === aprobacion.Aprobacion_Id}
                                  onClick={() => handleDecidir(aprobacion, false)}
                                  style={btnStyle("#dc3545")}
                                >
                                  Rechazar
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === "reglas" && (
        <>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
            <select
              value={reglaEmpresa}
              onChange={(event) => setReglaEmpresa(event.target.value)}
              style={selectStyle}
            >
              <option value="">Seleccionar empresa...</option>
              {companies.map((company) => (
                <option key={company.Company_Id} value={String(company.Company_Id)}>
                  {company.NameCompany}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                setReglaForm({ ...defaultReglaForm(), Company_Id: reglaEmpresa });
                setShowReglaForm(true);
              }}
              disabled={!reglaEmpresa}
              style={btnStyle("#0d6efd")}
            >
              + Nueva regla
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#f1f3f5" }}>
                  {[
                    "Modulo",
                    "Monto Minimo",
                    "Niveles",
                    "Aprobador 1",
                    "Aprobador 2",
                    "Activo",
                    "Acciones",
                  ].map((header) => (
                    <th key={header} style={thStyle}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reglas.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: "#888" }}>
                      {reglaEmpresa
                        ? "Sin reglas configuradas para esta empresa"
                        : "Selecciona una empresa"}
                    </td>
                  </tr>
                ) : (
                  reglas.map((regla) => (
                    <tr key={regla.Regla_Id} style={{ borderBottom: "1px solid #dee2e6" }}>
                      <td style={tdStyle}>
                        <strong>{MODULO_LABELS[regla.Modulo] || regla.Modulo}</strong>
                      </td>
                      <td style={tdStyle}>
                        {regla.MontoMinimo != null
                          ? `$${Number(regla.MontoMinimo).toLocaleString("es-MX")}`
                          : "Siempre"}
                      </td>
                      <td style={tdStyle}>{regla.NivelesReq}</td>
                      <td style={tdStyle}>{regla.Aprobador1Nombre || "-"}</td>
                      <td style={tdStyle}>{regla.Aprobador2Nombre || "-"}</td>
                      <td style={tdStyle}>
                        <span style={{ color: regla.Activo ? "#198754" : "#dc3545", fontWeight: 700 }}>
                          {regla.Activo ? "Si" : "No"}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={() => {
                              setReglaForm({
                                ...regla,
                                MontoMinimo: regla.MontoMinimo ?? "",
                                Aprobador1_Id: regla.Aprobador1_Id ?? "",
                                Aprobador2_Id: regla.Aprobador2_Id ?? "",
                              });
                              setShowReglaForm(true);
                            }}
                            style={btnStyle("#6c757d")}
                          >
                            Editar
                          </button>
                          <button onClick={() => handleEliminarRegla(regla)} style={btnStyle("#dc3545")}>
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showReglaForm && (
        <div style={overlayStyle}>
          <div style={{ background: "#fff", borderRadius: 10, padding: "2rem", width: 480 }}>
            <h3 style={{ marginTop: 0 }}>
              {reglaForm.Regla_Id ? "Editar regla" : "Nueva regla de aprobacion"}
            </h3>
            <form onSubmit={handleGuardarRegla}>
              <div style={{ display: "grid", gap: "0.8rem" }}>
                <div>
                  <label style={labelStyle}>Modulo *</label>
                  <select
                    value={reglaForm.Modulo}
                    onChange={(event) =>
                      setReglaForm((prev) => ({ ...prev, Modulo: event.target.value }))
                    }
                    required
                    style={inputStyle}
                  >
                    {MODULOS.map((modulo) => (
                      <option key={modulo} value={modulo}>
                        {MODULO_LABELS[modulo]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Monto minimo (vacio = aplica siempre)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={reglaForm.MontoMinimo}
                    onChange={(event) =>
                      setReglaForm((prev) => ({ ...prev, MontoMinimo: event.target.value }))
                    }
                    style={inputStyle}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Niveles de aprobacion</label>
                  <select
                    value={reglaForm.NivelesReq}
                    onChange={(event) =>
                      setReglaForm((prev) => ({ ...prev, NivelesReq: event.target.value }))
                    }
                    style={inputStyle}
                  >
                    <option value={1}>1 nivel</option>
                    <option value={2}>2 niveles</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Aprobador nivel 1</label>
                  <select
                    value={reglaForm.Aprobador1_Id}
                    onChange={(event) =>
                      setReglaForm((prev) => ({ ...prev, Aprobador1_Id: event.target.value }))
                    }
                    style={inputStyle}
                  >
                    <option value="">Sin asignar</option>
                    {usuarios.map((usuario) => (
                      <option key={usuario.User_Id} value={usuario.User_Id}>
                        {usuario.Name} {usuario.Lastname} ({usuario.Username})
                      </option>
                    ))}
                  </select>
                </div>
                {parseInt(reglaForm.NivelesReq, 10) === 2 && (
                  <div>
                    <label style={labelStyle}>Aprobador nivel 2</label>
                    <select
                      value={reglaForm.Aprobador2_Id}
                      onChange={(event) =>
                        setReglaForm((prev) => ({ ...prev, Aprobador2_Id: event.target.value }))
                      }
                      style={inputStyle}
                    >
                      <option value="">Sin asignar</option>
                      {usuarios.map((usuario) => (
                        <option key={usuario.User_Id} value={usuario.User_Id}>
                          {usuario.Name} {usuario.Lastname} ({usuario.Username})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    id="activo"
                    checked={reglaForm.Activo}
                    onChange={(event) =>
                      setReglaForm((prev) => ({ ...prev, Activo: event.target.checked }))
                    }
                  />
                  <label htmlFor="activo" style={{ fontSize: 14, cursor: "pointer" }}>
                    Regla activa
                  </label>
                </div>
              </div>
              <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end", marginTop: "1.5rem" }}>
                <button type="button" onClick={() => setShowReglaForm(false)} style={btnStyle("#6c757d")}>
                  Cancelar
                </button>
                <button type="submit" style={btnStyle("#0d6efd")}>
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {comentariosModal && (
        <div style={overlayStyle}>
          <div style={{ background: "#fff", borderRadius: 10, padding: "2rem", width: 420 }}>
            <h3 style={{ marginTop: 0, color: "#dc3545" }}>Rechazar solicitud</h3>
            <p style={{ color: "#555", marginBottom: "0.75rem" }}>
              {MODULO_LABELS[comentariosModal.Modulo]} #{comentariosModal.Documento_Id}
            </p>
            <label style={labelStyle}>Motivo de rechazo (opcional)</label>
            <textarea
              value={comentarioTexto}
              onChange={(event) => setComentarioTexto(event.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: "vertical", marginBottom: "1rem" }}
              placeholder="Explica el motivo del rechazo..."
            />
            <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setComentariosModal(null);
                  setDecisionPendiente(null);
                }}
                style={btnStyle("#6c757d")}
              >
                Cancelar
              </button>
              <button onClick={handleConfirmarRechazo} style={btnStyle("#dc3545")}>
                Confirmar rechazo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const btnStyle = (background) => ({
  background,
  color: "#fff",
  border: "none",
  borderRadius: 5,
  padding: "0.3rem 0.8rem",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  whiteSpace: "nowrap",
});

const selectStyle = {
  padding: "0.4rem 0.8rem",
  borderRadius: 6,
  border: "1px solid #ccc",
  fontSize: 14,
};

const labelStyle = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 3,
  color: "#555",
};

const inputStyle = {
  width: "100%",
  padding: "0.4rem 0.6rem",
  borderRadius: 6,
  border: "1px solid #ced4da",
  fontSize: 14,
  boxSizing: "border-box",
};

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const thStyle = {
  padding: "0.6rem 0.8rem",
  textAlign: "left",
  borderBottom: "2px solid #dee2e6",
  whiteSpace: "nowrap",
};

const tdStyle = { padding: "0.6rem 0.8rem" };
