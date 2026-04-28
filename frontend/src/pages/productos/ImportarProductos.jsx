import { useState, useRef, useEffect } from 'react';
import { FaFileUpload } from 'react-icons/fa';
import api from '../../services/api';
import { notify } from '../../services/notify';

const premiumFieldClass =
  'w-full rounded-[14px] border border-[#dce4f0] bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-[0_2px_8px_rgba(15,45,93,0.06)] outline-none transition focus:border-[#3b6fd4] focus:ring-2 focus:ring-[#3b6fd4]/20';

const premiumSectionClass =
  'rounded-[24px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,248,255,0.9)_100%)] p-5 shadow-[0_4px_20px_rgba(15,45,93,0.07)]';

const Field = ({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</label>
    {children}
  </div>
);

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
        const res = await api.get('/companies/');
        setCompanies(res.data || []);
      } catch (err) {
        console.error('Error cargando empresas', err);
      }
    };
    fetchCompanies();
  }, []);

  const handleImport = async () => {
    if (!file) { notify.error('Selecciona un archivo'); return; }
    if (!companyId) { notify.error('Selecciona la empresa'); return; }

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
    <div
      className="min-h-screen w-full px-4 sm:px-6 py-6"
      style={{
        background:
          'radial-gradient(ellipse at 70% 0%, rgba(59,107,212,0.07) 0%, rgba(255,255,255,0) 60%), radial-gradient(ellipse at 0% 80%, rgba(99,102,241,0.05) 0%, rgba(255,255,255,0) 55%), #f4f6fb',
      }}
    >
      <div className="mx-auto max-w-3xl space-y-5">

        {/* ── Header ── */}
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#1b3d86] to-[#2a5fc4] shadow-[0_4px_14px_rgba(27,61,134,0.35)]">
            <FaFileUpload className="text-white text-lg" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3b6fd4]">Productos</p>
            <h1 className="text-2xl font-bold leading-tight text-[#0d1f3c]">Importar Productos desde Excel</h1>
            <p className="text-sm text-slate-500">Carga masiva desde archivo .xls / .xlsx</p>
          </div>
        </div>

        {/* ── Format instructions ── */}
        <div className={premiumSectionClass}>
          <h2 className="mb-3 text-sm font-bold text-[#0d1f3c]">Formato requerido</h2>
          <ul className="space-y-1.5 text-sm text-slate-600">
            {[
              'Columnas: SKU, Nombre, Descripcion, Precio, Moneda, ClaveProdServSAT, ClaveUnidadSAT, ImpuestoIVA, Activo',
              'Moneda: MXN, USD o EUR (si no viene, se asigna MXN por defecto)',
              'Las claves SAT deben existir en los catálogos oficiales',
              'Si el SKU ya existe, el producto será actualizado',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">{i + 1}</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Upload form ── */}
        <div className={premiumSectionClass}>
          <h2 className="mb-4 text-sm font-bold text-[#0d1f3c]">Seleccionar archivo y empresa</h2>
          <div className="space-y-4">
            <Field label="Archivo Excel (.xls / .xlsx)">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xls,.xlsx"
                onChange={handleFileChange}
                className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-[10px] file:border file:border-blue-200 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
              />
              {file && (
                <p className="mt-1 text-xs text-emerald-600">
                  Seleccionado: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </Field>

            <Field label="Empresa *">
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className={premiumFieldClass}
              >
                <option value="">Selecciona una empresa</option>
                {companies.map((c) => (
                  <option key={c.Company_Id} value={c.Company_Id}>
                    {c.NameCompany}
                  </option>
                ))}
              </select>
            </Field>

            <div className="flex justify-end border-t border-[#eaf0fa] pt-4">
              <button
                onClick={handleImport}
                disabled={!file || !companyId || loading}
                className="rounded-[14px] bg-gradient-to-r from-[#1b3d86] to-[#2a5fc4] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(27,61,134,0.30)] transition hover:shadow-[0_6px_20px_rgba(27,61,134,0.40)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Importando…' : 'Importar Productos'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Import results ── */}
        {resultado && (
          <div className={premiumSectionClass}>
            <h2 className="mb-4 text-sm font-bold text-[#0d1f3c]">Resultado de Importación</h2>
            <div className="mb-4 grid grid-cols-3 gap-3">
              <div className="rounded-[16px] border border-slate-200 bg-slate-50 p-4 text-center">
                <div className="text-2xl font-bold text-slate-700">{resultado.total}</div>
                <div className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Total</div>
              </div>
              <div className="rounded-[16px] border border-emerald-200 bg-emerald-50 p-4 text-center">
                <div className="text-2xl font-bold text-emerald-700">{resultado.exitosas}</div>
                <div className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-600">Exitosas</div>
              </div>
              <div className="rounded-[16px] border border-rose-200 bg-rose-50 p-4 text-center">
                <div className="text-2xl font-bold text-rose-700">{resultado.conError}</div>
                <div className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-rose-600">Con Error</div>
              </div>
            </div>

            {resultado.errores?.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Errores detectados</p>
                <div className="max-h-64 space-y-1.5 overflow-y-auto">
                  {resultado.errores.map((err, idx) => (
                    <div key={idx} className="rounded-[10px] border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      <span className="font-semibold">Fila {err.fila}:</span> {err.error}
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
