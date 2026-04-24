"""
Análisis completo de factibilidad de turnos para sucursal mall (10:00-20:00, 7 días/semana).

Restricciones:
- Cobertura: siempre ≥1 trabajador en sucursal (10:00-20:00)
- 42 horas laborales/semana (turno_presencia = horas_laborales + 1h colación)
- Máximo 2 domingos trabajados por mes
- Máximo 6 días consecutivos trabajados

Esquemas de turno analizados:
  E1: Solo APE+CIE fijo (mitad apertura, mitad cierre)
  E2: Rotativo semanal (todos rotan APE↔CIE semana a semana)
  E3: COM puro (todos hacen turno completo)
  E4: Mixto (COM + APE o COM + CIE)
"""

from math import ceil
from itertools import combinations

# ──────────────────────────────────────────────
# Constantes
# ──────────────────────────────────────────────
MALL_OPEN  = 10 * 60  # minutos desde medianoche
MALL_CLOSE = 20 * 60
LUNCH_MIN  = 60       # colación = 1h
TARGET_WORK_H = 42    # horas laborales semanales

DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
SUNDAY    = 6  # índice 0=Lun

# Definición de turnos: (nombre, inicio_min, fin_min, presencia_h, laborales_h)
TURNOS = {
    'OFF': (None, None, 0, 0),
    'APE': (10*60, 18*60, 8, 7),   # 10:00-18:00  → 7h laborales
    'CIE': (12*60, 20*60, 8, 7),   # 12:00-20:00  → 7h laborales
    'COM': (10*60, 20*60, 10, 9),  # 10:00-20:00  → 9h laborales
}

SUNDAYS_PER_MONTH = 4  # valor típico; algunos meses tienen 5

# ──────────────────────────────────────────────
# Utilidades
# ──────────────────────────────────────────────

