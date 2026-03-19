import { useState, useRef, useEffect } from 'react';
import api from '../../services/api';
import { notify } from '../../services/notify';

export default function ImportarProductos() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const ext = selectedFile.name.split('.').pop().toLowerCase();
      if (!['xls', 'xlsx'].includes(ext)) {
        notify.error('Solo se permiten archivos Excel (.xls, .xlsx)');
        return;
      }
      setFile(selectedFile);
    }
  };

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const res = await api.get('/companies');
        setCompanies(res.data || []);
      } catch (err) {
        console.error('Error cargando empresas', err);
      }
    };
    fetchCompanies();
  }, []);

  const handleImport = async () => {
    if (!file) {
      notify.error('Selecciona un archivo');
      return;
    }

    if (!companyId) {
      notify.error('Selecciona la empresa a la que se asignarán los productos');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('Company_Id', companyId);

    try {
      const res = await api.post('/productos/importar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResultado(res.data);
      notify.success(`Importación completada: ${res.data.exitosas} exitosas, ${res.data.conError} con error`);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      notify.error(err.response?.data?.msg || 'Error al importar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-screen bg-white rounded-none shadow-none p-6 overflow-auto">
      <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">Importar Productos desde Excel</h1>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Formato requerido</h2>
        <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
          <li>Columnas: SKU, Nombre, Descripcion, Precio, Moneda, ClaveProdServSAT, ClaveUnidadSAT, ImpuestoIVA, Activo</li>
          <li>Moneda: MXN, USD o EUR (si no viene, se asigna MXN por defecto)</li>
          <li>Las claves SAT deben existir en los catálogos oficiales</li>
          <li>Si el SKU existe, se actualizará el producto</li>
        </ul>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <label className="block text-sm font-medium mb-2">Seleccionar archivo Excel</label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xls,.xlsx"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        {file && <p className="mt-2 text-sm text-gray-600">Archivo: {file.name}</p>}

        <div className="mt-4">
          <label className="block text-sm font-medium mb-2">Empresa a la que pertenecen los productos</label>
          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="w-full max-w-sm p-2 rounded border bg-white text-gray-900 border-gray-300"
          >
            <option value="">Selecciona una empresa</option>
            {companies.map((c) => (
              <option key={c.Company_Id} value={c.Company_Id}>
                {c.NameCompany}
              </option>
            ))}
          </select>
        </div>
        
        <button
          onClick={handleImport}
          disabled={!file || !companyId || loading}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Importando...' : 'Importar Productos'}
        </button>
      </div>

      {resultado && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Resultado de Importación</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-4 bg-gray-50 rounded">
              <div className="text-2xl font-bold text-gray-700">{resultado.total}</div>
              <div className="text-sm text-gray-600">Total</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded">
              <div className="text-2xl font-bold text-green-700">{resultado.exitosas}</div>
              <div className="text-sm text-green-600">Exitosas</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded">
              <div className="text-2xl font-bold text-red-700">{resultado.conError}</div>
              <div className="text-sm text-red-600">Con Error</div>
            </div>
          </div>

          {resultado.errores?.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Errores detectados:</h3>
              <div className="max-h-64 overflow-y-auto">
                {resultado.errores.map((err, idx) => (
                  <div key={idx} className="text-sm p-2 mb-2 bg-red-50 border border-red-200 rounded">
                    <span className="font-medium">Fila {err.fila}:</span> {err.error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
