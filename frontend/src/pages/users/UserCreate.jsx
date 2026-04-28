import { useState, useEffect, useMemo } from "react";
import api from "../../services/api";
import { isValidPhoneNumber } from 'libphonenumber-js';
import { getUserCompanies, getUserRole } from '../../utils/tokenHelper';

// ---------- Perfiles predefinidos ----------
const PERFILES = [
  {
    id: "vendedor",
    nombre: "Vendedor",
    icono: "🛒",
    modulos: ["dashboard", "clients", "crm", "sales", "quotes", "products"],
    descripcion: "Clientes, CRM, Ventas y Productos",
  },
  {
    id: "compras",
    nombre: "Compras",
    icono: "📦",
    modulos: ["dashboard", "purchases", "products", "inventory"],
    descripcion: "Compras, Inventario y Productos",
  },
  {
    id: "contador",
    nombre: "Contador",
    icono: "📊",
    modulos: ["dashboard", "accounting", "fixed_assets", "reporteria", "companies"],
    descripcion: "Contabilidad, Activos, Reportes",
  },
  {
    id: "rh",
    nombre: "RH",
    icono: "👥",
    modulos: ["dashboard", "rh", "users", "expenses"],
    descripcion: "Recursos Humanos, Usuarios, Gastos",
  },
  {
    id: "operaciones",
    nombre: "Operaciones",
    icono: "⚙️",
    modulos: ["dashboard", "production", "bom", "inventory", "products"],
    descripcion: "Producción, Recetas, Inventario",
  },
  {
    id: "admin_completo",
    nombre: "Admin completo",
    icono: "🔑",
    modulos: [
      "dashboard","users","rh","clients","crm","sales","purchases","products",
      "inventory","production","bom","reporteria","accounting","fixed_assets","quotes",
      "companies","projects","helpdesk","expenses","website","marketing","fleet",
      "surveys","subscriptions",
    ],
    descripcion: "Acceso total al sistema",
  },
];

const ALL_MODULES = [
  { key: "dashboard", label: "Inicio" },
  { key: "users", label: "Usuarios" },
  { key: "rh", label: "RH / Nómina / Asistencia" },
  { key: "clients", label: "Clientes" },
  { key: "crm", label: "CRM" },
  { key: "sales", label: "Ventas" },
  { key: "quotes", label: "Cotizaciones" },
  { key: "purchases", label: "Compras / Aprobaciones" },
  { key: "products", label: "Productos" },
  { key: "inventory", label: "Inventario / Almacenes" },
  { key: "production", label: "Producción / Mantenimiento" },
  { key: "bom", label: "Recetas de producción" },
  { key: "reporteria", label: "Reportería" },
  { key: "accounting", label: "Contabilidad" },
  { key: "fixed_assets", label: "Activos Fijos" },
  { key: "companies", label: "Licencias / Configuración" },
  { key: "projects", label: "Proyectos" },
  { key: "helpdesk", label: "Helpdesk" },
  { key: "expenses", label: "Gastos" },
  { key: "website", label: "Website" },
  { key: "marketing", label: "Marketing" },
  { key: "fleet", label: "Flotilla" },
  { key: "surveys", label: "Encuestas" },
  { key: "subscriptions", label: "Suscripciones" },
];

const SENSITIVE = new Set(["users", "companies", "accounting"]);
const SUPERADMIN_ROLE_ID = 1;
const FIXED_ADMIN_ROLE_ID = 2;

