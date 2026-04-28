function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return String(value).trim();
}

function getJwtSecret() {
  const secret = getRequiredEnv("ERP_SECRET_KEY");
  if (secret.length < 32) {
    throw new Error("ERP_SECRET_KEY must be at least 32 characters long");
  }
  return secret;
}

module.exports = {
  getRequiredEnv,
  getJwtSecret,
};
