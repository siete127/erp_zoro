import React, { useState, useEffect } from "react";
import api from "../../services/api";
import confirm from "../../services/confirm";
import { notify } from "../../services/notify";

const defaultForm = { Company_Id: "", Nombre: "", Lider_Id: "", miembros: [] };

export default function EquiposVenta() {
  const [equipos, setEquipos] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEmpresa, setFiltroEmpresa] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editEquipo, setEditEquipo] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [detalle, setDetalle] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [eqRes, compRes, usrRes] = await Promise.all([
        api.get("/crm/equipos"),
        api.get("/companies/"),
        api.get("/users/"),
      ]);
      setEquipos(Array.isArray(eqRes.data) ? eqRes.data : []);
      setCompanies(Array.isArray(compRes.data) ? compRes.data : (compRes.data?.data || []));
      setUsuarios(Array.isArray(usrRes.data) ? usrRes.data : (usrRes.data?.data || []));
    } catch (e) {
      notify("Error cargando equipos", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const lista = equipos.filter((e) => filtroEmpresa === "all" || String(e.Company_Id) === filtroEmpresa);

  const openNuevo = () => { setEditEquipo(null); setForm(defaultForm); setShowForm(true); };
  const openEditar = async (equipo) => {
    try {
      const res = await api.get(`/crm/equipos/${equipo.Equipo_Id}`);
      const data = res.data;
      setEditEquipo(data);
      setForm({
        Company_Id: data.Company_Id,
        Nombre: data.Nombre,
        Lider_Id: data.Lider_Id || "",
        miembros: (data.miembros || []).map((m) => m.User_Id),
      });
      setShowForm(true);
    } catch (e) {
      notify("Error cargando equipo", "error");
    }
  };

  const toggleMiembro = (uid) => {
    setForm((f) => ({
      ...f,
      miembros: f.miembros.includes(uid)
        ? f.miembros.filter((m) => m !== uid)
        : [...f.miembros, uid],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.Nombre) { alert("El nombre es requerido"); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        Company_Id: parseInt(form.Company_Id),
        Lider_Id: form.Lider_Id ? parseInt(form.Lider_Id) : null,
      };
      if (editEquipo) {
        await api.put(`/crm/equipos/${editEquipo.Equipo_Id}`, { ...payload, Activo: true });
        notify("Equipo actualizado", "success");
      } else {
        await api.post("/crm/equipos", payload);
        notify("Equipo creado", "success");
      }
      setShowForm(false);
      fetchAll();
    } catch (err) {
      alert(err?.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleEliminar = async (equipo) => {
    if (!await confirm(`¿Eliminar el equipo "${equipo.Nombre}"? Se desvinculará de los leads.`)) return;
    try {
      await api.delete(`/crm/equipos/${equipo.Equipo_Id}`);
      notify("Equipo eliminado", "success");
      fetchAll();
    } catch (err) {
      alert(err?.response?.data?.detail || "Error");
    }
  };

  const verDetalle = async (equipo) => {
    try {
      const res = await api.get(`/crm/equipos/${equipo.Equipo_Id}`);
      setDetalle(res.data);
    } catch (e) {
      notify("Error", "error");
    }
  };

  // Filtrar usuarios de la empresa seleccionada en el form
  const usuariosEmpresa = form.Company_Id
    ? usuarios.filter((u) => !u.companies || u.companies?.includes(parseInt(form.Company_Id)))
    : usuarios;

  return (
    <div style={{ padding: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h2 style={{ margin: 0 }}>Equipos de Venta</h2>
        <button onClick={openNuevo} style={btnStyle("#0d6efd")}>+ Nuevo Equipo</button>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <select value={filtroEmpresa} onChange={(e) => setFiltroEmpresa(e.target.value)} style={selectStyle}>
          <option value="all">Todas las empresas</option>
          {companies.map((c) => <option key={c.Company_Id} value={String(c.Company_Id)}>{c.NameCompany}</option>)}
        </select>
      </div>

      {loading ? <p>Cargando...</p> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
          {lista.length === 0 ? (
            <p style={{ color: "#888" }}>Sin equipos configurados.</p>
          ) : lista.map((eq) => (
            <div key={eq.Equipo_Id} style={{ border: "1px solid #dee2e6", borderRadius: 10, padding: "1.25rem", background: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{eq.Nombre}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>{eq.NameCompany}</div>
                  {eq.LiderNombre && <div style={{ fontSize: 12, color: "#0d6efd", marginTop: 2 }}>Líder: {eq.LiderNombre}</div>}
                </div>
                <span style={{ background: "#e9ecef", borderRadius: 12, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>
                  {eq.TotalMiembros || 0} miembro{eq.TotalMiembros !== 1 ? "s" : ""}
                </span>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: "1rem" }}>
                <button onClick={() => verDetalle(eq)} style={btnStyle("#6c757d")}>Ver</button>
                <button onClick={() => openEditar(eq)} style={btnStyle("#0d6efd")}>Editar</button>
                <button onClick={() => handleEliminar(eq)} style={btnStyle("#dc3545")}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Nuevo/Editar Equipo */}
      {showForm && (
        <div style={overlayStyle}>
          <div style={{ background: "#fff", borderRadius: 10, padding: "2rem", width: "90%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ marginTop: 0 }}>{editEquipo ? "Editar Equipo" : "Nuevo Equipo de Venta"}</h3>
            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gap: "0.8rem" }}>
                {!editEquipo && (
                  <div>
                    <label style={labelStyle}>Empresa *</label>
                    <select value={form.Company_Id} onChange={(e) => setForm((f) => ({ ...f, Company_Id: e.target.value, miembros: [] }))} required style={inputStyle}>
                      <option value="">Seleccionar...</option>
                      {companies.map((c) => <option key={c.Company_Id} value={c.Company_Id}>{c.NameCompany}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label style={labelStyle}>Nombre del equipo *</label>
                  <input value={form.Nombre} onChange={(e) => setForm((f) => ({ ...f, Nombre: e.target.value }))} required style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Líder del equipo</label>
                  <select value={form.Lider_Id} onChange={(e) => setForm((f) => ({ ...f, Lider_Id: e.target.value }))} style={inputStyle}>
                    <option value="">Sin líder</option>
                    {usuarios.map((u) => <option key={u.User_Id} value={u.User_Id}>{u.Name} {u.Lastname} ({u.Username})</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Miembros</label>
                  <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #ced4da", borderRadius: 6, padding: "0.5rem" }}>
                    {usuarios.length === 0 ? (
                      <p style={{ color: "#888", margin: 0, fontSize: 13 }}>Sin usuarios disponibles</p>
                    ) : usuarios.map((u) => (
                      <label key={u.User_Id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", cursor: "pointer", fontSize: 13 }}>
                        <input
                          type="checkbox"
                          checked={form.miembros.includes(u.User_Id)}
                          onChange={() => toggleMiembro(u.User_Id)}
                        />
                        {u.Name} {u.Lastname} <span style={{ color: "#888", fontSize: 11 }}>({u.Username})</span>
                      </label>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>{form.miembros.length} miembro(s) seleccionado(s)</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end", marginTop: "1.5rem" }}>
                <button type="button" onClick={() => setShowForm(false)} style={btnStyle("#6c757d")}>Cancelar</button>
                <button type="submit" disabled={saving} style={btnStyle("#0d6efd")}>{saving ? "Guardando..." : (editEquipo ? "Actualizar" : "Crear Equipo")}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detalle Equipo */}
      {detalle && (
        <div style={overlayStyle}>
          <div style={{ background: "#fff", borderRadius: 10, padding: "2rem", width: 420 }}>
            <h3 style={{ marginTop: 0 }}>{detalle.Nombre}</h3>
            <p style={{ color: "#555", marginBottom: "0.5rem" }}><strong>Empresa:</strong> {detalle.NameCompany}</p>
            {detalle.LiderNombre && <p style={{ color: "#555", marginBottom: "0.5rem" }}><strong>Líder:</strong> {detalle.LiderNombre}</p>}
            <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Miembros ({(detalle.miembros || []).length}):</p>
            {(detalle.miembros || []).length === 0 ? (
              <p style={{ color: "#888", fontSize: 13 }}>Sin miembros asignados</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
                {detalle.miembros.map((m) => (
                  <li key={m.User_Id} style={{ fontSize: 14, marginBottom: 4 }}>
                    {m.Nombre} <span style={{ color: "#888", fontSize: 12 }}>({m.Username})</span>
                  </li>
                ))}
              </ul>
            )}
            <div style={{ marginTop: "1.5rem", textAlign: "right" }}>
              <button onClick={() => setDetalle(null)} style={btnStyle("#6c757d")}>Cerrar</button>
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
