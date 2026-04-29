# Guía: Cómo Probar SuperAdmin Localmente

## 📋 Requisitos Previos

- Node.js 18+ (para frontend)
- Python 3.10+ (para backend)
- SQL Server con la BD ERP configurada
- Git o acceso a los archivos del proyecto

## 🚀 Paso 1: Iniciar el Backend Python FastAPI

```bash
# Navegar a la carpeta del backend Python
cd "c:\Users\diazj\OneDrive\Escritorio\ERP_PROYECTO\erp_zoro_python"

# Instalar dependencias (si es la primera vez)
pip install -r requirements.txt

# O usar conda si está disponible
conda env create -f environment.yml

# Activar el ambiente
# En Windows:
conda activate erp_zoro
# O si usas venv:
.\venv\Scripts\activate

# Ejecutar el servidor
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Deberías ver:
# INFO:     Uvicorn running on http://0.0.0.0:8000
# INFO:     Application startup complete
```

## 🎨 Paso 2: Iniciar el Frontend React

```bash
# En otra terminal/ventana
cd "c:\Users\diazj\OneDrive\Escritorio\ERP_PROYECTO\frontend"

# Instalar dependencias (si es la primera vez)
npm install

# Ejecutar desarrollo
npm run dev

# O si usas el servidor de desarrollo Vite:
npm start

# Deberías ver:
# VITE v5.x.x  ready in xxx ms
# ➜  Local:   http://127.0.0.1:5173/
```

## 🔐 Paso 3: Login como SuperAdmin

1. Abre el navegador en: `http://localhost:5173` (o el puerto que te muestre)
2. Ve a la página de login
3. Usa credenciales de SuperAdmin:
   - **Usuario:** (usuario con rol_id = 1)
   - **Contraseña:** (contraseña)
4. Después de login, deberías tener un token en localStorage

### Verificar Token JWT

Abre la consola del navegador (F12) y ejecuta:

```javascript
// Ver el token completo
const token = localStorage.getItem('token');
console.log(token);

// Decodificar el payload (solo lectura, no verifica firma)
const parts = token.split('.');
const payload = JSON.parse(atob(parts[1]));
console.log(payload);
// Deberías ver: { is_super_admin: true, rol_id: 1, ... }
```

## 📊 Paso 4: Probar el Dashboard SuperAdmin

1. Después de loguearse, observa la barra lateral izquierda
2. Deberías ver una sección **"SuperAdmin"** con 4 opciones:
   - 📊 Dashboard Global
   - 🏢 Gestión Empresas
   - 👔 Administradores
   - 📜 Auditoría Global

3. Haz clic en **"Dashboard Global"**
4. Deberías ver:
   - ✅ 4 tarjetas con KPIs (Empresas, Usuarios, Actividad, Última Actividad)
   - ✅ Tabla con todas las empresas
   - ✅ Gráfico de barras (usuarios por empresa)
   - ✅ Gráfico de pastel (distribución)

### Si ves errores:

```
Error: "Acceso denegado: requiere permisos de SuperAdmin"
→ El usuario no tiene is_super_admin=true en el token
  Solución: Verifica que el usuario tenga rol_id=1 en la BD

Error: "No hay datos"
→ Puede no haber empresas o usuarios en la BD
  Solución: Carga datos de prueba (ver EJEMPLO_DATOS_PRUEBA.sql)

Error: "Network Error" o "404"
→ El backend no está corriendo
  Solución: Verifica que uvicorn esté ejecutándose en puerto 8000
```

## 📜 Paso 5: Probar la Auditoría Global

1. Desde el menú SuperAdmin, haz clic en **"Auditoría Global"**
2. Deberías ver:
   - ✅ Una tabla con logs (columnas: Fecha, Usuario, Acción, Empresa, Detalles)
   - ✅ Filtros: usuario, empresa, acción, fechas
   - ✅ Búsqueda libre
   - ✅ Botón "Exportar CSV"

### Probar Filtros:

```
1. Selecciona una empresa en el dropdown "Empresa"
   → Tabla debe filtrar a solo esa empresa

2. Selecciona una acción "UPDATE"
   → Tabla debe mostrar solo cambios (UPDATE)

3. Ingresa fecha "2024-01-01" en "Desde"
   → Tabla debe filtrar desde esa fecha

4. Escribe texto en "Buscar"
   → Tabla debe buscar en detalles

5. Haz clic en "Exportar CSV"
   → Descargará archivo auditoria_YYYY-MM-DD.csv
```

## 👔 Paso 6: Probar Gestión de Administradores

1. Desde el menú SuperAdmin, haz clic en **"Administradores"**
2. Deberías ver:
   - ✅ Dropdown para seleccionar empresa
   - ✅ Display del admin actual (si existe)
   - ✅ Botón "Remover" (si hay admin asignado)
   - ✅ Dropdown de usuarios disponibles
   - ✅ Botón "Asignar Como Admin"

