// trackerConfig.js
const PROVEEDOR_ACTIVO = "GPSWOX";

const CONFIG_PROVEEDORES = {
  GPSWOX: {
    BASE_URL: "http://ingresar.galaxgpsvzla.com/api",
    USER_API_HASH: "$2y$10$kMJlvRZeRk63CWp8hyl9cuHxXf.BroKJh9/5wNoVBEAOappC6a69a",
    ENDPOINTS: {
      devices: "/get_devices", // <-- Endpoint correcto detectado en tu documentación
      clients: "/admin/clients"
    }
  }
};

const SUPABASE_CONFIG = {
  URL: "https://eejkrbehgqkdvyafvxnr.supabase.co",
  KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlamtyYmVoZ3FrZHZ5YWZ2eG5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5NjU4NjAsImV4cCI6MjEwNDU0MTg2MH0.q1Hp178vPMW3y8p7oy8Ben7U5ISFqgrRhZ-ky8qcli0"
};

module.exports = {
  PROVEEDOR_ACTIVO,
  CONFIG: CONFIG_PROVEEDORES[PROVEEDOR_ACTIVO],
  SUPABASE_CONFIG
};