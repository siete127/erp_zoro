# 🔗 Guía de Integración: Módulo Vacaciones en RH

## 📋 Descripción

Esta guía explica cómo integrar el componente de **Vacaciones** en el módulo RH existente.

---

## 🚀 Pasos de Integración

### 1. Importar el componente

En `frontend/src/pages/rh/RH.jsx`, agrega el import:

```javascript
import VacacionesTab from './Vacaciones';
```

Debería estar junto con los otros imports, alrededor de la línea 6-7:

```javascript
import React, { useEffect, useMemo, useState } from 'react';
import CreatableSelect from 'react-select/creatable';
import VacacionesTab from './Vacaciones';  // ← Agregar esta línea
import api from '../../services/api';
import { rhService } from '../../services/rhService';
```

---

### 2. Agregar pestaña a modalTabs

En la sección donde están definidos los `modalTabs` (alrededor de la línea 319), agrega:

```javascript
const modalTabs = [
  { key: 'perfil', label: 'Perfil RH', helper: 'Datos generales, laborales y salud' },
  { key: 'contactos', label: 'Contactos', helper: 'Emergencia y respaldo familiar' },
  { key: 'cuentas', label: 'Cuentas', helper: 'Dispersión bancaria y titularidad' },
  { key: 'documentos', label: 'Documentos', helper: 'Expediente digital del colaborador' },
  { key: 'vacaciones', label: 'Vacaciones', helper: 'Solicitud de descanso y vacaciones' }  // ← Agregar esta línea
];
```

---

### 3. Agregar renderización condicional

Busca la sección donde se renderizan los tabs (alrededor de la línea 1129+) y agrega:

```javascript
{activeTab === 'documentos' && (
  // ... código existente de documentos ...
)}

{activeTab === 'vacaciones' && (
  <VacacionesTab 
    currentUser={currentUser} 
    userCompanies={companies} 
  />
)}
```

Ubícalo después del bloque `{activeTab === 'documentos' && ...}`.

---

## 🎯 Ubicaciones Exactas

### Ubicación 1: Imports (línea ~6-7)
```javascript
import VacacionesTab from './Vacaciones';  // ← Agregar aquí
```

### Ubicación 2: modalTabs (línea ~319-323)
```javascript
const modalTabs = [
  { key: 'perfil', ... },
  { key: 'contactos', ... },
  { key: 'cuentas', ... },
  { key: 'documentos', ... },
  { key: 'vacaciones', label: 'Vacaciones', helper: 'Solicitud de descanso y vacaciones' }  // ← Agregar aquí
];
```

### Ubicación 3: Renderización (línea ~1500+)
Busca el último bloque `{activeTab === 'documentos' && ...}` y agrega después:

```javascript
{activeTab === 'vacaciones' && (
  <VacacionesTab 
    currentUser={currentUser} 
    userCompanies={companies} 
  />
)}
```

---

## ✅ Checklist de Integración

- [ ] Importar `VacacionesTab` en RH.jsx
- [ ] Agregar pestaña a `modalTabs`
- [ ] Agregar renderización condicional
- [ ] Verificar que no haya errores de console
- [ ] Probar que la pestaña se muestre correctamente
- [ ] Crear tabla en BD con script SQL

---

## 🧪 Pruebas

### 1. Verificar que aparece la pestaña

1. Navega a RH
2. Selecciona un empleado
3. Verifica que aparezca la pestaña "📅 Vacaciones"

### 2. Probar crear solicitud

1. Click en "➕ Nueva Solicitud"
2. Completa el formulario
3. Verifica que aparezca en "Mis Solicitudes"

### 3. Probar filtros

1. Crea varias solicitudes con diferentes estados
2. Prueba los filtros por estado
3. Verifica que funcione correctamente

---

## 🐛 Troubleshooting

### Problema: Pestaña no aparece
- Verifica que hayas agregado el import
- Verifica que hayas agregado la entrada en `modalTabs`
- Verifica que hayas agregado el renderizado condicional
- Busca errores en la consola del navegador

### Problema: "Component not found"
- Verifica que el archivo `Vacaciones.jsx` exista en la ruta correcta
- Verifica la ruta del import

### Problema: Estilos se ven mal
- Verifica que hayas copiado `vacaciones.css`
- Verifica que se esté importando en `Vacaciones.jsx`

---

## 📝 Próximas Mejoras

Después de integración, podrías agregar:
- [ ] Integración con notificaciones en tiempo real
- [ ] Reportes de vacaciones por departamento
- [ ] Límite de días por año
- [ ] Aprobación en cascada

---

## 📞 Archivos Relacionados

- [GUIA_MODULO_VACACIONES.md](GUIA_MODULO_VACACIONES.md) - Guía de uso del módulo
- [sql/create_vacation_request_table.sql](erp_zoro_python/sql/create_vacation_request_table.sql) - Script para crear tabla
- [Vacaciones.jsx](frontend/src/pages/rh/Vacaciones.jsx) - Componente React
- [vacacionesService.js](frontend/src/services/vacacionesService.js) - Servicio API

---

**Fecha de creación:** 28 de Abril de 2026
**Última actualización:** 28 de Abril de 2026
