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
  templates: FactibilityWeekday[][]
): FactibilityWorkerTemplate[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index + 1}`,
    label: `${prefix}-${index + 1}`,
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
    ...makeWorkers("APE", "APE", apeCount, ["APE", "APE", "APE", "APE"], apeTemplates),
    ...makeWorkers("CIE", "CIE", cieCount, ["CIE", "CIE", "CIE", "CIE"], cieTemplates),
  ];

  return {
    id: "fijo",
    title: "APE + CIE fijo",
    scheme: "fijo",
    recommended: headcount === 4,
    headline: "Mantiene roles estables durante todo el ciclo de 4 semanas.",
    shortAnalysis:
      headcount === 4
        ? "Es la base mas simple para N=4. Si se toca mal un libre, la fragilidad aparece al tiro."
        : "Da una lectura clara de cobertura y permite comparar la estabilidad contra la opcion rotativa.",
    summaryBullets: [
      "42h exactas por trabajador con 1 libre semanal.",
      "Muestra con claridad la asimetria entre apertura y cierre.",
      "Sirve como baseline para comparar equidad versus simplicidad.",
    ],
    workers,
    roleCountsLabel: `${apeCount} APE + ${cieCount} CIE`,
  };
}

function makeRotativeOption(headcount: number): FactibilityOption {
  const groupACount = Math.ceil(headcount / 2);
  const groupBCount = Math.floor(headcount / 2);
  const groupATemplates = buildGroupOffTemplates(groupACount);
  const groupBTemplates = buildGroupOffTemplates(groupBCount);
  const workers = [
    ...makeWorkers("G1", "Grupo 1", groupACount, ["APE", "CIE", "APE", "CIE"], groupATemplates),
    ...makeWorkers("G2", "Grupo 2", groupBCount, ["CIE", "APE", "CIE", "APE"], groupBTemplates),
  ];

  return {
    id: "rotativo",
    title: "Rotativo semanal A/B",
    scheme: "rotativo",
    recommended: headcount >= 5,
    headline: "Alterna manana y tarde por semana sin cambiar la logica base de cobertura.",
    shortAnalysis:
      headcount === 5
        ? "Es la opcion minima que mejor reparte la carga y ayuda a comparar la equidad del equipo."
        : "Es la mejor base para discutir equidad sin perder la lectura operativa de la cobertura.",
    summaryBullets: [
      "Semana 1/3: Grupo 1 apertura, Grupo 2 cierre.",
      "Semana 2/4: Grupo 1 cierre, Grupo 2 apertura.",
      "Ideal para iterar cambios de libres y ver rapido cuando aparece una racha larga.",
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
      "Es el minimo matematicamente viable. Cubre el dia completo, pero cualquier ausencia o cambio torpe de libre lo deja en rojo.",
    fifthSundayNote:
      "En un mes de 5 domingos queda muy expuesto; esta vista modela 4 semanas y conviene validar el mes real aparte.",
  },
  5: {
    title: "N = 5",
    verdict: "Minimo viable",
    verdictTone: "warn",
    baselineAnalysis:
      "El rotativo aparece como mejor comparador porque mejora equidad y deja una lectura mas honesta de domingos.",
    fifthSundayNote:
      "Con 5 domingos queda justo. El analisis de 4 semanas ayuda, pero no reemplaza la validacion del mes real.",
  },
  6: {
    title: "N = 6",
    verdict: "Solido",
    verdictTone: "good",
    baselineAnalysis:
      "Es el primer punto donde el sistema deja de sentirse fragil y empieza a dar margen real de gestion.",
    fifthSundayNote:
      "Tolera mejor meses de 5 domingos, aunque igual conviene revisar ausencias y cambios manuales.",
  },
  7: {
    title: "N = 7",
    verdict: "Holgura buena",
    verdictTone: "good",
    baselineAnalysis:
      "Ya aparece una capa de aire operativo. La herramienta sirve para probar ajustes sin romper la base tan facil.",
    fifthSundayNote:
      "Sigue siendo sano validar el mes real, pero la holgura mejora mucho frente a N=4 y N=5.",
  },
  8: {
    title: "N = 8",
    verdict: "Holgura comoda",
    verdictTone: "good",
    baselineAnalysis:
      "Cobertura alta y comparacion interesante entre estabilidad fija y reparto equitativo de la rotacion.",
    fifthSundayNote:
      "Tiene espalda suficiente para un quinto domingo, pero la distribucion fina igual importa.",
    mixedOutlook:
      "Desde aqui ya vale la pena contrastar con esquemas mixtos usando COM, aunque esa variante aun no esta modelada en esta vista.",
  },
  9: {
    title: "N = 9",
    verdict: "Zona comoda",
    verdictTone: "good",
    baselineAnalysis:
      "Permite comparar patrones sin que la cobertura base se vuelva el cuello de botella principal.",
    fifthSundayNote:
      "El riesgo de domingo baja mucho, asi que la conversacion se mueve mas hacia equidad y confort del equipo.",
    mixedOutlook:
      "La documentacion recomienda abrir el analisis hacia COM + APE/CIE; esta pantalla deja esa comparacion preparada como siguiente iteracion.",
  },
  10: {
    title: "N = 10",
    verdict: "Zona de confort",
    verdictTone: "good",
    baselineAnalysis:
      "Es un buen punto para discutir preferencia de los trabajadores en vez de mera supervivencia operativa.",
    fifthSundayNote:
      "El quinto domingo deja de ser la amenaza principal y el foco pasa a distribucion y claridad del patron.",
    mixedOutlook:
      "Se puede introducir una variante mixta con COM como base, pero aqui mantenemos el terreno comparable APE/CIE.",
  },
  11: {
    title: "N = 11",
    verdict: "Alta holgura",
    verdictTone: "good",
    baselineAnalysis:
      "La herramienta sirve mas para afinar justicia, orden y lectura del patron que para pelear la factibilidad base.",
    fifthSundayNote:
      "El quinto domingo importa mucho menos; lo delicado pasa a ser mantener un patron entendible para el equipo.",
    mixedOutlook:
      "A esta altura el esquema mixto empieza a ser una comparacion natural, aunque aun no lo dibujamos con turno corto complementario.",
  },
  12: {
    title: "N = 12",
    verdict: "Maxima holgura del rango",
    verdictTone: "good",
    baselineAnalysis:
      "Es la lectura mas desahogada del rango analizado. Ideal para iterar y decidir que patron prefieren realmente los trabajadores.",
    fifthSundayNote:
      "La validacion mensual sigue siendo sana, pero esta dotacion ya opera con una espalda muy distinta.",
    mixedOutlook:
      "El siguiente salto de valor es comparar este baseline contra un mixto con COM y turno corto de ajuste.",
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
