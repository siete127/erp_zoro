import React, { useEffect, useMemo, useState } from 'react';
import CreatableSelect from 'react-select/creatable';
import api from '../../services/api';
import { rhService } from '../../services/rhService';
import { notify } from '../../services/notify';
import confirm from '../../services/confirm';

const profileDefaults = {
  FechaNacimiento: '',
  CURP: '',
  RFC: '',
  NSS: '',
  EstadoCivil: '',
  Genero: '',
  Direccion: '',
  Ciudad: '',
  Estado: '',
  CodigoPostal: '',
  Pais: 'México',
  NumeroEmpleado: '',
  FechaIngreso: '',
  Puesto: '',
  Departamento: '',
  SalarioMensual: '',
  TipoContrato: '',
  BancoPrincipal: '',
  NumeroCuentaPrincipal: '',
  CLABE: '',
  NombreTitularCuenta: '',
  ContactoEmergenciaPrincipal: '',
  TelefonoEmergenciaPrincipal: '',
  Alergias: '',
  TipoSangre: '',
  NotasMedicas: ''
};

const contactoDefaults = {
  Nombre: '',
  Parentesco: '',
  Telefono: '',
  TelefonoAlterno: '',
  Direccion: '',
  EsPrincipal: false,
  Notas: ''
};

const cuentaDefaults = {
  Banco: '',
  NumeroCuenta: '',
  CLABE: '',
  NumeroTarjeta: '',
  Moneda: 'MXN',
  EsPrincipal: false,
  NombreTitular: ''
};

const documentoDefaults = {
  TipoDocumento: '',
  Descripcion: ''
};

const createOptions = (values) => values.map((value) => ({ value, label: value }));

const puestoOptions = createOptions([
  'Auxiliar Administrativo',
  'Analista',
  'Coordinador',
  'Supervisor',
  'Jefe de Área',
  'Gerente',
  'Director',
  'Operador',
  'Técnico',
  'Ejecutivo de Ventas',
  'Recursos Humanos',
  'Contador'
]);

const departamentoOptions = createOptions([
  'Administración',
  'Ventas',
  'Compras',
  'Producción',
  'Almacén',
  'Logística',
  'Finanzas',
  'Recursos Humanos',
  'Calidad',
  'Sistemas',
  'Mantenimiento'
]);

const tipoContratoOptions = createOptions([
  'Indefinido',
  'Temporal',
  'Por obra determinada',
  'Por temporada',
  'Honorarios',
  'Prácticas profesionales',
  'Medio tiempo'
]);

const estadoCivilOptions = createOptions([
  'Soltero(a)',
  'Casado(a)',
  'Divorciado(a)',
  'Viudo(a)',
  'Unión libre'
]);

const generoOptions = createOptions([
  'Masculino',
  'Femenino',
  'No binario',
  'Prefiero no decirlo'
]);

const paisOptions = createOptions([
  'México',
  'Estados Unidos',
  'Canadá',
  'Colombia',
  'Argentina',
  'Chile',
  'Perú',
  'España'
]);

const bancoOptions = createOptions([
  'BBVA',
  'Banamex',
  'Santander',
  'Banorte',
  'HSBC',
  'Scotiabank',
  'Banco Azteca',
  'Inbursa',
  'NU',
  'Hey Banco'
]);

const tipoSangreOptions = createOptions([
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-'
]);

const parentescoOptions = createOptions([
  'Padre',
  'Madre',
  'Hermano(a)',
  'Cónyuge',
  'Hijo(a)',
  'Tío(a)',
  'Primo(a)',
  'Amigo(a)',
  'Tutor(a)'
]);

const monedaOptions = createOptions([
  'MXN',
  'USD',
  'EUR',
  'CAD'
]);

const catalogSelectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: 42,
    borderColor: state.isFocused ? '#092052' : '#d1d5db',
    boxShadow: state.isFocused ? '0 0 0 1px #092052' : 'none',
    '&:hover': {
      borderColor: '#092052'
    },
    borderRadius: 6,
    fontSize: '0.875rem'
  }),
  valueContainer: (base) => ({
    ...base,
    padding: '0 12px'
  }),
  placeholder: (base) => ({
    ...base,
    color: '#9ca3af'
  }),
  menu: (base) => ({
    ...base,
    zIndex: 30
  })
};

function findSelectedOption(options, value) {
  if (!value) return null;
  return options.find((option) => option.value === value) || { value, label: value };
}

function CatalogSelectField({ value, onChange, options, placeholder }) {
  return (
    <CreatableSelect
      isClearable
      placeholder={placeholder}
      options={options}
      value={findSelectedOption(options, value)}
      onChange={(selected) => onChange(selected?.value || '')}
      styles={catalogSelectStyles}
      formatCreateLabel={(inputValue) => `Agregar "${inputValue}"`}
      noOptionsMessage={() => 'Sin opciones'}
    />
  );
}

function mapPerfilToForm(perfil) {
  if (!perfil) return { ...profileDefaults };
  return {
    ...profileDefaults,
    ...perfil,
    FechaNacimiento: perfil.FechaNacimiento ? String(perfil.FechaNacimiento).slice(0, 10) : '',
    FechaIngreso: perfil.FechaIngreso ? String(perfil.FechaIngreso).slice(0, 10) : '',
    SalarioMensual: perfil.SalarioMensual ?? ''
  };
}

