import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaArrowLeft, FaSave } from 'react-icons/fa';
import {
  OperationHeader,
  OperationSectionTitle,
  OperationStat,
  operationContainerClass,
  operationFieldClass,
  operationPageClass,
  operationPrimaryButtonClass,
  operationSecondaryButtonClass,
} from '../../components/operation/OperationUI';
import * as materiaPrimaService from '../../services/materiaPrimaService';
import { notify } from '../../services/notify';

const initialForm = {
  Codigo: '',
  Nombre: '',
  Descripcion: '',
  Tipo: 'PAPEL',
  UnidadCompra: 'TONELADA',
  UnidadConsumo: 'KG',
  FactorConversion: 1000,
  Gramaje: '',
  CostoUnitario: 0,
  Moneda: 'MXN',
  Activo: true,
};

function Field({ label, hint, children, span = false }) {
  return (
    <div className={span ? 'md:col-span-2' : ''}>
      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-[#6b7a96]">{label}</label>
      {children}
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

const FormularioMateriaPrima = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    if (isEdit) {
      cargarMateria();
    }
  }, [id]);

  const cargarMateria = async () => {
    try {
      setLoading(true);
      const response = await materiaPrimaService.getMateriaPrimaDetalle(id);
      setFormData({ ...initialForm, ...response.data });
    } catch (error) {
      console.error('Error al cargar materia prima:', error);
      notify('Error al cargar materia prima', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      if (isEdit) {
        await materiaPrimaService.updateMateriaPrima(id, formData);
        notify('Materia prima actualizada correctamente', 'success');
      } else {
        await materiaPrimaService.createMateriaPrima(formData);
        notify('Materia prima creada correctamente', 'success');
      }
      navigate('/produccion/materias-primas');
    } catch (error) {
      console.error('Error al guardar:', error);
      notify(error.response?.data?.message || 'Error al guardar materia prima', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEdit) {
    return (
      <div className={operationPageClass}>
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 rounded-full border-4 border-[#1b3d86]/20 border-t-[#1b3d86] animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className={operationPageClass}>
      <div className={operationContainerClass}>
        <OperationHeader
          eyebrow="Producción"
          title={isEdit ? 'Editar Materia Prima' : 'Nueva Materia Prima'}
          description="Configura el maestro de insumos con costo, unidades, conversión y clasificación operativa."
          actions={
            <>
              <button onClick={() => navigate('/produccion/materias-primas')} className={operationSecondaryButtonClass}>
                <FaArrowLeft className="text-xs" /> Volver
              </button>
              <button onClick={handleSubmit} className={operationPrimaryButtonClass} disabled={loading}>
                <FaSave className="text-xs" /> {loading ? 'Guardando...' : 'Guardar'}
              </button>
            </>
          }
          stats={[
            <OperationStat key="tipo" label="Tipo" value={formData.Tipo || '-'} tone="blue" />,
            <OperationStat key="consumo" label="Unidad consumo" value={formData.UnidadConsumo || '-'} tone="emerald" />,
            <OperationStat key="compra" label="Unidad compra" value={formData.UnidadCompra || '-'} tone="amber" />,
            <OperationStat key="moneda" label="Moneda" value={formData.Moneda || 'MXN'} tone="slate" />,
          ]}
        />

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(246,249,253,0.97))] p-5 shadow-[0_18px_40px_rgba(15,45,93,0.08)]">
            <OperationSectionTitle
              eyebrow="Identidad"
              title="Datos generales"
              description="Define código, nombre comercial y una descripción de referencia para inventario y producción."
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Código *" hint="Identificador único, por ejemplo MP-001, ADH-001 o PAP-120.">
                <input
                  type="text"
                  value={formData.Codigo}
                  onChange={(e) => setFormData({ ...formData, Codigo: e.target.value })}
                  className={operationFieldClass}
                  placeholder="MP-001"
                  required
                />
              </Field>
              <Field label="Nombre *">
                <input
                  type="text"
                  value={formData.Nombre}
                  onChange={(e) => setFormData({ ...formData, Nombre: e.target.value })}
                  className={operationFieldClass}
                  required
                />
              </Field>
              <Field label="Descripción" span>
                <textarea
                  value={formData.Descripcion}
                  onChange={(e) => setFormData({ ...formData, Descripcion: e.target.value })}
                  className={`${operationFieldClass} resize-none`}
                  rows="3"
                />
              </Field>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(246,249,253,0.97))] p-5 shadow-[0_18px_40px_rgba(15,45,93,0.08)]">
            <OperationSectionTitle
              eyebrow="Operación"
              title="Clasificación y unidades"
              description="Establece tipo de insumo y cómo se compra contra cómo se consume en producción."
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Tipo *">
                <select
                  value={formData.Tipo}
                  onChange={(e) => setFormData({ ...formData, Tipo: e.target.value })}
                  className={operationFieldClass}
                  required
                >
                  <option value="PAPEL">Papel</option>
                  <option value="ADHESIVO">Adhesivo</option>
                  <option value="REVENTA">Reventa</option>
                  <option value="OTRO">Otro</option>
                </select>
              </Field>
              <Field label="Unidad de compra *">
                <select
                  value={formData.UnidadCompra}
                  onChange={(e) => setFormData({ ...formData, UnidadCompra: e.target.value })}
                  className={operationFieldClass}
                  required
                >
                  <option value="TONELADA">Tonelada</option>
                  <option value="KILO">Kilo</option>
                  <option value="LITRO">Litro</option>
                  <option value="PIEZA">Pieza</option>
                  <option value="ROLLO">Rollo</option>
                  <option value="CAJA">Caja</option>
                </select>
              </Field>
              <Field label="Unidad de consumo *">
                <select
                  value={formData.UnidadConsumo}
                  onChange={(e) => setFormData({ ...formData, UnidadConsumo: e.target.value })}
                  className={operationFieldClass}
                  required
                >
                  <option value="KG">Kilogramo (KG)</option>
                  <option value="GRAMO">Gramo</option>
                  <option value="LITRO">Litro</option>
                  <option value="ML">Mililitro (ML)</option>
                  <option value="PIEZA">Pieza</option>
                  <option value="METRO">Metro</option>
                </select>
              </Field>
              <Field label="Factor de conversión *" hint="Ejemplo: 1 tonelada = 1000 KG.">
                <input
                  type="number"
                  value={formData.FactorConversion}
                  onChange={(e) => setFormData({ ...formData, FactorConversion: parseFloat(e.target.value) })}
                  className={operationFieldClass}
                  step="0.001"
                  min="0"
                  required
                />
              </Field>
              {formData.Tipo === 'PAPEL' ? (
                <Field label="Gramaje (g/m²)">
                  <input
                    type="number"
                    value={formData.Gramaje}
                    onChange={(e) => setFormData({ ...formData, Gramaje: parseFloat(e.target.value) })}
                    className={operationFieldClass}
                    step="0.01"
                    min="0"
                  />
                </Field>
              ) : null}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(246,249,253,0.97))] p-5 shadow-[0_18px_40px_rgba(15,45,93,0.08)]">
            <OperationSectionTitle
              eyebrow="Costo"
              title="Valuación"
              description="Define costo unitario, moneda y disponibilidad del insumo dentro del maestro operativo."
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Costo unitario *" hint={`Costo por ${formData.UnidadConsumo}.`}>
                <input
                  type="number"
                  value={formData.CostoUnitario}
                  onChange={(e) => setFormData({ ...formData, CostoUnitario: parseFloat(e.target.value) })}
                  className={operationFieldClass}
                  step="0.01"
                  min="0"
                  required
                />
              </Field>
              <Field label="Moneda">
                <select
                  value={formData.Moneda}
                  onChange={(e) => setFormData({ ...formData, Moneda: e.target.value })}
                  className={operationFieldClass}
                >
                  <option value="MXN">MXN</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </Field>
              <div className="md:col-span-2">
                <label className="inline-flex items-center gap-3 rounded-[18px] border border-[#dce4f0] bg-white/90 px-4 py-3 text-sm font-medium text-slate-700 shadow-[0_6px_18px_rgba(15,45,93,0.04)]">
                  <input
                    type="checkbox"
                    checked={formData.Activo}
                    onChange={(e) => setFormData({ ...formData, Activo: e.target.checked })}
                  />
                  Activo
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => navigate('/produccion/materias-primas')} className={operationSecondaryButtonClass}>
              Cancelar
            </button>
            <button type="submit" disabled={loading} className={operationPrimaryButtonClass}>
              <FaSave className="text-xs" /> {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FormularioMateriaPrima;
