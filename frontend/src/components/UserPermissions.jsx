import { useState, useEffect, useMemo } from 'react';
import {
  FaShoppingCart, FaCalculator, FaUsers, FaIndustry, FaShieldAlt,
  FaHandshake, FaCheck, FaChevronDown, FaChevronUp, FaExclamationTriangle
} from 'react-icons/fa';
import api from '../services/api';
import { notify } from '../services/notify';
import { clearCache as clearPermissionCache } from '../services/permissionService';

// ─── Perfiles predefinidos ───────────────────────────────────────────────────
const PERFILES = [
  {
    id: 'vendedor',
    nombre: 'Vendedor',
    descripcion: 'Ventas, clientes y CRM',
    icon: FaShoppingCart,
    color: 'blue',
    modulos: ['dashboard', 'clients', 'crm', 'sales', 'products', 'quotes'],
  },
  {
    id: 'compras',
    nombre: 'Compras',
    descripcion: 'Órdenes de compra e inventario',
    icon: FaHandshake,
    color: 'orange',
    modulos: ['dashboard', 'purchases', 'products', 'inventory'],
  },
  {
    id: 'contador',
    nombre: 'Contador',
    descripcion: 'Contabilidad y reportes financieros',
    icon: FaCalculator,
    color: 'green',
    modulos: ['dashboard', 'accounting', 'fixed_assets', 'reporteria', 'companies'],
  },
  {
    id: 'rh',
    nombre: 'RH',
    descripcion: 'Recursos humanos, nómina y asistencia',
    icon: FaUsers,
    color: 'purple',
    modulos: ['dashboard', 'rh', 'users', 'expenses'],
  },
  {
    id: 'operaciones',
    nombre: 'Operaciones',
    descripcion: 'Producción, inventario y mantenimiento',
    icon: FaIndustry,
    color: 'yellow',
    modulos: ['dashboard', 'production', 'bom', 'inventory', 'products'],
  },
  {
    id: 'admin',
    nombre: 'Administrador completo',
    descripcion: 'Acceso total al sistema',
    icon: FaShieldAlt,
    color: 'red',
    modulos: '__all__',
  },
];

const COLOR_MAP = {
  blue:   { card: 'border-blue-400 bg-blue-50',   icon: 'bg-blue-100 text-blue-600',   badge: 'bg-blue-500' },
  orange: { card: 'border-orange-400 bg-orange-50', icon: 'bg-orange-100 text-orange-600', badge: 'bg-orange-500' },
  green:  { card: 'border-green-400 bg-green-50',  icon: 'bg-green-100 text-green-600',  badge: 'bg-green-500' },
  purple: { card: 'border-purple-400 bg-purple-50', icon: 'bg-purple-100 text-purple-600', badge: 'bg-purple-500' },
  yellow: { card: 'border-yellow-400 bg-yellow-50', icon: 'bg-yellow-100 text-yellow-600', badge: 'bg-yellow-500' },
  red:    { card: 'border-red-400 bg-red-50',     icon: 'bg-red-100 text-red-600',     badge: 'bg-red-500' },
};

