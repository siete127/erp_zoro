import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import confirm from '../../services/confirm';
import { notify } from '../../services/notify';

const CATEGORY_OPTIONS = ['Maquinaria', 'Vehiculo', 'Equipo de Computo', 'Mobiliario', 'Inmueble', 'Otro'];
const STATUS_OPTIONS = ['ACTIVO', 'BAJA', 'VENDIDO'];

const emptyForm = {
  Company_Id: '',
  Nombre: '',
  Categoria: 'Maquinaria',
  NumeroSerie: '',
  NumeroEconomico: '',
  FechaAdquisicion: '',
  ValorAdquisicion: '',
  VidaUtilMeses: '',
  MetodoDeprec: 'LINEA_RECTA',
  ValorResidual: 0,
  Estatus: 'ACTIVO',
  Responsable_Id: '',
  Almacen_Id: '',
  CuentaDeprec: '',
  CuentaActivo: '',
  Notas: '',
};

function toCurrency(value) {
  return Number(value || 0).toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  });
}

function toDate(value) {
  return value ? new Date(String(value).slice(0, 10)).toLocaleDateString('es-MX') : '—';
}

function monthToPeriod(monthValue) {
  return monthValue ? `${monthValue}-01` : null;
}

function inputClass() {
  return 'w-full rounded-[12px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20';
}

function assetStatusStyle(status) {
  const styles = {
    ACTIVO: 'bg-emerald-100 text-emerald-700',
    BAJA: 'bg-amber-100 text-amber-700',
    VENDIDO: 'bg-slate-200 text-slate-700',
  };
  return styles[status] || 'bg-gray-100 text-gray-700';
}

