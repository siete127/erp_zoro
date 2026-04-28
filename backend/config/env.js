/**
 * Obtiene una variable de entorno requerida
 * @param {string} name - Nombre de la variable
 * @throws {Error} Si la variable no existe o está vacía
 * @returns {string} Valor de la variable
 */
function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    const error = `\n❌ ERROR: Variable de entorno requerida no encontrada o vacía: "${name}"\n\nSolución:\n1. Verifica que existe: backend/.env\n2. Verifica que contiene: ${name}=<valor>\n3. Reinicia el servidor\n\nReferencia: backend/.env.example\n`;
    console.error(error);
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return String(value).trim();
}

/**
 * Obtiene y valida la clave JWT secreta
 * @throws {Error} Si ERP_SECRET_KEY no existe o es menor a 32 caracteres
 * @returns {string} Valor de la clave secreta
 */
function getJwtSecret() {
  const secret = getRequiredEnv("ERP_SECRET_KEY");
  if (secret.length < 32) {
    const error = `\n❌ ERROR: ERP_SECRET_KEY debe tener al menos 32 caracteres\n\nActual: ${secret.length} caracteres\nMínimo requerido: 32 caracteres\n\nModifica backend/.env:\nERP_SECRET_KEY=<una-clave-de-32-o-mas-caracteres>\n`;
    console.error(error);
    throw new Error("ERP_SECRET_KEY must be at least 32 characters long");
  }
  return secret;
}

/**
 * Valida todas las variables de entorno requeridas al iniciar
 * @throws {Error} Si falta alguna variable crítica
 */
function validateEnvironment() {
  const required = [
    'DB_SERVER',
    'DB_PORT',
    'DB_DATABASE',
    'DB_USER',
    'DB_PASSWORD',
    'ERP_SECRET_KEY',
    'PORT',
    'FRONTEND_URL'
  ];

  const missing = [];
  const invalid = [];

  required.forEach(envVar => {
    const value = process.env[envVar];
    if (!value || !String(value).trim()) {
      missing.push(envVar);
    }
    
    if (envVar === 'ERP_SECRET_KEY' && value && value.length < 32) {
      invalid.push(`${envVar} (debe tener mínimo 32 caracteres)`);
    }
    
    if (envVar === 'PORT' && isNaN(Number(value))) {
      invalid.push(`${envVar} (debe ser un número)`);
    }
  });

  if (missing.length > 0 || invalid.length > 0) {
    let errorMsg = '\n❌ ERROR: Configuración de entorno incompleta\n';
    
    if (missing.length > 0) {
      errorMsg += `\nVariables faltantes (${missing.length}):\n`;
      missing.forEach(v => errorMsg += `  - ${v}\n`);
    }
    
    if (invalid.length > 0) {
      errorMsg += `\nVariables inválidas (${invalid.length}):\n`;
      invalid.forEach(v => errorMsg += `  - ${v}\n`);
    }
    
    errorMsg += `\n📝 Copia backend/.env.example a backend/.env y completa los valores\n`;
    
    console.error(errorMsg);
    throw new Error('Environment validation failed');
  }
}

module.exports = {
  getRequiredEnv,
  getJwtSecret,
  validateEnvironment,
};
