const TablaProductos = ({ productos, onActualizar, onEliminar, editable = true, originalPrices = {} }) => {
  const calcularSubtotal = (prod) => prod.Cantidad * prod.PrecioUnitario;

  const calcularTotales = () => {
    let subtotal = 0;
    productos.forEach(p => {
      subtotal += calcularSubtotal(p);
    });
    const iva = subtotal * 0.16;
    const total = subtotal + iva;
    return { subtotal, iva, total };
  };

  const hasPriceChanged = (prod) => {
    const originalPrice = originalPrices[prod.Producto_Id];
    return originalPrice && parseFloat(prod.PrecioUnitario) !== parseFloat(originalPrice);
  };

  const totales = calcularTotales();

  return (
    <div>
      {productos.length === 0 ? (
        <p className="text-gray-500 text-center py-4">No hay productos agregados</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Producto</th>
                  <th className="px-4 py-2 text-left">Código</th>
                  <th className="px-4 py-2 text-right">Cantidad</th>
                  <th className="px-4 py-2 text-right">Precio Unit.</th>
                  <th className="px-4 py-2 text-right">Subtotal</th>
                  {editable && <th className="px-4 py-2"></th>}
                </tr>
              </thead>
              <tbody>
                {productos.map((prod, index) => (
                  <tr key={index} className="border-b">
                    <td className="px-4 py-2">{prod.Nombre || prod.ProductoNombre}</td>
                    <td className="px-4 py-2">{prod.Codigo || prod.ProductoCodigo}</td>
                    <td className="px-4 py-2">
                      {editable ? (
                        <input
                          type="number"
                          value={prod.Cantidad}
                          onChange={(e) => onActualizar(index, 'Cantidad', e.target.value)}
                          className="w-20 border rounded px-2 py-1 text-right"
                          min="1"
                        />
                      ) : (
                        <span className="text-right block">{prod.Cantidad}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {editable ? (
                        <input
                          type="number"
                          value={prod.PrecioUnitario}
                          onChange={(e) => onActualizar(index, 'PrecioUnitario', e.target.value)}
                          className={`w-24 border rounded px-2 py-1 text-right ${
                            hasPriceChanged(prod) ? 'border-orange-400 bg-orange-50' : ''
                          }`}
                          min="0"
                          step="0.01"
                        />
                      ) : (
                        <span className="text-right block">${parseFloat(prod.PrecioUnitario).toFixed(2)}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      ${calcularSubtotal(prod).toFixed(2)}
                    </td>
                    {editable && (
                      <td className="px-4 py-2">
                        <button
                          onClick={() => onEliminar(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          ✕
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 border-t pt-4">
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-semibold">${totales.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>IVA (16%):</span>
                  <span className="font-semibold">${totales.iva.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t mt-2 pt-2">
                  <span>Total:</span>
                  <span>${totales.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TablaProductos;
