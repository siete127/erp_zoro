const express = require("express");
const cors = require("cors");
const fileUpload = require("express-fileupload");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
require("dotenv").config();

// ============================================
// VALIDACIÓN DE VARIABLES DE ENTORNO
// ============================================
const { validateEnvironment, getJwtSecret } = require("./config/env");
try {
  validateEnvironment();
  // Valida también la clave JWT
  getJwtSecret();
  console.log("✅ Variables de entorno validadas correctamente\n");
} catch (error) {
  console.error("\n" + error.message);
  process.exit(1);
}

const app = express();
const server = http.createServer(app);

// Configurar orígenes permitidos para Socket.io
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'https://qaerp.ardabytec.vip',
  'https://erp.ardabytec.vip',
  process.env.FRONTEND_URL,
].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  },
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log("Cliente WebSocket conectado", socket.id);

  socket.on("disconnect", () => {
    // Log silencioso - las desconexiones son normales
    if (process.env.DEBUG_WEBSOCKET === 'true') {
      console.log("Cliente WebSocket desconectado", socket.id);
    }
  });
});

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json());
app.use(fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 },
  abortOnLimit: true,
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/password", require("./routes/password.routes"));
app.use("/api/users", require("./routes/user.routes"));
app.use("/api/roles", require("./routes/role.routes"));
app.use("/api/permissions", require("./routes/permission.routes"));
app.use("/api/clients", require("./routes/client.routes"));
app.use("/api/companies", require("./routes/company.routes"));
app.use("/api/productos", require("./routes/producto.routes"));
app.use("/api/almacenes", require("./routes/almacen.routes"));
app.use("/api/inventario", require("./routes/inventario.routes"));
app.use("/api/sat", require("./routes/sat.routes"));
app.use("/api/precios", require("./routes/precio.routes"));
app.use("/api/config", require("./routes/config.routes"));
app.use("/api/constancia", require("./routes/constancia.routes"));
app.use("/api/ventas", require("./routes/venta.routes"));
app.use("/api/crm", require("./routes/crm.routes"));
app.use("/api", require("./routes/factura.routes"));
app.use("/api/cotizaciones", require("./routes/cotizacion.routes"));
app.use("/api/produccion", require("./routes/produccion.routes"));
app.use("/api/bom", require("./routes/bom.routes"));
app.use("/api/materias-primas", require("./routes/materiaPrima.routes"));
app.use("/api/client-pricing", require("./routes/clientPricing.routes"));
app.use("/api/reporteria", require("./routes/reporteria.routes"));
app.use("/api/notas-credito", require("./routes/notaCredito.routes"));
app.use("/api/complementos-pago", require("./routes/complementoPago.routes"));
app.use("/api/rh", require("./routes/rh.routes"));
app.use("/api/cp", require("./routes/cp.routes"));
app.use("/api/compras", require("./routes/compras.routes"));
app.use("/api/accounting", require("./routes/accounting.routes"));
app.use("/api/superadmin", require("./routes/superadmin.routes"));

app.get("/", (req, res) => {
  res.send("ERP Backend funcionando");
});

// ============================================
// ENDPOINT DE SALUD PARA VERIFICAR QUE BACKEND ESTÁ CORRIENDO
// ============================================
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    port: process.env.PORT || 5000,
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log("\n" + "=".repeat(60));
  console.log("✅ ERP Backend iniciado correctamente");
  console.log("=".repeat(60));
  console.log(`📡 API escuchando en:     http://localhost:${PORT}`);
  console.log(`🌐 Frontend conecta en:   http://localhost:5173`);
  console.log(`💊 Health check:          http://localhost:${PORT}/health`);
  console.log(`📚 WebSocket (Socket.io): ws://localhost:${PORT}`);
  console.log("=".repeat(60) + "\n");
});
