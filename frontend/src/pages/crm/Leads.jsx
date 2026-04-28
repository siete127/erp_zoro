import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import confirm from "../../services/confirm";
import { notify } from "../../services/notify";

const STATUS_COLORS = {
  NUEVO: "#0d6efd",
  CONTACTADO: "#fd7e14",
  CALIFICADO: "#198754",
  DESCARTADO: "#adb5bd",
  CONVERTIDO: "#6f42c1",
};

const STATUS_LABELS = {
  NUEVO: "Nuevo",
  CONTACTADO: "Contactado",
  CALIFICADO: "Calificado",
  DESCARTADO: "Descartado",
  CONVERTIDO: "Convertido",
};

const ORIGENES = ["Web", "Llamada", "Referido", "Evento", "Redes sociales", "Otro"];

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("es-MX") : "—");

const defaultForm = {
  Company_Id: "", Nombre: "", Email: "", Telefono: "", Empresa: "",
  Cargo: "", Origen: "", Asignado_Id: "", Equipo_Id: "", Notas: "",
};

const defaultConvertir = { NombreOportunidad: "", Client_Id: "", MontoEstimado: "", Probabilidad: 50 };

export default function Leads() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroEmpresa, setFiltroEmpresa] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [convertirModal, setConvertirModal] = useState(null);
  const [convertirForm, setConvertirForm] = useState(defaultConvertir);
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [leadsRes, compRes, usrRes, eqRes, cliRes] = await Promise.all([
        api.get("/crm/leads"),
        api.get("/companies/"),
        api.get("/users/"),
        api.get("/crm/equipos"),
        api.get("/clients/"),
      ]);
      setLeads(Array.isArray(leadsRes.data) ? leadsRes.data : []);
      setCompanies(Array.isArray(compRes.data) ? compRes.data : (compRes.data?.data || []));
      setUsuarios(Array.isArray(usrRes.data) ? usrRes.data : (usrRes.data?.data || []));
      setEquipos(Array.isArray(eqRes.data) ? eqRes.data : []);
      setClientes(Array.isArray(cliRes.data) ? cliRes.data : (cliRes.data?.data || []));
    } catch (e) {
      notify("Error cargando leads", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const lista = leads.filter((l) => {
    if (filtroStatus && l.Status !== filtroStatus) return false;
    if (filtroEmpresa !== "all" && String(l.Company_Id) !== filtroEmpresa) return false;
    return true;
  });

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const openNuevo = () => { setEditLead(null); setForm(defaultForm); setShowForm(true); };
  const openEditar = (lead) => {
    setEditLead(lead);
    setForm({
      Company_Id: lead.Company_Id, Nombre: lead.Nombre, Email: lead.Email || "",
      Telefono: lead.Telefono || "", Empresa: lead.Empresa || "", Cargo: lead.Cargo || "",
      Origen: lead.Origen || "", Asignado_Id: lead.Asignado_Id || "",
      Equipo_Id: lead.Equipo_Id || "", Notas: lead.Notas || "",
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.Company_Id) { alert("Selecciona una empresa"); return; }
    if (!form.Nombre) { alert("El nombre es requerido"); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        Company_Id: parseInt(form.Company_Id),
        Asignado_Id: form.Asignado_Id ? parseInt(form.Asignado_Id) : null,
        Equipo_Id: form.Equipo_Id ? parseInt(form.Equipo_Id) : null,
      };
      if (editLead) {
        await api.put(`/crm/leads/${editLead.Lead_Id}`, payload);
        notify("Lead actualizado", "success");
      } else {
        await api.post("/crm/leads", payload);
        notify("Lead creado", "success");
      }
      setShowForm(false);
      fetchAll();
    } catch (err) {
      alert(err?.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleCambiarStatus = async (lead, nuevoStatus) => {
    try {
      await api.put(`/crm/leads/${lead.Lead_Id}`, { Status: nuevoStatus });
      fetchAll();
    } catch (err) {
      alert(err?.response?.data?.detail || "Error");
    }
  };

  const handleConvertir = async () => {
    setSaving(true);
    try {
      const payload = {
        NombreOportunidad: convertirForm.NombreOportunidad || null,
        Client_Id: convertirForm.Client_Id ? parseInt(convertirForm.Client_Id) : null,
        MontoEstimado: convertirForm.MontoEstimado ? parseFloat(convertirForm.MontoEstimado) : null,
        Probabilidad: parseInt(convertirForm.Probabilidad) || 50,
      };
      const res = await api.post(`/crm/leads/${convertirModal.Lead_Id}/convertir`, payload);
      notify("Lead convertido a oportunidad", "success");
      setConvertirModal(null);
      fetchAll();
      if (res.data?.Oportunidad_Id) navigate(`/crm/oportunidades/${res.data.Oportunidad_Id}`);
    } catch (err) {
      alert(err?.response?.data?.detail || "Error al convertir");
    } finally {
      setSaving(false);
    }
  };

  const handleDescartar = async (lead) => {
    if (!await confirm(`¿Descartar el lead "${lead.Nombre}"?`)) return;
    try {
      await api.delete(`/crm/leads/${lead.Lead_Id}`);
      fetchAll();
    } catch (err) {
      alert(err?.response?.data?.detail || "Error");
    }
  };

  const byStatus = (s) => lista.filter((l) => l.Status === s).length;

  return (
    <div style={{ padding: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h2 style={{ margin: 0 }}>Leads CRM</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => navigate("/crm/equipos")} style={btnStyle("#6c757d")}>Equipos de Venta</button>
          <button onClick={openNuevo} style={btnStyle("#0d6efd")}>+ Nuevo Lead</button>
        </div>
      </div>

      {/* Contadores por status */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {Object.entries(STATUS_LABELS).map(([k, v]) => (
          <div key={k} onClick={() => setFiltroStatus(filtroStatus === k ? "" : k)}
            style={{ background: filtroStatus === k ? STATUS_COLORS[k] : "#f8f9fa", color: filtroStatus === k ? "#fff" : "#333", borderRadius: 8, padding: "0.5rem 1rem", cursor: "pointer", border: `2px solid ${STATUS_COLORS[k]}`, fontWeight: 600, fontSize: 13 }}>
            {v} <span style={{ fontSize: 16 }}>{byStatus(k)}</span>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
        <select value={filtroEmpresa} onChange={(e) => setFiltroEmpresa(e.target.value)} style={selectStyle}>
          <option value="all">Todas las empresas</option>
          {companies.map((c) => <option key={c.Company_Id} value={String(c.Company_Id)}>{c.NameCompany}</option>)}
        </select>
      </div>

      {loading ? <p>Cargando...</p> : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#f1f3f5" }}>
                {["Nombre", "Empresa", "Email / Teléfono", "Origen", "Asignado", "Último Contacto", "Status", "Acciones"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: "2rem", textAlign: "center", color: "#888" }}>Sin leads</td></tr>
              ) : lista.map((l) => (
                <tr key={l.Lead_Id} style={{ borderBottom: "1px solid #dee2e6" }}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600 }}>{l.Nombre}</div>
                    {l.Cargo && <div style={{ fontSize: 11, color: "#666" }}>{l.Cargo}</div>}
                  </td>
                  <td style={tdStyle}>{l.Empresa || "—"}</td>
                  <td style={tdStyle}>
                    {l.Email && <div>{l.Email}</div>}
                    {l.Telefono && <div style={{ color: "#555" }}>{l.Telefono}</div>}
                  </td>
                  <td style={tdStyle}>{l.Origen || "—"}</td>
                  <td style={tdStyle}>{l.AsignadoNombre || "—"}</td>
                  <td style={tdStyle}>{fmtDate(l.FechaUltimoContacto)}</td>
                  <td style={tdStyle}>
                    <span style={{ background: STATUS_COLORS[l.Status] || "#adb5bd", color: "#fff", borderRadius: 4, padding: "2px 8px", fontSize: 12, fontWeight: 600 }}>
                      {STATUS_LABELS[l.Status] || l.Status}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      <button onClick={() => openEditar(l)} style={btnStyle("#6c757d")}>Editar</button>
                      {l.Status === "NUEVO" && (
                        <button onClick={() => handleCambiarStatus(l, "CONTACTADO")} style={btnStyle("#fd7e14")}>Contactar</button>
                      )}
                      {l.Status === "CONTACTADO" && (
                        <button onClick={() => handleCambiarStatus(l, "CALIFICADO")} style={btnStyle("#198754")}>Calificar</button>
                      )}
                      {["NUEVO", "CONTACTADO", "CALIFICADO"].includes(l.Status) && (
                        <button onClick={() => { setConvertirModal(l); setConvertirForm({ ...defaultConvertir, NombreOportunidad: `Oportunidad — ${l.Nombre}` }); }} style={btnStyle("#6f42c1")}>Convertir</button>
                      )}
                      {!["CONVERTIDO", "DESCARTADO"].includes(l.Status) && (
                        <button onClick={() => handleDescartar(l)} style={btnStyle("#dc3545")}>Descartar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Nuevo/Editar Lead */}
      {showForm && (
        <div style={overlayStyle}>
          <div style={{ background: "#fff", borderRadius: 10, padding: "2rem", width: "90%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ marginTop: 0 }}>{editLead ? "Editar Lead" : "Nuevo Lead"}</h3>
            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem" }}>
                {!editLead && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>Empresa *</label>
                    <select name="Company_Id" value={form.Company_Id} onChange={handleFormChange} required style={inputStyle}>
                      <option value="">Seleccionar...</option>
                      {companies.map((c) => <option key={c.Company_Id} value={c.Company_Id}>{c.NameCompany}</option>)}
                    </select>
                  </div>
                )}
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Nombre *</label>
                  <input name="Nombre" value={form.Nombre} onChange={handleFormChange} required style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input type="email" name="Email" value={form.Email} onChange={handleFormChange} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Teléfono</label>
                  <input name="Telefono" value={form.Telefono} onChange={handleFormChange} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Empresa / Organización</label>
                  <input name="Empresa" value={form.Empresa} onChange={handleFormChange} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Cargo</label>
                  <input name="Cargo" value={form.Cargo} onChange={handleFormChange} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Origen</label>
                  <select name="Origen" value={form.Origen} onChange={handleFormChange} style={inputStyle}>
                    <option value="">Seleccionar...</option>
                    {ORIGENES.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Asignado a</label>
                  <select name="Asignado_Id" value={form.Asignado_Id} onChange={handleFormChange} style={inputStyle}>
                    <option value="">Sin asignar</option>
                    {usuarios.map((u) => <option key={u.User_Id} value={u.User_Id}>{u.Name} {u.Lastname}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Equipo</label>
                  <select name="Equipo_Id" value={form.Equipo_Id} onChange={handleFormChange} style={inputStyle}>
                    <option value="">Sin equipo</option>
                    {equipos.map((e) => <option key={e.Equipo_Id} value={e.Equipo_Id}>{e.Nombre}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Notas</label>
                  <textarea name="Notas" value={form.Notas} onChange={handleFormChange} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end", marginTop: "1.5rem" }}>
                <button type="button" onClick={() => setShowForm(false)} style={btnStyle("#6c757d")}>Cancelar</button>
                <button type="submit" disabled={saving} style={btnStyle("#0d6efd")}>{saving ? "Guardando..." : (editLead ? "Actualizar" : "Crear Lead")}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Convertir a Oportunidad */}
      {convertirModal && (
        <div style={overlayStyle}>
          <div style={{ background: "#fff", borderRadius: 10, padding: "2rem", width: 460 }}>
            <h3 style={{ marginTop: 0, color: "#6f42c1" }}>Convertir a Oportunidad</h3>
            <p style={{ color: "#555", marginBottom: "1rem" }}>Lead: <strong>{convertirModal.Nombre}</strong></p>
            <div style={{ display: "grid", gap: "0.8rem" }}>
              <div>
                <label style={labelStyle}>Nombre de la Oportunidad</label>
                <input value={convertirForm.NombreOportunidad} onChange={(e) => setConvertirForm((f) => ({ ...f, NombreOportunidad: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Cliente vinculado</label>
                <select value={convertirForm.Client_Id} onChange={(e) => setConvertirForm((f) => ({ ...f, Client_Id: e.target.value }))} style={inputStyle}>
                  <option value="">Sin cliente</option>
                  {clientes.map((c) => <option key={c.Client_Id} value={c.Client_Id}>{c.NameClient || c.CommercialName}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Monto estimado</label>
                <input type="number" min="0" step="any" value={convertirForm.MontoEstimado} onChange={(e) => setConvertirForm((f) => ({ ...f, MontoEstimado: e.target.value }))} style={inputStyle} placeholder="0.00" />
              </div>
              <div>
                <label style={labelStyle}>Probabilidad (%)</label>
                <input type="number" min="0" max="100" value={convertirForm.Probabilidad} onChange={(e) => setConvertirForm((f) => ({ ...f, Probabilidad: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end", marginTop: "1.5rem" }}>
              <button onClick={() => setConvertirModal(null)} style={btnStyle("#6c757d")}>Cancelar</button>
              <button onClick={handleConvertir} disabled={saving} style={btnStyle("#6f42c1")}>{saving ? "Procesando..." : "Convertir"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const btnStyle = (bg) => ({ background: bg, color: "#fff", border: "none", borderRadius: 5, padding: "0.3rem 0.8rem", cursor: "pointer", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" });
const selectStyle = { padding: "0.4rem 0.8rem", borderRadius: 6, border: "1px solid #ccc", fontSize: 14 };
const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 3, color: "#555" };
const inputStyle = { width: "100%", padding: "0.4rem 0.6rem", borderRadius: 6, border: "1px solid #ced4da", fontSize: 14, boxSizing: "border-box" };
const overlayStyle = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 };
const thStyle = { padding: "0.6rem 0.8rem", textAlign: "left", borderBottom: "2px solid #dee2e6", whiteSpace: "nowrap" };
const tdStyle = { padding: "0.6rem 0.8rem" };
