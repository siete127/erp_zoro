/**
 * LeaveTypeSelector.jsx
 * Componente selector para elegir tipo de licencia al crear solicitud
 * Muestra descripción, color y días por defecto de cada tipo
 */

import React, { useEffect, useState } from 'react';
import { notify } from '../../services/notify';
import './leaveTypeSelector.css';

const LeaveTypeSelector = ({ companyId, value, onChange, disabled = false }) => {
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (companyId) {
      loadLeaveTypes();
    }
  }, [companyId]);

  const loadLeaveTypes = async () => {
    setLoading(true);
    try {
      // Simulando API call - en producción llamaría a leaveService.getLeaveTypes()
      // const response = await leaveService.getLeaveTypes(companyId);
      
      // Datos de ejemplo
      const mockData = [
        {
          leave_type_id: 1,
          name: 'Vacaciones',
          description: 'Descanso anual pagado',
          color: '#10b981',
          default_days: 15,
          requires_document: false
        },
        {
          leave_type_id: 2,
          name: 'Enfermedad',
          description: 'Licencia por enfermedad',
          color: '#ef4444',
          default_days: 5,
          requires_document: true
        },
        {
          leave_type_id: 3,
          name: 'Licencia Personal',
          description: 'Licencia personal no remunerada',
          color: '#f59e0b',
          default_days: 3,
          requires_document: false
        },
        {
          leave_type_id: 4,
          name: 'Maternidad/Paternidad',
          description: 'Licencia por nacimiento',
          color: '#8b5cf6',
          default_days: 30,
          requires_document: true
        }
      ];

      setLeaveTypes(mockData);
    } catch (error) {
      notify.error('Error al cargar tipos de licencia');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const selectedType = leaveTypes.find(lt => lt.leave_type_id === value);

  const handleSelect = (type) => {
    onChange?.(type.leave_type_id, type);
    setShowDropdown(false);
  };

  return (
    <div className="leave-type-selector">
      {/* Selector principal */}
      <div className="selector-wrapper">
        <button
          className={`selector-button ${disabled ? 'disabled' : ''}`}
          onClick={() => !disabled && setShowDropdown(!showDropdown)}
          disabled={disabled}
        >
          {selectedType ? (
            <>
              <span
                className="type-color"
                style={{ backgroundColor: selectedType.color }}
              />
              <span className="type-name">{selectedType.name}</span>
              <span className="type-arrow">▼</span>
            </>
          ) : (
            <>
              <span className="placeholder">Selecciona tipo de licencia...</span>
              <span className="type-arrow">▼</span>
            </>
          )}
        </button>

        {/* Dropdown */}
        {showDropdown && !disabled && (
          <div className="selector-dropdown">
            {loading ? (
              <div className="dropdown-loading">Cargando tipos...</div>
            ) : leaveTypes.length === 0 ? (
              <div className="dropdown-empty">No hay tipos disponibles</div>
            ) : (
              leaveTypes.map(type => (
                <div
                  key={type.leave_type_id}
                  className={`dropdown-item ${
                    value === type.leave_type_id ? 'selected' : ''
                  }`}
                  onClick={() => handleSelect(type)}
                >
                  <div className="item-header">
                    <span
                      className="item-color"
                      style={{ backgroundColor: type.color }}
                    />
                    <div className="item-info">
                      <h4 className="item-name">{type.name}</h4>
                      <p className="item-description">{type.description}</p>
                    </div>
                  </div>

                  <div className="item-details">
                    <span className="detail-badge">
                      {type.default_days} días
                    </span>
                    {type.requires_document && (
                      <span className="detail-badge required">
                        📋 Requiere documento
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Información del tipo seleccionado */}
      {selectedType && (
        <div className="selected-info">
          <div className="info-item">
            <span className="info-label">Descripción:</span>
            <span className="info-value">{selectedType.description}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Días por defecto:</span>
            <span className="info-value">{selectedType.default_days}</span>
          </div>
          {selectedType.requires_document && (
            <div className="info-warning">
              <span className="warning-icon">📋</span>
              <span>Este tipo de licencia requiere documentación de soporte</span>
            </div>
          )}
        </div>
      )}

      {/* Nota de ayuda */}
      <div className="selector-help">
        <small>
          💡 Selecciona el tipo de licencia adecuado para tu solicitud.
          Algunos tipos requieren documentación de soporte.
        </small>
      </div>
    </div>
  );
};

export default LeaveTypeSelector;
