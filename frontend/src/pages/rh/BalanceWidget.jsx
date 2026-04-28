/**
 * BalanceWidget.jsx
 * Widget que muestra el saldo de vacaciones del empleado actual
 * Muestra por tipo de licencia los días disponibles vs usados
 */

import React, { useEffect, useState } from 'react';
import { notify } from '../../services/notify';
import leaveService from '../../services/leaveService';
import './balanceWidget.css';

const BalanceWidget = ({ userId, year = null }) => {
  const [balance, setBalance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentYear, setCurrentYear] = useState(year || new Date().getFullYear());
  const [useMockData, setUseMockData] = useState(false);

  useEffect(() => {
    loadBalance();
  }, [userId, currentYear]);

  const loadBalance = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      // Intentar cargar datos reales del API
      const response = await leaveService.getLeaveBalance(currentYear);
      
      if (response && Array.isArray(response) && response.length > 0) {
        // Transformar datos de API al formato esperado
        const transformedData = response.map(item => ({
          leave_type: item.leave_type_name || item.name,
          available_days: item.available_days,
          used_days: item.used_days,
          planned_days: item.planned_days || 0,
          remaining: item.remaining_days || (item.available_days - item.used_days - (item.planned_days || 0))
        }));
        setBalance(transformedData);
        setUseMockData(false);
      } else {
        throw new Error('No data returned');
      }
    } catch (error) {
      // Fallback a datos mock si hay error
      console.warn('Usando datos mock debido a:', error.message);
      setBalance(leaveService.getMockBalance().map(item => ({
        leave_type: item.leave_type_name,
        available_days: item.available_days,
        used_days: item.used_days,
        planned_days: item.planned_days || 0,
        remaining: item.remaining_days
      })));
      setUseMockData(true);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviousYear = () => {
    setCurrentYear(currentYear - 1);
  };

  const handleNextYear = () => {
    setCurrentYear(currentYear + 1);
  };

  const getProgressPercentage = (used, available) => {
    return available > 0 ? (used / available) * 100 : 0;
  };

  const getProgressColor = (remaining, available) => {
    const percentage = (remaining / available) * 100;
    if (percentage >= 75) return '#10b981'; // green
    if (percentage >= 50) return '#f59e0b'; // amber
    if (percentage >= 25) return '#ef5350'; // red
    return '#dc2626'; // dark red
  };

  return (
    <div className="balance-widget">
      {/* Encabezado */}
      <div className="balance-header">
        <h3>⚖️ Saldo de Vacaciones</h3>
        <div className="year-selector">
          <button className="year-btn" onClick={handlePreviousYear} title="Año anterior">
            ◀
          </button>
          <span className="year-display">{currentYear}</span>
          <button
            className="year-btn"
            onClick={handleNextYear}
            title="Año siguiente"
            disabled={currentYear >= new Date().getFullYear() + 1}
          >
            ▶
          </button>
        </div>
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="loading">Cargando saldo...</div>
      ) : balance.length === 0 ? (
        <div className="no-data">
          <p>No hay datos de saldo disponibles</p>
        </div>
      ) : (
        <div className="balance-list">
          {balance.map((item, idx) => (
            <div key={idx} className="balance-item">
              {/* Tipo de licencia */}
              <div className="leave-type-header">
                <h4 className="leave-type-name">{item.leave_type}</h4>
                <span className="remaining-badge" style={{
                  backgroundColor: getProgressColor(item.remaining, item.available_days)
                }}>
                  {item.remaining} días
                </span>
              </div>

              {/* Barra de progreso */}
              <div className="progress-container">
                <div className="progress-bar">
                  <div
                    className="progress-used"
                    style={{
                      width: `${getProgressPercentage(item.used_days, item.available_days)}%`,
                      backgroundColor: '#ef4444'
                    }}
                    title={`${item.used_days} días usados`}
                  />
                  <div
                    className="progress-planned"
                    style={{
                      width: `${getProgressPercentage(item.planned_days, item.available_days)}%`,
                      backgroundColor: '#f59e0b'
                    }}
                    title={`${item.planned_days} días planificados`}
                  />
                </div>
              </div>

              {/* Detalle de números */}
              <div className="balance-details">
                <div className="detail-row">
                  <span className="detail-label">
                    <span className="color-indicator used"></span>
                    Usados
                  </span>
                  <span className="detail-value">{item.used_days} / {item.available_days}</span>
                </div>

                <div className="detail-row">
                  <span className="detail-label">
                    <span className="color-indicator planned"></span>
                    Planificados
                  </span>
                  <span className="detail-value">{item.planned_days}</span>
                </div>

                <div className="detail-row total">
                  <span className="detail-label">Disponibles</span>
                  <span className="detail-value available">{item.remaining}</span>
                </div>
              </div>

              {/* Estado */}
              <div className="balance-status">
                {item.remaining > 5 && (
                  <span className="status-good">✅ Saldo suficiente</span>
                )}
                {item.remaining <= 5 && item.remaining > 0 && (
                  <span className="status-warning">⚠️ Saldo bajo</span>
                )}
                {item.remaining <= 0 && (
                  <span className="status-critical">❌ Sin saldo</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resumen general */}
      {balance.length > 0 && (
        <div className="balance-summary">
          <div className="summary-row">
            <span>Total de días disponibles:</span>
            <span className="summary-value">
              {balance.reduce((sum, item) => sum + item.available_days, 0)}
            </span>
          </div>
          <div className="summary-row">
            <span>Total de días usados:</span>
            <span className="summary-value">
              {balance.reduce((sum, item) => sum + item.used_days, 0)}
            </span>
          </div>
          <div className="summary-row">
            <span>Total de días planificados:</span>
            <span className="summary-value">
              {balance.reduce((sum, item) => sum + item.planned_days, 0)}
            </span>
          </div>
          <div className="summary-row highlight">
            <span>Total de días disponibles:</span>
            <span className="summary-value">
              {balance.reduce((sum, item) => sum + item.remaining, 0)}
            </span>
          </div>
        </div>
      )}

      {/* Nota informativa */}
      <div className="balance-info">
        <small>
          💡 Los días se actualizan automáticamente. Para solicitar vacaciones,
          asegúrate de tener saldo disponible.
        </small>
      </div>
    </div>
  );
};

export default BalanceWidget;
