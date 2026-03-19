/**
 * Obtiene las empresas del usuario desde el token JWT
 * @returns {Array<number>} Array de Company_Id asignados al usuario
 */
export const getUserCompanies = () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) return [];
    
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.companies || [];
  } catch (err) {
    console.error('Error al decodificar token:', err);
    return [];
  }
};

/**
 * Obtiene la primera empresa del usuario (empresa por defecto)
 * @returns {number} Company_Id de la primera empresa, o 1 como fallback
 */
export const getDefaultCompanyId = () => {
  const companies = getUserCompanies();
  return companies.length > 0 ? companies[0] : 1;
};

/**
 * Obtiene el rol del usuario desde el token JWT
 * @returns {number} RolId del usuario
 */
export const getUserRole = () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;
    
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.rol;
  } catch (err) {
    console.error('Error al decodificar token:', err);
    return null;
  }
};

/**
 * Verifica si el usuario es admin (RolId 1 o 2)
 * @returns {boolean} True si es admin o superadmin
 */
export const isUserAdmin = () => {
  const role = getUserRole();
  return role === 1 || role === 2;
};

export default {
  getUserCompanies,
  getDefaultCompanyId,
  getUserRole,
  isUserAdmin,
};
