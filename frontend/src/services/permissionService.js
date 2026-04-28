import api from './api';

let cachedPermissions = null;
let cachedUserId = null;

export const loadUserPermissions = async (userId) => {
  const normalizedUserId = String(userId || "").replace(/^\/+|\/+$/g, "");
  if (!normalizedUserId) {
    return {};
  }

  if (cachedUserId === normalizedUserId && cachedPermissions) {
    return cachedPermissions;
  }

  try {
    const { data } = await api.get(`/permissions/user/${normalizedUserId}`);
    const permMap = {};
    // El backend devuelve un array de objetos con ModuleKey y CanAccess
    (data.data || []).forEach(p => {
      const key = String(p.ModuleKey || '').trim().toLowerCase();
      if (!key) return;
      permMap[key] = p.CanAccess === 1 || p.CanAccess === true;
    });
    cachedPermissions = permMap;
    cachedUserId = normalizedUserId;
    console.log('Permisos procesados:', permMap);
    return permMap;
  } catch (error) {
    console.error('Error loading permissions:', error);
    return {};
  }
};

export const hasAccess = (moduleKey) => {
  return cachedPermissions?.[moduleKey] === true;
};

export const clearCache = () => {
  cachedPermissions = null;
  cachedUserId = null;
};
