"""
Tablas oficiales SAT México 2024 para cálculo de nómina.
Fuente: DOF 2023-12-28, Art. 96 LISR, Anexo 8 RMF 2024, Ley del IMSS.
"""
from __future__ import annotations

# ---------------------------------------------------------------------------
# ISR — Tabla mensual Art. 96 LISR 2024
# (limite_inferior, limite_superior, cuota_fija, porcentaje_sobre_excedente)
# ---------------------------------------------------------------------------
ISR_TABLA_MENSUAL: list[tuple[float, float, float, float]] = [
    (0.01,      746.04,     0.00,     1.92),
    (746.05,    6_332.05,   14.32,    6.40),
    (6_332.06,  11_128.01,  371.83,   10.88),
    (11_128.02, 12_935.82,  893.63,   16.00),
    (12_935.83, 15_487.71,  1_182.88, 17.92),
    (15_487.72, 31_236.49,  1_640.18, 21.36),
    (31_236.50, 49_233.00,  5_004.12, 23.52),
    (49_233.01, float("inf"), 9_236.89, 30.00),
]

# ---------------------------------------------------------------------------
# Subsidio al empleo mensual — Anexo 8 RMF 2024
# (hasta_ingreso_mensual_inclusive, subsidio_mensual_aplicable)
# ---------------------------------------------------------------------------
SUBSIDIO_TABLA_MENSUAL: list[tuple[float, float]] = [
    (1_768.96,  407.02),
    (2_653.38,  406.83),
    (3_472.84,  406.62),
    (3_537.87,  392.77),
    (4_446.15,  382.46),
    (4_717.18,  354.23),
    (5_335.42,  324.87),
    (6_224.67,  294.63),
    (7_113.90,  253.54),
    (7_382.33,  217.61),
    (float("inf"), 0.00),  # Sin subsidio para ingresos mayores
]

# ---------------------------------------------------------------------------
# Salario mínimo general 2024 (SMGDF)
# ---------------------------------------------------------------------------
SMGDF_2024: float = 248.93          # Zona general
SMGDF_ZLF_2024: float = 374.89      # Zona libre de la frontera norte

# ---------------------------------------------------------------------------
# Cuotas IMSS empleado 2024 (% sobre SBC/SDI)
# Fuente: Arts. 25, 107, 147, 168 Ley del IMSS
# ---------------------------------------------------------------------------
IMSS_EyM_EXCEDENTE: float = 0.00400   # Enf. y Maternidad — excedente 3 SMGDF
IMSS_INVALIDEZ_VIDA: float = 0.00625  # Invalidez y vida
IMSS_CESANTIA_VEJEZ: float = 0.01125  # Cesantía y vejez (AFORE)
IMSS_TOTAL_EMPLEADO: float = 0.02150  # Total cuota empleado (~2.15%)

# Nota: La cuota de Enfermedades y Maternidad tiene una parte fija (1.5% sobre
# 3 SMGDF) que paga el empleador, y la parte del empleado es solo sobre el
# excedente de 3 SMGDF al 0.4%. Para simplificar el cálculo de recibo de
# nómina usamos la tasa consolidada de 2.15% sobre el SDI completo.

# ---------------------------------------------------------------------------
# Funciones de cálculo
# ---------------------------------------------------------------------------

def calcular_isr_mensual(ingreso_mensual: float) -> float:
    """Calcula ISR mensual según tabla progresiva Art. 96 LISR."""
    if ingreso_mensual <= 0:
        return 0.0
    for li, ls, cuota, tasa in ISR_TABLA_MENSUAL:
        if li <= ingreso_mensual <= ls:
            excedente = ingreso_mensual - li
            return round(cuota + excedente * tasa / 100, 2)
    return 0.0


def calcular_subsidio_mensual(ingreso_mensual: float) -> float:
    """Calcula subsidio al empleo mensual según Anexo 8 RMF 2024."""
    if ingreso_mensual <= 0:
        return 0.0
    for hasta, subsidio in SUBSIDIO_TABLA_MENSUAL:
        if ingreso_mensual <= hasta:
            return float(subsidio)
    return 0.0


def calcular_imss_empleado(sdi: float, dias: int) -> float:
    """
    Calcula cuota IMSS a cargo del empleado.
    sdi: Salario Diario Integrado
    dias: días del período (15 quincena, 30 mensual)
    """
    if sdi <= 0 or dias <= 0:
        return 0.0
    return round(sdi * dias * IMSS_TOTAL_EMPLEADO, 2)


def calcular_impuestos_periodo(
    salario_bruto: float,
    sdi: float,
    dias: int,
) -> dict[str, float]:
    """
    Calcula ISR e IMSS para un período de nómina.

    Args:
        salario_bruto: Percepciones brutas del período (ya calculadas).
        sdi: Salario Diario Integrado del empleado.
        dias: Días del período (ej. 15 para quincena, 30 para mensual).

    Returns:
        dict con ISR, IMSS, SubsidioEmpleo, TotalDeducciones.
    """
    if dias <= 0:
        dias = 15

    # Mensualizar para aplicar la tabla progresiva del SAT
    salario_mensual = salario_bruto * 30 / dias

    isr_mensual = calcular_isr_mensual(salario_mensual)
    subsidio_mensual = calcular_subsidio_mensual(salario_mensual)
    isr_neto_mensual = max(0.0, isr_mensual - subsidio_mensual)

    # Proporcionar al período real
    factor = dias / 30
    isr_periodo = round(isr_neto_mensual * factor, 2)
    subsidio_periodo = round(subsidio_mensual * factor, 2)

    imss = calcular_imss_empleado(sdi, dias)

    total_deducciones = round(isr_periodo + imss, 2)

    return {
        "ISR": isr_periodo,
        "IMSS": imss,
        "SubsidioEmpleo": subsidio_periodo,
        "TotalDeducciones": total_deducciones,
    }
