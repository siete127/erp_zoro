import { useState, useEffect } from "react";
import api from "../../services/api";
import { isValidPhoneNumber } from 'libphonenumber-js';
import { getUserCompanies, getUserRole } from '../../utils/tokenHelper';

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
  const [countryDial, setCountryDial] = useState("+52");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});

  useEffect(() => {
    let mounted = true;
    const fetchRoles = async () => {
      try {
        const res = await api.get('/roles');
        if (mounted) setRoles(res.data || []);
      } catch (err) {
        console.error('Error cargando roles', err);
      }
    };
    const fetchCompanies = async () => {
      try {
        const res = await api.get('/companies');
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
    fetchRoles();
    fetchCompanies();
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
      // set phoneLocal from PhoneNumber if possible
      if (initialData.PhoneNumber) {
        // simple split: assume starts with +cc
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
      case "PhoneNumber":
        const full = (countryDial || "") + (value || phoneLocal || "");
        if (full && !phoneRegex.test(full)) msg = "Teléfono inválido";
        else {
          const digits = String(full).replace(/\D/g, "");
          if (digits.length > 20) msg = "Teléfono demasiado largo (máx. 20 dígitos).";
        }
        break;
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
      } catch (e) {}

      if (editMode && initialData) {
        // only allowed fields are in payloadBase
        const res = await api.put(`/users/${initialData.User_Id}`, payloadBase);
        setMessage(res.data.msg || "Usuario actualizado");
        if (typeof onSaved === 'function') {
          try { onSaved(res.data); } catch (e) { console.warn('onSaved callback error', e); }
        }
        setTimeout(() => { if (typeof onCancel === 'function') onCancel(); }, 1500);
      } else {
        // create
        const payload = { ...payloadBase, Password: form.Password, CreatedBy: 1 };
        const res = await api.post("/users/register", payload);
        setMessage(res.data.msg || "Usuario creado exitosamente");
        setForm({ Name: "", Lastname: "", Username: "", Password: "", ConfirmPassword: "", Email: "", PhoneNumber: "", Area: "", RolId: "", Company_Ids: [], IsActive: true });
        setPhoneLocal("");
        setCountryDial("+52");
        setErrors({});
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
    <div className="w-full max-h-[95vh] bg-white rounded-lg shadow-lg overflow-hidden flex flex-col">
      <div className="bg-[#092052] px-6 py-4 flex-shrink-0">
        <h2 className="text-2xl font-bold text-white">{editMode ? 'Editar Usuario' : 'Crear Usuario'}</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <form id="userForm" onSubmit={handleSubmit} className="p-6 pb-24 space-y-6" noValidate>
          {/* Información Personal */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-4">
            <h3 className="text-sm font-bold text-gray-900">Información Personal</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="Name" className="block text-xs font-semibold text-gray-700 mb-1">Nombre *</label>
                <input id="Name" name="Name" type="text" value={form.Name} onChange={handleChange} required aria-invalid={!!errors.Name} className="w-full h-9 px-3 text-sm rounded-lg border-2 border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#092052]" />
                {errors.Name && <p className="mt-1 text-xs text-red-600">{errors.Name}</p>}
              </div>
              <div>
                <label htmlFor="Lastname" className="block text-xs font-semibold text-gray-700 mb-1">Apellido *</label>
                <input id="Lastname" name="Lastname" type="text" value={form.Lastname} onChange={handleChange} required aria-invalid={!!errors.Lastname} className="w-full h-9 px-3 text-sm rounded-lg border-2 border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#092052]" />
                {errors.Lastname && <p className="mt-1 text-xs text-red-600">{errors.Lastname}</p>}
              </div>
              <div>
                <label htmlFor="Email" className="block text-xs font-semibold text-gray-700 mb-1">Email</label>
                <input id="Email" name="Email" type="email" value={form.Email} onChange={handleChange} aria-invalid={!!errors.Email} className="w-full h-9 px-3 text-sm rounded-lg border-2 border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#092052]" />
                {errors.Email && <p className="mt-1 text-xs text-red-600">{errors.Email}</p>}
              </div>
              <div>
                <label htmlFor="Area" className="block text-xs font-semibold text-gray-700 mb-1">Área</label>
                <input id="Area" name="Area" type="text" value={form.Area} onChange={handleChange} className="w-full h-9 px-3 text-sm rounded-lg border-2 border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#092052]" />
              </div>
            </div>
          </div>

          {/* Teléfono */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-3">
            <h3 className="text-sm font-bold text-gray-900">Contacto</h3>
            <div>
              <label htmlFor="PhoneNumberLocal" className="block text-xs font-semibold text-gray-700 mb-2">Teléfono</label>
              <div className="flex items-center gap-2">
                <select aria-label="País" value={countryDial} onChange={handleCountryChange} className="h-9 px-2 text-sm rounded-lg border-2 border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#092052]">
                  <option value="+52">México (+52)</option>
                  <option value="+1">USA (+1)</option>
                  <option value="+34">España (+34)</option>
                  <option value="+57">Colombia (+57)</option>
                  <option value="+44">Reino Unido (+44)</option>
                </select>
                <input id="PhoneNumberLocal" name="PhoneNumberLocal" type="text" value={phoneLocal} onChange={handlePhoneLocalChange} aria-invalid={!!errors.PhoneNumber} placeholder="Ej. 5584473337" className="flex-1 h-9 px-3 text-sm rounded-lg border-2 border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#092052]" />
              </div>
              <p className="mt-1 text-xs text-gray-500">Prefijo por defecto: <strong>+52</strong></p>
              {errors.PhoneNumber && <p className="mt-1 text-xs text-red-600">{errors.PhoneNumber}</p>}
            </div>
          </div>

          {/* Credenciales */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-4">
            <h3 className="text-sm font-bold text-gray-900">Credenciales</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="Username" className="block text-xs font-semibold text-gray-700 mb-1">Usuario *</label>
                <input id="Username" name="Username" type="text" value={form.Username} onChange={handleChange} required aria-invalid={!!errors.Username} className="w-full h-9 px-3 text-sm rounded-lg border-2 border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#092052]" />
                {errors.Username && <p className="mt-1 text-xs text-red-600">{errors.Username}</p>}
              </div>
              {!editMode && (
                <>
                  <div>
                    <label htmlFor="Password" className="block text-xs font-semibold text-gray-700 mb-1">Contraseña *</label>
                    <input id="Password" name="Password" type="password" value={form.Password} onChange={handleChange} required aria-invalid={!!errors.Password} className="w-full h-9 px-3 text-sm rounded-lg border-2 border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#092052]" />
                    {errors.Password ? <p className="mt-1 text-xs text-red-600">{errors.Password}</p> : <p className="mt-1 text-xs text-gray-500">Min. 12 caracteres, mayús, minús, número y símbolo</p>}
                  </div>
                  <div>
                    <label htmlFor="ConfirmPassword" className="block text-xs font-semibold text-gray-700 mb-1">Confirmar Contraseña *</label>
                    <input id="ConfirmPassword" name="ConfirmPassword" type="password" value={form.ConfirmPassword} onChange={handleChange} required aria-invalid={!!errors.ConfirmPassword} className="w-full h-9 px-3 text-sm rounded-lg border-2 border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#092052]" />
                    {errors.ConfirmPassword && <p className="mt-1 text-xs text-red-600">{errors.ConfirmPassword}</p>}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Rol y Estado */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-4">
            <h3 className="text-sm font-bold text-gray-900">Configuración</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="RolId" className="block text-xs font-semibold text-gray-700 mb-1">Rol *</label>
                <select id="RolId" name="RolId" value={form.RolId} onChange={handleChange} required aria-invalid={!!errors.RolId} className="w-full h-9 px-3 text-sm rounded-lg border-2 border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#092052]">
                  <option value="">Selecciona un rol</option>
                  {roles.map((r) => (
                    <option key={r.Rol_Id ?? r.RolId ?? r.id} value={r.Rol_Id ?? r.RolId ?? r.id}>{r.Name}</option>
                  ))}
                </select>
                {errors.RolId && <p className="mt-1 text-xs text-red-600">{errors.RolId}</p>}
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-2">Empresas</label>
                <div className="grid grid-cols-2 gap-2">
                  {companies.map((c) => (
                    <label key={c.Company_Id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-100 p-2 rounded">
                      <input
                        type="checkbox"
                        name="Company_Ids"
                        value={c.Company_Id}
                        checked={form.Company_Ids.includes(c.Company_Id)}
                        onChange={handleChange}
                        className="h-4 w-4 text-[#092052] border-gray-300 rounded"
                      />
                      <span className="text-gray-700">{c.NameCompany}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <input id="IsActive" name="IsActive" type="checkbox" checked={form.IsActive} onChange={handleChange} className="h-4 w-4 text-[#092052] border-gray-300 rounded" />
                <label htmlFor="IsActive" className="text-xs font-semibold text-gray-700">Activo</label>
              </div>
            </div>
          </div>
        </form>
        {message && <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">{message}</div>}
        {error && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}
      </div>

      {/* Footer con botones fijos */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-white px-6 py-4 flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 h-10 bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold rounded-lg transition-all">
          Cancelar
        </button>
        <button 
          type="submit" 
          form="userForm"
          disabled={loading || !isFormValid()} 
          className="flex-1 h-10 bg-[#092052] hover:bg-[#0d3a7a] text-white font-bold rounded-lg shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? (editMode ? 'Guardando...' : 'Creando...') : (editMode ? 'Guardar cambios' : 'Crear Usuario')}
        </button>
      </div>
    </div>
  );
}