export default function UserCreate({ onCreated, editMode = false, initialData = null, onSaved, onCancel, allowedCompanyIds = [], isSuperAdmin = false } = {}) {
  const [form, setForm] = useState({
    Name: "",
    Lastname: "",
    Username: "",
    Password: "",
    ConfirmPassword: "",
    Email: "",
    PhoneNumber: "",
    Area: "",
    RolId: "",
    Company_Ids: [],
    IsActive: true
  });
  const [roles, setRoles] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [moduleCatalog, setModuleCatalog] = useState([]);
  const [countryDial, setCountryDial] = useState("+52");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});

  // --- Permisos ---
  const [perfilesActivos, setPerfilesActivos] = useState([]);
  const [modulosManuales, setModulosManuales] = useState(new Set());
  const [showModulos, setShowModulos] = useState(false);

  const isFixedAdmin = editMode && Number(initialData?.RolId) === FIXED_ADMIN_ROLE_ID;
  const availableModules = useMemo(() => {
    if (moduleCatalog.length > 0) {
      return moduleCatalog;
    }
    return ALL_MODULES;
  }, [moduleCatalog]);

  const modulosDePerfiles = useMemo(() => {
    const s = new Set();
    perfilesActivos.forEach((pid) => {
      const p = PERFILES.find((x) => x.id === pid);
      if (p) p.modulos.forEach((m) => s.add(m));
    });
    return s;
  }, [perfilesActivos]);

  const modulosActivos = useMemo(() => {
    const s = new Set([...modulosDePerfiles, ...modulosManuales]);
    return s;
  }, [modulosDePerfiles, modulosManuales]);

  const advertencias = useMemo(() => {
    const warns = [];
    if (perfilesActivos.includes("admin_completo") && perfilesActivos.length > 1) {
      warns.push("Combinaste 'Admin completo' con otro perfil. El acceso ya es total, el perfil adicional es redundante.");
    }
    if (modulosActivos.size > 15) {
      warns.push(`Este usuario tendrá acceso a ${modulosActivos.size} módulos — casi total. Revisa si es necesario.`);
    }
    if (
      perfilesActivos.length === 0 &&
      [...modulosManuales].some((m) => SENSITIVE.has(m))
    ) {
      warns.push("Activaste módulos sensibles (Usuarios, Configuración, Contabilidad) sin seleccionar un perfil formal.");
    }
    return warns;
  }, [perfilesActivos, modulosActivos, modulosManuales]);

  const togglePerfil = (pid) => {
    setPerfilesActivos((prev) =>
      prev.includes(pid) ? prev.filter((x) => x !== pid) : [...prev, pid]
    );
  };

  const toggleModulo = (key) => {
    setModulosManuales((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    let mounted = true;
    const fetchRoles = async () => {
      try {
        const res = await api.get('/roles/');
        if (mounted) {
          setRoles(
            (res.data || []).filter(
              (role) => Number(role.Rol_Id ?? role.RolId ?? role.id) !== SUPERADMIN_ROLE_ID
            )
          );
        }
      } catch (err) {
        console.error('Error cargando roles', err);
      }
    };
    const fetchCompanies = async () => {
      try {
        const res = await api.get('/companies/');
        if (!mounted) return;

        const allCompanies = res.data || [];
        const tokenRole = getUserRole();
        const tokenCompanyIds = getUserCompanies().map(Number).filter((id) => Number.isInteger(id));
        const scopedCompanyIds = Array.isArray(allowedCompanyIds) && allowedCompanyIds.length > 0 ? allowedCompanyIds : tokenCompanyIds;
        const hasSuperAdminAccess = isSuperAdmin || tokenRole === 1;

        if (hasSuperAdminAccess) {
          setCompanies(allCompanies);
          return;
        }

        setCompanies(allCompanies.filter((company) => scopedCompanyIds.includes(Number(company.Company_Id))));
      } catch (err) {
        console.error('Error cargando empresas', err);
      }
    };
    const fetchModules = async () => {
      try {
        const res = await api.get('/permissions/modules');
        if (!mounted) return;
        const modules = (res.data?.data || []).map((module) => ({
          key: String(module.ModuleKey || '').trim().toLowerCase(),
          label: module.ModuleName || module.DisplayName || module.ModuleKey,
        })).filter((module) => module.key);
        setModuleCatalog(modules);
      } catch (err) {
        console.error('Error cargando módulos', err);
      }
    };
    fetchRoles();
    fetchCompanies();
    fetchModules();
    return () => { mounted = false };
  }, [allowedCompanyIds, isSuperAdmin]);

  // Initialize form when editing
  useEffect(() => {
    if (editMode && initialData) {
      setForm(prev => ({
        ...prev,
        Name: initialData.Name || "",
        Lastname: initialData.Lastname || "",
        Username: initialData.Username || "",
        Password: "",
        ConfirmPassword: "",
        Email: initialData.Email || "",
        PhoneNumber: initialData.PhoneNumber || "",
        Area: initialData.Area || "",
        RolId: initialData.RolId ?? '',
        Company_Ids: initialData.companies ? initialData.companies.map(c => c.Company_Id) : [],
        IsActive: initialData.IsActive === 1 || initialData.IsActive === true
      }));
      if (initialData.PhoneNumber) {
        const pn = String(initialData.PhoneNumber);
        const match = pn.match(/^(\+\d{1,3})(.*)$/);
        if (match) {
          setCountryDial(match[1]);
          setPhoneLocal(match[2]);
        } else {
          setPhoneLocal(pn);
        }
      }
    }
  }, [editMode, initialData]);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^[0-9()+\-\s]{4,20}$/;
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

  const validateField = (name, value) => {
    let msg = "";
    switch (name) {
      case "Name":
      case "Lastname":
        if (!value || value.trim().length < 1) msg = "Este campo es requerido";
        break;
      case "Username":
        if (!value || value.trim().length < 3) msg = "Usuario debe tener al menos 3 caracteres";
        break;
      case "Email":
        if (value && !emailRegex.test(value)) msg = "Email inválido";
        break;
      case "PhoneNumber": {
        const full = (countryDial || "") + (value || phoneLocal || "");
        if (full && !phoneRegex.test(full)) msg = "Teléfono inválido";
        else {
          const digits = String(full).replace(/\D/g, "");
          if (digits.length > 20) msg = "Teléfono demasiado largo (máx. 20 dígitos).";
        }
        break;
      }
      case "Password":
        if (!passwordRegex.test(value)) msg = "Contraseña mínima 12 caracteres, incluyendo mayúscula, minúscula, número y símbolo";
        if (form.ConfirmPassword && form.ConfirmPassword !== value) setErrors(prev => ({ ...prev, ConfirmPassword: "Las contraseñas no coinciden" }));
        else setErrors(prev => ({ ...prev, ConfirmPassword: prev.ConfirmPassword ? "" : prev.ConfirmPassword }));
        break;
      case "ConfirmPassword":
        if (value !== form.Password) msg = "Las contraseñas no coinciden";
        break;
      case "RolId":
        if (!value) msg = "Selecciona un rol";
        break;
      default:
        break;
    }
    setErrors(prev => ({ ...prev, [name]: msg }));
    return msg === "";
  };

  const validateAll = () => {
    const toValidate = editMode ? ["Name", "Lastname", "Username", "RolId"] : ["Name", "Lastname", "Username", "Password", "ConfirmPassword", "RolId"];
    const newErrors = {};
    toValidate.forEach((f) => {
      const value = form[f];
      switch (f) {
        case "Name":
        case "Lastname":
          if (!value || value.trim().length < 1) { newErrors[f] = "Este campo es requerido"; }
          break;
        case "Username":
          if (!value || value.trim().length < 3) { newErrors[f] = "Usuario debe tener al menos 3 caracteres"; }
          break;
        case "Password":
          if (!editMode && !passwordRegex.test(value)) { newErrors[f] = "Contraseña mínima 12 caracteres, incluyendo mayúscula, minúscula, número y símbolo"; }
          break;
        case "ConfirmPassword":
          if (!editMode && value !== form.Password) { newErrors[f] = "Las contraseñas no coinciden"; }
          break;
        case "RolId":
          if (!value) { newErrors[f] = "Selecciona un rol"; }
          break;
        default:
          break;
      }
    });
    if (form.Email && !emailRegex.test(form.Email)) newErrors.Email = "Email inválido";
    const fullPhone = (countryDial || "") + (phoneLocal || "");
    if (fullPhone && !phoneRegex.test(fullPhone)) newErrors.PhoneNumber = "Teléfono inválido";
    setErrors(newErrors);
    return { valid: Object.keys(newErrors).length === 0, errors: newErrors };
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === "checkbox" && name === "Company_Ids") {
      const companyId = parseInt(value);
      setForm(prev => ({
        ...prev,
        Company_Ids: checked
          ? [...prev.Company_Ids, companyId]
          : prev.Company_Ids.filter(id => id !== companyId)
      }));
    } else {
      const val = type === "checkbox" ? checked : value;
      setForm({ ...form, [name]: val });
      validateField(name, val);
    }
  };

  const handlePhoneLocalChange = (e) => {
    const v = e.target.value;
    setPhoneLocal(v);
    validateField('PhoneNumber', v);
  };

  const handleCountryChange = (e) => {
    const val = e.target.value;
    setCountryDial(val);
    validateField('PhoneNumber', phoneLocal);
  };

  const isFormValid = () => {
    if (!form.Name || !form.Lastname) return false;
    if (!form.Username || form.Username.trim().length < 3) return false;
    if (!form.RolId) return false;
    if (!editMode) {
      if (!passwordRegex.test(form.Password)) return false;
      if (form.Password !== form.ConfirmPassword) return false;
      // Obligatorio seleccionar al menos un módulo en creación
      if (modulosActivos.size === 0) return false;
    }
    if (form.Email && !emailRegex.test(form.Email)) return false;
    const fullPhone = (countryDial || "") + (phoneLocal || "");
    if (fullPhone && !phoneRegex.test(fullPhone)) return false;
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const validation = validateAll();
      if (!validation.valid) {
        setError("Corrige los errores del formulario antes de enviar.");
        setLoading(false);
        return;
      }

      // Validación adicional de permisos en modo creación
      if (!editMode && modulosActivos.size === 0) {
        setError("Debes seleccionar al menos un perfil o módulo de acceso.");
        setLoading(false);
        return;
      }

      const payloadBase = {
        Name: form.Name,
        Lastname: form.Lastname,
        Username: form.Username,
        Email: form.Email,
        PhoneNumber: (countryDial || "") + (phoneLocal || form.PhoneNumber || ""),
        Area: form.Area,
        RolId: form.RolId ? parseInt(form.RolId, 10) : null,
        Company_Ids: form.Company_Ids,
        IsActive: form.IsActive ? 1 : 0
      };

      try {
        const fullPhone = payloadBase.PhoneNumber;
        if (fullPhone && !isValidPhoneNumber(fullPhone)) {
          setError('Teléfono inválido para el país seleccionado');
          setLoading(false);
          return;
        }
      } catch {
        // libphonenumber puede fallar con entradas parciales; ya existe validación previa del formulario
      }

      if (editMode && initialData) {
        const res = await api.put(`/users/${initialData.User_Id}`, payloadBase);
        setMessage(res.data.msg || "Usuario actualizado");
        if (typeof onSaved === 'function') {
          try { onSaved(res.data); } catch (e) { console.warn('onSaved callback error', e); }
        }
        setTimeout(() => { if (typeof onCancel === 'function') onCancel(); }, 1500);
      } else {
        const payload = {
          ...payloadBase,
          Password: form.Password,
          Permissions: availableModules.map((m) => ({
            ModuleKey: m.key,
            CanAccess: modulosActivos.has(m.key),
          })),
        };
        const res = await api.post("/users/register", payload);

        setMessage(res.data.msg || "Usuario creado exitosamente");
        setForm({ Name: "", Lastname: "", Username: "", Password: "", ConfirmPassword: "", Email: "", PhoneNumber: "", Area: "", RolId: "", Company_Ids: [], IsActive: true });
        setPhoneLocal("");
        setCountryDial("+52");
        setErrors({});
        setPerfilesActivos([]);
        setModulosManuales(new Set());
        if (typeof onCreated === 'function') {
          try { onCreated(res.data); } catch (e) { console.warn('onCreated callback error', e); }
        }
        setTimeout(() => { if (typeof onCancel === 'function') onCancel(); }, 1500);
      }
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.msg || (editMode ? "Error al actualizar usuario" : "Error al crear usuario");
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-h-[95vh] overflow-hidden rounded-[20px] shadow-[0_24px_64px_rgba(10,20,50,0.22)] flex flex-col">
      <div className="bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-6 py-4 flex-shrink-0">
        <h2 className="text-lg font-bold text-white">{editMode ? 'Editar Usuario' : 'Crear Usuario'}</h2>
      </div>

      <div className="flex-1 overflow-y-auto bg-white">
        <form id="userForm" onSubmit={handleSubmit} className="p-6 pb-24 space-y-5" noValidate>
          {/* Información Personal */}
          <div className="rounded-[16px] border border-[#dce4f0] bg-[#f8faff] p-4 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-[#3b6fd4]">Información Personal</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="Name" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Nombre *</label>
                <input id="Name" name="Name" type="text" value={form.Name} onChange={handleChange} required aria-invalid={!!errors.Name} className="w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20" />
                {errors.Name && <p className="mt-1 text-xs text-red-600">{errors.Name}</p>}
              </div>
              <div>
                <label htmlFor="Lastname" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Apellido *</label>
                <input id="Lastname" name="Lastname" type="text" value={form.Lastname} onChange={handleChange} required aria-invalid={!!errors.Lastname} className="w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20" />
                {errors.Lastname && <p className="mt-1 text-xs text-red-600">{errors.Lastname}</p>}
              </div>
              <div>
                <label htmlFor="Email" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Email</label>
                <input id="Email" name="Email" type="email" value={form.Email} onChange={handleChange} aria-invalid={!!errors.Email} className="w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20" />
                {errors.Email && <p className="mt-1 text-xs text-red-600">{errors.Email}</p>}
              </div>
              <div>
                <label htmlFor="Area" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Área</label>
                <input id="Area" name="Area" type="text" value={form.Area} onChange={handleChange} className="w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20" />
              </div>
            </div>
          </div>

          {/* Teléfono */}
          <div className="rounded-[16px] border border-[#dce4f0] bg-[#f8faff] p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-[#3b6fd4]">Contacto</h3>
            <div>
              <label htmlFor="PhoneNumberLocal" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Teléfono</label>
              <div className="flex items-center gap-2">
                <select aria-label="País" value={countryDial} onChange={handleCountryChange} className="rounded-[12px] border border-[#dce4f0] bg-white px-3 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20">
                  <option value="+52">México (+52)</option>
                  <option value="+1">USA (+1)</option>
                  <option value="+34">España (+34)</option>
                  <option value="+57">Colombia (+57)</option>
                  <option value="+44">Reino Unido (+44)</option>
                </select>
                <input id="PhoneNumberLocal" name="PhoneNumberLocal" type="text" value={phoneLocal} onChange={handlePhoneLocalChange} aria-invalid={!!errors.PhoneNumber} placeholder="Ej. 5584473337" className="flex-1 rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20" />
              </div>
              <p className="mt-1 text-xs text-slate-400">Prefijo por defecto: <strong>+52</strong></p>
              {errors.PhoneNumber && <p className="mt-1 text-xs text-red-600">{errors.PhoneNumber}</p>}
            </div>
          </div>

          {/* Credenciales */}
          <div className="rounded-[16px] border border-[#dce4f0] bg-[#f8faff] p-4 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-[#3b6fd4]">Credenciales</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="Username" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Usuario *</label>
                <input id="Username" name="Username" type="text" value={form.Username} onChange={handleChange} required aria-invalid={!!errors.Username} className="w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20" />
                {errors.Username && <p className="mt-1 text-xs text-red-600">{errors.Username}</p>}
              </div>
              {!editMode && (
                <>
                  <div>
                    <label htmlFor="Password" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Contraseña *</label>
                    <input id="Password" name="Password" type="password" value={form.Password} onChange={handleChange} required aria-invalid={!!errors.Password} className="w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20" />
                    {errors.Password ? <p className="mt-1 text-xs text-red-600">{errors.Password}</p> : <p className="mt-1 text-xs text-slate-400">Min. 12 caracteres, mayús, minús, número y símbolo</p>}
                  </div>
                  <div>
                    <label htmlFor="ConfirmPassword" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Confirmar Contraseña *</label>
                    <input id="ConfirmPassword" name="ConfirmPassword" type="password" value={form.ConfirmPassword} onChange={handleChange} required aria-invalid={!!errors.ConfirmPassword} className="w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20" />
                    {errors.ConfirmPassword && <p className="mt-1 text-xs text-red-600">{errors.ConfirmPassword}</p>}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Rol y Estado */}
          <div className="rounded-[16px] border border-[#dce4f0] bg-[#f8faff] p-4 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-[#3b6fd4]">Configuración</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="RolId" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Rol *</label>
                {isFixedAdmin ? (
                  <div>
                    <div className="w-full rounded-[12px] border border-[#dce4f0] bg-slate-50 px-3.5 py-2.5 text-sm text-slate-400 flex items-center gap-2 cursor-not-allowed">
                      <span>Admin fijo</span>
                      <span className="text-[10px] border border-slate-200 bg-white text-slate-500 px-1.5 py-0.5 rounded-full">Protegido</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">Este usuario conserva el rol Admin fijo y no se le puede cambiar desde aquí.</p>
                  </div>
                ) : (
                  <div>
                    <select id="RolId" name="RolId" value={form.RolId} onChange={handleChange} required aria-invalid={!!errors.RolId} className="w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20">
                      <option value="">Selecciona un rol</option>
                      {roles.map((r) => (
                        <option key={r.Rol_Id ?? r.RolId ?? r.id} value={r.Rol_Id ?? r.RolId ?? r.id}>{r.Name}</option>
                      ))}
                    </select>
                    {errors.RolId && <p className="mt-1 text-xs text-red-600">{errors.RolId}</p>}
                    <p className="mt-1 text-xs text-slate-400">El rol Admin sigue disponible para usuarios editables. SuperAdmin no se puede asignar desde este formulario.</p>
                  </div>
                )}
              </div>
              <div className="col-span-2">
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">Empresas</label>
                <div className="grid grid-cols-2 gap-2">
                  {companies.map((c) => (
                    <label key={c.Company_Id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-[#f0f4ff] p-2 rounded-[8px] transition">
                      <input
                        type="checkbox"
                        name="Company_Ids"
                        value={c.Company_Id}
                        checked={form.Company_Ids.includes(c.Company_Id)}
                        onChange={handleChange}
                        className="h-4 w-4 rounded accent-[#1b3d86]"
                      />
                      <span className="text-gray-700">{c.NameCompany}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <input id="IsActive" name="IsActive" type="checkbox" checked={form.IsActive} onChange={handleChange} className="h-4 w-4 rounded accent-[#1b3d86]" />
                <label htmlFor="IsActive" className="text-xs font-semibold text-gray-700">Activo</label>
              </div>
            </div>
          </div>

          {/* Permisos de acceso — solo en creación */}
          {!editMode && (
            <div className={`rounded-[16px] border-2 p-4 space-y-4 ${modulosActivos.size === 0 ? 'border-rose-300 bg-rose-50' : 'border-[#3b6fd4]/30 bg-[#f0f8ff]'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Acceso a módulos <span className="text-red-500">*</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {modulosActivos.size === 0
                      ? "Selecciona al menos un perfil para continuar"
                      : `${modulosActivos.size} módulo${modulosActivos.size !== 1 ? 's' : ''} seleccionado${modulosActivos.size !== 1 ? 's' : ''}`}
                  </p>
                </div>
                {modulosActivos.size === 0 && (
                  <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                    Requerido
                  </span>
                )}
                {modulosActivos.size > 0 && (
                  <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                    ✓ Listo
                  </span>
                )}
              </div>

              {/* Advertencias */}
              {advertencias.map((w, i) => (
                <div key={i} className="flex items-start gap-2 bg-yellow-50 border border-yellow-300 rounded-lg px-3 py-2">
                  <span className="text-yellow-500 mt-0.5 flex-shrink-0">⚠️</span>
                  <p className="text-xs text-yellow-800">{w}</p>
                </div>
              ))}

              {/* Grid de perfiles */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PERFILES.map((p) => {
                  const activo = perfilesActivos.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePerfil(p.id)}
                      className={`relative text-left p-3 rounded-[14px] border-2 transition-all ${
                        activo
                          ? 'border-[#1b3d86] bg-[#f0f4ff] shadow-[0_2px_8px_rgba(27,61,134,0.15)]'
                          : 'border-[#dce4f0] bg-white hover:border-[#3b6fd4] hover:bg-[#f8faff]'
                      }`}
                    >
                      {activo && (
                        <span className="absolute top-1.5 right-1.5 text-[10px] bg-emerald-500 text-white rounded-full w-4 h-4 flex items-center justify-center font-bold">✓</span>
                      )}
                      <div className="text-xl mb-1">{p.icono}</div>
                      <div className="text-xs font-bold text-slate-800">{p.nombre}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{p.descripcion}</div>
                      <div className="text-[10px] text-[#3b6fd4] mt-1">{p.modulos.length} módulos</div>
                    </button>
                  );
                })}
              </div>

              {/* Personalización manual colapsable */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowModulos((v) => !v)}
                  className="flex items-center gap-1 text-xs text-blue-700 font-semibold hover:underline"
                >
                  {showModulos ? '▲' : '▼'} Personalizar módulos manualmente
                </button>

                {showModulos && (
                  <div className="mt-3 grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
                    {availableModules.map((m) => {
                      const fromPerfil = modulosDePerfiles.has(m.key);
                      const fromManual = modulosManuales.has(m.key);
                      const active = fromPerfil || fromManual;
                      return (
                        <label
                          key={m.key}
                          className={`flex items-center gap-2 text-xs cursor-pointer p-1.5 rounded border transition-colors ${
                            active ? 'border-[#3b6fd4]/30 bg-[#f0f4ff]' : 'border-transparent hover:bg-[#f8faff]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() => {
                              if (fromPerfil && !fromManual) {
                                // Quitar desde perfil: agregar a manuales como "excluido" no aplica aquí
                                // simplemente añadir a manuales para quitar un módulo de perfil
                                setModulosManuales((prev) => {
                                  // Si está en perfil y queremos desactivarlo, marcamos para exclusión
                                  // Pero en este modelo es más simple: si lo desmarca, lo marcamos en manuales como toggle OFF
                                  // Re-pensado: si viene de perfil, desmarcarlo no es posible sin quitar el perfil
                                  // Lo dejamos como solo-lectura para módulos de perfil
                                  return prev;
                                });
                              } else {
                                toggleModulo(m.key);
                              }
                            }}
                            className="h-3.5 w-3.5 text-blue-600 border-gray-300 rounded flex-shrink-0"
                            readOnly={fromPerfil}
                          />
                          <span className={`flex-1 ${active ? 'text-gray-800 font-medium' : 'text-gray-600'}`}>
                            {m.label}
                          </span>
                          {fromPerfil && (
                            <span className="text-[9px] text-blue-500 bg-blue-100 px-1 rounded-full flex-shrink-0">perfil</span>
                          )}
                          {fromManual && !fromPerfil && (
                            <span className="text-[9px] text-purple-500 bg-purple-100 px-1 rounded-full flex-shrink-0">manual</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </form>
        {message && <div className="mx-6 mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">{message}</div>}
        {error && <div className="mx-6 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}
      </div>

      {/* Footer con botones fijos */}
      <div className="flex-shrink-0 border-t border-[#eaf0fa] bg-white px-6 py-4 flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-[12px] border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
        >
          Cancelar
        </button>
        <button
          type="submit"
          form="userForm"
          disabled={loading || !isFormValid()}
          className="flex-1 rounded-[12px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] py-2.5 text-sm font-bold text-white shadow-[0_4px_14px_rgba(27,61,134,0.30)] disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading ? (editMode ? 'Guardando...' : 'Creando...') : (editMode ? 'Guardar cambios' : 'Crear Usuario')}
        </button>
      </div>
    </div>
  );
}
