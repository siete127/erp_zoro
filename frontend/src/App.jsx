import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/auth/Login";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import Dashboard from "./pages/dashboard/Dashboard";
import UserCreate from "./pages/users/UserCreate";
import Users from "./pages/users/Users";
import Clients from "./pages/clients/Clients";
import Productos from "./pages/productos/Productos";
import ImportarProductos from "./pages/productos/ImportarProductos";
import Almacenes from "./pages/productos/Almacenes";
import Inventario from "./pages/productos/Inventario";
import Movimientos from "./pages/productos/Movimientos";
import Transferencias from "./pages/productos/Transferencias";
import RecepcionPendiente from "./pages/productos/RecepcionPendiente";
import Lotes from "./pages/productos/Lotes";
import CatalogoPrecios from "./pages/productos/CatalogoPrecios";
import ListaVentas from "./pages/ListaVentas";
import NuevaVenta from "./pages/NuevaVenta";
import DetalleVenta from "./pages/DetalleVenta";
import Oportunidades from "./pages/crm/Oportunidades";
import OportunidadDetalle from "./pages/crm/OportunidadDetalle";
import OrdenesProduccion from "./pages/produccion/OrdenesProduccion";
import DetalleOrdenProduccion from "./pages/produccion/DetalleOrdenProduccion";
import GestionBOM from "./pages/produccion/GestionBOM";
import FormularioBOM from "./pages/produccion/FormularioBOM";
import DetalleBOM from "./pages/produccion/DetalleBOM";
import MateriasPrimas from "./pages/produccion/MateriasPrimas";
import FormularioMateriaPrima from "./pages/produccion/FormularioMateriaPrima";
import Configuracion from "./pages/Configuracion";
import Cotizaciones from "./pages/Cotizaciones";
import CotizacionNueva from "./pages/CotizacionNueva";
import CotizacionDetalle from "./pages/CotizacionDetalle";
import Reporteria from "./pages/Reporteria";
import NotasCredito from "./pages/NotasCredito";
import ComplementosPago from "./pages/ComplementosPago";
import RH from "./pages/rh/RH";
import Accounting from "./pages/accounting/Accounting";
import Auditoria from "./pages/admin/Auditoria";
import Licencias from "./pages/admin/Licencias";
import OrdenesCompra from "./pages/compras/OrdenesCompra";
import NuevaOrdenCompra from "./pages/compras/NuevaOrdenCompra";
import DetalleOrdenCompra from "./pages/compras/DetalleOrdenCompra";
import RegistroDirectoCompra from "./pages/compras/RegistroDirectoCompra";
import Requisiciones from "./pages/compras/Requisiciones";
import Proveedores from "./pages/compras/Proveedores";
import Aprobaciones from "./pages/aprobaciones/Aprobaciones";
import Leads from "./pages/crm/Leads";
import EquiposVenta from "./pages/crm/EquiposVenta";
import Tareas from "./pages/tareas/Tareas";
import Proyectos from "./pages/proyectos/Proyectos";
import DetalleProyecto from "./pages/proyectos/DetalleProyecto";
import Nomina from "./pages/nomina/Nomina";
import Asistencia from "./pages/asistencia/Asistencia";
import GestionEmpresas from "./pages/superadmin/GestionEmpresas";
import DashboardSuperAdmin from "./pages/superadmin/DashboardSuperAdmin";
import PanelAdministradores from "./pages/superadmin/PanelAdministradores";
import SolicitudPermisos from "./pages/superadmin/SolicitudPermisos";
import ActivosFijos from "./pages/accounting/ActivosFijos";
import Mantenimiento from "./pages/mantenimiento/Mantenimiento";
import PortalCliente from "./pages/portal/PortalCliente";
import Helpdesk from "./pages/helpdesk/Helpdesk";
import DetalleTicket from "./pages/helpdesk/DetalleTicket";
import Gastos from "./pages/expenses/Gastos";
import CatalogoPublico from "./pages/website/CatalogoPublico";
import ConfiguracionWebsite from "./pages/website/ConfiguracionWebsite";
import Marketing from "./pages/marketing/Marketing";
import Flotilla from "./pages/fleet/Flotilla";
import Encuestas from "./pages/surveys/Encuestas";
import DetalleEncuesta from "./pages/surveys/DetalleEncuesta";
import EncuestaPublica from "./pages/surveys/EncuestaPublica";
import Suscripciones from "./pages/subscriptions/Suscripciones";
import SuperAdminLayout from "./pages/superadmin/SuperAdminLayout";
import EmpresaLayoutSuperAdmin from "./pages/superadmin/EmpresaLayoutSuperAdmin";
import DashboardEmpresa from "./pages/superadmin/empresa/DashboardEmpresa";
import AdministradoresEmpresa from "./pages/superadmin/empresa/AdministradoresEmpresa";
import UsuariosEmpresa from "./pages/superadmin/empresa/UsuariosEmpresa";
import LicenciasEmpresa from "./pages/superadmin/empresa/LicenciasEmpresa";
import AuditoriaEmpresa from "./pages/superadmin/empresa/AuditoriaEmpresa";
import ModulosEmpresa from "./pages/superadmin/empresa/ModulosEmpresa";
import VentasEmpresa from "./pages/superadmin/empresa/VentasEmpresa";
import ComprasEmpresa from "./pages/superadmin/empresa/ComprasEmpresa";
import FacturacionEmpresa from "./pages/superadmin/empresa/FacturacionEmpresa";
import ProtectedLayout from "./layouts/ProtectedLayout";
import Notification from './components/Notification';
import ConfirmModal from './components/ConfirmModal';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/portal/:token" element={<PortalCliente />} />
        <Route path="/website/:slug" element={<CatalogoPublico />} />
        <Route path="/encuesta-publica/:encuestaId" element={<EncuestaPublica />} />
        <Route element={<SuperAdminLayout />}>
          <Route path="/superadmin/dashboard" element={<DashboardSuperAdmin />} />
          <Route path="/superadmin/admins" element={<PanelAdministradores />} />
          <Route path="/superadmin/permisos" element={<SolicitudPermisos />} />
          <Route path="/superadmin/empresas" element={<GestionEmpresas />} />
        </Route>
        <Route path="/superadmin/empresas/:empresaId" element={<EmpresaLayoutSuperAdmin />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardEmpresa />} />
          <Route path="administradores" element={<AdministradoresEmpresa />} />
          <Route path="usuarios" element={<UsuariosEmpresa />} />
          <Route path="ventas" element={<VentasEmpresa />} />
          <Route path="compras" element={<ComprasEmpresa />} />
          <Route path="facturacion" element={<FacturacionEmpresa />} />
          <Route path="licencias" element={<LicenciasEmpresa />} />
          <Route path="auditoria" element={<AuditoriaEmpresa />} />
          <Route path="modulos" element={<ModulosEmpresa />} />
        </Route>
        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/create-user" element={<UserCreate />} />
          <Route path="/users" element={<Users />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/productos" element={<Productos />} />
          <Route path="/productos/importar" element={<ImportarProductos />} />
          <Route path="/productos/almacenes" element={<Almacenes />} />
          <Route path="/productos/inventario" element={<Inventario />} />
          <Route path="/productos/recepcion-pendiente" element={<RecepcionPendiente />} />
          <Route path="/productos/movimientos" element={<Movimientos />} />
          <Route path="/productos/transferencias" element={<Transferencias />} />
          <Route path="/productos/lotes" element={<Lotes />} />
          <Route path="/productos/precios" element={<CatalogoPrecios />} />
          <Route path="/ventas" element={<ListaVentas />} />
          <Route path="/ventas/nueva" element={<NuevaVenta />} />
          <Route path="/ventas/editar/:ventaId" element={<NuevaVenta />} />
          <Route path="/ventas/:id" element={<DetalleVenta />} />
          <Route path="/cotizaciones" element={<Cotizaciones />} />
          <Route path="/cotizaciones/nueva" element={<CotizacionNueva />} />
          <Route path="/cotizaciones/:id" element={<CotizacionDetalle />} />
          <Route path="/crm/oportunidades" element={<Oportunidades />} />
          <Route path="/crm/oportunidades/:id" element={<OportunidadDetalle />} />
          <Route path="/crm/leads" element={<Leads />} />
          <Route path="/crm/equipos" element={<EquiposVenta />} />
          <Route path="/produccion/ordenes" element={<OrdenesProduccion />} />
          <Route path="/produccion/ordenes/:id" element={<DetalleOrdenProduccion />} />
          <Route path="/produccion/bom" element={<GestionBOM />} />
          <Route path="/produccion/bom/nuevo" element={<FormularioBOM />} />
          <Route path="/produccion/bom/:id" element={<DetalleBOM />} />
          <Route path="/produccion/bom/:id/editar" element={<FormularioBOM />} />
          <Route path="/produccion/materias-primas" element={<MateriasPrimas />} />
          <Route path="/produccion/materias-primas/nuevo" element={<FormularioMateriaPrima />} />
          <Route path="/produccion/materias-primas/:id/editar" element={<FormularioMateriaPrima />} />
          <Route path="/configuracion" element={<Configuracion />} />
          <Route path="/reporteria" element={<Reporteria />} />
          <Route path="/notas-credito" element={<NotasCredito />} />
          <Route path="/complementos-pago" element={<ComplementosPago />} />
          <Route path="/rh" element={<RH />} />
          <Route path="/contabilidad" element={<Accounting />} />
          <Route path="/licencias" element={<Licencias />} />
          <Route path="/auditoria" element={<Auditoria />} />
          <Route path="/compras" element={<OrdenesCompra />} />
          <Route path="/compras/nueva" element={<NuevaOrdenCompra />} />
          <Route path="/compras/registro-directo" element={<RegistroDirectoCompra />} />
          <Route path="/compras/requisiciones" element={<Requisiciones />} />
          <Route path="/compras/proveedores" element={<Proveedores />} />
          <Route path="/aprobaciones" element={<Aprobaciones />} />
          <Route path="/compras/:id" element={<DetalleOrdenCompra />} />
          <Route path="/tareas" element={<Tareas />} />
          <Route path="/proyectos" element={<Proyectos />} />
          <Route path="/proyectos/:id" element={<DetalleProyecto />} />
          <Route path="/nomina" element={<Nomina />} />
          <Route path="/asistencia" element={<Asistencia />} />
          <Route path="/contabilidad/activos-fijos" element={<ActivosFijos />} />
          <Route path="/mantenimiento" element={<Mantenimiento />} />
          <Route path="/helpdesk" element={<Helpdesk />} />
          <Route path="/helpdesk/:ticketId" element={<DetalleTicket />} />
          <Route path="/gastos" element={<Gastos />} />
          <Route path="/website" element={<ConfiguracionWebsite />} />
          <Route path="/marketing" element={<Marketing />} />
          <Route path="/flotilla" element={<Flotilla />} />
          <Route path="/encuestas" element={<Encuestas />} />
          <Route path="/encuestas/:encuestaId" element={<DetalleEncuesta />} />
          <Route path="/suscripciones" element={<Suscripciones />} />
        </Route>
      </Routes>
      <Notification />
      <ConfirmModal />
    </BrowserRouter>
  );
}

export default App;
