  import { useState, useEffect, useRef } from 'react';
import api from '../services/api';

export default function SATAutocomplete({ type, value, onChange, label, placeholder }) {
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef(null);
  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (search.length < 2) {
      setOptions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const endpoint = type === 'prodserv' ? '/sat/prodserv' : '/sat/unidades';
        const res = await api.get(`${endpoint}?search=${search}&limit=20`);
        setOptions(res.data.data || []);
        setShowDropdown(true);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search, type]);

  const handleSelect = (item) => {
    onChange(item.Clave);
    setSearch(type === 'prodserv' ? `${item.Clave} - ${item.Descripcion}` : `${item.Clave} - ${item.Nombre}`);
    setShowDropdown(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={() => search.length >= 2 && setShowDropdown(true)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      
      {showDropdown && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto">
          {loading ? (
            <div className="p-3 text-center text-gray-500">Buscando...</div>
          ) : options.length === 0 ? (
            <div className="p-3 text-center text-gray-500">No se encontraron resultados</div>
          ) : (
            options.map((item) => (
              <div
                key={item.Clave}
                onClick={() => handleSelect(item)}
                className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              >
                <div className="font-medium text-sm">{item.Clave}</div>
                <div className="text-xs text-gray-600">
                  {type === 'prodserv' ? item.Descripcion : item.Nombre}
                </div>
              </div>
            ))
          )}
        </div>
      )}
      
      <input type="hidden" value={value} />
    </div>
  );
}
