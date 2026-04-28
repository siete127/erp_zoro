from __future__ import annotations

import fastapi as _fastapi
import fastapi.routing as _fastapi_routing

from app.api.router_utils import APIRouter

_fastapi.APIRouter = APIRouter
_fastapi_routing.APIRouter = APIRouter

from app.api.routes import (
    accounting,
    activos,
    api_keys,
    asistencia,
    auditoria,
    auth,
    bom,
    chat,
    client_docs,
    client_pricing,
    clients,
    companies,
    company_admin,
    config,
    aprobaciones,
    expenses,
    helpdesk,
    leads,
    mantenimiento,
    portal,
    proveedores,
    requisiciones,
    constancia,
    cp,
    crm,
    credit_notes,
    facturacion,
    guias,
    inventory,
    licencias,
    nomina,
    notificaciones,
    password,
    payment_complements,
    permissions,
    prices,
    product_images,
    proyectos,
    production,
    products,
    purchases,
    quotes,
    raw_materials,
    reporteria,
    rh,
    roles,
    sat,
    sales,
    superadmin,
    tareas,
    timesheets,
    users,
    warehouses,
    website,
    marketing,
    fleet,
    surveys,
    subscriptions,
)


api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(roles.router, prefix="/roles", tags=["roles"])
api_router.include_router(permissions.router, prefix="/permissions", tags=["permissions"])
api_router.include_router(companies.router, prefix="/companies", tags=["companies"])
api_router.include_router(company_admin.router, prefix="/companies", tags=["company-admin"])
api_router.include_router(clients.router, prefix="/clients", tags=["clients"])
api_router.include_router(products.router, prefix="/productos", tags=["productos"])
api_router.include_router(warehouses.router, prefix="/almacenes", tags=["almacenes"])
api_router.include_router(sat.router, prefix="/sat", tags=["sat"])
api_router.include_router(config.router, prefix="/config", tags=["config"])
api_router.include_router(prices.router, prefix="/precios", tags=["precios"])
api_router.include_router(quotes.router, prefix="/cotizaciones", tags=["cotizaciones"])
api_router.include_router(sales.router, prefix="/ventas", tags=["ventas"])
api_router.include_router(credit_notes.router, prefix="/notas-credito", tags=["notas-credito"])
api_router.include_router(payment_complements.router, prefix="/complementos-pago", tags=["complementos-pago"])
api_router.include_router(facturacion.router, prefix="/facturacion", tags=["facturacion"])
# Alias sin prefijo para compatibilidad con Node.js (/api/facturar, /api/facturas/...)
api_router.include_router(facturacion.router, tags=["facturacion-compat"])
api_router.include_router(inventory.router, prefix="/inventario", tags=["inventario"])
api_router.include_router(production.router, prefix="/produccion", tags=["produccion"])
api_router.include_router(bom.router, prefix="/bom", tags=["bom"])
api_router.include_router(raw_materials.router, prefix="/materias-primas", tags=["materias-primas"])
api_router.include_router(purchases.router, prefix="/compras", tags=["compras"])
api_router.include_router(crm.router, prefix="/crm", tags=["crm"])
api_router.include_router(leads.router, prefix="/crm", tags=["crm-leads"])
api_router.include_router(reporteria.router, prefix="/reporteria", tags=["reporteria"])
api_router.include_router(rh.router, prefix="/rh", tags=["rh"])
api_router.include_router(accounting.router, prefix="/accounting", tags=["accounting"])
api_router.include_router(activos.router, prefix="/activos", tags=["activos"])
api_router.include_router(password.router, prefix="/password", tags=["password"])
api_router.include_router(constancia.router, prefix="/constancia", tags=["constancia"])
api_router.include_router(client_pricing.router, prefix="/client-pricing", tags=["client-pricing"])
api_router.include_router(cp.router, prefix="/cp", tags=["cp"])
api_router.include_router(product_images.router, prefix="/productos", tags=["product-images"])
api_router.include_router(client_docs.router, prefix="/clients", tags=["client-docs"])
api_router.include_router(tareas.router, prefix="/tareas", tags=["tareas"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(notificaciones.router, prefix="/notificaciones", tags=["notificaciones"])
api_router.include_router(licencias.router, prefix="/licencias", tags=["licencias"])
api_router.include_router(auditoria.router, prefix="/auditoria", tags=["auditoria"])
api_router.include_router(guias.router, prefix="/logistica", tags=["logistica"])
api_router.include_router(nomina.router, prefix="/nomina", tags=["nomina"])
api_router.include_router(asistencia.router, prefix="/asistencia", tags=["asistencia"])
api_router.include_router(requisiciones.router, prefix="/requisiciones", tags=["requisiciones"])
api_router.include_router(aprobaciones.router, prefix="/aprobaciones", tags=["aprobaciones"])
api_router.include_router(superadmin.router, prefix="/superadmin", tags=["superadmin"])
api_router.include_router(proveedores.router, prefix="/proveedores", tags=["proveedores"])
api_router.include_router(proyectos.router, prefix="/proyectos", tags=["proyectos"])
api_router.include_router(timesheets.router, prefix="/timesheets", tags=["timesheets"])
api_router.include_router(mantenimiento.router, prefix="/mantenimiento", tags=["mantenimiento"])
api_router.include_router(portal.router, prefix="/portal", tags=["portal"])
api_router.include_router(api_keys.router, prefix="/api-keys", tags=["api-keys"])
api_router.include_router(helpdesk.router, prefix="/helpdesk", tags=["helpdesk"])
api_router.include_router(expenses.router, prefix="/gastos", tags=["gastos"])
api_router.include_router(website.router, prefix="/website", tags=["website"])
api_router.include_router(marketing.router, prefix="/marketing", tags=["marketing"])
api_router.include_router(fleet.router, prefix="/flotilla", tags=["fleet"])
api_router.include_router(surveys.router, prefix="/encuestas", tags=["surveys"])
api_router.include_router(subscriptions.router, prefix="/suscripciones", tags=["subscriptions"])