def coverage_gaps(shifts_for_day: list[str]) -> list[tuple[int,int]]:
    """Devuelve lista de franjas (h_inicio, h_fin) sin cobertura en el día."""
    covered = [False] * (MALL_CLOSE - MALL_OPEN)
    for t in shifts_for_day:
        if t == 'OFF':
            continue
        s, e = TURNOS[t][1], TURNOS[t][2]  # índice 1=inicio, 2=fin -- ver abajo
    # Re-hacemos con índices correctos
    covered = [False] * (MALL_CLOSE - MALL_OPEN)
    for t in shifts_for_day:
        if t == 'OFF':
            continue
        inicio = TURNOS[t][0]
        fin    = TURNOS[t][1]
        for m in range(inicio - MALL_OPEN, fin - MALL_OPEN):
            if 0 <= m < len(covered):
                covered[m] = True
    gaps = []
    in_gap = False
    gap_start = None
    for i, c in enumerate(covered):
        if not c and not in_gap:
            in_gap = True
            gap_start = MALL_OPEN + i
        elif c and in_gap:
            in_gap = False
            gaps.append((gap_start // 60, (MALL_OPEN + i) // 60))
    if in_gap:
        gaps.append((gap_start // 60, MALL_CLOSE // 60))
    return gaps


def is_day_covered(shifts_for_day: list[str]) -> bool:
    return len(coverage_gaps(shifts_for_day)) == 0


def max_consecutive(pattern_7: list[str]) -> int:
    """Días consecutivos máximos en una semana (solo considera la semana, sin cross-semana)."""
    days_worked = [1 if t != 'OFF' else 0 for t in pattern_7]
    max_c = cur = 0
    for d in days_worked:
        cur = cur + 1 if d else 0
        max_c = max(max_c, cur)
    return max_c


def cross_week_consecutive(pattern_prev: list[str], pattern_curr: list[str]) -> int:
    """Máximo streak contando el cruce entre la semana anterior y la actual."""
    # Cuántos días seguidos al FINAL de la semana anterior
    tail = 0
    for t in reversed(pattern_prev):
        if t != 'OFF':
            tail += 1
        else:
            break
    # Cuántos días seguidos al INICIO de la semana actual
    head = 0
    for t in pattern_curr:
        if t != 'OFF':
            head += 1
        else:
            break
    return tail + head


def weekly_work_hours(pattern_7: list[str]) -> int:
    return sum(TURNOS[t][3] for t in pattern_7)


def sundays_in_pattern(pattern_7: list[str]) -> int:
    return 1 if pattern_7[SUNDAY] != 'OFF' else 0


# ──────────────────────────────────────────────
# ESQUEMA 1: APE fijo + CIE fijo
# N/2 trabajadores hacen APE siempre, N/2 hacen CIE siempre.
# Cada trabajador trabaja 6 días/semana (1 libre), 7h/día → 42h.
# ──────────────────────────────────────────────

def analyze_ape_cie_fixed(N: int) -> dict:
    """
    Con N trabajadores (mitad APE, mitad CIE), evalúa:
    - Si la cobertura es factible (≥1 APE y ≥1 CIE cada día)
    - Si se cumplen los 42h/semana
    - Si se pueden respetar max 2 domingos/mes
    - Si se puede evitar >6 días consecutivos
    """
    n_ape = N // 2
    n_cie = N - n_ape

    result = {
        'esquema': 'E1: APE+CIE fijo',
        'N': N,
        'n_ape': n_ape,
        'n_cie': n_cie,
    }

    # ── COBERTURA ──────────────────────────────
    # Cada día necesita ≥1 APE y ≥1 CIE.
    # Con X trabajadores APE cada uno libre 1 día/semana, el peor caso es que
    # todos sus días libres son el mismo día → ese día solo hay X-1 APE.
    # Para garantizar ≥1 APE: necesitamos X ≥ 2 (días libres en diferentes días).
    # Idem CIE.
    coverage_ok = (n_ape >= 2) and (n_cie >= 2)
    result['coverage_ok'] = coverage_ok

    # ── HORAS SEMANALES ────────────────────────
    # APE: 6 días × 7h = 42h ✓
    # CIE: 6 días × 7h = 42h ✓
    result['horas_ok'] = True  # Siempre cumple con este esquema
    result['horas_por_worker'] = 42
    result['dias_por_semana'] = 6

    # ── DOMINGOS ──────────────────────────────
    # Cada domingo: necesita ≥1 APE y ≥1 CIE → 2 trabajadores mínimo por domingo.
    # Meses típicos: 4 domingos → 8 domingo-slots necesarios.
    # Meses con 5 domingos: 10 domingo-slots.
    # Cada trabajador puede trabajar máx 2 domingos/mes.
    # Total slots disponibles: N × 2 (pero repartidos N/2 para APE y N/2 para CIE).
    # APE-slots disponibles: n_ape × 2
    # CIE-slots disponibles: n_cie × 2
    # Necesarios APE por mes (4 dom): 4 (1 APE por domingo)
    # Necesarios CIE por mes (4 dom): 4

    ape_slots_avail = n_ape * 2
    cie_slots_avail = n_cie * 2
    dom_per_month_needed_each_type = SUNDAYS_PER_MONTH  # 1 APE + 1 CIE por domingo

    sunday_ok_4dom = (ape_slots_avail >= dom_per_month_needed_each_type and
                      cie_slots_avail >= dom_per_month_needed_each_type)
    sunday_ok_5dom = (ape_slots_avail >= 5 and cie_slots_avail >= 5)

    result['sunday_ok_4dom'] = sunday_ok_4dom
    result['sunday_ok_5dom'] = sunday_ok_5dom
    result['ape_dom_margin_4'] = ape_slots_avail - dom_per_month_needed_each_type
    result['cie_dom_margin_4'] = cie_slots_avail - dom_per_month_needed_each_type

    # ── DÍAS CONSECUTIVOS ─────────────────────
    # Con día libre FIJO por semana y día libre en domingo cuando no trabaja ese domingo:
    # Si trabajador APE trabaja sus 2 domingos: en esas semanas el libre es un día de semana.
    # En las otras semanas el libre es el domingo.
    # Verificamos el peor caso cross-week:
    #   - Semana A: libre el miércoles → trabaja Dom(A)→Lun→Mar→[libre]→Jue→Vie→Sáb = max 2+3=5 consec
    #   - Semana B: libre el domingo → trabaja Lun→Mar→Mié→Jue→Vie→Sáb = 6 consec
    # Cross-week Sáb(A) → Dom(A) es el mismo día.
    # Cross-week Dom(A) → Lun(B): trabaja Dom(A) y Lun(B) → 2 + lo que sigue en B
    # Lo que sigue en B: Lun→Mar→Mié→Jue→Vie→Sáb antes del Dom(libre) = 6
    # Total: 1 (Dom A) + 6 (Lun-Sáb B) = 7 → ¡ROMPE!

    # El problema aparece cuando el trabajador trabaja Domingo en semana N
    # y luego la semana N+1 libra el domingo (trabaja Lun-Sáb).
    # → Dom(N) + Lun+Mar+Mié+Jue+Vie+Sáb(N+1) = 7 días seguidos.

    # Solución: cuando el trabajador trabaja el domingo, su día libre de la SIGUIENTE semana
    # debe ser lunes o martes (no domingo) para romper la racha.
    # O bien: en la semana donde trabaja el domingo, el libre es el lunes
    # → Libre Lun(N) → trabaja Mar→Mié→Jue→Vie→Sáb→Dom(N)
    # → semana N+1 libre Dom: Lun→Mar→Mié→Jue→Vie→Sáb
    # Cross: Dom(N) → Lun(N+1) → ... → Sáb(N+1) = 7 ✗ (mismo problema)

    # La solución real: cuando se trabaja domingo, el libre de ESA semana Y de la siguiente
    # deben garantizar que el cruce no supere 6.
    # Patrón seguro: libre el Sábado cuando se trabaja Domingo:
    # Libre Sáb(N): Lun→Mar→Mié→Jue→Vie→[libre Sáb]→Dom
    # Dom(N) → Lun(N+1): si N+1 tiene libre Dom: Lun→Mar→Mié→Jue→Vie→Sáb
    # Cross: Dom(N) + Lun+Mar+Mié+Jue+Vie+Sáb(N+1) = 7 ✗ SIGUE MAL

    # La única solución sin >6 días: cuando se trabaja Dom, libre el Lunes de la semana SIGUIENTE.
    # Libre Sáb(N) imposible → Libre Lun(N+1):
    # Dom(N) + [libre Lun(N+1)] = Dom seguido de OFF → solo 1 día, luego break ✓
    # Semana N+1: [libre Lun] → Mar→Mié→Jue→Vie→Sáb→Dom(N+1 si trabaja)
    # Max en N+1: 6 (Mar-Dom) ✓
    # Cross Dom(N)→Lun(N+1)=OFF → no hay cross consecutivo ✓

    # CONCLUSIÓN: el turno rotativo de DOMINGO-LIBRE debe ser:
    # "semana donde trabajas domingo: libre otro día cualquiera"
    # "semana siguiente: libre el LUNES" → rompe el cruce
    # → Esto es factible pero requiere planificación mensual cuidadosa.

    # Patrón limpio sin problemas cross-week:
    # Trabajador A: siempre libre el mismo día X (X ≠ Dom)
    # → trabaja Dom siempre → 4-5 domingos → VIOLA MAX 2 domingos

    # Trabajador A: libre Dom en semanas sin domingo, libre otro día en semanas con domingo
    # → cross-week puede generar 7 días si no se cuida el día libre de la semana siguiente

    # Clasificamos esto como "REQUIERE PLANIFICACIÓN MENSUAL"
    result['consecutive_pattern'] = 'Requiere planificación mensual; naïve puede generar 7 días'
    result['consecutive_max_naive'] = 7
    result['consecutive_max_optimized'] = 6  # con planificación adecuada

    # ── RESUMEN ────────────────────────────────
    result['feasible'] = coverage_ok and sunday_ok_4dom
    result['feasible_5dom'] = coverage_ok and sunday_ok_5dom

    return result


# ──────────────────────────────────────────────
# ESQUEMA 2: Rotativo semanal (todos rotan APE↔CIE)
# Semana 1: mitad APE, mitad CIE
# Semana 2: se invierten
# Semana 3: como semana 1, etc.
# Cada trabajador hace lo mismo que E1 en horas, pero rota el tipo de turno.
# ──────────────────────────────────────────────

def analyze_rotativo(N: int) -> dict:
    result = analyze_ape_cie_fixed(N)
    result['esquema'] = 'E2: Rotativo semanal (APE↔CIE por semana)'
    # La factibilidad es idéntica a E1 en términos de restricciones duras.
    # La diferencia es que cada trabajador experimenta ambos horarios a lo largo del mes.
    # Ventaja: mayor equidad (todos tienen mañanas y tardes).
    # Sin impacto en factibilidad numérica.
    result['fairness'] = 'Alta: todos rotan entre apertura y cierre'
    return result


# ──────────────────────────────────────────────
# ESQUEMA 3: COM puro (todos 10:00-20:00)
# ──────────────────────────────────────────────

def analyze_com_puro(N: int) -> dict:
    result = {
        'esquema': 'E3: COM puro (10:00-20:00)',
        'N': N,
    }

    # Cobertura: T-COM solo cubre el día entero → 1 trabajador basta por día.
    # Con N trabajadores, 1 día libre por semana cada uno:
    # Peor caso: todos libres el mismo día → 0 trabajadores ese día → sin cobertura ✗
    # Con N ≥ 2 y días libres distintos: siempre hay ≥1 trabajador ✓
    coverage_ok = N >= 2
    result['coverage_ok'] = coverage_ok

    # Horas: T-COM = 9h laborales/día.
    # Para 42h: 42 / 9 = 4.67 días → NO calza exacto.
    # Opciones:
    #   a) 4 días COM + 1 día CORTO (6h lab, 7h pres) = 42h → requiere turno adicional
    #   b) 5 días COM = 45h → supera el límite legal de 42h
    #   c) 4 días COM = 36h → bajo el target
    # Ninguna opción es limpia. Se necesita un turno adicional de 6h laborales.
    # Propuesta: turno CORTO de 10:00-17:00 (6h lab, 7h pres) o 13:00-20:00

    result['horas_ok'] = False  # No calza 42h con días enteros
    result['horas_nota'] = (
        '9h/día × 4 días = 36h (bajo), × 5 días = 45h (sobre límite legal). '
        'Requiere 1 turno corto adicional (6h laborales): 10:00-17:00 o 14:00-20:00. '
        'El turno corto no cubre el día completo solo → solo funciona si otro COM está presente.'
    )
    result['horas_por_worker_aprox'] = '36-45h (no calza exacto en 42h)'

    # Domingos: cada domingo necesita ≥1 COM worker.
    # Max 2 domingos/mes por worker.
    # Total slots: N × 2
    # Necesarios: SUNDAYS_PER_MONTH (1 worker por domingo si solo se exige cobertura mínima)
    dom_slots = N * 2
    sunday_ok_4dom = dom_slots >= SUNDAYS_PER_MONTH
    sunday_ok_5dom = dom_slots >= 5
    result['sunday_ok_4dom'] = sunday_ok_4dom
    result['sunday_ok_5dom'] = sunday_ok_5dom

    # Consecutivos: misma lógica que E1, aplica.
    result['consecutive_note'] = 'Mismos riesgos que E1 si el patrón semanal no se planifica'

    result['feasible'] = coverage_ok and sunday_ok_4dom and result['horas_ok']  # False por horas
    result['feasible_nota'] = 'Inviable por horas: COM puro no calza 42h semanales exactas'

    return result


# ──────────────────────────────────────────────
# ESQUEMA 4: Mixto (COM + APE o COM + CIE)
# Algunos trabajadores COM, otros APE o CIE.
# ──────────────────────────────────────────────

def analyze_mixto(N: int) -> dict:
    """
    N trabajadores: floor(N/2) hacen COM, ceil(N/2) hacen APE+CIE.
    El COM worker cubre el día completo solo.
    El APE/CIE worker añade cobertura y llega a 42h.
    """
    n_com = N // 2
    n_split = N - n_com  # estos hacen APE o CIE según la semana

    result = {
        'esquema': 'E4: Mixto (COM + APE/CIE)',
        'N': N,
        'n_com': n_com,
        'n_ape_cie': n_split,
    }

    # Cobertura: COM workers cubren el día completo (si hay ≥1 COM presente).
    # Con n_com ≥ 2 y días libres distintos: siempre hay ≥1 COM worker ✓
    # Si n_com = 0 o 1: cobertura depende de APE+CIE workers estar ambos presentes.
    if n_com >= 2:
        coverage_ok = True
        coverage_nota = f'{n_com} workers COM con días libres distintos garantizan cobertura'
    elif n_com == 1:
        coverage_ok = False
        coverage_nota = 'Solo 1 COM worker: su día libre deja sin cobertura completa'
    else:
        coverage_ok = (n_split >= 4)  # Vuelve a necesitar APE+CIE como E1
        coverage_nota = 'Sin COM workers; requiere ≥2 APE + ≥2 CIE'

    result['coverage_ok'] = coverage_ok
    result['coverage_nota'] = coverage_nota

    # Horas:
    # COM workers: 9h/día × ? días → no calza 42h solo
    # Para COM workers: 4 días COM (36h) + 1 día CORTO (6h) = 42h
    # APE/CIE workers: 6 días × 7h = 42h ✓
    result['horas_com_nota'] = '4 días COM (36h) + 1 día CORTO 6h = 42h (requiere turno adicional)'
    result['horas_split_ok'] = True

    # Domingos: COM workers pueden trabajar domingos (cubre todo el día solo).
    # Max 2 domingos/mes.
    dom_slots_com   = n_com * 2
    dom_slots_split = n_split * 2
    dom_slots_total = dom_slots_com + dom_slots_split

    # Necesarios: SUNDAYS_PER_MONTH (1 COM basta por domingo si tienen COM worker)
    sunday_ok_4dom = dom_slots_com >= SUNDAYS_PER_MONTH or (
        dom_slots_split >= SUNDAYS_PER_MONTH * 2  # si no hay COM, necesita APE+CIE
    )
    result['sunday_ok_4dom'] = sunday_ok_4dom

    result['feasible'] = coverage_ok  # COM workers no dan 42h exactas → siempre con advertencia
    result['feasible_nota'] = (
        'Factible en cobertura y domingos, pero COM workers requieren turno corto adicional para 42h exactas.'
        if coverage_ok else 'No factible en cobertura con esta distribución.'
    )

    return result


# ──────────────────────────────────────────────
# ESQUEMA 5: Rotativo mensual (4 semanas, 4 horarios)
# Sem 1: APE, Sem 2: CIE, Sem 3: APE, Sem 4: CIE (o variantes)
# Todos los trabajadores rotan por semana.
# ──────────────────────────────────────────────

def analyze_rotativo_mensual(N: int) -> dict:
    """
    Todos los trabajadores hacen el mismo horario cada semana, rotando:
    Sem 1: APE (10:00-18:00), Sem 2: CIE (12:00-20:00), Sem 3: APE, Sem 4: CIE.

    Problema: si TODOS hacen APE en la misma semana, 18:00-20:00 queda sin cobertura.
    Solución: siempre MITAD APE + MITAD CIE, pero QUÉ mitad rota.
    - Grupo A: Sem 1 APE, Sem 2 CIE, Sem 3 APE, Sem 4 CIE
    - Grupo B: Sem 1 CIE, Sem 2 APE, Sem 3 CIE, Sem 4 APE
    Resultado: igual que E2 (rotativo semanal) pero en sentido opuesto por grupo.
    La factibilidad es idéntica a E1/E2.
    """
    result = analyze_ape_cie_fixed(N)
    result['esquema'] = 'E5: Rotativo mensual (grupos A/B alternados por semana)'
    result['fairness'] = 'Máxima: rotación entre grupos garantiza todos hacen ambos turnos'
    return result


# ──────────────────────────────────────────────
# ANÁLISIS COMPLETO: N = 2..12
# ──────────────────────────────────────────────

def run_full_analysis():
    print("=" * 80)
    print("ANÁLISIS DE FACTIBILIDAD — MALL 7 DÍAS — 10:00 A 20:00")
    print("=" * 80)
    print()

    print("PARÁMETROS:")
    print(f"  Horario: 10:00-20:00 (10h de atención)")
    print(f"  Días abiertos: 7/semana (lunes a domingo)")
    print(f"  Horas laborales objetivo: {TARGET_WORK_H}h/semana")
    print(f"  Fórmula: presencia_turno = horas_laborales + 1h_colación")
    print(f"  Restricciones:")
    print(f"    - Siempre ≥1 trabajador en sucursal")
    print(f"    - Máx 2 domingos trabajados por mes")
    print(f"    - Máx 6 días consecutivos trabajados")
    print()

    print("─" * 80)
    print("DEFINICIÓN DE TURNOS")
    print("─" * 80)
    for nombre, (inicio, fin, pres, lab) in TURNOS.items():
        if nombre == 'OFF':
            print(f"  OFF  : Libre")
        else:
            h_i = inicio // 60
            h_f = fin // 60
            print(f"  {nombre:4s}: {h_i:02d}:00-{h_f:02d}:00 | presencia {pres}h | laborales {lab}h")

    print()
    print("  Para 42h semanales:")
    for nombre, (inicio, fin, pres, lab) in TURNOS.items():
        if nombre == 'OFF' or lab == 0:
            continue
        if 42 % lab == 0:
            dias = 42 // lab
            print(f"    {nombre}: {dias} días × {lab}h = 42h ✓")
        else:
            dias_f = 42 / lab
            print(f"    {nombre}: {dias_f:.2f} días → no calza exacto ✗")

    print()
    print("─" * 80)
    print("ANÁLISIS POR ESQUEMA Y DOTACIÓN")
    print("─" * 80)

    # Tabla resumen por N
    print()
    print("### E1 — APE+CIE FIJO (mitad apertura, mitad cierre, cada uno 6 días/semana, 42h) ###")
    print()
    print(f"{'N':>3} | {'n_APE':>5} | {'n_CIE':>5} | {'Cobertura':>9} | {'42h':>5} | {'Dom 4S':>6} | {'Dom 5S':>6} | {'Margen APE':>10} | {'Margen CIE':>10} | {'Factible':>8}")
    print("-" * 100)

    for N in range(2, 13):
        r = analyze_ape_cie_fixed(N)
        cob   = "✓" if r['coverage_ok'] else "✗"
        h42   = "✓" if r['horas_ok'] else "✗"
        d4    = "✓" if r['sunday_ok_4dom'] else "✗"
        d5    = "✓" if r['sunday_ok_5dom'] else "✗"
        mape  = r['ape_dom_margin_4']
        mcie  = r['cie_dom_margin_4']
        fact  = "✓ SÓLIDO" if r['feasible'] and r['sunday_ok_5dom'] else (
                "⚠ AJUSTADO" if r['feasible'] and not r['sunday_ok_5dom'] else "✗ NO")
        print(f"{N:>3} | {r['n_ape']:>5} | {r['n_cie']:>5} | {cob:>9} | {h42:>5} | {d4:>6} | {d5:>6} | {mape:>+10} | {mcie:>+10} | {fact:>8}")

    print()
    print("Nota: 'Margen' = slots domingos disponibles − domingos a cubrir. Margen 0 = sin tolerancia a ausencias.")
    print()

    print()
    print("### E3 — COM PURO (10:00-20:00) ###")
    print()
    print("ADVERTENCIA: T-COM (9h laborales/día) no calza 42h con días enteros.")
    print("  4 días × 9h = 36h (bajo). 5 días × 9h = 45h (supera límite legal).")
    print("  Requiere turno corto adicional: p. ej. 10:00-17:00 (6h laborales, 7h presencia).")
    print("  Patrón: 4 días COM + 1 día CORTO = 36 + 6 = 42h ✓")
    print("  PERO: T-CORTO no cubre 10h solo → solo funciona si otro COM está presente ese día.")
    print("  → E3 NO es un esquema autosuficiente. Siempre necesita al menos 2 COM workers.")
    print()
    print(f"{'N':>3} | {'Cobertura':>9} | {'Horas exactas':>13} | {'Dom 4S':>6} | {'Factible':>8}")
    print("-" * 55)
    for N in range(2, 13):
        r = analyze_com_puro(N)
        cob  = "✓" if r['coverage_ok'] else "✗"
        h42  = "✗ (necesita CORTO)" if not r['horas_ok'] else "✓"
        d4   = "✓" if r['sunday_ok_4dom'] else "✗"
        fact = "✗ horas" if not r['horas_ok'] else ("✓" if r['feasible'] else "✗")
        print(f"{N:>3} | {cob:>9} | {h42:>13} | {d4:>6} | {fact:>8}")

    print()
    print("### ANÁLISIS CONSECUTIVOS — SEMANA TIPO PARA E1 ###")
    print()
    print("Patrón seguro (sin cruce de semana > 6 días):")
    print()
    print("Clave: el día libre de cada trabajador debe ser FIJO dentro de la semana,")
    print("       pero cuando trabaja domingo, debe librar el LUNES de la semana siguiente.")
    print()

    for N in range(2, 9):
        n_ape = N // 2
        n_cie = N - n_ape
        print(f"  N={N} ({n_ape} APE + {n_cie} CIE):")

        # Distribuir días libres entre APE workers
        # Regla: días libres distintos, repartidos en la semana
        days_to_assign = list(range(7))

        # APE workers: asignar días libres no-domingo (para meses normales; domingo se maneja mensualmente)
        ape_days_off = []
        for i in range(n_ape):
            day_off = days_to_assign[i % 7]
            ape_days_off.append(day_off)

        # CIE workers
        cie_days_off = []
        for i in range(n_cie):
            day_off = days_to_assign[(n_ape + i) % 7]
            cie_days_off.append(day_off)

        # Generar tabla semanal
        header = f"    {'Worker':>8} | {'Turno':>5} | " + " | ".join(f"{d:>3}" for d in DAY_NAMES) + " | Horas"
        print(header)
        print("    " + "-" * len(header.replace("    ","")))
        total_hours_check = True

        all_patterns = []
        for i in range(n_ape):
            day_off = ape_days_off[i] if i < len(ape_days_off) else 6
            pattern = ['APE' if d != day_off else 'OFF' for d in range(7)]
            # Asegurar que domingo sea manejado mensualmente; el patrón base lo deja trabajando
            hours = weekly_work_hours(pattern)
            all_patterns.append(('APE', pattern))
            cells = " | ".join(f"{t:>3}" for t in pattern)
            marker = "✓" if hours == 42 else f"⚠{hours}h"
            print(f"    {'APE-'+str(i+1):>8} | {'APE':>5} | {cells} | {marker}")

        for i in range(n_cie):
            day_off = cie_days_off[i] if i < len(cie_days_off) else 5
            pattern = ['CIE' if d != day_off else 'OFF' for d in range(7)]
            hours = weekly_work_hours(pattern)
            all_patterns.append(('CIE', pattern))
            cells = " | ".join(f"{t:>3}" for t in pattern)
            marker = "✓" if hours == 42 else f"⚠{hours}h"
            print(f"    {'CIE-'+str(i+1):>8} | {'CIE':>5} | {cells} | {marker}")

        # Verificar cobertura por día
        print(f"    {'Cobertura':>8} |       | ", end="")
        all_covered = True
        for day in range(7):
            shifts_today = [p[day] for _, p in all_patterns]
            covered = is_day_covered(shifts_today)
            if not covered:
                all_covered = False
            print(f"{'✓':>3}", end=" | ")
        if all_covered:
            print("Completa")
        else:
            print("⚠ GAPS")

        # Verificar consecutivos
        for tipo, pattern in all_patterns:
            mc = max_consecutive(pattern)
            if mc > 6:
                print(f"    ⚠ {tipo}: max {mc} días seguidos en semana tipo")

        print()

    print()
    print("### ANÁLISIS DE DOMINGOS — DISTRIBUCIÓN MENSUAL ###")
    print()
    print("Mes típico: 4 domingos. Para N trabajadores con max 2 domingos/mes cada uno:")
    print()
    print(f"{'N':>3} | {'Slots disp.':>11} | {'Slots necesarios':>16} | {'Holgura':>7} | {'Factible 4 dom':>14} | {'Factible 5 dom':>14}")
    print("-" * 80)

    for N in range(2, 13):
        # Necesitamos 1 APE + 1 CIE por domingo (con E1)
        # = 2 workers/domingo
        slots_needed_4 = SUNDAYS_PER_MONTH * 2  # 8
        slots_needed_5 = 5 * 2  # 10
        slots_avail = N * 2  # max 2 domingos/trabajador
        holgura = slots_avail - slots_needed_4
        fact_4 = "✓" if slots_avail >= slots_needed_4 else "✗"
        fact_5 = "✓" if slots_avail >= slots_needed_5 else "✗"
        print(f"{N:>3} | {slots_avail:>11} | {slots_needed_4:>16} | {holgura:>+7} | {fact_4:>14} | {fact_5:>14}")

    print()
    print("Nota: con E1 (APE+CIE), cada domingo necesita 1 APE + 1 CIE = 2 workers.")
    print("      Los slots se distribuyen: N/2 APE workers × 2 + N/2 CIE workers × 2.")
    print("      Restricción adicional: cada tipo debe cubrir sus domingos con su propio grupo.")

    print()
    print("─" * 80)
    print("RESUMEN EJECUTIVO POR DOTACIÓN")
    print("─" * 80)
    print()

    recommendations = []
    for N in range(2, 13):
        r = analyze_ape_cie_fixed(N)
        slots_needed = SUNDAYS_PER_MONTH * 2
        slots_avail = N * 2

        if not r['coverage_ok']:
            estado = "✗ INFACTIBLE"
            razon = "Cobertura insuficiente: necesita ≥2 APE y ≥2 CIE (mín. N=4)"
        elif not r['sunday_ok_4dom']:
            estado = "✗ INFACTIBLE"
            razon = f"Domingos: solo {slots_avail} slots vs {slots_needed} necesarios"
        elif not r['sunday_ok_5dom']:
            estado = "⚠ FACTIBLE AJUSTADO"
            razon = "Factible en meses de 4 domingos; falla en meses de 5 domingos. Sin margen para ausencias."
        elif slots_avail - slots_needed <= 2:
            estado = "✓ FACTIBLE MÍNIMO"
            razon = f"Holgura de {slots_avail - slots_needed} slot(s) en domingos. Frágil ante ausencias."
        else:
            estado = "✓ FACTIBLE SÓLIDO"
            razon = f"Holgura de {slots_avail - slots_needed} slots en domingos. Permite gestión de ausencias."

        recommendations.append((N, estado, razon))
        n_ape = N // 2
        n_cie = N - n_ape
        print(f"N={N:>2} ({n_ape}APE+{n_cie}CIE): {estado}")
        print(f"        {razon}")
        if r['coverage_ok'] and r['sunday_ok_4dom']:
            coverage_per_day = f"Cobertura mínima/día: 1 APE + 1 CIE (días cuando cada grupo tiene 1 libre)"
            print(f"        {coverage_per_day}")
        print()

    print()
    print("─" * 80)
    print("CONCLUSIONES Y RECOMENDACIONES")
    print("─" * 80)
    print("""
1. ESQUEMAS VIABLES:
   - E1 (APE+CIE fijo) y E2 (rotativo semanal) son los únicos esquemas que cumplen
     42h exactas con días completos. Son matemáticamente equivalentes en factibilidad.
   - E3 (COM puro) no calza 42h. Requiere turno corto adicional → complejidad extra.
   - E4 (Mixto) es viable solo si los workers APE/CIE cubren los gaps de COM.

2. MÍNIMO VIABLE: N=4 (⚠ AJUSTADO)
   - Factible en meses de 4 domingos. Cero margen para ausencias.
   - NO recomendado para operación real sin plan de contingencia.

3. MÍNIMO OPERATIVO REAL: N=5
   - Primer N con margen en domingos para meses normales (4 domingos).
   - Sigue frágil en meses de 5 domingos.
   - Aceptable si hay política de turnos de reemplazo.

4. MÍNIMO SÓLIDO: N=6
   - Holgura de 4 slots de domingos (meses de 4 dom) y 2 slots (meses de 5 dom).
   - Permite 1 ausencia/domingo sin afectar cobertura mínima.
   - Cobertura mínima de 2 personas/horario en la mayoría de los días.

5. PROBLEMA DE DÍAS CONSECUTIVOS:
   - Con el patrón semanal estándar (1 día libre/semana), si el día libre CAMBIA
     entre semanas (por rotación de domingos), el cruce puede llegar a 7 días.
   - Solución: cuando un trabajador trabaja el domingo de la semana N, su día libre
     de la semana N+1 DEBE ser el lunes (rompe la racha inmediatamente).
   - Esto requiere planificación MENSUAL, no semanal automática.
   - El solver actual NO implementa esta restricción correctamente (ver doc base).

6. TURNO ÚNICO ROTATIVO (una variante por semana):
   - Si se usa 1 solo tipo de turno por worker pero cambia semana a semana,
     la factibilidad es idéntica a E1/E2 — el análisis es el mismo.
   - El valor es en equidad y variedad, no en factibilidad adicional.
""")


if __name__ == '__main__':
    run_full_analysis()