// ─── Componente principal ────────────────────────────────────────────────────
export default function UserPermissions({ userId, userName, onClose }) {
  const [permissions, setPermissions] = useState([]);        // lista completa de módulos con CanAccess
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isCurrentUser, setIsCurrentUser] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [perfilesActivos, setPerfilesActivos] = useState([]); // ids de perfiles seleccionados
  const [modulosManuales, setModulosManuales] = useState(new Set()); // keys modificados a mano
  const [mostrarDetalle, setMostrarDetalle] = useState(false);

  const normalizedUserId = String(userId || '').replace(/^\/+|\/+$/g, '');

  // Todos los moduleKeys disponibles
  const todosLosModulos = useMemo(() => permissions.map(p => p.ModuleKey), [permissions]);

  // Módulos que activan los perfiles seleccionados (unión)
  const modulosDePerfiles = useMemo(() => {
    const set = new Set();
    perfilesActivos.forEach(pid => {
      const perfil = PERFILES.find(p => p.id === pid);
      if (!perfil) return;
      if (perfil.modulos === '__all__') {
        todosLosModulos.forEach(k => set.add(k));
      } else {
        perfil.modulos.forEach(k => set.add(k));
      }
    });
    return set;
  }, [perfilesActivos, todosLosModulos]);

  // Módulos activos = unión de perfiles + cambios manuales aplicados sobre permissions
  const modulosActivos = useMemo(() => {
    return new Set(permissions.filter(p => p.CanAccess).map(p => p.ModuleKey));
  }, [permissions]);

  // ¿El set actual de permisos difiere de lo que darían los perfiles solos?
  const hayModificacionManual = useMemo(() => modulosManuales.size > 0, [modulosManuales]);

  // ─── Advertencias ───────────────────────────────────────────────────────
  const advertencias = useMemo(() => {
    const warns = [];
    const activos = permissions.filter(p => p.CanAccess).length;

    if (perfilesActivos.includes('admin') && perfilesActivos.length > 1) {
      warns.push('Combinaste "Administrador completo" con otros perfiles. Los demás perfiles son redundantes.');
    }
    if (activos > 15 && !perfilesActivos.includes('admin')) {
      warns.push(`Este usuario tendrá acceso a ${activos} de ${permissions.length} módulos — acceso muy amplio.`);
    }
    if (perfilesActivos.length === 0 && modulosManuales.size > 0) {
      const sensibles = ['users', 'companies', 'accounting'].filter(k => modulosActivos.has(k));
      if (sensibles.length > 0) {
        warns.push(`Activaste módulos sensibles manualmente sin un perfil base: ${sensibles.join(', ')}.`);
      }
    }
    return warns;
  }, [perfilesActivos, permissions, modulosManuales, modulosActivos]);

  // ─── Carga inicial ───────────────────────────────────────────────────────
  useEffect(() => {
    const currentUserId = localStorage.getItem('userId');
    setIsCurrentUser(String(currentUserId) === normalizedUserId);
    loadPermissions();
    checkIfAdmin();
  }, [normalizedUserId]);

  const checkIfAdmin = async () => {
    if (!normalizedUserId) return;
    try {
      const { data } = await api.get(`/users/${normalizedUserId}`);
      setIsAdmin(data.RolId !== undefined ? Number(data.RolId) <= 2 : false);
    } catch {}
  };

  const loadPermissions = async () => {
    if (!normalizedUserId) return;
    try {
      setLoading(true);
      const { data } = await api.get(`/permissions/user/${normalizedUserId}`);
      const permsWithBool = (data.data || []).map(p => ({
        ...p,
        ModuleKey: String(p.ModuleKey || '').trim().toLowerCase(),
        CanAccess: p.CanAccess === 1 || p.CanAccess === true,
      }));
      setPermissions(permsWithBool);
    } catch {
      notify.error('Error al cargar permisos');
    } finally {
      setLoading(false);
    }
  };

  // ─── Seleccionar / deseleccionar perfil ──────────────────────────────────
  const togglePerfil = (perfilId) => {
    if (isAdmin) return;
    const perfil = PERFILES.find(p => p.id === perfilId);
    if (!perfil) return;

    const yaActivo = perfilesActivos.includes(perfilId);
    const nuevosPerfiles = yaActivo
      ? perfilesActivos.filter(id => id !== perfilId)
      : [...perfilesActivos, perfilId];

    setPerfilesActivos(nuevosPerfiles);
    setModulosManuales(new Set()); // al cambiar perfil, resetear modificaciones manuales

    // Calcular nuevos módulos activos
    const nuevosModulos = new Set();
    nuevosPerfiles.forEach(pid => {
      const p = PERFILES.find(x => x.id === pid);
      if (!p) return;
      if (p.modulos === '__all__') {
        todosLosModulos.forEach(k => nuevosModulos.add(k));
      } else {
        p.modulos.forEach(k => nuevosModulos.add(k));
      }
    });

    setPermissions(prev =>
      prev.map(p => ({ ...p, CanAccess: nuevosModulos.has(p.ModuleKey) }))
    );
  };

  // ─── Toggle manual de un módulo ─────────────────────────────────────────
  const toggleModulo = (moduleKey) => {
    if (isAdmin) return;
    setModulosManuales(prev => {
      const next = new Set(prev);
      next.has(moduleKey) ? next.delete(moduleKey) : next.add(moduleKey);
      return next;
    });
    setPermissions(prev =>
      prev.map(p => p.ModuleKey === moduleKey ? { ...p, CanAccess: !p.CanAccess } : p)
    );
  };

  const selectAll = () => {
    setPermissions(prev => prev.map(p => ({ ...p, CanAccess: true })));
    setPerfilesActivos([]);
    setModulosManuales(new Set(todosLosModulos));
  };

  const deselectAll = () => {
    setPermissions(prev => prev.map(p => ({ ...p, CanAccess: false })));
    setPerfilesActivos([]);
    setModulosManuales(new Set());
  };

  // ─── Guardar ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!normalizedUserId) return;
    try {
      setSaving(true);
      await api.put(`/permissions/user/${normalizedUserId}`, {
        permissions: permissions.map(p => ({
          ModuleKey: String(p.ModuleKey || '').trim().toLowerCase(),
          CanAccess: p.CanAccess,
        })),
      });
      notify.success('Permisos actualizados correctamente');
      if (isCurrentUser) {
        clearPermissionCache();
        window.location.reload();
      }
      onClose?.();
    } catch {
      notify.error('Error al guardar permisos');
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const modulosActivosCount = permissions.filter(p => p.CanAccess).length;

  return (
    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-auto flex flex-col max-h-[90vh]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Permisos de acceso</h2>
          <p className="text-sm text-gray-500 mt-0.5">{userName}</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
      </div>

      <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

        {/* Admin bloqueado */}
        {isAdmin && (
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-800">
            <strong>Usuario Administrador:</strong> Tiene acceso completo. Los permisos no se pueden modificar.
          </div>
        )}

        {/* Advertencia usuario actual */}
        {isCurrentUser && !isAdmin && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            <strong>Estás editando tus propios permisos.</strong> Si bloqueas un módulo, la página se recargará.
          </div>
        )}

        {/* ── SECCIÓN A: Perfiles ── */}
        {!isAdmin && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800 text-sm">Perfiles rápidos</h3>
              <span className="text-xs text-gray-400">Puedes combinar varios perfiles</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {PERFILES.map(perfil => {
                const activo = perfilesActivos.includes(perfil.id);
                const c = COLOR_MAP[perfil.color];
                const Icon = perfil.icon;
                const totalModulos = perfil.modulos === '__all__'
                  ? todosLosModulos.length
                  : perfil.modulos.length;

                return (
                  <button
                    key={perfil.id}
                    onClick={() => togglePerfil(perfil.id)}
                    className={`relative text-left p-3 rounded-xl border-2 transition-all ${
                      activo ? c.card + ' shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    {/* Check badge */}
                    {activo && (
                      <span className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center ${c.badge}`}>
                        <FaCheck className="text-white text-[9px]" />
                      </span>
                    )}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${c.icon}`}>
                      <Icon className="text-sm" />
                    </div>
                    <p className="font-semibold text-gray-900 text-xs leading-tight">{perfil.nombre}</p>
                    <p className="text-gray-400 text-[10px] mt-0.5 leading-tight">{perfil.descripcion}</p>
                    <p className="text-gray-400 text-[10px] mt-1">{totalModulos} módulos</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Advertencias ── */}
        {advertencias.length > 0 && (
          <div className="space-y-2">
            {advertencias.map((w, i) => (
              <div key={i} className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <FaExclamationTriangle className="flex-shrink-0 mt-0.5 text-amber-500" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── SECCIÓN B: Personalización manual ── */}
        {!isAdmin && (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            {/* Header colapsable */}
            <button
              onClick={() => setMostrarDetalle(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-800 text-sm">Personalización manual</span>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                  {modulosActivosCount} / {permissions.length} activos
                </span>
                {hayModificacionManual && (
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                    Modificado manualmente
                  </span>
                )}
              </div>
              {mostrarDetalle ? <FaChevronUp className="text-gray-400 text-xs" /> : <FaChevronDown className="text-gray-400 text-xs" />}
            </button>

            {mostrarDetalle && (
              <div className="p-4">
                {/* Acciones rápidas */}
                <div className="flex gap-2 mb-3">
                  <button onClick={selectAll} className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors">
                    Activar todos
                  </button>
                  <button onClick={deselectAll} className="text-xs px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors">
                    Desactivar todos
                  </button>
                </div>

                {/* Lista de módulos */}
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {permissions.map(perm => {
                    const esDeUnPerfil = modulosDePerfiles.has(perm.ModuleKey);
                    const modificadoManual = modulosManuales.has(perm.ModuleKey);
                    return (
                      <label
                        key={perm.ModuleKey}
                        className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors ${
                          perm.CanAccess ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50 border border-gray-100 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-medium text-gray-900">{perm.ModuleName}</span>
                            {esDeUnPerfil && !modificadoManual && (
                              <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">perfil</span>
                            )}
                            {modificadoManual && (
                              <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">manual</span>
                            )}
                          </div>
                          {perm.Description && (
                            <p className="text-xs text-gray-400 truncate">{perm.Description}</p>
                          )}
                        </div>
                        <input
                          type="checkbox"
                          checked={!!perm.CanAccess}
                          onChange={() => toggleModulo(perm.ModuleKey)}
                          className="w-4 h-4 ml-3 text-blue-600 rounded cursor-pointer flex-shrink-0"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-4 border-t flex-shrink-0 bg-gray-50 rounded-b-xl">
        <span className="text-xs text-gray-400">
          {isAdmin ? 'Acceso total (no modificable)' : `${modulosActivosCount} módulos activos`}
        </span>
        <div className="flex gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          {!isAdmin && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
            >
              {saving ? 'Guardando...' : 'Guardar permisos'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
