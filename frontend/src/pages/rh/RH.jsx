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
  Pais: 'M\u00e9xico',
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
  'Jefe de \u00c1rea',
  'Gerente',
  'Director',
  'Operador',
  'T\u00e9cnico',
  'Ejecutivo de Ventas',
  'Recursos Humanos',
  'Contador'
]);

const departamentoOptions = createOptions([
  'Administraci\u00f3n',
  'Ventas',
  'Compras',
  'Producci\u00f3n',
  'Almac\u00e9n',
  'Log\u00edstica',
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
  'Pr\u00e1cticas profesionales',
  'Medio tiempo'
]);

const estadoCivilOptions = createOptions([
  'Soltero(a)',
  'Casado(a)',
  'Divorciado(a)',
  'Viudo(a)',
  'Uni\u00f3n libre'
]);

const generoOptions = createOptions([
  'Masculino',
  'Femenino',
  'No binario',
  'Prefiero no decirlo'
]);

const paisOptions = createOptions([
  'M\u00e9xico',
  'Estados Unidos',
  'Canad\u00e1',
  'Colombia',
  'Argentina',
  'Chile',
  'Per\u00fa',
  'Espa\u00f1a'
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
    minHeight: 48,
    borderColor: state.isFocused ? '#17346f' : '#d7e0ee',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,249,252,0.98))',
    boxShadow: state.isFocused ? '0 0 0 3px rgba(23,52,111,0.12)' : '0 8px 20px rgba(15, 45, 93, 0.05)',
    '&:hover': {
      borderColor: '#17346f'
    },
    borderRadius: 16,
    fontSize: '0.875rem'
  }),
  valueContainer: (base) => ({
    ...base,
    padding: '2px 14px'
  }),
  placeholder: (base) => ({
    ...base,
    color: '#94a3b8'
  }),
  singleValue: (base) => ({
    ...base,
    color: '#0f172a'
  }),
  indicatorSeparator: () => ({
    display: 'none'
  }),
  menu: (base) => ({
    ...base,
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 18px 36px rgba(15, 45, 93, 0.14)',
    zIndex: 30
  })
};

