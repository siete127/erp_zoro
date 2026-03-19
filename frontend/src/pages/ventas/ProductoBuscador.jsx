import { useState, useEffect } from 'react';
import api from '../../services/api';

const ProductoBuscador = ({ onAgregarProducto }) => {
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    cargarProductos();
  }, []);

  const cargarProductos = async () => {
    setLoading(true);
    try {
      const response = await api.get('/productos?activo=true');
      const data = response.data || {};
      const lista = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
      setProductos(lista);
    } catch (error) {
      console.error('Error al cargar productos:', error);
    } finally {
      setLoading(false);
    }
  };

  const productosFiltrados = productos.filter(p =>
    p.Nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.SKU?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar producto por nombre o código..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full border rounded px-3 py-2"
        />
      </div>

      {loading ? (
        <div className="text-center py-4 text-gray-600">Cargando productos...</div>
      ) : (
        <div className="max-h-60 overflow-y-auto border rounded">
          {productosFiltrados.length === 0 ? (
            <div className="p-4 text-center text-gray-600">No se encontraron productos</div>
          ) : (
            productosFiltrados.map(producto => (
              <div
                key={producto.Producto_Id}
                className="p-3 border-b hover:bg-gray-50 flex justify-between items-center"
              >
                <div>
                  <div className="font-medium">{producto.Nombre}</div>
                  <div className="text-sm text-gray-600">
                    SKU: {producto.SKU} | Precio: ${producto.Precio ?? producto.PrecioVenta ?? 0} ({producto.TipoMoneda || 'MXN'})
                  </div>
                </div>
                <button
                  onClick={() => onAgregarProducto(producto)}
                  className="bg-green-600 text-white px-4 py-1 rounded hover:bg-green-700"
                >
                  Agregar
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default ProductoBuscador;
