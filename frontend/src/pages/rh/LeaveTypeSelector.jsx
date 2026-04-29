import React, { useEffect, useState } from 'react';
import leaveService from '../../services/leaveService';
import './leaveTypeSelector.css';

const FALLBACK_TYPES = [
  { leave_type_id: 1, name: 'Vacaciones', description: 'Descanso anual pagado', color: '#10b981', default_days: 15, requires_document: false },
  { leave_type_id: 2, name: 'Enfermedad', description: 'Licencia por enfermedad', color: '#ef4444', default_days: 5, requires_document: true },
  { leave_type_id: 3, name: 'Licencia Personal', description: 'Licencia personal', color: '#f59e0b', default_days: 3, requires_document: false },
];

const LeaveTypeSelector = ({ companyId, value, onChange, disabled = false }) => {
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (companyId) loadLeaveTypes();
  }, [companyId]);

  const loadLeaveTypes = async () => {
    setLoading(true);
    try {
      const data = await leaveService.getLeaveTypes(companyId, true);
      if (Array.isArray(data) && data.length > 0) {
        // Normalizar keys del backend (snake_case o PascalCase)
        setLeaveTypes(data.map(t => ({
          leave_type_id: t.LeaveType_Id || t.leave_type_id || t.id,
          name: t.Name || t.name,
          description: t.Description || t.description || '',
          color: t.Color || t.color || '#6b7280',
          default_days: t.DefaultDays || t.default_days || 0,
          requires_document: !!(t.RequiresDocument || t.requires_document),
        })));
      } else {
        setLeaveTypes(FALLBACK_TYPES);
      }
    } catch {
      setLeaveTypes(FALLBACK_TYPES);
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
      <div className="selector-wrapper">
        <button
          className={`selector-button ${disabled ? 'disabled' : ''}`}
          onClick={() => !disabled && setShowDropdown(!showDropdown)}
          disabled={disabled}
          type="button"
        >
          {selectedType ? (
            <>
              <span className="type-color" style={{ backgroundColor: selectedType.color }} />
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
                  className={`dropdown-item ${value === type.leave_type_id ? 'selected' : ''}`}
                  onClick={() => handleSelect(type)}
                >
                  <div className="item-header">
                    <span className="item-color" style={{ backgroundColor: type.color }} />
                    <div className="item-info">
                      <h4 className="item-name">{type.name}</h4>
                      <p className="item-description">{type.description}</p>
                    </div>
                  </div>
                  <div className="item-details">
                    <span className="detail-badge">{type.default_days} días</span>
                    {type.requires_document && (
                      <span className="detail-badge required">Requiere documento</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

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
    </div>
  );
};

export default LeaveTypeSelector;
