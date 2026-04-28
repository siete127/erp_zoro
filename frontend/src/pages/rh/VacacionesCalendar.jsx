import React, { useEffect, useMemo, useState } from 'react';
import leaveService from '../../services/leaveService';
import './vacacionesCalendar.css';

const monthNames = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const dayNames = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

function normalizeDate(dateLike) {
  const date = new Date(dateLike);
  date.setHours(12, 0, 0, 0);
  return date;
}

function sameDay(a, b) {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

function formatShortDate(dateLike) {
  return normalizeDate(dateLike).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short'
  });
}

function formatLongDate(dateLike) {
  return normalizeDate(dateLike).toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function buildMonthDays(currentDate) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const cells = [];

  for (let i = firstDayIndex - 1; i >= 0; i -= 1) {
    cells.push({
      date: new Date(year, month - 1, daysInPrevMonth - i),
      isCurrentMonth: false
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      date: new Date(year, month, day),
      isCurrentMonth: true
    });
  }

  while (cells.length % 7 !== 0 || cells.length < 42) {
    const nextDay = cells.length - (firstDayIndex + daysInMonth) + 1;
    cells.push({
      date: new Date(year, month + 1, nextDay),
      isCurrentMonth: false
    });
  }

  return cells;
}

export default function VacacionesCalendar({ currentUser, onCreateClick }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [vacaciones, setVacaciones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('month');
  const [selectedDate, setSelectedDate] = useState(normalizeDate(new Date()));
  const [useMockData, setUseMockData] = useState(false);

  useEffect(() => {
    loadVacaciones();
  }, [currentDate]);

  const loadVacaciones = async () => {
    setLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;
      const data = await leaveService.getApprovedVacations(
        currentUser?.company_id,
        startDate,
        endDate
      );

      if (Array.isArray(data) && data.length > 0) {
        setVacaciones(data);
        setUseMockData(false);
      } else {
        setVacaciones(leaveService.getMockApprovedVacations());
        setUseMockData(true);
      }
    } catch (error) {
      console.warn('Usando datos mock de vacaciones debido a:', error.message);
      setVacaciones(leaveService.getMockApprovedVacations());
      setUseMockData(true);
    } finally {
      setLoading(false);
    }
  };

  const getVacacionesForDate = (dateLike) => {
    const checkDate = normalizeDate(dateLike);
    return vacaciones.filter((vac) => {
      const inicio = normalizeDate(vac.FechaInicio);
      const fin = normalizeDate(vac.FechaFin);
      return checkDate >= inicio && checkDate <= fin;
    });
  };

  const monthCells = useMemo(() => buildMonthDays(currentDate), [currentDate]);
  const selectedVacations = useMemo(
    () => (selectedDate ? getVacacionesForDate(selectedDate) : []),
    [selectedDate, vacaciones, currentDate]
  );

  const monthStats = useMemo(() => {
    const activePeople = new Set();
    let totalBookedDays = 0;
    let busiestDay = null;
    let busiestCount = 0;

    monthCells.forEach(({ date, isCurrentMonth }) => {
      if (!isCurrentMonth) return;
      const dayVacations = getVacacionesForDate(date);
      if (dayVacations.length > busiestCount) {
        busiestCount = dayVacations.length;
        busiestDay = date;
      }
      dayVacations.forEach((vac) => {
        activePeople.add(vac.User_Id || vac.user_id || vac.Nombre || vac.name || vac.Vacaciones_Id);
      });
    });

    vacaciones.forEach((vac) => {
      totalBookedDays += Number(vac.Cantidad || 0);
    });

    return {
      activePeople: activePeople.size,
      totalRequests: vacaciones.length,
      totalBookedDays,
      busiestDay,
      busiestCount
    };
  }, [vacaciones, monthCells]);

  const weekDays = useMemo(() => {
    const startOfWeek = normalizeDate(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + index);
      return day;
    });
  }, [currentDate]);

  const handlePrev = () => {
    if (viewMode === 'week') {
      setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 7));
      return;
    }
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNext = () => {
    if (viewMode === 'week') {
      setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7));
      return;
    }
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleToday = () => {
    const today = normalizeDate(new Date());
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const renderMonthView = () => (
    <div className="calendar-grid-shell">
      <div className="calendar-header">
        {dayNames.map((day) => (
          <div key={day} className="calendar-day-name">{day}</div>
        ))}
      </div>

      <div className="calendar-body">
        {monthCells.map(({ date, isCurrentMonth }) => {
          const vacacionesDelDia = getVacacionesForDate(date);
          const isToday = sameDay(date, normalizeDate(new Date()));
          const isSelected = selectedDate && sameDay(date, selectedDate);

          return (
            <button
              key={date.toISOString()}
              type="button"
              className={[
                'calendar-day',
                isCurrentMonth ? '' : 'is-outside',
                isToday ? 'today' : '',
                isSelected ? 'selected' : '',
                vacacionesDelDia.length > 0 ? 'has-vacation' : ''
              ].join(' ').trim()}
              onClick={() => setSelectedDate(normalizeDate(date))}
            >
              <div className="calendar-day-top">
                <span className="day-number">{date.getDate()}</span>
                {vacacionesDelDia.length > 0 && (
                  <span className="day-badge">{vacacionesDelDia.length}</span>
                )}
              </div>

              {vacacionesDelDia.length > 0 ? (
                <div className="day-preview-list">
                  {vacacionesDelDia.slice(0, 2).map((vac) => (
                    <div key={vac.Vacaciones_Id} className="day-preview-chip">
                      <span className="day-preview-dot" />
                      <span>{vac.Nombre || vac.name || vac.Razon || 'Vacaciones'}</span>
                    </div>
                  ))}
                  {vacacionesDelDia.length > 2 && (
                    <div className="day-preview-more">+{vacacionesDelDia.length - 2} mas</div>
                  )}
                </div>
              ) : (
                <div className="day-preview-empty">Sin movimientos</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderWeekView = () => (
    <div className="calendar-week">
      {weekDays.map((date) => {
        const vacacionesDelDia = getVacacionesForDate(date);
        const isToday = sameDay(date, normalizeDate(new Date()));
        const isSelected = selectedDate && sameDay(date, selectedDate);

        return (
          <button
            key={date.toISOString()}
            type="button"
            className={[
              'week-day',
              isToday ? 'today' : '',
              isSelected ? 'selected' : '',
              vacacionesDelDia.length > 0 ? 'has-vacation' : ''
            ].join(' ').trim()}
            onClick={() => setSelectedDate(normalizeDate(date))}
          >
            <div className="week-day-header">
              <span className="day-name">{dayNames[date.getDay()]}</span>
              <span className="week-date-label">{date.getDate()}</span>
            </div>
            <div className="week-day-content">
              {vacacionesDelDia.length > 0 ? (
                vacacionesDelDia.map((vac) => (
                  <div key={vac.Vacaciones_Id} className="week-vacation">
                    <strong>{vac.Nombre || vac.name || 'Colaborador'}</strong>
                    <span>{vac.Cantidad} dias</span>
                  </div>
                ))
              ) : (
                <div className="week-vacation week-vacation-empty">Sin vacaciones</div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="vacaciones-calendar-container">
      <section className="calendar-hero">
        <div>
          <p className="calendar-eyebrow">Planeacion de ausencias</p>
          <h3>Calendario del equipo</h3>
          <p className="calendar-subtitle">
            Visualiza quien estara fuera, detecta dias con mayor demanda y crea solicitudes
            sin salir del modulo de RH.
          </p>
        </div>

        <div className="calendar-hero-actions">
          {useMockData && <span className="calendar-data-badge">Mostrando datos demo</span>}
          <button type="button" className="btn-create" onClick={() => onCreateClick?.()}>
            Nueva solicitud
          </button>
        </div>
      </section>

      <section className="calendar-stats-strip">
        <article className="stat-card">
          <span className="stat-card-label">Solicitudes en periodo</span>
          <strong>{monthStats.totalRequests}</strong>
          <small>Aprobadas para {monthNames[currentDate.getMonth()].toLowerCase()}</small>
        </article>

        <article className="stat-card">
          <span className="stat-card-label">Dias apartados</span>
          <strong>{monthStats.totalBookedDays}</strong>
          <small>Suma total de dias aprobados</small>
        </article>

        <article className="stat-card">
          <span className="stat-card-label">Personas impactadas</span>
          <strong>{monthStats.activePeople}</strong>
          <small>Colaboradores con ausencia registrada</small>
        </article>

        <article className="stat-card">
          <span className="stat-card-label">Dia con mas carga</span>
          <strong>{monthStats.busiestCount || 0}</strong>
          <small>
            {monthStats.busiestDay ? formatShortDate(monthStats.busiestDay) : 'Sin picos detectados'}
          </small>
        </article>
      </section>

      <section className="calendar-shell">
        <div className="calendar-main">
          <div className="calendar-toolbar">
            <div className="toolbar-left">
              <div className="toolbar-title-group">
                <p className="toolbar-kicker">Vista {viewMode === 'month' ? 'mensual' : 'semanal'}</p>
                <h4>
                  {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h4>
              </div>

              <div className="toolbar-nav">
                <button type="button" className="btn-nav" onClick={handlePrev} title="Periodo anterior">
                  ‹
                </button>
                <button type="button" className="btn-nav" onClick={handleNext} title="Periodo siguiente">
                  ›
                </button>
              </div>
            </div>

            <div className="toolbar-right">
              <button type="button" className="btn-today" onClick={handleToday}>
                Hoy
              </button>

              <div className="view-toggle">
                <button
                  type="button"
                  className={`view-btn ${viewMode === 'month' ? 'active' : ''}`}
                  onClick={() => setViewMode('month')}
                >
                  Mes
                </button>
                <button
                  type="button"
                  className={`view-btn ${viewMode === 'week' ? 'active' : ''}`}
                  onClick={() => setViewMode('week')}
                >
                  Semana
                </button>
              </div>
            </div>
          </div>

          <div className="calendar-legend">
            <div className="legend-item">
              <span className="legend-indicator vacation" />
              <span>Vacaciones aprobadas</span>
            </div>
            <div className="legend-item">
              <span className="legend-indicator today" />
              <span>Hoy</span>
            </div>
            <div className="legend-item">
              <span className="legend-indicator selected" />
              <span>Dia seleccionado</span>
            </div>
          </div>

          {loading ? (
            <div className="calendar-loading">Cargando vacaciones...</div>
          ) : viewMode === 'month' ? (
            renderMonthView()
          ) : (
            renderWeekView()
          )}
        </div>

        <aside className="calendar-sidebar">
          <div className="sidebar-card">
            <p className="sidebar-label">Selecciona un dia</p>
            <h4>{selectedDate ? formatLongDate(selectedDate) : 'Sin fecha seleccionada'}</h4>
            <p className="sidebar-helper">
              Haz clic en una fecha para ver detalle del equipo y revisar la carga de ausencias.
            </p>
          </div>

          <div className="sidebar-card">
            <div className="sidebar-card-header">
              <h5>Ausencias del dia</h5>
              <span className="sidebar-pill">{selectedVacations.length}</span>
            </div>

            {selectedVacations.length > 0 ? (
              <div className="vacations-list">
                {selectedVacations.map((vac) => (
                  <article key={vac.Vacaciones_Id} className="vacation-item">
                    <div className="vacation-item-head">
                      <strong>{vac.Nombre || vac.name || 'Colaborador'}</strong>
                      <span className="vacation-days">{vac.Cantidad} dias</span>
                    </div>
                    <div className="vacation-period">
                      {formatShortDate(vac.FechaInicio)} a {formatShortDate(vac.FechaFin)}
                    </div>
                    <p className="vacation-reason">{vac.Razon || 'Sin motivo especificado'}</p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="no-vacations">
                <p>No hay vacaciones registradas para esta fecha.</p>
                <button type="button" className="btn-create secondary" onClick={() => onCreateClick?.()}>
                  Crear solicitud
                </button>
              </div>
            )}
          </div>

          <div className="sidebar-card compact">
            <div className="sidebar-card-header">
              <h5>Resumen del mes</h5>
            </div>
            <div className="month-summary-list">
              <div className="month-summary-row">
                <span>Pendientes visuales</span>
                <strong>{monthStats.totalRequests}</strong>
              </div>
              <div className="month-summary-row">
                <span>Dia mas cargado</span>
                <strong>{monthStats.busiestCount || 0}</strong>
              </div>
              <div className="month-summary-row">
                <span>Personas distintas</span>
                <strong>{monthStats.activePeople}</strong>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