### Probar Acciones:

```
1. Selecciona una empresa
   → Muestra el admin actual de esa empresa

2. Si hay admin, haz clic "Remover"
   → Desaparece el display del admin

3. Selecciona un usuario del dropdown
   → Prepara para asignación

4. Haz clic "Asignar Como Admin"
   → Admin se asigna y se refleja en la tabla
```

## 🏢 Paso 7: Gestión de Empresas

1. Desde el menú SuperAdmin, haz clic en **"Gestión Empresas"**
2. Deberías ver una tabla con todas las empresas
3. Debería permitir crear, editar, eliminar empresas

## 🔧 Paso 8: Validación Técnica con Postman

### Descargar Postman:
https://www.postman.com/downloads/

### Crear requests de prueba:

**Request 1: Dashboard Global**
```
GET http://localhost:8000/api/superadmin/dashboard

Headers:
Authorization: Bearer {tu_token_jwt}
Content-Type: application/json

Esperado:
Status 200
{
  "total_companies": 5,
  "total_users": 25,
  "activity_today": 10,
  "last_activity": "2024-01-15T14:30:00",
  "companies": [...]
}
```

**Request 2: Auditoría con Filtros**
```
GET http://localhost:8000/api/superadmin/auditoria?company_id=1&action_type=UPDATE&limit=50

Headers:
Authorization: Bearer {tu_token_jwt}

Esperado:
Status 200
{
  "items": [
    {
      "id": 1,
      "usuario_id": 2,
      "empresa_id": 1,
      "accion": "UPDATE",
      "modulo": "productos",
      "fecha": "2024-01-15T14:25:00",
      "detalle": "{...}",
      "Name": "Usuario Nombre",
      "NameCompany": "Empresa Nombre"
    }
  ],
  "count": 5
}
```

**Request 3: Sin Autorización (Debe fallar)**
```
GET http://localhost:8000/api/superadmin/dashboard

Headers:
Content-Type: application/json

Esperado:
Status 403 (o 401)
{
  "detail": "Acceso denegado: requiere permisos de SuperAdmin"
}
```

## 📊 Paso 9: Ver Logs en Consola

### Frontend Console (F12 en navegador)

```javascript
// Ver solicitudes HTTP
window.axios.defaults.interceptors.response.use(...)

// O usa las DevTools de red (Network tab)
// Filtra por XHR para ver las llamadas AJAX
```

### Backend Console (Terminal donde corre uvicorn)

```
INFO:     127.0.0.1:12345 - "GET /api/superadmin/dashboard HTTP/1.1" 200 OK
INFO:     127.0.0.1:12345 - "GET /api/superadmin/auditoria?... HTTP/1.1" 200 OK
```

## ⚠️ Troubleshooting

### Error: "Invalid token"
```
Solución:
1. Limpia localStorage: F12 → Application → Storage → Clear All
2. Vuelve a hacer login
3. Verifica que el token sea válido
```

### Error: "CORS error"
```
Solución:
1. Verifica que el backend FastAPI tenga CORS configurado
2. Asegúrate que localhost:5173 esté en las origins permitidas
3. Reinicia ambos servidores
```

### Error: "Database connection failed"
```
Solución:
1. Verifica que SQL Server esté corriendo
2. Revisa las credenciales en .env del backend
3. Asegúrate que la BD existe y tiene las tablas ERP_*
```

### Gráficos no aparecen
```
Solución:
1. Verifica que Recharts esté instalado: npm list recharts
2. Recarga la página (Ctrl+Shift+R para limpiar caché)
3. Ve a la consola y busca errores
```

### Tabla de auditoría vacía
```
Solución:
1. Verifica que la tabla ERP_AUDIT_LOGS existe
2. Ejecuta: SELECT COUNT(*) FROM ERP_AUDIT_LOGS
3. Si está vacía, es normal (los logs se generan con acciones)
4. Realiza acciones en el sistema para generar logs
```

## ✅ Checklist Final

- [ ] Backend FastAPI corriendo en puerto 8000
- [ ] Frontend React corriendo en puerto 5173
- [ ] Logueado como SuperAdmin
- [ ] Token JWT con is_super_admin=true
- [ ] Menú SuperAdmin visible en sidebar
- [ ] Dashboard Global carga datos
- [ ] Auditoría Global muestra logs
- [ ] Filtros funcionan
- [ ] Exportar CSV funciona
- [ ] Postman requests retornan 200
- [ ] Permisos rechazados si no es SuperAdmin

## 🎯 Siguiente: Sesión 3

Si todo funciona:
1. ✅ Documentar endpoints en Swagger
2. ✅ Hacer más pruebas de edge cases
3. ✅ Preparar datos de producción
4. ✅ Performance testing

¡Éxito en las pruebas! 🚀
