# Módulo RH (Recursos Humanos)

## Alcance inicial

Este primer bloque del módulo RH agrega soporte backend para:

- Perfil RH por usuario (`ERP_HR_PROFILE`)
- Contactos de emergencia (`ERP_HR_EMERGENCY_CONTACT`)
- Cuentas bancarias (`ERP_HR_BANK_ACCOUNT`)

La base de identidad del empleado sigue en `ERP_USERS`, y RH complementa esa información.

## Instalación de esquema

Ejecutar en SQL Server:

`backend/sql/rh_schema.sql`

Para registrar el módulo `rh` en la tabla de permisos (instalaciones existentes):

`backend/sql/add_rh_module.sql`

Si el switch de activar/desactivar RH no refleja cambios por claves antiguas (`RH`, `Rh`, etc.), ejecutar:

`backend/sql/normalize_module_keys.sql`

## Endpoints

Base: `/api/rh`

### Perfiles

- `GET /perfiles` (admin)
  - Query opcional: `company_id`
- `GET /perfiles/:userId`
- `PUT /perfiles/:userId` (admin)
- `POST /perfiles/:userId/foto` (admin, multipart/form-data)

Para subir foto de perfil, enviar archivo en campo `fotoPerfil`.
Formatos permitidos: `image/jpeg`, `image/png`, `image/webp`.

Campos sugeridos para `PUT /perfiles/:userId`:

```json
{
  "FechaNacimiento": "1990-05-21",
  "CURP": "XAXX010101HNEXXXA4",
  "RFC": "XAXX010101000",
  "NSS": "12345678901",
  "EstadoCivil": "Soltero",
  "Genero": "Masculino",
  "Direccion": "Av. Siempre Viva 123",
  "Ciudad": "Monterrey",
  "Estado": "Nuevo León",
  "CodigoPostal": "64000",
  "Pais": "México",
  "NumeroEmpleado": "RH-001",
  "FechaIngreso": "2026-03-11",
  "Puesto": "Analista",
  "Departamento": "RH",
  "SalarioMensual": 18000,
  "TipoContrato": "Indefinido",
  "BancoPrincipal": "BBVA",
  "NumeroCuentaPrincipal": "1234567890",
  "CLABE": "012345678901234567",
  "NombreTitularCuenta": "Nombre Completo",
  "ContactoEmergenciaPrincipal": "Juan Pérez",
  "TelefonoEmergenciaPrincipal": "8112345678",
  "Alergias": "Ninguna",
  "TipoSangre": "O+",
  "NotasMedicas": "Información relevante"
}
```

### Contactos de emergencia

- `POST /perfiles/:userId/contactos-emergencia` (admin)
- `PUT /contactos-emergencia/:contactoId` (admin)
- `DELETE /contactos-emergencia/:contactoId` (admin)

Payload base:

```json
{
  "Nombre": "María López",
  "Parentesco": "Madre",
  "Telefono": "8111111111",
  "TelefonoAlterno": "8188888888",
  "Direccion": "Calle 1",
  "EsPrincipal": true,
  "Notas": "Disponible 24/7"
}
```

### Cuentas bancarias

- `POST /perfiles/:userId/cuentas-bancarias` (admin)
- `PUT /cuentas-bancarias/:cuentaId` (admin)
- `DELETE /cuentas-bancarias/:cuentaId` (admin)

Payload base:

```json
{
  "Banco": "BBVA",
  "NumeroCuenta": "1234567890",
  "CLABE": "012345678901234567",
  "NumeroTarjeta": "4111111111111111",
  "Moneda": "MXN",
  "EsPrincipal": true,
  "NombreTitular": "Nombre Completo"
}
```

## Seguridad y permisos

- Todas las rutas requieren `authMiddleware`.
- Operaciones administrativas usan `isAdmin`.
- Se respeta el filtrado por empresa para usuarios no superadmin.

## Siguiente paso recomendado

Construir pantalla frontend de RH con 3 pestañas:

1. Información personal/laboral
2. Contactos de emergencia
3. Cuentas bancarias