const premiumFieldClass = 'w-full rounded-2xl border border-[#d7e0ee] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,252,0.98))] px-4 py-3 text-sm text-slate-800 shadow-[0_8px_20px_rgba(15,45,93,0.05)] outline-none transition placeholder:text-slate-400 focus:border-[#17346f] focus:ring-4 focus:ring-[#17346f]/10';
const premiumSectionClass = 'rounded-[26px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,247,251,0.98))] p-4 shadow-[0_18px_40px_rgba(15,45,93,0.08)] sm:rounded-[28px] sm:p-5';
const primaryButtonClass = 'inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#1b3d86,#0f2556)] px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(15,45,93,0.24)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_32px_rgba(15,45,93,0.3)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none';
const secondaryButtonClass = 'inline-flex items-center justify-center rounded-2xl border border-[#d7e0ee] bg-white/90 px-4 py-3 text-sm font-semibold text-slate-700 shadow-[0_10px_24px_rgba(15,45,93,0.06)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:text-slate-900';
const subtleDangerButtonClass = 'inline-flex items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100';
const tableShellClass = 'overflow-hidden rounded-[28px] border border-white/70 bg-white/95 shadow-[0_18px_40px_rgba(15,45,93,0.08)]';

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

  const selectedUser = useMemo(
    () => usuarios.find((u) => Number(u.User_Id) === Number(selectedUserId)) || null,
    [usuarios, selectedUserId]
  );

  const modalTabs = [
    { key: 'perfil', label: 'Perfil RH', helper: 'Datos generales, laborales y salud' },
    { key: 'contactos', label: 'Contactos', helper: 'Emergencia y respaldo familiar' },
    { key: 'cuentas', label: 'Cuentas', helper: 'Dispersión bancaria y titularidad' },
    { key: 'documentos', label: 'Documentos', helper: 'Expediente digital del colaborador' }
  ];

  const expedienteStats = useMemo(() => ([
    {
      label: 'No. empleado',
      value: profileForm.NumeroEmpleado || selectedUser?.NumeroEmpleado || 'Pendiente',
      tone: 'text-slate-900'
    },
    {
      label: 'Contactos',
      value: String(contactos.length),
      tone: 'text-[#17346f]'
    },
    {
      label: 'Cuentas',
      value: String(cuentas.length),
      tone: 'text-emerald-700'
    },
    {
      label: 'Documentos',
      value: String(documentos.length),
      tone: 'text-rose-700'
    }
  ]), [
    contactos.length,
    cuentas.length,
    documentos.length,
    profileForm.NumeroEmpleado,
    selectedUser?.NumeroEmpleado
  ]);

  const cargarEmpresas = async () => {
    try {
      const res = await api.get('/companies/');
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
    // La carga se dispara intencionalmente cuando cambia la empresa seleccionada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      } catch {
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
    } catch {
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
      } catch {
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
    <div className="w-full min-h-screen overflow-auto bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.88),_transparent_30%),linear-gradient(180deg,#edf2f8_0%,#e7edf5_48%,#edf2f7_100%)] p-4 md:p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#6b7a96]">Capital humano</p>
          <h2 className="text-3xl font-semibold tracking-tight text-[#1d2430]">Empleados</h2>
          <p className="text-sm text-slate-500">Gestiona expedientes, filtros y accesos del equipo desde un solo panel.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-white/80 bg-white/75 px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm">
            {usuariosFiltrados.length} / {usuarios.length}
          </span>
          {usuariosFiltrados.length > 0 && (
            <button
              onClick={() => {
                const rows = usuariosFiltrados.map(u => ({
                  Nombre: `${u.Name || ''} ${u.Lastname || ''}`.trim(),
                  Email: u.Email || '',
                  NumeroEmpleado: u.NumeroEmpleado || '',
                  Puesto: u.Puesto || '',
                  Departamento: u.Departamento || '',
                  TipoContrato: u.TipoContrato || '',
                  FechaIngreso: u.FechaIngreso ? String(u.FechaIngreso).slice(0,10) : '',
                  SalarioMensual: u.SalarioMensual || '',
                  RFC: u.RFC || '',
                  CURP: u.CURP || '',
                  NSS: u.NSS || '',
                  Empresa: u.NameCompany || '',
                }));
                const csv = [
                  Object.keys(rows[0]).join(','),
                  ...rows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))
                ].join('\n');
                const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'empleados_rh.csv';
                document.body.appendChild(a); a.click(); a.remove();
                URL.revokeObjectURL(url);
              }}
              className="rounded-xl bg-gradient-to-r from-[#17408b] to-[#2e67d1] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(23,64,139,0.18)] transition hover:from-[#12356e] hover:to-[#2559ba]"
            >
              Exportar CSV
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <aside className="xl:col-span-3 2xl:col-span-2 h-fit rounded-[28px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(245,248,252,0.92))] p-4 shadow-[0_18px_40px_rgba(15,45,93,0.08)]">
          <div className="mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7b8aa6]">Filtro maestro</p>
            <h3 className="mt-1 text-lg font-semibold text-[#1d2430]">Departamentos</h3>
          </div>
          <div className="mb-4">
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="w-full rounded-2xl border border-[#d5ddeb] bg-white px-4 py-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-[#17408b] focus:ring-2 focus:ring-[#17408b]/10"
            >
              <option value="all">Todas las empresas</option>
              {companies.map((c) => (
                <option key={c.Company_Id} value={c.Company_Id}>{c.NameCompany}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            {departamentoStats.map((item) => {
              const isActive = selectedDepartment === item.name;
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setSelectedDepartment(item.name)}
                  className={`flex w-full items-center justify-between rounded-2xl px-3.5 py-3 text-sm transition ${
                    isActive
                      ? 'bg-gradient-to-r from-[#dde9fb] to-[#edf4ff] text-[#10366f] shadow-[inset_0_0_0_1px_rgba(23,64,139,0.08)]'
                      : 'text-slate-600 hover:bg-white hover:text-[#12356e]'
                  }`}
                >
                  <span className={`truncate ${isActive ? 'font-semibold' : 'font-medium'}`}>{item.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${isActive ? 'bg-white text-[#10366f]' : 'bg-slate-100 text-slate-500'}`}>{item.total}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="xl:col-span-9 2xl:col-span-10 space-y-4">
          <div className="rounded-[26px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(246,249,253,0.92))] p-4 shadow-[0_18px_40px_rgba(15,45,93,0.08)]">
            <div className="flex flex-wrap items-center gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, correo, puesto o departamento"
              className="min-w-[220px] flex-1 rounded-2xl border border-[#d5ddeb] bg-white px-4 py-3 text-sm text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#17408b] focus:ring-2 focus:ring-[#17408b]/10"
            />
            <div className="rounded-2xl border border-[#dce3ef] bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
              Departamento: <span className="font-semibold text-slate-700">{selectedDepartment}</span>
            </div>
            </div>
          </div>

          {loadingUsuarios ? (
            <div className="rounded-[26px] border border-white/80 bg-white/90 p-6 text-sm text-slate-600 shadow-[0_18px_40px_rgba(15,45,93,0.08)]">
              Cargando colaboradores...
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
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
                    className={`overflow-hidden rounded-[28px] border bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,250,253,0.94))] text-left shadow-[0_16px_36px_rgba(15,45,93,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_44px_rgba(15,45,93,0.14)] ${
                      isSelected ? 'border-[#4f6edb] ring-2 ring-[#4f6edb]/20' : 'border-white/80'
                    }`}
                  >
                    <div className="flex min-h-[182px]">
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
                      <div className="flex flex-1 flex-col justify-between p-4">
                        <div>
                          <p className="text-lg font-semibold leading-tight text-slate-900">{u.Name} {u.Lastname}</p>
                          <div className="mt-2 space-y-1.5 text-[13px] text-slate-600">
                            <p>{u.Puesto || 'Sin puesto asignado'}</p>
                            <p className="truncate">{u.Email || 'Sin correo registrado'}</p>
                            <p>{u.PhoneNumber || 'Sin teléfono registrado'}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-3">
                          <span className="inline-flex rounded-full bg-gradient-to-r from-pink-100 to-rose-100 px-3 py-1 text-xs font-semibold text-pink-700">
                            {u.Departamento || 'Sin departamento'}
                          </span>
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-emerald-600 text-xs font-bold text-white shadow-sm">
                            {initials.charAt(0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}

              {usuariosFiltrados.length === 0 && (
                <div className="col-span-full rounded-[26px] border border-white/80 bg-white/90 p-8 text-sm text-slate-500 shadow-[0_18px_40px_rgba(15,45,93,0.08)]">
                  No hay colaboradores para mostrar con este filtro.
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {selectedUserId && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-[rgba(3,10,28,0.62)] p-2 backdrop-blur-[2px] sm:p-4 md:p-6"
          onClick={() => {
            setSelectedUserId(null);
            setSelectedUserLabel('');
          }}
        >
          <div
            className="flex max-h-[96vh] w-full max-w-7xl flex-col overflow-hidden rounded-[28px] border border-white/30 bg-[linear-gradient(180deg,rgba(247,250,253,0.99),rgba(236,242,248,0.99))] shadow-[0_40px_100px_rgba(2,10,28,0.36)] sm:rounded-[32px]"
            onClick={(e) => e.stopPropagation()}
          >
            {loadingDetalle ? (
              <div className="p-6 md:p-8">
                {/* Skeleton — mismo shape que el header real */}
                <div className="animate-pulse rounded-[26px] bg-[linear-gradient(135deg,#d0d9ec,#c8d4e8)] p-5 md:p-6">
                  <div className="flex items-start gap-4">
                    <div className="h-20 w-20 shrink-0 rounded-[22px] bg-white/30" />
                    <div className="flex-1 space-y-3 pt-1">
                      <div className="h-2.5 w-24 rounded-full bg-white/40" />
                      <div className="h-7 w-56 rounded-full bg-white/50" />
                      <div className="h-3.5 w-full max-w-sm rounded-full bg-white/30" />
                      <div className="flex gap-2 pt-1">
                        <div className="h-6 w-28 rounded-full bg-white/30" />
                        <div className="h-6 w-24 rounded-full bg-white/25" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 animate-pulse rounded-[22px] bg-slate-200/60 p-3">
                  <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                    {[0,1,2,3].map(i => <div key={i} className="h-16 rounded-[18px] bg-white/70" />)}
                  </div>
                </div>
                <div className="mt-4 animate-pulse space-y-3 rounded-[22px] border border-white/60 bg-white/80 p-5">
                  <div className="h-2 w-20 rounded-full bg-slate-200" />
                  <div className="grid gap-3 md:grid-cols-3">
                    {[0,1,2,3,4,5].map(i => <div key={i} className="h-12 rounded-2xl bg-slate-100" />)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                {/* Header ejecutivo */}
                <div className="shrink-0 rounded-t-[28px] bg-[linear-gradient(135deg,#0f2556,#1c3f87_58%,#285fb3)] p-4 text-white shadow-[0_8px_24px_rgba(9,32,82,0.22)] sm:rounded-t-[32px] sm:p-5 md:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                      <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] sm:h-20 sm:w-20 sm:rounded-[26px] ${getColorClass(selectedUser?.User_Id || 0)} text-2xl font-semibold text-white shadow-[0_12px_28px_rgba(15,23,42,0.28)]`}>
                        {selectedUser && resolveFotoUrl(selectedUser.FotoPerfilUrl) ? (
                          <img
                            src={resolveFotoUrl(selectedUser.FotoPerfilUrl)}
                            alt={selectedUserLabel}
                            className="h-full w-full rounded-[22px] object-cover sm:rounded-[26px]"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        ) : (
                          getInitials(selectedUser || {}).slice(0, 2)
                        )}
                      </div>
                      <div className="min-w-0 space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-blue-100/75 sm:text-[11px]">Expediente RH</p>
                        <h3 className="truncate text-xl font-semibold tracking-tight text-white sm:text-2xl md:text-[2rem]">{selectedUserLabel}</h3>
                        <p className="hidden max-w-2xl text-sm text-blue-100/75 sm:block">
                          {"Vista integral del colaborador \u2014 datos laborales, bancarios, contactos y documentos."}
                        </p>
                        <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold sm:gap-2 sm:text-xs">
                          <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-white/90 sm:px-3 sm:py-1.5">
                            {selectedUser?.Puesto || 'Sin puesto'}
                          </span>
                          <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-white/90 sm:px-3 sm:py-1.5">
                            {selectedUser?.Departamento || 'Sin departamento'}
                          </span>
                          {selectedUser?.Email && (
                            <span className="hidden rounded-full border border-emerald-300/30 bg-emerald-400/15 px-2.5 py-1 text-emerald-50 sm:inline-flex sm:px-3 sm:py-1.5">
                              {selectedUser.Email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedUserId(null); setSelectedUserLabel(''); }}
                      className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white transition hover:bg-white/20 sm:h-auto sm:w-auto sm:px-4 sm:py-2.5 sm:text-sm sm:font-semibold"
                      aria-label="Cerrar expediente"
                    >
                      <svg className="h-4 w-4 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span className="hidden sm:inline">Cerrar expediente</span>
                    </button>
                  </div>
                </div>

                {/* Tab bar */}
                <div className="shrink-0 border-b border-slate-200/70 bg-white/85 px-2 py-2 backdrop-blur-sm sm:px-3">
                  <div className="mb-2 grid grid-cols-2 gap-2 xl:grid-cols-4">
                    {expedienteStats.map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-[18px] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(244,247,251,0.96))] px-3 py-3 shadow-[0_8px_18px_rgba(15,45,93,0.05)]"
                      >
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{stat.label}</p>
                        <p className={`mt-1 truncate text-sm font-semibold sm:text-base ${stat.tone}`}>{stat.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 xl:grid-cols-4">
                    {modalTabs.map((tab) => {
                      const isActive = activeTab === tab.key;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setActiveTab(tab.key)}
                          className={`rounded-[18px] px-3 py-3 text-left transition sm:px-4 ${
                            isActive
                              ? 'bg-[linear-gradient(135deg,#15336d,#2453a4)] text-white shadow-[0_12px_24px_rgba(15,45,93,0.18)]'
                              : 'bg-transparent hover:bg-slate-100/80'
                          }`}
                        >
                          <p className={`text-xs font-bold sm:text-sm ${isActive ? 'text-white' : 'text-slate-900'}`}>{tab.label}</p>
                          <p className={`mt-0.5 hidden text-[11px] sm:block ${isActive ? 'text-blue-100/75' : 'text-slate-500'}`}>{tab.helper}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-4">

              {activeTab === 'perfil' && (
                <form onSubmit={guardarPerfil} className="space-y-4 lg:space-y-5">
                  <div className={`${premiumSectionClass} flex flex-col gap-4 md:flex-row md:items-center md:justify-between`}>
                    <img
                      src={fotoPreview || 'https://ui-avatars.com/api/?name=RH&background=092052&color=fff'}
                      alt="Foto de perfil"
                      className="h-24 w-24 rounded-[28px] border border-white/70 object-cover shadow-[0_18px_34px_rgba(15,45,93,0.16)]"
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
                    <div className="flex-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Identidad visual</p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">Foto de perfil</p>
                      <p className="mb-3 mt-1 text-sm text-slate-500">Formatos permitidos: JPG, PNG, WEBP</p>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleFotoPerfilChange}
                        disabled={uploadingFoto}
                        className={`${premiumFieldClass} file:mr-4 file:rounded-xl file:border-0 file:bg-[#17346f] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white`}
                      />
                      {uploadingFoto && <p className="mt-2 text-xs font-medium text-[#17346f]">Subiendo imagen...</p>}
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    {/* Bloque laboral */}
                    <div className={premiumSectionClass}>
                      <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.24em] text-[#6b7a96]">Datos laborales</p>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-slate-600">Numero de empleado</label>
                          <input name="NumeroEmpleado" value={profileForm.NumeroEmpleado} onChange={handleProfileChange} placeholder="Ej. EMP-001" className={premiumFieldClass} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-slate-600">Puesto</label>
                          <CatalogSelectField value={profileForm.Puesto} onChange={(value) => handleProfileCatalogChange('Puesto', value)} options={puestoOptions} placeholder="Puesto" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-slate-600">Departamento</label>
                          <CatalogSelectField value={profileForm.Departamento} onChange={(value) => handleProfileCatalogChange('Departamento', value)} options={departamentoOptions} placeholder="Departamento" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-slate-600">Fecha de ingreso</label>
                          <input type="date" name="FechaIngreso" value={profileForm.FechaIngreso} onChange={handleProfileChange} className={premiumFieldClass} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-slate-600">Tipo de contrato</label>
                          <CatalogSelectField value={profileForm.TipoContrato} onChange={(value) => handleProfileCatalogChange('TipoContrato', value)} options={tipoContratoOptions} placeholder="Tipo de contrato" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-slate-600">Salario mensual</label>
                          <input type="number" step="0.01" name="SalarioMensual" value={profileForm.SalarioMensual} onChange={handleProfileChange} placeholder="0.00" className={premiumFieldClass} />
                        </div>
                      </div>
                    </div>

                    {/* Bloque identificacion */}
                    <div className={premiumSectionClass}>
                      <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.24em] text-[#6b7a96]">Identificacion</p>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-slate-600">Fecha de nacimiento</label>
                          <input type="date" name="FechaNacimiento" value={profileForm.FechaNacimiento} onChange={handleProfileChange} className={premiumFieldClass} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-slate-600">Estado civil</label>
                          <CatalogSelectField value={profileForm.EstadoCivil} onChange={(value) => handleProfileCatalogChange('EstadoCivil', value)} options={estadoCivilOptions} placeholder="Estado civil" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-slate-600">Genero</label>
                          <CatalogSelectField value={profileForm.Genero} onChange={(value) => handleProfileCatalogChange('Genero', value)} options={generoOptions} placeholder="Genero" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-slate-600">CURP</label>
                          <input name="CURP" value={profileForm.CURP} onChange={handleProfileChange} placeholder="18 caracteres" className={premiumFieldClass} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-slate-600">RFC</label>
                          <input name="RFC" value={profileForm.RFC} onChange={handleProfileChange} placeholder="RFC con homoclave" className={premiumFieldClass} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-slate-600">NSS</label>
                          <input name="NSS" value={profileForm.NSS} onChange={handleProfileChange} placeholder="Numero de seguridad social" className={premiumFieldClass} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    {/* Bloque domicilio */}
                    <div className={premiumSectionClass}>
                      <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.24em] text-[#6b7a96]">Domicilio</p>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="flex flex-col gap-1.5 md:col-span-2">
                          <label className="text-xs font-semibold text-slate-600">Direccion</label>
                          <input name="Direccion" value={profileForm.Direccion} onChange={handleProfileChange} placeholder="Calle, numero, colonia" className={premiumFieldClass} />
                        </div>
                        <div className="flex flex-col gap-1.5 relative">
                          <label className="text-xs font-semibold text-slate-600">Codigo postal</label>
                          <input
                            name="CodigoPostal"
                            value={profileForm.CodigoPostal}
                            onChange={handleCodigoPostalChange}
                            placeholder="5 digitos"
                            maxLength={5}
                            inputMode="numeric"
                            className={`${premiumFieldClass} pr-10`}
                          />
                          {loadingCP && (
                            <span className="absolute bottom-3 right-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#17346f]">...</span>
                          )}
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-slate-600">Pais</label>
                          <CatalogSelectField value={profileForm.Pais} onChange={(value) => handleProfileCatalogChange('Pais', value)} options={paisOptions} placeholder="Pais" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-slate-600">Ciudad</label>
                          <input
                            name="Ciudad"
                            value={profileForm.Ciudad}
                            onChange={handleProfileChange}
                            placeholder={loadingCP ? 'Buscando...' : 'Ciudad'}
                            disabled={loadingCP}
                            className={`${premiumFieldClass} ${loadingCP ? 'opacity-60' : ''}`}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-slate-600">Estado</label>
                          <input
                            name="Estado"
                            value={profileForm.Estado}
                            onChange={handleProfileChange}
                            placeholder={loadingCP ? 'Buscando...' : 'Estado'}
                            disabled={loadingCP}
                            className={`${premiumFieldClass} ${loadingCP ? 'opacity-60' : ''}`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bloque salud y banco */}
                    <div className={premiumSectionClass}>
                      <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.24em] text-[#6b7a96]">Salud y cuenta bancaria principal</p>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="flex flex-col gap-1.5 md:col-span-2">
                          <label className="text-xs font-semibold text-slate-600">Contacto de emergencia principal</label>
                          <input name="ContactoEmergenciaPrincipal" value={profileForm.ContactoEmergenciaPrincipal} onChange={handleProfileChange} placeholder="Nombre del contacto" className={premiumFieldClass} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-slate-600">Telefono de emergencia</label>
                          <input name="TelefonoEmergenciaPrincipal" value={profileForm.TelefonoEmergenciaPrincipal} onChange={handleProfileChange} placeholder="+52 000 000 0000" className={premiumFieldClass} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-slate-600">Banco principal</label>
                          <CatalogSelectField value={profileForm.BancoPrincipal} onChange={(value) => handleProfileCatalogChange('BancoPrincipal', value)} options={bancoOptions} placeholder="Banco" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-slate-600">Numero de cuenta</label>
                          <input name="NumeroCuentaPrincipal" value={profileForm.NumeroCuentaPrincipal} onChange={handleProfileChange} placeholder="16 digitos" className={premiumFieldClass} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-slate-600">CLABE interbancaria</label>
                          <input name="CLABE" value={profileForm.CLABE} onChange={handleProfileChange} placeholder="18 digitos" className={premiumFieldClass} />
                        </div>
                        <div className="flex flex-col gap-1.5 md:col-span-2">
                          <label className="text-xs font-semibold text-slate-600">Nombre del titular</label>
                          <input name="NombreTitularCuenta" value={profileForm.NombreTitularCuenta} onChange={handleProfileChange} placeholder="Nombre como aparece en la cuenta" className={premiumFieldClass} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-slate-600">Tipo de sangre</label>
                          <CatalogSelectField value={profileForm.TipoSangre} onChange={(value) => handleProfileCatalogChange('TipoSangre', value)} options={tipoSangreOptions} placeholder="Tipo de sangre" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-slate-600">Alergias</label>
                          <input name="Alergias" value={profileForm.Alergias} onChange={handleProfileChange} placeholder="Describe alergias conocidas" className={premiumFieldClass} />
                        </div>
                        <div className="flex flex-col gap-1.5 md:col-span-2">
                          <label className="text-xs font-semibold text-slate-600">Notas medicas</label>
                          <textarea name="NotasMedicas" value={profileForm.NotasMedicas} onChange={handleProfileChange} placeholder="Condiciones, medicamentos o indicaciones relevantes" className={`${premiumFieldClass} min-h-24 resize-none`} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={savingProfile}
                      className={primaryButtonClass}
                    >
                      {savingProfile ? 'Guardando...' : 'Guardar perfil RH'}
                    </button>
                  </div>
                </form>
              )}

              {activeTab === 'contactos' && (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#6b7a96]">Respuesta inmediata</p>
                      <h4 className="mt-1 text-lg font-semibold text-slate-900">Contactos de emergencia</h4>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
                      {contactos.length} registrados
                    </span>
                  </div>
                  <form onSubmit={guardarContacto} className={`${premiumSectionClass} grid grid-cols-1 gap-3 md:grid-cols-3`}>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-600">Nombre</label>
                      <input name="Nombre" value={contactoForm.Nombre} onChange={handleContactoChange} placeholder="Nombre completo" className={premiumFieldClass} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-600">Parentesco</label>
                      <CatalogSelectField value={contactoForm.Parentesco} onChange={(value) => handleContactoCatalogChange('Parentesco', value)} options={parentescoOptions} placeholder="Parentesco" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-600">Telefono</label>
                      <input name="Telefono" value={contactoForm.Telefono} onChange={handleContactoChange} placeholder="+52 000 000 0000" className={premiumFieldClass} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-600">Telefono alterno</label>
                      <input name="TelefonoAlterno" value={contactoForm.TelefonoAlterno} onChange={handleContactoChange} placeholder="Opcional" className={premiumFieldClass} />
                    </div>
                    <div className="flex flex-col gap-1.5 md:col-span-2">
                      <label className="text-xs font-semibold text-slate-600">Direccion</label>
                      <input name="Direccion" value={contactoForm.Direccion} onChange={handleContactoChange} placeholder="Calle, numero, colonia" className={premiumFieldClass} />
                    </div>
                    <div className="flex flex-col gap-1.5 md:col-span-2">
                      <label className="text-xs font-semibold text-slate-600">Notas</label>
                      <input name="Notas" value={contactoForm.Notas} onChange={handleContactoChange} placeholder="Informacion adicional" className={premiumFieldClass} />
                    </div>
                    <label className="flex items-center gap-3 rounded-2xl border border-[#d7e0ee] bg-slate-50/90 px-4 py-3 text-sm font-medium text-slate-700">
                      <input type="checkbox" name="EsPrincipal" checked={contactoForm.EsPrincipal} onChange={handleContactoChange} className="h-4 w-4 rounded border-slate-300 text-[#17346f] focus:ring-[#17346f]" />
                      Contacto principal
                    </label>
                    <div className="md:col-span-3 flex flex-wrap gap-3">
                      <button type="submit" disabled={savingContacto} className={primaryButtonClass}>
                        {savingContacto ? 'Guardando...' : editingContactoId ? 'Actualizar contacto' : 'Agregar contacto'}
                      </button>
                      {editingContactoId && (
                        <button type="button" onClick={resetContactoForm} className={secondaryButtonClass}>
                          Cancelar edición
                        </button>
                      )}
                    </div>
                  </form>

                  <div className={tableShellClass}>
                    <div className="overflow-auto">
                    <table className="w-full min-w-[760px] text-left text-sm border-collapse">
                      <thead className="bg-slate-50/90 text-slate-500">
                        <tr>
                          <th className="px-5 py-4 font-semibold">Nombre</th>
                          <th className="px-5 py-4 font-semibold">Parentesco</th>
                          <th className="px-5 py-4 font-semibold">Teléfono</th>
                          <th className="px-5 py-4 font-semibold">Principal</th>
                          <th className="px-5 py-4 font-semibold">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contactos.map((c) => (
                          <tr key={c.ContactoEmergencia_Id} className="border-t border-slate-100 text-slate-700">
                            <td className="px-5 py-4 font-medium text-slate-900">{c.Nombre}</td>
                            <td className="px-5 py-4 text-slate-700">{c.Parentesco || '-'}</td>
                            <td className="px-5 py-4 text-slate-700">{c.Telefono}</td>
                            <td className="px-5 py-4 text-slate-700">
                              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${c.EsPrincipal ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                {c.EsPrincipal ? 'Sí' : 'No'}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => startEditContacto(c)} className={secondaryButtonClass}>Editar</button>
                                <button type="button" onClick={() => eliminarContacto(c.ContactoEmergencia_Id)} className={subtleDangerButtonClass}>Eliminar</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                    {contactos.length === 0 && <p className="px-5 py-6 text-sm text-slate-500">Sin contactos de emergencia.</p>}
                  </div>
                </div>
              )}

              {activeTab === 'cuentas' && (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#6b7a96]">Dispersión</p>
                      <h4 className="mt-1 text-lg font-semibold text-slate-900">Cuentas bancarias</h4>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
                      {cuentas.length} registradas
                    </span>
                  </div>
                  <form onSubmit={guardarCuenta} className={`${premiumSectionClass} grid grid-cols-1 gap-3 md:grid-cols-3`}>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-600">Banco</label>
                      <CatalogSelectField value={cuentaForm.Banco} onChange={(value) => handleCuentaCatalogChange('Banco', value)} options={bancoOptions} placeholder="Banco" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-600">Numero de cuenta</label>
                      <input name="NumeroCuenta" value={cuentaForm.NumeroCuenta} onChange={handleCuentaChange} placeholder="16 digitos" className={premiumFieldClass} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-600">CLABE interbancaria</label>
                      <input name="CLABE" value={cuentaForm.CLABE} onChange={handleCuentaChange} placeholder="18 digitos" className={premiumFieldClass} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-600">Numero de tarjeta</label>
                      <input name="NumeroTarjeta" value={cuentaForm.NumeroTarjeta} onChange={handleCuentaChange} placeholder="16 digitos" className={premiumFieldClass} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-600">Nombre del titular</label>
                      <input name="NombreTitular" value={cuentaForm.NombreTitular} onChange={handleCuentaChange} placeholder="Como aparece en la cuenta" className={premiumFieldClass} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-600">Moneda</label>
                      <CatalogSelectField value={cuentaForm.Moneda} onChange={(value) => handleCuentaCatalogChange('Moneda', value)} options={monedaOptions} placeholder="Moneda" />
                    </div>
                    <label className="flex items-center gap-3 rounded-2xl border border-[#d7e0ee] bg-slate-50/90 px-4 py-3 text-sm font-medium text-slate-700 md:col-span-3">
                      <input type="checkbox" name="EsPrincipal" checked={cuentaForm.EsPrincipal} onChange={handleCuentaChange} className="h-4 w-4 rounded border-slate-300 text-[#17346f] focus:ring-[#17346f]" />
                      Cuenta principal
                    </label>
                    <div className="md:col-span-3 flex flex-wrap gap-3">
                      <button type="submit" disabled={savingCuenta} className={primaryButtonClass}>
                        {savingCuenta ? 'Guardando...' : editingCuentaId ? 'Actualizar cuenta' : 'Agregar cuenta'}
                      </button>
                      {editingCuentaId && (
                        <button type="button" onClick={resetCuentaForm} className={secondaryButtonClass}>
                          Cancelar edición
                        </button>
                      )}
                    </div>
                  </form>

                  <div className={tableShellClass}>
                    <div className="overflow-auto">
                    <table className="w-full min-w-[760px] text-left text-sm border-collapse">
                      <thead className="bg-slate-50/90 text-slate-500">
                        <tr>
                          <th className="px-5 py-4 font-semibold">Banco</th>
                          <th className="px-5 py-4 font-semibold">Cuenta</th>
                          <th className="px-5 py-4 font-semibold">CLABE</th>
                          <th className="px-5 py-4 font-semibold">Principal</th>
                          <th className="px-5 py-4 font-semibold">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cuentas.map((c) => (
                          <tr key={c.CuentaBancaria_Id} className="border-t border-slate-100 text-slate-700">
                            <td className="px-5 py-4 font-medium text-slate-900">{c.Banco}</td>
                            <td className="px-5 py-4 text-slate-700">{c.NumeroCuenta}</td>
                            <td className="px-5 py-4 text-slate-700">{c.CLABE || '-'}</td>
                            <td className="px-5 py-4 text-slate-700">
                              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${c.EsPrincipal ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                {c.EsPrincipal ? 'Sí' : 'No'}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => startEditCuenta(c)} className={secondaryButtonClass}>Editar</button>
                                <button type="button" onClick={() => eliminarCuenta(c.CuentaBancaria_Id)} className={subtleDangerButtonClass}>Eliminar</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                    {cuentas.length === 0 && <p className="px-5 py-6 text-sm text-slate-500">Sin cuentas bancarias registradas.</p>}
                  </div>
                </div>
              )}

              {activeTab === 'documentos' && (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#6b7a96]">Resguardo digital</p>
                      <h4 className="mt-1 text-lg font-semibold text-slate-900">Documentos del expediente</h4>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
                      {documentos.length} cargados
                    </span>
                  </div>
                  <form onSubmit={guardarDocumento} className={`${premiumSectionClass} grid grid-cols-1 gap-3 md:grid-cols-3`}>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-600">Tipo de documento</label>
                      <input
                        name="TipoDocumento"
                        value={documentoForm.TipoDocumento}
                        onChange={handleDocumentoFieldChange}
                        placeholder="INE, contrato, constancia, etc."
                        className={premiumFieldClass}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 md:col-span-2">
                      <label className="text-xs font-semibold text-slate-600">Descripción</label>
                      <input
                        name="Descripcion"
                        value={documentoForm.Descripcion}
                        onChange={handleDocumentoFieldChange}
                        placeholder="Describe el contenido o vigencia"
                        className={premiumFieldClass}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 md:col-span-2">
                      <label className="text-xs font-semibold text-slate-600">Archivo adjunto</label>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                        onChange={handleDocumentoFileChange}
                        className={`${premiumFieldClass} file:mr-4 file:rounded-xl file:border-0 file:bg-[#17346f] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white`}
                      />
                    </div>
                    <div className="flex items-end text-xs font-medium text-slate-500">
                      Formatos: PDF, JPG, PNG, WEBP, DOC, DOCX
                    </div>
                    <div className="md:col-span-3 flex flex-wrap gap-3 pt-1">
                      <button
                        type="submit"
                        disabled={uploadingDocumento}
                        className={primaryButtonClass}
                      >
                        {uploadingDocumento ? 'Subiendo...' : 'Cargar documento'}
                      </button>
                    </div>
                  </form>

                  <div className={tableShellClass}>
                    <div className="overflow-auto">
                    <table className="w-full min-w-[860px] text-left text-sm border-collapse">
                      <thead className="bg-slate-50/90 text-slate-500">
                        <tr>
                          <th className="px-5 py-4 font-semibold">Tipo</th>
                          <th className="px-5 py-4 font-semibold">Archivo</th>
                          <th className="px-5 py-4 font-semibold">Descripción</th>
                          <th className="px-5 py-4 font-semibold">Fecha</th>
                          <th className="px-5 py-4 font-semibold">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {documentos.map((d) => (
                          <tr key={d.Documento_Id} className="border-t border-slate-100 text-slate-700">
                            <td className="px-5 py-4 font-medium text-slate-900">{d.TipoDocumento || '-'}</td>
                            <td className="px-5 py-4">
                              <a
                                href={resolveDocumentoUrl(d.ArchivoUrl)}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium text-[#17346f] hover:underline"
                              >
                                {d.NombreArchivo || 'Ver documento'}
                              </a>
                            </td>
                            <td className="px-5 py-4 text-slate-700">{d.Descripcion || '-'}</td>
                            <td className="px-5 py-4 text-slate-700">{d.CreatedAt ? new Date(d.CreatedAt).toLocaleDateString('es-MX') : '-'}</td>
                            <td className="px-5 py-4">
                              <button
                                type="button"
                                onClick={() => eliminarDocumento(d.Documento_Id)}
                                className={subtleDangerButtonClass}
                              >
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                    {documentos.length === 0 && <p className="px-5 py-6 text-sm text-slate-500">Sin documentos cargados.</p>}
                  </div>
                </div>
              )}

              </div>
            </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
