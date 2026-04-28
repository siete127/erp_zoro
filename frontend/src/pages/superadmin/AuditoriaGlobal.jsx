import React, { useState, useEffect } from 'react';
import { FaFilter, FaDownload, FaSearch } from 'react-icons/fa';
import axios from 'axios';

const AuditoriaGlobal = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filtros
  const [filters, setFilters] = useState({
    user_id: '',
    company_id: '',
    action_type: '',
    fecha_inicio: '',
    fecha_fin: '',
  });

  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  
  const token = localStorage.getItem('token');

  // Cargar empresas y usuarios para filtros
  useEffect(() => {
    const loadFilterData = async () => {
      try {
        const [companiesRes, usersRes] = await Promise.all([
          axios.get('/api/companies', { headers: { Authorization: `Bearer ${token}` } }),
          axios.get('/api/users', { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        setCompanies(companiesRes.data);
        setUsers(usersRes.data);
      } catch (err) {
        console.error('Error cargando filtros:', err);
      }
    };
    loadFilterData();
  }, [token]);

  // Cargar logs de auditoría
  useEffect(() => {
    const loadLogs = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (filters.user_id) params.append('user_id', filters.user_id);
        if (filters.company_id) params.append('company_id', filters.company_id);
        if (filters.action_type) params.append('action_type', filters.action_type);
        if (filters.fecha_inicio) params.append('fecha_inicio', filters.fecha_inicio);
        if (filters.fecha_fin) params.append('fecha_fin', filters.fecha_fin);
        if (searchTerm) params.append('search', searchTerm);

        const response = await axios.get(`/api/superadmin/auditoria?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setLogs(response.data);
        setError(null);
      } catch (err) {
        console.error('Error cargando auditoría:', err);
        setError(err.response?.data?.detail || 'Error cargando logs');
      } finally {
        setLoading(false);
      }
    };

    loadLogs();
  }, [filters, searchTerm, token]);

  // Exportar a CSV
  const handleExportCSV = () => {
    if (logs.length === 0) return;

    const headers = ['Fecha', 'Usuario', 'Acción', 'Empresa', 'Detalles'];
    const rows = logs.map(log => [
      log.created_at || '',
      log.user_name || '',
      log.action_type || '',
      log.company_name || '',
      log.details || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Limpiar filtros
  const handleClearFilters = () => {
    setFilters({
      user_id: '',
      company_id: '',
      action_type: '',
      fecha_inicio: '',
      fecha_fin: '',
    });
    setSearchTerm('');
  };

  const actionColors = {
    'CREATE': 'bg-green-100 text-green-700',
    'UPDATE': 'bg-blue-100 text-blue-700',
    'DELETE': 'bg-red-100 text-red-700',
    'LOGIN': 'bg-purple-100 text-purple-700',
    'LOGOUT': 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Auditoría Global</h1>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <FaFilter className="text-blue-500" />
            <h2 className="text-xl font-bold">Filtros</h2>
            <button
              onClick={handleClearFilters}
              className="ml-auto px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
            >
              Limpiar Filtros
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Búsqueda */}
            <div>
              <label className="block text-sm font-medium mb-1">Buscar</label>
              <div className="relative">
                <FaSearch className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Usuario */}
            <div>
              <label className="block text-sm font-medium mb-1">Usuario</label>
              <select
                value={filters.user_id}
                onChange={(e) => setFilters({ ...filters, user_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </div>

            {/* Empresa */}
            <div>
              <label className="block text-sm font-medium mb-1">Empresa</label>
              <select
                value={filters.company_id}
                onChange={(e) => setFilters({ ...filters, company_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todas</option>
                {companies.map(company => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
            </div>

            {/* Tipo de Acción */}
            <div>
              <label className="block text-sm font-medium mb-1">Acción</label>
              <select
                value={filters.action_type}
                onChange={(e) => setFilters({ ...filters, action_type: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todas</option>
                <option value="CREATE">Crear</option>
                <option value="UPDATE">Actualizar</option>
                <option value="DELETE">Eliminar</option>
                <option value="LOGIN">Login</option>
                <option value="LOGOUT">Logout</option>
              </select>
            </div>

            {/* Rango de Fechas */}
            <div>
              <label className="block text-sm font-medium mb-1">Desde</label>
              <input
                type="date"
                value={filters.fecha_inicio}
                onChange={(e) => setFilters({ ...filters, fecha_inicio: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium mb-1">Hasta</label>
            <input
              type="date"
              value={filters.fecha_fin}
              onChange={(e) => setFilters({ ...filters, fecha_fin: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 md:w-1/5"
            />
          </div>
        </div>

        {/* Botón Exportar */}
        <div className="mb-4 flex gap-2">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2"
            disabled={logs.length === 0}
          >
            <FaDownload /> Exportar CSV
          </button>
          <span className="px-4 py-2 bg-gray-100 rounded-lg text-sm">
            Total: {logs.length} registros
          </span>
        </div>

        {/* Tabla de Auditoría */}
        <div className="bg-white rounded-lg shadow-md p-6">
          {loading ? (
            <div className="text-center py-10">Cargando logs...</div>
          ) : error ? (
            <div className="text-center py-10 text-red-500">{error}</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-10 text-gray-500">No hay registros</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b-2">
                    <th className="text-left p-3">Fecha</th>
                    <th className="text-left p-3">Usuario</th>
                    <th className="text-left p-3">Acción</th>
                    <th className="text-left p-3">Empresa</th>
                    <th className="text-left p-3">Detalles</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="p-3 text-sm">{log.created_at || 'N/A'}</td>
                      <td className="p-3 font-medium">{log.user_name || 'Sistema'}</td>
                      <td className="p-3">
                        <span className={`px-3 py-1 rounded text-sm ${actionColors[log.action_type] || 'bg-gray-100'}`}>
                          {log.action_type}
                        </span>
                      </td>
                      <td className="p-3">{log.company_name || 'Sistema'}</td>
                      <td className="p-3 text-sm text-gray-600 truncate max-w-xs">
                        {log.details || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="mt-8 bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-500 text-sm text-gray-700">
          <strong>Nota:</strong> Los logs de auditoría registran todas las acciones críticas del sistema.
          Filtra por fechas, usuarios o empresas para encontrar lo que buscas.
        </div>
      </div>
    </div>
  );
};

export default AuditoriaGlobal;