export default function RH() {
  const [usuarios, setUsuarios] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('Todos');
  const [query, setQuery] = useState('');
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);

  const [activeTab, setActiveTab] = useState('perfil');
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUserLabel, setSelectedUserLabel] = useState('');
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  const [profileForm, setProfileForm] = useState({ ...profileDefaults });
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [fotoPreview, setFotoPreview] = useState('');
  const [brokenFotoUsers, setBrokenFotoUsers] = useState({});

  const [contactos, setContactos] = useState([]);
  const [contactoForm, setContactoForm] = useState({ ...contactoDefaults });
  const [editingContactoId, setEditingContactoId] = useState(null);
  const [savingContacto, setSavingContacto] = useState(false);

  const [cuentas, setCuentas] = useState([]);
  const [cuentaForm, setCuentaForm] = useState({ ...cuentaDefaults });
  const [editingCuentaId, setEditingCuentaId] = useState(null);
  const [savingCuenta, setSavingCuenta] = useState(false);
  const [documentos, setDocumentos] = useState([]);
  const [documentoForm, setDocumentoForm] = useState({ ...documentoDefaults });
  const [documentoFile, setDocumentoFile] = useState(null);
  const [uploadingDocumento, setUploadingDocumento] = useState(false);

  const usuariosFiltrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    return usuarios.filter((u) => {
      const departamento = String(u.Departamento || 'Sin departamento');
      const byDepartment = selectedDepartment === 'Todos' || departamento === selectedDepartment;
      if (!byDepartment) return false;
      if (!q) return true;

      const nombre = `${u.Name || ''} ${u.Lastname || ''}`.toLowerCase();
      return (
        nombre.includes(q)
        || String(u.NumeroEmpleado || '').toLowerCase().includes(q)
        || String(u.Email || '').toLowerCase().includes(q)
        || String(u.Puesto || '').toLowerCase().includes(q)
        || String(u.Departamento || '').toLowerCase().includes(q)
      );
    });
  }, [usuarios, query, selectedDepartment]);

  const departamentoStats = useMemo(() => {
    const counter = usuarios.reduce((acc, user) => {
      const key = String(user.Departamento || 'Sin departamento');
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const departamentos = Object.entries(counter)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));

    return [{ name: 'Todos', total: usuarios.length }, ...departamentos];
  }, [usuarios]);

  const cargarEmpresas = async () => {
    try {
      const res = await api.get('/companies');
      setCompanies(res.data || []);
    } catch (error) {
      console.error('Error cargando empresas RH', error);
    }
  };

  const cargarUsuarios = async () => {
    setLoadingUsuarios(true);
    try {
      const data = await rhService.listPerfiles(
        selectedCompany === 'all' ? {} : { company_id: selectedCompany }
      );
      const lista = Array.isArray(data) ? data : [];
      setUsuarios(lista);

      if (selectedUserId && !lista.some((u) => Number(u.User_Id) === Number(selectedUserId))) {
        setSelectedUserId(null);
        setSelectedUserLabel('');
        setProfileForm({ ...profileDefaults });
        setContactos([]);
        setCuentas([]);
      }
    } catch (error) {
      console.error('Error cargando perfiles RH', error);
      notify(error.response?.data?.msg || 'Error cargando módulo RH', 'error');
      setUsuarios([]);
    } finally {
      setLoadingUsuarios(false);
    }
  };

  const seleccionarUsuario = async (usuario) => {
    const userId = Number(usuario.User_Id);
    setSelectedUserId(userId);
    setSelectedUserLabel(`${usuario.Name || ''} ${usuario.Lastname || ''}`.trim());
    setLoadingDetalle(true);
    try {
      const data = await rhService.getPerfil(userId);
      setProfileForm(mapPerfilToForm(data.perfil));
      setFotoPreview(resolveFotoUrl(data?.perfil?.FotoPerfilUrl));
      setContactos(Array.isArray(data.contactosEmergencia) ? data.contactosEmergencia : []);
      setCuentas(Array.isArray(data.cuentasBancarias) ? data.cuentasBancarias : []);
      setDocumentos(Array.isArray(data.documentos) ? data.documentos : []);
      setContactoForm({ ...contactoDefaults });
      setCuentaForm({ ...cuentaDefaults });
      setDocumentoForm({ ...documentoDefaults });
      setDocumentoFile(null);
      setEditingContactoId(null);
      setEditingCuentaId(null);
    } catch (error) {
      console.error('Error cargando detalle RH', error);
      notify(error.response?.data?.msg || 'Error cargando detalle RH', 'error');
    } finally {
      setLoadingDetalle(false);
    }
  };

  useEffect(() => {
    cargarEmpresas();
  }, []);

  useEffect(() => {
    cargarUsuarios();
  }, [selectedCompany]);

  const resolveFotoUrl = (value) => {
    if (!value) return '';

    const rawValue = String(value).trim().replace(/\\/g, '/');

    if (/^https?:\/\//i.test(rawValue)) {
      try {
        const parsed = new URL(rawValue);
        const pathname = parsed.pathname || '';
        const isUploadsPath = /\/uploads\//i.test(pathname);

        if (typeof window !== 'undefined' && isUploadsPath) {
          const currentHost = window.location.hostname;
          const isLegacyHost = ['localhost', '127.0.0.1', 'qaerp.ardabytec.vip', 'erp.ardabytec.vip'].includes(parsed.hostname);
          if (isLegacyHost && parsed.hostname !== currentHost) {
            return `${window.location.origin}${pathname}${parsed.search || ''}`;
          }
        }

        return rawValue;
      } catch (_) {
        return rawValue;
      }
    }

    let normalized = rawValue.startsWith('/') ? rawValue : `/${rawValue}`;
    normalized = normalized.replace(/^\/api\/uploads\//i, '/uploads/');

    const apiBase = api?.defaults?.baseURL || '';
    const asString = String(apiBase || '');

    if (/^https?:\/\//i.test(asString)) {
      return `${asString.replace(/\/api\/?$/i, '')}${normalized}`;
    }

    const directApiBase = import.meta.env.VITE_API_BASE_PROD_DIRECT || import.meta.env.VITE_API_URL_PROD_DIRECT;
    if (directApiBase && /^https?:\/\//i.test(directApiBase)) {
      return `${directApiBase.replace(/\/api\/?$/i, '')}${normalized}`;
    }

    const prodApiBase = import.meta.env.VITE_API_BASE_PROD || import.meta.env.VITE_API_URL;
    if (prodApiBase && /^https?:\/\//i.test(prodApiBase)) {
      return `${prodApiBase.replace(/\/api\/?$/i, '')}${normalized}`;
    }

    if (typeof window !== 'undefined') {
      return `${window.location.origin}${normalized}`;
    }

    return normalized;
  };

  const resolveFotoUrlApiFallback = (value) => {
    if (!value) return '';
    const baseResolved = resolveFotoUrl(value);
    if (!baseResolved) return '';

    try {
      const url = new URL(baseResolved, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
      url.pathname = url.pathname.replace(/^\/uploads\//i, '/api/uploads/');
      return url.toString();
    } catch (_) {
      return baseResolved.replace(/^\/uploads\//i, '/api/uploads/');
    }
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
  };

  const [loadingCP, setLoadingCP] = useState(false);

  const handleCodigoPostalChange = async (e) => {
    const cp = e.target.value.replace(/\D/g, '').slice(0, 5);
    setProfileForm((prev) => ({ ...prev, CodigoPostal: cp }));

    if (cp.length === 5) {
      setLoadingCP(true);
      try {
        // Endpoint propio del backend — sin CORS, sin token externo
        const res = await api.get(`/cp/${cp}`);
        const d = res.data?.data;
        if (d) {
          setProfileForm((prev) => ({
            ...prev,
            CodigoPostal: cp,
            Ciudad: d.ciudad || prev.Ciudad,
            Estado: d.estado || prev.Estado,
            Pais: d.pais || 'México'
          }));
        } else {
          notify('No se encontró información para ese código postal', 'warning');
        }
      } catch (_) {
        notify('No se pudo obtener datos del código postal', 'warning');
      } finally {
        setLoadingCP(false);
      }
    }
  };

  const handleProfileCatalogChange = (field, value) => {
    setProfileForm((prev) => ({ ...prev, [field]: value }));
  };

  const guardarPerfil = async (e) => {
    e.preventDefault();
    if (!selectedUserId) return;
    setSavingProfile(true);
    try {
      const payload = {
        ...profileForm,
        SalarioMensual:
          profileForm.SalarioMensual === '' || profileForm.SalarioMensual == null
            ? null
            : Number(profileForm.SalarioMensual)
      };
      await rhService.upsertPerfil(selectedUserId, payload);
      notify('Perfil RH guardado correctamente', 'success');
      await cargarUsuarios();
      const selected = usuarios.find((u) => Number(u.User_Id) === Number(selectedUserId));
      if (selected) {
        await seleccionarUsuario(selected);
      }
    } catch (error) {
      console.error('Error guardando perfil RH', error);
      notify(error.response?.data?.msg || 'Error guardando perfil RH', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleFotoPerfilChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedUserId) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      notify('Formato inválido. Usa JPG, PNG o WEBP.', 'error');
      return;
    }

    setUploadingFoto(true);
    try {
      const result = await rhService.uploadFotoPerfil(selectedUserId, file);
      const imageUrl = resolveFotoUrl(result?.FotoPerfilUrl);
      setFotoPreview(imageUrl);
      setProfileForm((prev) => ({ ...prev, FotoPerfilUrl: result?.FotoPerfilUrl || prev.FotoPerfilUrl }));
      notify('Foto de perfil actualizada', 'success');
      await cargarUsuarios();
    } catch (error) {
      console.error('Error subiendo foto de perfil', error);
      notify(error.response?.data?.msg || 'Error subiendo foto de perfil', 'error');
    } finally {
      setUploadingFoto(false);
      e.target.value = '';
    }
  };

  const handleContactoChange = (e) => {
    const { name, value, type, checked } = e.target;
    setContactoForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleContactoCatalogChange = (field, value) => {
    setContactoForm((prev) => ({ ...prev, [field]: value }));
  };

  const startEditContacto = (c) => {
    setEditingContactoId(c.ContactoEmergencia_Id);
    setContactoForm({
      Nombre: c.Nombre || '',
      Parentesco: c.Parentesco || '',
      Telefono: c.Telefono || '',
      TelefonoAlterno: c.TelefonoAlterno || '',
      Direccion: c.Direccion || '',
      EsPrincipal: !!c.EsPrincipal,
      Notas: c.Notas || ''
    });
  };

  const resetContactoForm = () => {
    setEditingContactoId(null);
    setContactoForm({ ...contactoDefaults });
  };

  const guardarContacto = async (e) => {
    e.preventDefault();
    if (!selectedUserId) return;
    if (!contactoForm.Nombre || !contactoForm.Telefono) {
      notify('Nombre y teléfono son requeridos', 'error');
      return;
    }

    setSavingContacto(true);
    try {
      if (editingContactoId) {
        await rhService.updateContactoEmergencia(editingContactoId, contactoForm);
        notify('Contacto de emergencia actualizado', 'success');
      } else {
        await rhService.createContactoEmergencia(selectedUserId, contactoForm);
        notify('Contacto de emergencia creado', 'success');
      }
      const selected = usuarios.find((u) => Number(u.User_Id) === Number(selectedUserId));
      if (selected) await seleccionarUsuario(selected);
      resetContactoForm();
    } catch (error) {
      console.error('Error guardando contacto de emergencia', error);
      notify(error.response?.data?.msg || 'Error guardando contacto de emergencia', 'error');
    } finally {
      setSavingContacto(false);
    }
  };

  const eliminarContacto = async (contactoId) => {
    const ok = await confirm('¿Deseas eliminar este contacto de emergencia?', 'Eliminar contacto', 'Eliminar', 'Cancelar');
    if (!ok) return;
    try {
      await rhService.deleteContactoEmergencia(contactoId);
      notify('Contacto eliminado', 'success');
      const selected = usuarios.find((u) => Number(u.User_Id) === Number(selectedUserId));
      if (selected) await seleccionarUsuario(selected);
    } catch (error) {
      console.error('Error eliminando contacto', error);
      notify(error.response?.data?.msg || 'Error eliminando contacto', 'error');
    }
  };

  const handleCuentaChange = (e) => {
    const { name, value, type, checked } = e.target;
    setCuentaForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleCuentaCatalogChange = (field, value) => {
    setCuentaForm((prev) => ({ ...prev, [field]: value }));
  };

  const startEditCuenta = (c) => {
    setEditingCuentaId(c.CuentaBancaria_Id);
    setCuentaForm({
      Banco: c.Banco || '',
      NumeroCuenta: c.NumeroCuenta || '',
      CLABE: c.CLABE || '',
      NumeroTarjeta: c.NumeroTarjeta || '',
      Moneda: c.Moneda || 'MXN',
      EsPrincipal: !!c.EsPrincipal,
      NombreTitular: c.NombreTitular || ''
    });
  };

  const resetCuentaForm = () => {
    setEditingCuentaId(null);
    setCuentaForm({ ...cuentaDefaults });
  };

  const guardarCuenta = async (e) => {
    e.preventDefault();
    if (!selectedUserId) return;
    if (!cuentaForm.Banco || !cuentaForm.NumeroCuenta) {
      notify('Banco y número de cuenta son requeridos', 'error');
      return;
    }

    setSavingCuenta(true);
    try {
      if (editingCuentaId) {
        await rhService.updateCuentaBancaria(editingCuentaId, cuentaForm);
        notify('Cuenta bancaria actualizada', 'success');
      } else {
        await rhService.createCuentaBancaria(selectedUserId, cuentaForm);
        notify('Cuenta bancaria creada', 'success');
      }
      const selected = usuarios.find((u) => Number(u.User_Id) === Number(selectedUserId));
      if (selected) await seleccionarUsuario(selected);
      resetCuentaForm();
    } catch (error) {
      console.error('Error guardando cuenta bancaria', error);
      notify(error.response?.data?.msg || 'Error guardando cuenta bancaria', 'error');
    } finally {
      setSavingCuenta(false);
    }
  };

  const eliminarCuenta = async (cuentaId) => {
    const ok = await confirm('¿Deseas eliminar esta cuenta bancaria?', 'Eliminar cuenta', 'Eliminar', 'Cancelar');
    if (!ok) return;
    try {
      await rhService.deleteCuentaBancaria(cuentaId);
      notify('Cuenta bancaria eliminada', 'success');
      const selected = usuarios.find((u) => Number(u.User_Id) === Number(selectedUserId));
      if (selected) await seleccionarUsuario(selected);
    } catch (error) {
      console.error('Error eliminando cuenta bancaria', error);
      notify(error.response?.data?.msg || 'Error eliminando cuenta bancaria', 'error');
    }
  };

  const resolveDocumentoUrl = (value) => {
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) return value;

    const normalized = value.startsWith('/') ? value : `/${value}`;
    const apiBase = api?.defaults?.baseURL || '';
    if (!apiBase) return normalized;

    const hostBase = apiBase.replace(/\/api\/?$/i, '');
    return `${hostBase}${normalized}`;
  };

  const handleDocumentoFieldChange = (e) => {
    const { name, value } = e.target;
    setDocumentoForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleDocumentoFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setDocumentoFile(file);
  };

  const guardarDocumento = async (e) => {
    e.preventDefault();
    if (!selectedUserId) return;
    if (!documentoFile) {
      notify('Selecciona un archivo para cargar', 'error');
      return;
    }

    const allowed = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (!allowed.includes(documentoFile.type)) {
      notify('Formato inválido. Usa PDF, JPG, PNG, WEBP, DOC o DOCX.', 'error');
      return;
    }

    setUploadingDocumento(true);
    try {
      await rhService.uploadDocumento(selectedUserId, {
        file: documentoFile,
        TipoDocumento: documentoForm.TipoDocumento,
        Descripcion: documentoForm.Descripcion
      });
      notify('Documento cargado correctamente', 'success');

      const docs = await rhService.listDocumentos(selectedUserId);
      setDocumentos(Array.isArray(docs) ? docs : []);
      setDocumentoForm({ ...documentoDefaults });
      setDocumentoFile(null);
    } catch (error) {
      console.error('Error cargando documento RH', error);
      notify(error.response?.data?.msg || 'Error cargando documento RH', 'error');
    } finally {
      setUploadingDocumento(false);
    }
  };

  const eliminarDocumento = async (documentoId) => {
    const ok = await confirm('¿Deseas eliminar este documento?', 'Eliminar documento', 'Eliminar', 'Cancelar');
    if (!ok) return;
    try {
      await rhService.deleteDocumento(documentoId);
      notify('Documento eliminado', 'success');
      const docs = await rhService.listDocumentos(selectedUserId);
      setDocumentos(Array.isArray(docs) ? docs : []);
    } catch (error) {
      console.error('Error eliminando documento RH', error);
      notify(error.response?.data?.msg || 'Error eliminando documento', 'error');
    }
  };

  const getInitials = (user) => {
    const fullName = `${user?.Name || ''} ${user?.Lastname || ''}`.trim();
    if (!fullName) return 'RH';
    const parts = fullName.split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
  };

  const colorClasses = ['bg-fuchsia-600', 'bg-lime-600', 'bg-cyan-600', 'bg-rose-600', 'bg-indigo-600', 'bg-emerald-600', 'bg-amber-600'];

  const getColorClass = (userId) => {
    const id = Number(userId) || 0;
    return colorClasses[Math.abs(id) % colorClasses.length];
  };

  return (
    <div className="w-full min-h-screen bg-[#eef1f5] p-4 md:p-6 overflow-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-3xl font-semibold text-[#1d2430]">Empleados</h2>
        </div>
        <div className="text-sm text-gray-600">
          {usuariosFiltrados.length} / {usuarios.length}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <aside className="xl:col-span-2 bg-[#f7f8fa] border border-gray-200 rounded-lg p-3 h-fit">
          <p className="text-sm font-extrabold tracking-wide text-gray-800 mb-3">🧑‍🤝‍🧑 DEPARTAMENTO</p>
          <div className="mb-3">
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm w-full bg-white"
            >
              <option value="all">Todas las empresas</option>
              {companies.map((c) => (
                <option key={c.Company_Id} value={c.Company_Id}>{c.NameCompany}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            {departamentoStats.map((item) => {
              const isActive = selectedDepartment === item.name;
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setSelectedDepartment(item.name)}
                  className={`w-full px-3 py-2 rounded text-sm flex items-center justify-between ${isActive ? 'bg-blue-100 text-[#0f2b5b] font-semibold' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  <span>{item.name}</span>
                  <span className="text-gray-500">{item.total}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="xl:col-span-10 space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-3 flex flex-wrap items-center gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar..."
              className="border border-gray-300 rounded px-3 py-2 text-sm flex-1 min-w-[220px]"
            />
            <div className="text-sm text-gray-500">Departamento: <span className="font-medium text-gray-700">{selectedDepartment}</span></div>
          </div>

          {loadingUsuarios ? (
            <div className="bg-white border border-gray-200 rounded-lg p-6 text-sm text-gray-600">Cargando colaboradores...</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
              {usuariosFiltrados.map((u) => {
                const isSelected = Number(selectedUserId) === Number(u.User_Id);
                const foto = resolveFotoUrl(u.FotoPerfilUrl);
                const hideBrokenFoto = !!brokenFotoUsers[u.User_Id];
                const initials = getInitials(u);
                const colorClass = getColorClass(u.User_Id);

                return (
                  <button
                    key={u.User_Id}
                    type="button"
                    onClick={() => seleccionarUsuario(u)}
                    className={`bg-white border rounded-md shadow-sm overflow-hidden text-left hover:shadow transition ${isSelected ? 'border-[#5e6ad2] ring-1 ring-[#5e6ad2]' : 'border-gray-200'}`}
                  >
                    <div className="flex min-h-[170px]">
                      <div className={`w-28 shrink-0 ${colorClass} flex items-center justify-center`}>
                        {foto && !hideBrokenFoto ? (
                          <img
                            src={foto}
                            alt={`${u.Name || ''} ${u.Lastname || ''}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const current = e.currentTarget;
                              const triedApiFallback = current.dataset.apiFallbackTried === '1';
                              if (!triedApiFallback) {
                                const apiFallback = resolveFotoUrlApiFallback(u.FotoPerfilUrl);
                                if (apiFallback && current.src !== apiFallback) {
                                  current.dataset.apiFallbackTried = '1';
                                  current.src = apiFallback;
                                  return;
                                }
                              }
                              setBrokenFotoUsers((prev) => ({ ...prev, [u.User_Id]: true }));
                            }}
                          />
                        ) : (
                          <span className="text-white text-6xl font-light leading-none">{initials.charAt(0)}</span>
                        )}
                      </div>
                      <div className="flex-1 p-3 flex flex-col justify-between">
                        <div>
                          <p className="font-semibold text-gray-900 leading-tight">{u.Name} {u.Lastname}</p>
                          <p className="text-[13px] text-gray-700">💼 {u.Puesto || 'Sin puesto'}</p>
                          <p className="text-[13px] text-gray-700 truncate">✉️ {u.Email || 'Sin correo'}</p>
                          <p className="text-[13px] text-gray-700">📞 {u.PhoneNumber || 'Sin teléfono'}</p>
                        </div>
                        <div className="flex items-center justify-between pt-2">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-pink-100 text-pink-700">
                            {u.Departamento || 'Sin departamento'}
                          </span>
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded text-xs font-bold text-white bg-emerald-600">
                            {initials.charAt(0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}

              {usuariosFiltrados.length === 0 && (
                <div className="col-span-full bg-white border border-gray-200 rounded-lg p-6 text-sm text-gray-500">
                  No hay colaboradores para mostrar con este filtro.
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {selectedUserId && (
        <div
          className="fixed inset-0 z-50 bg-black/40 p-3 md:p-6 flex items-start justify-center"
          onClick={() => {
            setSelectedUserId(null);
            setSelectedUserLabel('');
          }}
        >
          <div
            className="w-full max-w-6xl max-h-[94vh] overflow-y-auto border border-gray-200 rounded-xl p-4 bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            {loadingDetalle ? (
              <p className="text-sm text-gray-600">Cargando expediente RH...</p>
            ) : (
              <>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-gray-500">Colaborador seleccionado</p>
                    <h3 className="text-xl font-semibold text-gray-900">{selectedUserLabel}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUserId(null);
                      setSelectedUserLabel('');
                    }}
                    className="px-3 py-1.5 rounded bg-gray-100 text-gray-700 text-sm hover:bg-gray-200"
                  >
                    Cerrar
                  </button>
                </div>

              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setActiveTab('perfil')}
                  className={`px-3 py-2 rounded text-sm ${activeTab === 'perfil' ? 'bg-[#092052] text-white' : 'bg-gray-200 text-gray-800'}`}
                >
                  Perfil RH
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('contactos')}
                  className={`px-3 py-2 rounded text-sm ${activeTab === 'contactos' ? 'bg-[#092052] text-white' : 'bg-gray-200 text-gray-800'}`}
                >
                  Contactos de emergencia
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('cuentas')}
                  className={`px-3 py-2 rounded text-sm ${activeTab === 'cuentas' ? 'bg-[#092052] text-white' : 'bg-gray-200 text-gray-800'}`}
                >
                  Cuentas bancarias
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('documentos')}
                  className={`px-3 py-2 rounded text-sm ${activeTab === 'documentos' ? 'bg-[#092052] text-white' : 'bg-gray-200 text-gray-800'}`}
                >
                  Documentos
                </button>
              </div>

              {activeTab === 'perfil' && (
                <form onSubmit={guardarPerfil} className="space-y-4">
                  <div className="border border-gray-200 rounded-lg p-3 flex items-center gap-4">
                    <img
                      src={fotoPreview || 'https://ui-avatars.com/api/?name=RH&background=092052&color=fff'}
                      alt="Foto de perfil"
                      className="w-20 h-20 rounded-full object-cover border border-gray-300"
                      onError={(e) => {
                        const current = e.currentTarget;
                        const triedApiFallback = current.dataset.apiFallbackTried === '1';
                        if (!triedApiFallback && profileForm?.FotoPerfilUrl) {
                          const apiFallback = resolveFotoUrlApiFallback(profileForm.FotoPerfilUrl);
                          if (apiFallback && current.src !== apiFallback) {
                            current.dataset.apiFallbackTried = '1';
                            setFotoPreview(apiFallback);
                            return;
                          }
                        }
                        setFotoPreview('');
                      }}
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Foto de perfil</p>
                      <p className="text-xs text-gray-600 mb-2">Formatos permitidos: JPG, PNG, WEBP</p>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleFotoPerfilChange}
                        disabled={uploadingFoto}
                        className="text-sm"
                      />
                      {uploadingFoto && <p className="text-xs text-blue-700 mt-1">Subiendo imagen...</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input name="NumeroEmpleado" value={profileForm.NumeroEmpleado} onChange={handleProfileChange} placeholder="Número de empleado" className="border border-gray-300 rounded px-3 py-2 text-sm" />
                    <CatalogSelectField value={profileForm.Puesto} onChange={(value) => handleProfileCatalogChange('Puesto', value)} options={puestoOptions} placeholder="Puesto" />
                    <CatalogSelectField value={profileForm.Departamento} onChange={(value) => handleProfileCatalogChange('Departamento', value)} options={departamentoOptions} placeholder="Departamento" />
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-600">Fecha de ingreso</label>
                      <input type="date" name="FechaIngreso" value={profileForm.FechaIngreso} onChange={handleProfileChange} className="border border-gray-300 rounded px-3 py-2 text-sm" />
                    </div>
                    <CatalogSelectField value={profileForm.TipoContrato} onChange={(value) => handleProfileCatalogChange('TipoContrato', value)} options={tipoContratoOptions} placeholder="Tipo de contrato" />
                    <input type="number" step="0.01" name="SalarioMensual" value={profileForm.SalarioMensual} onChange={handleProfileChange} placeholder="Salario mensual" className="border border-gray-300 rounded px-3 py-2 text-sm" />
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-600">Fecha de nacimiento</label>
                      <input type="date" name="FechaNacimiento" value={profileForm.FechaNacimiento} onChange={handleProfileChange} className="border border-gray-300 rounded px-3 py-2 text-sm" />
                    </div>
                    <input name="CURP" value={profileForm.CURP} onChange={handleProfileChange} placeholder="CURP" className="border border-gray-300 rounded px-3 py-2 text-sm" />
                    <input name="RFC" value={profileForm.RFC} onChange={handleProfileChange} placeholder="RFC" className="border border-gray-300 rounded px-3 py-2 text-sm" />
                    <input name="NSS" value={profileForm.NSS} onChange={handleProfileChange} placeholder="NSS" className="border border-gray-300 rounded px-3 py-2 text-sm" />
                    <CatalogSelectField value={profileForm.EstadoCivil} onChange={(value) => handleProfileCatalogChange('EstadoCivil', value)} options={estadoCivilOptions} placeholder="Estado civil" />
                    <CatalogSelectField value={profileForm.Genero} onChange={(value) => handleProfileCatalogChange('Genero', value)} options={generoOptions} placeholder="Género" />
                    <input name="Direccion" value={profileForm.Direccion} onChange={handleProfileChange} placeholder="Dirección" className="border border-gray-300 rounded px-3 py-2 text-sm md:col-span-2" />
                    <div className="relative">
                      <input
                        name="CodigoPostal"
                        value={profileForm.CodigoPostal}
                        onChange={handleCodigoPostalChange}
                        placeholder="Código postal"
                        maxLength={5}
                        inputMode="numeric"
                        className="border border-gray-300 rounded px-3 py-2 text-sm w-full pr-8"
                      />
                      {loadingCP && (
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-blue-600 text-xs">⏳</span>
                      )}
                    </div>
                    <input
                      name="Ciudad"
                      value={profileForm.Ciudad}
                      onChange={handleProfileChange}
                      placeholder={loadingCP ? 'Buscando...' : 'Ciudad'}
                      disabled={loadingCP}
                      className={`border border-gray-300 rounded px-3 py-2 text-sm ${loadingCP ? 'bg-gray-100 text-gray-400' : ''}`}
                    />
                    <input
                      name="Estado"
                      value={profileForm.Estado}
                      onChange={handleProfileChange}
                      placeholder={loadingCP ? 'Buscando...' : 'Estado'}
                      disabled={loadingCP}
                      className={`border border-gray-300 rounded px-3 py-2 text-sm ${loadingCP ? 'bg-gray-100 text-gray-400' : ''}`}
                    />
                    <CatalogSelectField value={profileForm.Pais} onChange={(value) => handleProfileCatalogChange('Pais', value)} options={paisOptions} placeholder="País" />
                    <input name="ContactoEmergenciaPrincipal" value={profileForm.ContactoEmergenciaPrincipal} onChange={handleProfileChange} placeholder="Contacto emergencia principal" className="border border-gray-300 rounded px-3 py-2 text-sm md:col-span-2" />
                    <input name="TelefonoEmergenciaPrincipal" value={profileForm.TelefonoEmergenciaPrincipal} onChange={handleProfileChange} placeholder="Teléfono emergencia" className="border border-gray-300 rounded px-3 py-2 text-sm" />
                    <CatalogSelectField value={profileForm.BancoPrincipal} onChange={(value) => handleProfileCatalogChange('BancoPrincipal', value)} options={bancoOptions} placeholder="Banco principal" />
                    <input name="NumeroCuentaPrincipal" value={profileForm.NumeroCuentaPrincipal} onChange={handleProfileChange} placeholder="Número de cuenta principal" className="border border-gray-300 rounded px-3 py-2 text-sm" />
                    <input name="CLABE" value={profileForm.CLABE} onChange={handleProfileChange} placeholder="CLABE" className="border border-gray-300 rounded px-3 py-2 text-sm" />
                    <input name="NombreTitularCuenta" value={profileForm.NombreTitularCuenta} onChange={handleProfileChange} placeholder="Titular de la cuenta" className="border border-gray-300 rounded px-3 py-2 text-sm md:col-span-2" />
                    <CatalogSelectField value={profileForm.TipoSangre} onChange={(value) => handleProfileCatalogChange('TipoSangre', value)} options={tipoSangreOptions} placeholder="Tipo de sangre" />
                    <input name="Alergias" value={profileForm.Alergias} onChange={handleProfileChange} placeholder="Alergias" className="border border-gray-300 rounded px-3 py-2 text-sm md:col-span-2" />
                    <textarea name="NotasMedicas" value={profileForm.NotasMedicas} onChange={handleProfileChange} placeholder="Notas médicas" className="border border-gray-300 rounded px-3 py-2 text-sm md:col-span-3 min-h-24" />
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
                    >
                      {savingProfile ? 'Guardando...' : 'Guardar perfil RH'}
                    </button>
                  </div>
                </form>
              )}

              {activeTab === 'contactos' && (
                <div className="space-y-4">
                  <form onSubmit={guardarContacto} className="grid grid-cols-1 md:grid-cols-3 gap-3 border border-gray-200 rounded-lg p-3">
                    <input name="Nombre" value={contactoForm.Nombre} onChange={handleContactoChange} placeholder="Nombre" className="border border-gray-300 rounded px-3 py-2 text-sm" />
                    <CatalogSelectField value={contactoForm.Parentesco} onChange={(value) => handleContactoCatalogChange('Parentesco', value)} options={parentescoOptions} placeholder="Parentesco" />
                    <input name="Telefono" value={contactoForm.Telefono} onChange={handleContactoChange} placeholder="Teléfono" className="border border-gray-300 rounded px-3 py-2 text-sm" />
                    <input name="TelefonoAlterno" value={contactoForm.TelefonoAlterno} onChange={handleContactoChange} placeholder="Teléfono alterno" className="border border-gray-300 rounded px-3 py-2 text-sm" />
                    <input name="Direccion" value={contactoForm.Direccion} onChange={handleContactoChange} placeholder="Dirección" className="border border-gray-300 rounded px-3 py-2 text-sm md:col-span-2" />
                    <input name="Notas" value={contactoForm.Notas} onChange={handleContactoChange} placeholder="Notas" className="border border-gray-300 rounded px-3 py-2 text-sm md:col-span-2" />
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" name="EsPrincipal" checked={contactoForm.EsPrincipal} onChange={handleContactoChange} />
                      Contacto principal
                    </label>
                    <div className="md:col-span-3 flex gap-2">
                      <button type="submit" disabled={savingContacto} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400">
                        {savingContacto ? 'Guardando...' : editingContactoId ? 'Actualizar contacto' : 'Agregar contacto'}
                      </button>
                      {editingContactoId && (
                        <button type="button" onClick={resetContactoForm} className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400">
                          Cancelar edición
                        </button>
                      )}
                    </div>
                  </form>

                  <div className="overflow-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="text-gray-600">
                          <th className="py-2 pr-3">Nombre</th>
                          <th className="py-2 pr-3">Parentesco</th>
                          <th className="py-2 pr-3">Teléfono</th>
                          <th className="py-2 pr-3">Principal</th>
                          <th className="py-2 pr-3">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contactos.map((c) => (
                          <tr key={c.ContactoEmergencia_Id} className="border-t border-gray-200">
                            <td className="py-2 pr-3 text-gray-900">{c.Nombre}</td>
                            <td className="py-2 pr-3 text-gray-900">{c.Parentesco || '-'}</td>
                            <td className="py-2 pr-3 text-gray-900">{c.Telefono}</td>
                            <td className="py-2 pr-3 text-gray-900">{c.EsPrincipal ? 'Sí' : 'No'}</td>
                            <td className="py-2 pr-3">
                              <div className="flex gap-2">
                                <button type="button" onClick={() => startEditContacto(c)} className="px-2 py-1 bg-gray-600 text-white rounded">Editar</button>
                                <button type="button" onClick={() => eliminarContacto(c.ContactoEmergencia_Id)} className="px-2 py-1 bg-red-600 text-white rounded">Eliminar</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {contactos.length === 0 && <p className="text-sm text-gray-500 mt-2">Sin contactos de emergencia.</p>}
                  </div>
                </div>
              )}

              {activeTab === 'cuentas' && (
                <div className="space-y-4">
                  <form onSubmit={guardarCuenta} className="grid grid-cols-1 md:grid-cols-3 gap-3 border border-gray-200 rounded-lg p-3">
                    <CatalogSelectField value={cuentaForm.Banco} onChange={(value) => handleCuentaCatalogChange('Banco', value)} options={bancoOptions} placeholder="Banco" />
                    <input name="NumeroCuenta" value={cuentaForm.NumeroCuenta} onChange={handleCuentaChange} placeholder="Número de cuenta" className="border border-gray-300 rounded px-3 py-2 text-sm" />
                    <input name="CLABE" value={cuentaForm.CLABE} onChange={handleCuentaChange} placeholder="CLABE" className="border border-gray-300 rounded px-3 py-2 text-sm" />
                    <input name="NumeroTarjeta" value={cuentaForm.NumeroTarjeta} onChange={handleCuentaChange} placeholder="Número de tarjeta" className="border border-gray-300 rounded px-3 py-2 text-sm" />
                    <input name="NombreTitular" value={cuentaForm.NombreTitular} onChange={handleCuentaChange} placeholder="Titular" className="border border-gray-300 rounded px-3 py-2 text-sm" />
                    <CatalogSelectField value={cuentaForm.Moneda} onChange={(value) => handleCuentaCatalogChange('Moneda', value)} options={monedaOptions} placeholder="Moneda" />
                    <label className="flex items-center gap-2 text-sm text-gray-700 md:col-span-3">
                      <input type="checkbox" name="EsPrincipal" checked={cuentaForm.EsPrincipal} onChange={handleCuentaChange} />
                      Cuenta principal
                    </label>
                    <div className="md:col-span-3 flex gap-2">
                      <button type="submit" disabled={savingCuenta} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400">
                        {savingCuenta ? 'Guardando...' : editingCuentaId ? 'Actualizar cuenta' : 'Agregar cuenta'}
                      </button>
                      {editingCuentaId && (
                        <button type="button" onClick={resetCuentaForm} className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400">
                          Cancelar edición
                        </button>
                      )}
                    </div>
                  </form>

                  <div className="overflow-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="text-gray-600">
                          <th className="py-2 pr-3">Banco</th>
                          <th className="py-2 pr-3">Cuenta</th>
                          <th className="py-2 pr-3">CLABE</th>
                          <th className="py-2 pr-3">Principal</th>
                          <th className="py-2 pr-3">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cuentas.map((c) => (
                          <tr key={c.CuentaBancaria_Id} className="border-t border-gray-200">
                            <td className="py-2 pr-3 text-gray-900">{c.Banco}</td>
                            <td className="py-2 pr-3 text-gray-900">{c.NumeroCuenta}</td>
                            <td className="py-2 pr-3 text-gray-900">{c.CLABE || '-'}</td>
                            <td className="py-2 pr-3 text-gray-900">{c.EsPrincipal ? 'Sí' : 'No'}</td>
                            <td className="py-2 pr-3">
                              <div className="flex gap-2">
                                <button type="button" onClick={() => startEditCuenta(c)} className="px-2 py-1 bg-gray-600 text-white rounded">Editar</button>
                                <button type="button" onClick={() => eliminarCuenta(c.CuentaBancaria_Id)} className="px-2 py-1 bg-red-600 text-white rounded">Eliminar</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {cuentas.length === 0 && <p className="text-sm text-gray-500 mt-2">Sin cuentas bancarias registradas.</p>}
                  </div>
                </div>
              )}

              {activeTab === 'documentos' && (
                <div className="space-y-4">
                  <form onSubmit={guardarDocumento} className="grid grid-cols-1 md:grid-cols-3 gap-3 border border-gray-200 rounded-lg p-3">
                    <input
                      name="TipoDocumento"
                      value={documentoForm.TipoDocumento}
                      onChange={handleDocumentoFieldChange}
                      placeholder="Tipo de documento (INE, contrato, etc.)"
                      className="border border-gray-300 rounded px-3 py-2 text-sm"
                    />
                    <input
                      name="Descripcion"
                      value={documentoForm.Descripcion}
                      onChange={handleDocumentoFieldChange}
                      placeholder="Descripción"
                      className="border border-gray-300 rounded px-3 py-2 text-sm md:col-span-2"
                    />
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                      onChange={handleDocumentoFileChange}
                      className="border border-gray-300 rounded px-3 py-2 text-sm md:col-span-2"
                    />
                    <div className="text-xs text-gray-500 flex items-center">
                      Formatos: PDF, JPG, PNG, WEBP, DOC, DOCX
                    </div>
                    <div className="md:col-span-3 flex gap-2">
                      <button
                        type="submit"
                        disabled={uploadingDocumento}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
                      >
                        {uploadingDocumento ? 'Subiendo...' : 'Cargar documento'}
                      </button>
                    </div>
                  </form>

                  <div className="overflow-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="text-gray-600">
                          <th className="py-2 pr-3">Tipo</th>
                          <th className="py-2 pr-3">Archivo</th>
                          <th className="py-2 pr-3">Descripción</th>
                          <th className="py-2 pr-3">Fecha</th>
                          <th className="py-2 pr-3">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {documentos.map((d) => (
                          <tr key={d.Documento_Id} className="border-t border-gray-200">
                            <td className="py-2 pr-3 text-gray-900">{d.TipoDocumento || '-'}</td>
                            <td className="py-2 pr-3 text-gray-900">
                              <a
                                href={resolveDocumentoUrl(d.ArchivoUrl)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-700 hover:underline"
                              >
                                {d.NombreArchivo || 'Ver documento'}
                              </a>
                            </td>
                            <td className="py-2 pr-3 text-gray-900">{d.Descripcion || '-'}</td>
                            <td className="py-2 pr-3 text-gray-900">{d.CreatedAt ? new Date(d.CreatedAt).toLocaleDateString('es-MX') : '-'}</td>
                            <td className="py-2 pr-3">
                              <button
                                type="button"
                                onClick={() => eliminarDocumento(d.Documento_Id)}
                                className="px-2 py-1 bg-red-600 text-white rounded"
                              >
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {documentos.length === 0 && <p className="text-sm text-gray-500 mt-2">Sin documentos cargados.</p>}
                  </div>
                </div>
              )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