export default function ActivosFijos() {
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [assets, setAssets] = useState([]);
  const [preview, setPreview] = useState({ total: 0, data: [] });
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [selectedAssetDetail, setSelectedAssetDetail] = useState(null);

  useEffect(() => {
    loadMeta();
  }, []);

  useEffect(() => {
    if (selectedCompany) {
      loadAssets();
      loadPreview();
      loadWarehouses(selectedCompany);
    }
  }, [selectedCompany, selectedStatus, selectedCategory, selectedMonth]);

  async function loadMeta() {
    try {
      const [companyRes, userRes] = await Promise.all([
        api.get('/companies/'),
        api.get('/users/'),
      ]);
      const companyList = Array.isArray(companyRes.data) ? companyRes.data : (companyRes.data?.data || []);
      const userList = Array.isArray(userRes.data) ? userRes.data : (userRes.data?.data || []);
      const userLocal = JSON.parse(localStorage.getItem('user') || '{}');
      const defaultCompany = String(
        userLocal?.Company_Id || userLocal?.companies?.[0] || companyList[0]?.Company_Id || ''
      );

      setCompanies(companyList);
      setUsers(userList);
      setSelectedCompany((prev) => prev || defaultCompany);
      setForm((prev) => ({ ...prev, Company_Id: prev.Company_Id || defaultCompany }));
    } catch (error) {
      notify.error('No fue posible cargar los catálogos de activos');
    }
  }

  async function loadWarehouses(companyId) {
    try {
      const response = await api.get(`/almacenes/?company_id=${companyId}`);
      setWarehouses(Array.isArray(response.data) ? response.data : (response.data?.data || []));
    } catch (error) {
      setWarehouses([]);
    }
  }

  async function loadAssets() {
    if (!selectedCompany) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('company_id', selectedCompany);
      if (selectedStatus) params.set('estatus', selectedStatus);
      if (selectedCategory) params.set('categoria', selectedCategory);
      const response = await api.get(`/activos/?${params.toString()}`);
      setAssets(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      notify.error('No fue posible cargar los activos');
    } finally {
      setLoading(false);
    }
  }

  async function loadPreview() {
    if (!selectedCompany) return;
    try {
      const period = monthToPeriod(selectedMonth);
      const response = await api.get(`/activos/calcular-depreciacion?company_id=${selectedCompany}&periodo=${period}`);
      setPreview(response.data || { total: 0, data: [] });
    } catch (error) {
      setPreview({ total: 0, data: [] });
    }
  }

  async function openDetail(asset) {
    try {
      const response = await api.get(`/activos/${asset.Activo_Id}`);
      setSelectedAssetDetail(response.data);
    } catch (error) {
      notify.error('No fue posible cargar el historial del activo');
    }
  }

  function openCreate() {
    setEditingAsset(null);
    setForm({
      ...emptyForm,
      Company_Id: selectedCompany || companies[0]?.Company_Id || '',
      FechaAdquisicion: new Date().toISOString().slice(0, 10),
    });
    setShowForm(true);
  }

  function openEdit(asset) {
    setEditingAsset(asset);
    setForm({
      Company_Id: String(asset.Company_Id || ''),
      Nombre: asset.Nombre || '',
      Categoria: asset.Categoria || 'Maquinaria',
      NumeroSerie: asset.NumeroSerie || '',
      NumeroEconomico: asset.NumeroEconomico || '',
      FechaAdquisicion: asset.FechaAdquisicion ? String(asset.FechaAdquisicion).slice(0, 10) : '',
      ValorAdquisicion: asset.ValorAdquisicion ?? '',
      VidaUtilMeses: asset.VidaUtilMeses ?? '',
      MetodoDeprec: asset.MetodoDeprec || 'LINEA_RECTA',
      ValorResidual: asset.ValorResidual ?? 0,
      Estatus: asset.Estatus || 'ACTIVO',
      Responsable_Id: asset.Responsable_Id ? String(asset.Responsable_Id) : '',
      Almacen_Id: asset.Almacen_Id ? String(asset.Almacen_Id) : '',
      CuentaDeprec: asset.CuentaDeprec || '',
      CuentaActivo: asset.CuentaActivo || '',
      Notas: asset.Notas || '',
    });
    setShowForm(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.Company_Id || !form.Nombre.trim()) {
      notify.error('Empresa y nombre son requeridos');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        Company_Id: Number(form.Company_Id),
        Nombre: form.Nombre.trim(),
        Categoria: form.Categoria || null,
        NumeroSerie: form.NumeroSerie || null,
        NumeroEconomico: form.NumeroEconomico || null,
        FechaAdquisicion: form.FechaAdquisicion,
        ValorAdquisicion: Number(form.ValorAdquisicion || 0),
        VidaUtilMeses: Number(form.VidaUtilMeses || 0),
        MetodoDeprec: form.MetodoDeprec || 'LINEA_RECTA',
        ValorResidual: Number(form.ValorResidual || 0),
        Estatus: form.Estatus,
        Responsable_Id: form.Responsable_Id ? Number(form.Responsable_Id) : null,
        Almacen_Id: form.Almacen_Id ? Number(form.Almacen_Id) : null,
        CuentaDeprec: form.CuentaDeprec || null,
        CuentaActivo: form.CuentaActivo || null,
        Notas: form.Notas || null,
      };
      if (editingAsset) {
        await api.put(`/activos/${editingAsset.Activo_Id}`, payload);
        notify.success('Activo actualizado');
      } else {
        await api.post('/activos/', payload);
        notify.success('Activo creado');
      }
      setShowForm(false);
      setEditingAsset(null);
      setForm(emptyForm);
      await loadAssets();
      await loadPreview();
    } catch (error) {
      notify.error(error?.response?.data?.detail || 'No fue posible guardar el activo');
    } finally {
      setSaving(false);
    }
  }

  async function handleApplyDepreciation() {
    const ok = await confirm(`¿Aplicar depreciación de ${selectedMonth}?`, 'Depreciación', 'Aplicar', 'Cancelar');
    if (!ok) return;
    try {
      const response = await api.post('/activos/aplicar-depreciacion-mes', {
        Company_Id: Number(selectedCompany),
        Periodo: monthToPeriod(selectedMonth),
      });
      notify.success(`Depreciación aplicada. Activos procesados: ${response.data?.aplicados || 0}`);
      await loadAssets();
      await loadPreview();
      if (selectedAssetDetail?.activo?.Activo_Id) {
        await openDetail(selectedAssetDetail.activo);
      }
    } catch (error) {
      notify.error(error?.response?.data?.detail || 'No fue posible aplicar la depreciación');
    }
  }

  async function handleDelete(asset) {
    const ok = await confirm(`¿Dar de baja o eliminar ${asset.Nombre}?`, 'Activo fijo', 'Continuar', 'Cancelar');
    if (!ok) return;
    try {
      const response = await api.delete(`/activos/${asset.Activo_Id}`);
      notify.success(response.data?.message || 'Activo actualizado');
      await loadAssets();
      await loadPreview();
      if (selectedAssetDetail?.activo?.Activo_Id === asset.Activo_Id) {
        setSelectedAssetDetail(null);
      }
    } catch (error) {
      notify.error(error?.response?.data?.detail || 'No fue posible actualizar el activo');
    }
  }

  const totalValor = assets.reduce((sum, item) => sum + Number(item.ValorAdquisicion || 0), 0);
  const totalValorActual = assets.reduce((sum, item) => sum + Number(item.ValorActual || 0), 0);
  const activeAssets = assets.filter((item) => item.Estatus === 'ACTIVO').length;

  return (
    <div className="min-h-screen w-full px-4 sm:px-6 py-6 overflow-auto" style={{ background: 'radial-gradient(ellipse at 70% 0%, rgba(59,107,212,0.07) 0%, rgba(255,255,255,0) 60%), radial-gradient(ellipse at 0% 80%, rgba(99,102,241,0.05) 0%, rgba(255,255,255,0) 55%), #f4f6fb' }}>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3b6fd4]">Contabilidad</p>
          <h1 className="text-2xl font-bold leading-tight text-[#0d1f3c]">Activos Fijos</h1>
          <p className="text-sm text-slate-500">Alta de maquinaria y equipo con depreciación mensual automática.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleApplyDepreciation}
            className="rounded-[12px] border border-[#1b3d86]/30 bg-white px-4 py-2 text-sm font-semibold text-[#1b3d86] hover:bg-[#f0f4ff] transition"
          >
            Aplicar depreciación del mes
          </button>
          <button
            onClick={openCreate}
            className="rounded-[14px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(27,61,134,0.30)] hover:shadow-[0_6px_20px_rgba(27,61,134,0.40)] transition"
          >
            + Nuevo activo
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4 mb-6">
        <Field label="Empresa">
          <select className={inputClass()} value={selectedCompany} onChange={(event) => setSelectedCompany(event.target.value)}>
            <option value="">Seleccionar...</option>
            {companies.map((company) => (
              <option key={company.Company_Id} value={company.Company_Id}>
                {company.NameCompany}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Estatus">
          <select className={inputClass()} value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}>
            <option value="">Todos</option>
            {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </Field>
        <Field label="Categoría">
          <select className={inputClass()} value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
            <option value="">Todas</option>
            {CATEGORY_OPTIONS.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </Field>
        <Field label="Mes de depreciación">
          <input type="month" className={inputClass()} value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-5 mb-6">
        <InfoCard title="Activos visibles" value={assets.length} tone="slate" />
        <InfoCard title="Activos activos" value={activeAssets} tone="emerald" />
        <InfoCard title="Valor adquisición" value={toCurrency(totalValor)} tone="sky" />
        <InfoCard title="Valor actual" value={toCurrency(totalValorActual)} tone="violet" />
        <InfoCard title="Depreciación pendiente" value={toCurrency(preview.total)} tone="amber" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] p-5 shadow-[0_4px_20px_rgba(15,45,93,0.07)] overflow-hidden">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Inventario de activos</h3>
            <p className="text-sm text-gray-500">Valor actual, depreciación mensual y estatus operativo.</p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
              Cargando activos...
            </div>
          ) : assets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
              No hay activos registrados para los filtros seleccionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-[#eaf0fa]">
                    {["Activo", "Categoría", "Valor", "Depreciación", "Estatus", "Acciones"].map((col, i) => (
                      <th key={col} className={`px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b7a96] first:pl-6 ${[2,3,5].includes(i) ? 'text-right' : ''}`}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => (
                    <tr key={asset.Activo_Id} className="border-t border-[#eaf0fa] transition hover:bg-[#f4f7ff]/60">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{asset.Nombre}</div>
                        <div className="text-xs text-gray-500">{toDate(asset.FechaAdquisicion)} · {asset.AlmacenNombre || 'Sin almacén'}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{asset.Categoria || 'Sin categoría'}</td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        <div>{toCurrency(asset.ValorAdquisicion)}</div>
                        <div className="text-xs text-gray-500">Actual {toCurrency(asset.ValorActual)}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        <div>{toCurrency(asset.DepreciacionMensual)}</div>
                        <div className="text-xs text-gray-500">Acum {toCurrency(asset.DepreciacionAcum)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${assetStatusStyle(asset.Estatus)}`}>
                          {asset.Estatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openDetail(asset)}
                            className="rounded-[9px] border border-[#1b3d86]/20 bg-[#f0f4ff] px-3 py-1.5 text-xs font-semibold text-[#1b3d86] hover:bg-[#e4ecff] transition"
                          >
                            Historial
                          </button>
                          <button
                            onClick={() => openEdit(asset)}
                            className="rounded-[9px] border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100 transition"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(asset)}
                            className="rounded-[9px] border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
                          >
                            Baja
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] p-5 shadow-[0_4px_20px_rgba(15,45,93,0.07)] overflow-hidden">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Vista del mes</h3>
          <p className="text-sm text-gray-500 mb-4">Proyección de depreciación para {selectedMonth}.</p>
          {preview.data?.length ? (
            <div className="space-y-3 max-h-[36rem] overflow-auto pr-1">
              {preview.data.map((row) => (
                <div key={row.Activo_Id} className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="font-medium text-gray-900">{row.Nombre}</div>
                  <div className="mt-1 text-sm text-gray-600">
                    {toCurrency(row.Monto)} · valor libros {toCurrency(row.ValorLibros)}
                  </div>
                  {row.YaAplicada && (
                    <div className="mt-2 text-xs font-medium text-emerald-700">Ya aplicada</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
              No hay depreciación proyectada para este mes.
            </div>
          )}
        </section>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl overflow-hidden rounded-[26px] shadow-[0_24px_64px_rgba(10,20,50,0.22)]">
            <div className="flex items-center justify-between bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-6 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-200">Activos Fijos</p>
                <h3 className="text-base font-bold text-white">{editingAsset ? 'Editar activo' : 'Nuevo activo'}</h3>
              </div>
              <button onClick={() => setShowForm(false)} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition text-lg font-bold">×</button>
            </div>
            <div className="bg-white">
            <form onSubmit={handleSubmit} className="grid gap-4 p-6 md:grid-cols-2">
              <Field label="Empresa">
                <select className={inputClass()} value={form.Company_Id} onChange={(event) => setForm((prev) => ({ ...prev, Company_Id: event.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {companies.map((company) => <option key={company.Company_Id} value={company.Company_Id}>{company.NameCompany}</option>)}
                </select>
              </Field>
              <Field label="Estatus">
                <select className={inputClass()} value={form.Estatus} onChange={(event) => setForm((prev) => ({ ...prev, Estatus: event.target.value }))}>
                  {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </Field>
              <Field label="Nombre" span>
                <input className={inputClass()} value={form.Nombre} onChange={(event) => setForm((prev) => ({ ...prev, Nombre: event.target.value }))} required />
              </Field>
              <Field label="Categoría">
                <select className={inputClass()} value={form.Categoria} onChange={(event) => setForm((prev) => ({ ...prev, Categoria: event.target.value }))}>
                  {CATEGORY_OPTIONS.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </Field>
              <Field label="Fecha adquisición">
                <input type="date" className={inputClass()} value={form.FechaAdquisicion} onChange={(event) => setForm((prev) => ({ ...prev, FechaAdquisicion: event.target.value }))} />
              </Field>
              <Field label="Número de serie">
                <input className={inputClass()} value={form.NumeroSerie} onChange={(event) => setForm((prev) => ({ ...prev, NumeroSerie: event.target.value }))} />
              </Field>
              <Field label="Número económico">
                <input className={inputClass()} value={form.NumeroEconomico} onChange={(event) => setForm((prev) => ({ ...prev, NumeroEconomico: event.target.value }))} />
              </Field>
              <Field label="Valor adquisición">
                <input type="number" min="0" step="0.01" className={inputClass()} value={form.ValorAdquisicion} onChange={(event) => setForm((prev) => ({ ...prev, ValorAdquisicion: event.target.value }))} />
              </Field>
              <Field label="Valor residual">
                <input type="number" min="0" step="0.01" className={inputClass()} value={form.ValorResidual} onChange={(event) => setForm((prev) => ({ ...prev, ValorResidual: event.target.value }))} />
              </Field>
              <Field label="Vida útil (meses)">
                <input type="number" min="1" step="1" className={inputClass()} value={form.VidaUtilMeses} onChange={(event) => setForm((prev) => ({ ...prev, VidaUtilMeses: event.target.value }))} />
              </Field>
              <Field label="Método">
                <input className={inputClass()} value={form.MetodoDeprec} onChange={(event) => setForm((prev) => ({ ...prev, MetodoDeprec: event.target.value }))} />
              </Field>
              <Field label="Responsable">
                <select className={inputClass()} value={form.Responsable_Id} onChange={(event) => setForm((prev) => ({ ...prev, Responsable_Id: event.target.value }))}>
                  <option value="">Sin responsable</option>
                  {users.map((user) => <option key={user.User_Id} value={user.User_Id}>{`${user.Name || ''} ${user.Lastname || ''}`.trim() || user.Username}</option>)}
                </select>
              </Field>
              <Field label="Almacén">
                <select className={inputClass()} value={form.Almacen_Id} onChange={(event) => setForm((prev) => ({ ...prev, Almacen_Id: event.target.value }))}>
                  <option value="">Sin almacén</option>
                  {warehouses.filter((item) => String(item.Company_Id) === String(form.Company_Id)).map((warehouse) => (
                    <option key={warehouse.Almacen_Id} value={warehouse.Almacen_Id}>{warehouse.Nombre}</option>
                  ))}
                </select>
              </Field>
              <Field label="Cuenta gasto depreciación">
                <input className={inputClass()} value={form.CuentaDeprec} onChange={(event) => setForm((prev) => ({ ...prev, CuentaDeprec: event.target.value }))} placeholder="Ej. 6100" />
              </Field>
              <Field label="Cuenta activo">
                <input className={inputClass()} value={form.CuentaActivo} onChange={(event) => setForm((prev) => ({ ...prev, CuentaActivo: event.target.value }))} placeholder="Ej. 1500" />
              </Field>
              <Field label="Notas" span>
                <textarea rows={4} className={`${inputClass()} resize-none`} value={form.Notas} onChange={(event) => setForm((prev) => ({ ...prev, Notas: event.target.value }))} />
              </Field>
              <div className="md:col-span-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowForm(false)} className="rounded-[12px] border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="rounded-[12px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-5 py-2 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(27,61,134,0.25)] disabled:opacity-50 transition">
                  {saving ? 'Guardando...' : (editingAsset ? 'Guardar cambios' : 'Crear activo')}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {selectedAssetDetail && (
        <div className="fixed inset-0 z-50 bg-black/45 flex justify-end" onClick={(event) => {
          if (event.target === event.currentTarget) setSelectedAssetDetail(null);
        }}>
          <div className="h-full w-full max-w-xl bg-white shadow-2xl overflow-auto p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">{selectedAssetDetail.activo?.Nombre}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedAssetDetail.activo?.Categoria || 'Sin categoría'} · {selectedAssetDetail.activo?.ResponsableNombre || 'Sin responsable'}
                </p>
              </div>
              <button onClick={() => setSelectedAssetDetail(null)} className="text-2xl leading-none text-gray-400 hover:text-gray-600">×</button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 mb-6">
              <InfoCard title="Valor adquisición" value={toCurrency(selectedAssetDetail.activo?.ValorAdquisicion)} tone="slate" />
              <InfoCard title="Valor actual" value={toCurrency(selectedAssetDetail.activo?.ValorActual)} tone="emerald" />
              <InfoCard title="Depreciación acum." value={toCurrency(selectedAssetDetail.activo?.DepreciacionAcum)} tone="amber" />
              <InfoCard title="Mensual" value={toCurrency(selectedAssetDetail.activo?.DepreciacionMensual)} tone="sky" />
            </div>

            <div className="rounded-2xl border border-gray-200 p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Historial de depreciaciones</h4>
              {(selectedAssetDetail.depreciaciones || []).length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                  Sin depreciaciones aplicadas todavía.
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedAssetDetail.depreciaciones.map((row) => (
                    <div key={row.Deprec_Id} className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="font-medium text-gray-900">{toDate(row.Periodo)}</div>
                          <div className="text-sm text-gray-500">Valor libros {toCurrency(row.ValorLibros)}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-gray-900">{toCurrency(row.Monto)}</div>
                          <div className={`text-xs font-medium ${row.Aplicada ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {row.Aplicada ? 'Contabilizada' : 'Sin póliza'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({ title, value, tone }) {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    sky: 'border-sky-200 bg-sky-50 text-sky-900',
    violet: 'border-violet-200 bg-violet-50 text-violet-900',
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || 'border-gray-200 bg-gray-50 text-gray-900'}`}>
      <div className="text-xs uppercase tracking-wide opacity-70">{title}</div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
    </div>
  );
}

function Field({ label, children, span = false }) {
  return (
    <div className={span ? 'md:col-span-2' : ''}>
      <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#6b7a96] mb-1.5">{label}</label>
      {children}
    </div>
  );
}
