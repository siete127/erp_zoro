import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import OrdenesCompra from "./pages/compras/OrdenesCompra";
import NuevaOrdenCompra from "./pages/compras/NuevaOrdenCompra";
import DetalleOrdenCompra from "./pages/compras/DetalleOrdenCompra";
import RegistroDirectoCompra from "./pages/compras/RegistroDirectoCompra";
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
                  <Route path="/compras" element={<OrdenesCompra />} />
                  <Route path="/compras/nueva" element={<NuevaOrdenCompra />} />
                  <Route path="/compras/registro-directo" element={<RegistroDirectoCompra />} />
                  <Route path="/compras/:id" element={<DetalleOrdenCompra />} />
        </Route>
      </Routes>
      <Notification />
      <ConfirmModal />
    </BrowserRouter>
  );
}

export default App;
