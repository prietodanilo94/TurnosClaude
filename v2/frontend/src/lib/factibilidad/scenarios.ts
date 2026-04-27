import { buildGroupOffTemplates } from "./analyzer";
import {
  type FactibilityOption,
  type FactibilityRole,
  type FactibilityScenario,
  type FactibilityWeekday,
  type FactibilityWorkerTemplate,
} from "./types";

function cloneWorkers(workers: FactibilityWorkerTemplate[]): FactibilityWorkerTemplate[] {
  return workers.map((worker) => ({
    ...worker,
    weeklyRoles: [...worker.weeklyRoles],
    offDays: [...worker.offDays],
  }));
}

function makeWorkers(
  prefix: string,
  group: string,
  count: number,
  weeklyRoles: FactibilityRole[],
  templates: FactibilityWeekday[][],
  startIndex = 1
): FactibilityWorkerTemplate[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index + 1}`,
    label: `Trabajador ${startIndex + index}`,
    group,
    weeklyRoles: [...weeklyRoles],
    offDays: [...templates[index]],
  }));
}

function makeFixedOption(headcount: number): FactibilityOption {
  const apeCount = Math.ceil(headcount / 2);
  const cieCount = Math.floor(headcount / 2);
  const apeTemplates = buildGroupOffTemplates(apeCount);
  const cieTemplates = buildGroupOffTemplates(cieCount);
  const workers = [
    ...makeWorkers(
      "APE",
      "Turno de apertura",
      apeCount,
      ["APE", "APE", "APE", "APE"],
      apeTemplates,
      1
    ),
    ...makeWorkers(
      "CIE",
      "Turno de cierre",
      cieCount,
      ["CIE", "CIE", "CIE", "CIE"],
      cieTemplates,
      apeCount + 1
    ),
  ];

  return {
    id: "fijo",
    title: "Apertura y cierre fijos",
    scheme: "fijo",
    recommended: headcount === 4,
    headline: "Cada persona mantiene el mismo tipo de turno durante todo el ciclo de 4 semanas.",
    shortAnalysis:
      headcount === 4
        ? "Es la opcion mas simple para N=4. Se entiende facil, pero cualquier cambio torpe de libre la puede volver fragil."
        : "Es una opcion ordenada y facil de leer. Sirve para comparar estabilidad versus reparto mas equitativo.",
    summaryBullets: [
      "42h exactas por trabajador con 1 libre semanal.",
      "Hace muy visible quien queda siempre en apertura y quien queda siempre en cierre.",
      "Sirve como punto de partida para comparar simplicidad versus equidad.",
    ],
    workers,
    roleCountsLabel: `${apeCount} apertura + ${cieCount} cierre`,
  };
}

function makeRotativeOption(headcount: number): FactibilityOption {
  const groupACount = Math.ceil(headcount / 2);
  const groupBCount = Math.floor(headcount / 2);
  const groupATemplates = buildGroupOffTemplates(groupACount);
  const groupBTemplates = buildGroupOffTemplates(groupBCount);
  const workers = [
    ...makeWorkers(
      "G1",
      "Grupo 1",
      groupACount,
      ["APE", "CIE", "APE", "CIE"],
      groupATemplates,
      1
    ),
    ...makeWorkers(
      "G2",
      "Grupo 2",
      groupBCount,
      ["CIE", "APE", "CIE", "APE"],
      groupBTemplates,
      groupACount + 1
    ),
  ];

  return {
    id: "rotativo",
    title: "Rotativo semanal",
    scheme: "rotativo",
    recommended: headcount >= 5 && headcount <= 10,
    headline: "Alterna apertura y cierre por semana para repartir mejor la carga del equipo.",
    shortAnalysis:
      headcount === 5
        ? "Es la opcion minima que mejor reparte la carga entre personas y abre una conversacion mas justa."
        : "Es la mejor base para discutir justicia del patron sin perder claridad sobre la cobertura.",
    summaryBullets: [
      "Semanas 1 y 3: un grupo abre y el otro cierra.",
      "Semanas 2 y 4: los grupos intercambian sus turnos.",
      "Es ideal para probar cambios de libres y detectar rapido cuando aparece una racha larga.",
    ],
    workers,
    roleCountsLabel: `${groupACount} / ${groupBCount} por grupo`,
  };
}

const SCENARIO_COPY: Record<
  number,
  Omit<FactibilityScenario, "options" | "headcount">
> = {
  4: {
    title: "N = 4",
    verdict: "Ajustado",
    verdictTone: "warn",
    baselineAnalysis:
      "Es el minimo matematicamente viable. Puede cubrir el dia completo, pero cualquier ausencia o cambio mal hecho lo deja al limite.",
    fifthSundayNote:
      "En un mes con 5 domingos queda muy expuesto. Por eso conviene mirar la opcion `Mes real` antes de sacar conclusiones.",
    study: {
      status: "Minimo matematicamente viable",
      statusTone: "warn",
      recommendedLabel: "APE + CIE fijo",
      recommendedOptionId: "fijo",
      summary:
        "El estudio lo muestra como viable, pero con margen cero. Cubre el dia completo, aunque no tolera ausencias ni meses exigentes sin planificacion muy cuidada.",
      simulationNote:
        "Si la simulacion mensual de abajo cae, eso confirma lo fragil del caso. No significa que el estudio este mal: significa que N=4 vive en el limite.",
      bullets: [
        "2 personas en apertura y 2 en cierre.",
        "Los domingos quedan justos: 4 slots APE y 4 slots CIE para 4 necesarios.",
        "En meses de 5 domingos se vuelve muy delicado.",
      ],
      metrics: [
        { label: "Config. base", value: "2 APE + 2 CIE", tone: "neutral" },
        { label: "Margen dom. APE", value: "4 / 4", tone: "warn" },
        { label: "Margen dom. CIE", value: "4 / 4", tone: "warn" },
        { label: "Cobertura minima", value: "1 APE + 1 CIE", tone: "good" },
      ],
    },
  },
  5: {
    title: "N = 5",
    verdict: "Minimo viable",
    verdictTone: "warn",
    baselineAnalysis:
      "Ya aparece una base util para comparar opciones. El rotativo suele leerse mejor porque reparte mejor domingos y carga semanal.",
    fifthSundayNote:
      "Con 5 domingos sigue quedando justo. El analisis de 4 semanas ayuda, pero no reemplaza revisar un mes calendario real.",
    study: {
      status: "Minimo viable",
      statusTone: "warn",
      recommendedLabel: "Rotativo semanal",
      recommendedOptionId: "rotativo",
      summary:
        "El estudio marca aqui el primer caso realmente comparable. El rotativo se recomienda porque reparte mejor la carga y los domingos, pero sigue quedando justo.",
      simulationNote:
        "Si la simulacion editable se rompe, leelo como senal de fragilidad del caso, no como sorpresa: N=5 todavia necesita meses y libres muy bien planificados.",
      bullets: [
        "Base tipica: 3 APE + 2 CIE en una semana, luego 2 APE + 3 CIE.",
        "Tiene margen dominical total, pero en meses de 5 domingos queda exacto.",
        "Sirve para discutir justicia del patron, no para relajarse operativamente.",
      ],
      metrics: [
        { label: "Config. base", value: "3 APE + 2 CIE", tone: "neutral" },
        { label: "Margen dom. APE", value: "6 / 4 (+2)", tone: "good" },
        { label: "Margen dom. CIE", value: "4 / 4 (0)", tone: "warn" },
        { label: "Mes de 5 dom.", value: "CIE: -1", tone: "bad" },
      ],
    },
  },
  6: {
    title: "N = 6",
    verdict: "Solido",
    verdictTone: "good",
    baselineAnalysis:
      "Es el primer punto donde el sistema deja de sentirse fragil y empieza a dar margen real para mover piezas sin romper todo.",
    fifthSundayNote:
      "Tolera mejor meses de 5 domingos, aunque sigue siendo sano revisar ausencias y cambios manuales.",
    study: {
      status: "Primer punto solido",
      statusTone: "good",
      recommendedLabel: "Rotativo semanal",
      recommendedOptionId: "rotativo",
      summary:
        "El documento lo define como el primer minimo operativo realmente recomendable. Tiene margen en ambos tipos de turno y soporta mejor meses de 5 domingos.",
      simulationNote:
        "Ojo: esto no significa que cualquier plantilla mensual sea correcta. El mismo estudio dice 'maximo 6 con planificacion correcta'. Si la simulacion de abajo cae, el problema es la plantilla de libres, no la conclusion general del caso.",
      bullets: [
        "Base del estudio: 3 APE + 3 CIE.",
        "Hay margen +2 en domingos para ambos tipos.",
        "El tope de consecutivos se cumple solo con una planificacion correcta de libres.",
      ],
      metrics: [
        { label: "Config. base", value: "3 APE + 3 CIE", tone: "neutral" },
        { label: "Margen dom. APE", value: "6 / 4 (+2)", tone: "good" },
        { label: "Margen dom. CIE", value: "6 / 4 (+2)", tone: "good" },
        { label: "Max. consecutivos", value: "6 con planif. correcta", tone: "good" },
      ],
    },
  },
  7: {
    title: "N = 7",
    verdict: "Holgura buena",
    verdictTone: "good",
    baselineAnalysis:
      "Ya aparece una capa de aire operativo. Desde aqui es mas facil probar ajustes sin que la cobertura base se rompa de inmediato.",
    fifthSundayNote:
      "Sigue siendo sano validar el mes real, pero la holgura mejora mucho frente a N=4 y N=5.",
    study: {
      status: "Buena holgura",
      statusTone: "good",
      recommendedLabel: "Rotativo semanal",
      recommendedOptionId: "rotativo",
      summary:
        "Desde aqui el estudio muestra aire operativo real. La cobertura deja de romperse con tanta facilidad y se pueden probar ajustes con mas tranquilidad.",
      bullets: [
        "Caso base del estudio: 4 APE + 3 CIE.",
        "Puede absorber mejor ausencias y domingos exigentes.",
        "Sigue conviniendo validar el mes real, pero ya no se siente tan fragil.",
      ],
      metrics: [
        { label: "Config. base", value: "4 APE + 3 CIE", tone: "neutral" },
        { label: "Margen dom. APE", value: "+4", tone: "good" },
        { label: "Margen dom. CIE", value: "+2", tone: "good" },
        { label: "Cobertura minima", value: "3 APE + 2 CIE", tone: "good" },
      ],
    },
  },
  8: {
    title: "N = 8",
    verdict: "Holgura comoda",
    verdictTone: "good",
    baselineAnalysis:
      "La cobertura ya deja de ser la pelea principal y la comparacion se mueve hacia que patron se siente mas justo y entendible.",
    fifthSundayNote:
      "Tiene espalda suficiente para un quinto domingo, pero la distribucion fina igual importa.",
    mixedOutlook:
      "Desde aqui ya vale la pena contrastar con esquemas mixtos usando COM, aunque esa variante aun no esta modelada en esta vista.",
    study: {
      status: "Holgura comoda",
      statusTone: "good",
      recommendedLabel: "Rotativo semanal",
      recommendedOptionId: "rotativo",
      summary:
        "El estudio marca que desde N=8 la pelea ya no es sobrevivir la cobertura, sino comparar que patron se siente mas justo y mas facil de operar.",
      bullets: [
        "Caso base: 4 APE + 4 CIE.",
        "Desde aqui ya se empieza a abrir la conversacion con esquemas mixtos.",
        "La vista actual sigue comparando fijo versus rotativo sobre el baseline APE/CIE.",
      ],
      metrics: [
        { label: "Config. base", value: "4 APE + 4 CIE", tone: "neutral" },
        { label: "Margen dom. APE", value: "+4", tone: "good" },
        { label: "Margen dom. CIE", value: "+4", tone: "good" },
        { label: "Cobertura minima", value: "3 APE + 3 CIE", tone: "good" },
      ],
    },
  },
  9: {
    title: "N = 9",
    verdict: "Zona comoda",
    verdictTone: "good",
    baselineAnalysis:
      "Permite comparar patrones sin que la cobertura base se vuelva el principal cuello de botella.",
    fifthSundayNote:
      "El riesgo de domingo baja mucho, asi que la conversacion se mueve mas hacia equidad y confort del equipo.",
    mixedOutlook:
      "La documentacion recomienda abrir el analisis hacia COM + APE/CIE; esta pantalla deja esa comparacion preparada como siguiente iteracion.",
    study: {
      status: "Zona comoda",
      statusTone: "good",
      recommendedLabel: "Rotativo o mixto",
      recommendedOptionId: "rotativo",
      summary:
        "El estudio ya permite comparar el rotativo contra un futuro esquema mixto con COM. La app aun no dibuja ese mixto, asi que el rotativo es la mejor referencia entre las opciones modeladas.",
      bullets: [
        "Caso base: 5 APE + 4 CIE.",
        "Ya no domina la pelea por cobertura; pesa mas la justicia y el confort.",
        "Es un buen punto para abrir la siguiente iteracion con COM.",
      ],
      metrics: [
        { label: "Config. base", value: "5 APE + 4 CIE", tone: "neutral" },
        { label: "Margen dom. APE", value: "+6", tone: "good" },
        { label: "Margen dom. CIE", value: "+4", tone: "good" },
        { label: "Cobertura minima", value: "4 APE + 3 CIE", tone: "good" },
      ],
    },
  },
  10: {
    title: "N = 10",
    verdict: "Zona de confort",
    verdictTone: "good",
    baselineAnalysis:
      "Es un buen punto para discutir preferencia real de los trabajadores en vez de mera supervivencia operativa.",
    fifthSundayNote:
      "El quinto domingo deja de ser la amenaza principal y el foco pasa a distribucion y claridad del patron.",
    mixedOutlook:
      "Se puede introducir una variante mixta con COM como base, pero aqui mantenemos el terreno comparable APE/CIE.",
    study: {
      status: "Zona de confort",
      statusTone: "good",
      recommendedLabel: "Rotativo o mixto",
      recommendedOptionId: "rotativo",
      summary:
        "Segun el estudio, aqui ya se puede discutir preferencia real del equipo. Entre las opciones hoy visibles, el rotativo sigue siendo la comparacion mas util.",
      bullets: [
        "Caso base: 5 APE + 5 CIE.",
        "Hay flexibilidad dominical amplia.",
        "La siguiente mejora de valor es incorporar COM como tercera alternativa.",
      ],
      metrics: [
        { label: "Config. base", value: "5 APE + 5 CIE", tone: "neutral" },
        { label: "Margen dom.", value: "Flexibilidad alta", tone: "good" },
        { label: "Cobertura minima", value: "4 APE + 4 CIE", tone: "good" },
        { label: "Enfoque", value: "Equidad y claridad", tone: "good" },
      ],
    },
  },
  11: {
    title: "N = 11",
    verdict: "Alta holgura",
    verdictTone: "good",
    baselineAnalysis:
      "La herramienta sirve mas para afinar justicia, orden y facilidad de lectura del patron que para pelear la factibilidad base.",
    fifthSundayNote:
      "El quinto domingo importa mucho menos; lo delicado pasa a ser mantener un patron entendible para el equipo.",
    mixedOutlook:
      "A esta altura el esquema mixto empieza a ser una comparacion natural, aunque aun no lo dibujamos con turno corto complementario.",
    study: {
      status: "Alta holgura",
      statusTone: "good",
      recommendedLabel: "Mixto COM + APE/CIE",
      summary:
        "El documento ya recomienda pasar a un mixto con COM como base. La pantalla actual todavia no modela ese esquema, asi que lo de abajo sirve solo como aproximacion APE/CIE.",
      simulationNote:
        "En N=11, fijo o rotativo siguen siendo utiles como referencia, pero no representan la recomendacion final del estudio.",
      bullets: [
        "Caso base: 6 APE + 5 CIE.",
        "La cobertura deja de ser el problema; manda la claridad del patron.",
        "La mejor continuidad de esta vista es agregar el esquema mixto.",
      ],
      metrics: [
        { label: "Config. base", value: "6 APE + 5 CIE", tone: "neutral" },
        { label: "Margen dom. APE", value: "+8", tone: "good" },
        { label: "Margen dom. CIE", value: "+6", tone: "good" },
        { label: "Recomendacion", value: "Mixto", tone: "good" },
      ],
    },
  },
  12: {
    title: "N = 12",
    verdict: "Maxima holgura del rango",
    verdictTone: "good",
    baselineAnalysis:
      "Es la lectura mas desahogada del rango analizado. Ideal para iterar con calma y decidir que patron prefieren realmente los trabajadores.",
    fifthSundayNote:
      "La validacion mensual sigue siendo sana, pero esta dotacion ya opera con una espalda muy distinta.",
    mixedOutlook:
      "El siguiente salto de valor es comparar este baseline contra un mixto con COM y turno corto de ajuste.",
    study: {
      status: "Maxima holgura del rango",
      statusTone: "good",
      recommendedLabel: "Mixto COM + APE/CIE",
      summary:
        "Es el caso mas desahogado del estudio. La conclusion documentada ya empuja hacia un esquema mixto, porque la cobertura base esta mas que resuelta.",
      simulationNote:
        "La simulacion APE/CIE de abajo sigue siendo valida como referencia, pero no es la recomendacion final del estudio para esta dotacion.",
      bullets: [
        "Caso base: 6 APE + 6 CIE.",
        "Cobertura excelente todos los dias.",
        "El foco pasa a confort, solape y flexibilidad fina.",
      ],
      metrics: [
        { label: "Config. base", value: "6 APE + 6 CIE", tone: "neutral" },
        { label: "Cobertura minima", value: "5 APE + 5 CIE", tone: "good" },
        { label: "Holgura", value: "Muy alta", tone: "good" },
        { label: "Recomendacion", value: "Mixto", tone: "good" },
      ],
    },
  },
};

export function getFactibilityScenarios(): FactibilityScenario[] {
  return Array.from({ length: 9 }, (_, offset) => offset + 4).map((headcount) => ({
    headcount,
    ...SCENARIO_COPY[headcount],
    options: [makeFixedOption(headcount), makeRotativeOption(headcount)].map((option) => ({
      ...option,
      workers: cloneWorkers(option.workers),
    })),
  }));
}
