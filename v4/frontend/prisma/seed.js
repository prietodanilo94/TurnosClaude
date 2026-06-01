// Run with: node prisma/seed.js
// Upserts all built-in shift patterns into the ShiftPattern table.
// Safe to run multiple times (idempotent).

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const t = (start, end) => ({ start, end });
const L = null;

const patterns = [
  {
    id: "ventas_standalone",
    label: "Standalone",
    areaNegocio: "ventas",
    rotation: [
      [t("09:00","18:30"), t("09:00","18:30"), t("09:00","18:30"), t("09:00","18:30"), t("09:00","18:00"), L, L],
      [t("10:30","19:00"), t("10:30","19:00"), t("10:30","19:00"), t("10:30","19:00"), t("10:30","19:00"), t("10:00","14:30"), L],
    ],
    hours: [42, 42],
  },
  {
    id: "optimo_autoplaza",
    label: "Autoplaza",
    areaNegocio: "ventas",
    rotation: [
      [t("10:30","19:30"), L, t("10:30","20:30"), t("10:30","20:30"), t("10:30","20:30"), t("10:30","18:30"), L],
      [t("12:30","20:30"), t("13:30","20:30"), t("12:30","20:30"), L, t("13:00","21:00"), t("13:00","21:00"), t("11:00","20:00")],
      [t("10:30","20:30"), t("10:30","20:30"), L, t("10:30","20:30"), t("10:30","20:30"), L, L],
      [t("11:30","20:30"), t("13:30","20:30"), t("13:30","20:30"), t("13:30","20:30"), L, t("10:30","19:30"), t("11:00","20:00")],
    ],
    hours: [42, 42, 36, 42],
  },
  {
    id: "optimo_arauco_maipu",
    label: "Arauco Maipú",
    areaNegocio: "ventas",
    rotation: [
      [t("10:00","19:00"), L, t("10:00","20:00"), t("10:00","20:00"), t("10:00","20:00"), t("10:00","18:00"), L],
      [t("12:00","20:00"), t("13:00","20:00"), t("13:00","20:00"), L, t("13:00","21:00"), t("13:00","21:00"), t("10:30","20:30")],
      [t("10:00","20:00"), t("10:00","20:00"), L, t("10:00","20:00"), t("10:00","20:00"), L, L],
      [t("12:30","20:30"), t("13:30","20:30"), t("13:30","20:30"), t("13:30","20:30"), L, t("10:00","19:00"), t("10:30","20:30")],
    ],
    hours: [42, 42, 36, 42],
  },
  {
    id: "optimo_movicenter",
    label: "Movicenter",
    areaNegocio: "ventas",
    rotation: [
      [t("10:00","19:00"), L, t("10:00","20:00"), t("10:00","20:00"), t("10:00","20:00"), t("10:00","18:00"), L],
      [t("10:00","18:00"), t("12:00","20:00"), t("12:00","20:00"), L, t("12:00","20:00"), t("12:00","20:00"), t("12:00","20:00")],
      [t("10:00","20:00"), t("10:00","20:00"), L, t("10:00","20:00"), t("10:00","20:00"), L, L],
      [t("10:00","18:00"), t("10:00","17:00"), t("10:00","17:00"), t("10:00","17:00"), L, t("10:00","19:00"), t("10:00","20:00")],
    ],
    hours: [42, 42, 36, 42],
  },
  {
    id: "optimo_autopark",
    label: "Autopark",
    areaNegocio: "ventas",
    rotation: [
      [L, t("09:30","19:00"), t("09:30","19:00"), t("09:30","19:00"), t("09:30","19:00"), t("10:00","19:00"), L],
      [t("09:30","19:00"), t("09:30","19:00"), t("09:30","19:00"), L, t("09:30","19:00"), t("10:00","19:00"), L],
    ],
    hours: [42, 42],
  },
  {
    id: "ventas_geely_oeste",
    label: "Geely Oeste",
    areaNegocio: "ventas",
    rotation: [
      [t("10:00","18:00"), t("10:00","18:00"), t("10:00","18:00"), L, t("10:00","18:00"), t("10:00","18:00"), t("11:00","19:00")],
      [t("10:00","20:00"), L, t("10:00","20:00"), t("10:00","20:00"), t("10:00","20:00"), L, L],
    ],
    hours: [42, 36],
  },
  {
    id: "ventas_usados_oeste",
    label: "Usados Oeste",
    areaNegocio: "ventas",
    rotation: [
      [t("10:00","20:00"), t("10:00","20:00"), L, L, t("10:00","19:00"), t("11:00","20:00"), t("10:00","19:00")],
      [t("10:00","19:00"), L, t("10:30","20:00"), t("10:30","20:00"), t("10:30","19:00"), t("10:00","19:00"), L],
    ],
    hours: [42, 42],
  },
  {
    id: "ventas_kia_oeste",
    label: "KIA Oeste",
    areaNegocio: "ventas",
    rotation: [
      [t("13:00","20:00"), t("10:00","20:00"), L, L, t("10:00","20:00"), t("10:00","20:00"), t("10:00","20:00")],
      [t("10:00","17:00"), L, t("10:30","20:00"), t("10:30","20:00"), t("10:30","20:00"), t("10:30","20:00"), L],
    ],
    hours: [42, 42],
  },
  {
    id: "ventas_dfsk_oeste",
    label: "DFSK Oeste",
    areaNegocio: "ventas",
    rotation: [
      [t("10:00","20:00"), L, t("10:00","20:00"), t("10:00","20:00"), t("10:00","20:00"), L, L],
      [t("10:00","18:00"), t("10:00","18:00"), t("10:00","18:00"), L, t("10:00","16:00"), t("10:30","19:30"), t("11:30","19:30")],
    ],
    hours: [36, 42],
  },
  {
    id: "ventas_dfsk_oeste2",
    label: "DFSK Oeste 2",
    areaNegocio: "ventas",
    rotation: [
      [t("10:00","20:00"), L, t("10:00","20:00"), t("10:00","20:00"), t("10:00","20:00"), L, L],
      [t("10:00","18:00"), t("12:00","20:00"), t("10:00","18:00"), L, t("10:00","16:00"), t("10:30","19:30"), t("11:30","19:30")],
    ],
    hours: [36, 42],
  },
  {
    id: "postventa_vista_hermosa",
    label: "Postventa Vista Hermosa",
    areaNegocio: "postventa",
    rotation: [
      [t("08:30","17:30"), t("08:30","17:30"), t("08:30","18:30"), t("08:30","18:30"), t("08:30","17:30"), L, L],
    ],
    hours: [42],
  },
  {
    id: "postventa_standalone",
    label: "Postventa Standalone",
    areaNegocio: "postventa",
    rotation: [
      [t("08:30","18:00"), t("08:30","18:00"), t("08:30","18:00"), t("08:30","18:00"), t("08:30","17:30"), L, L],
      [t("08:30","17:00"), t("08:30","17:00"), t("08:30","17:00"), t("08:30","17:00"), t("08:30","16:30"), t("09:00","14:00"), L],
    ],
    hours: [42, 42],
  },
  {
    id: "postventa_cap",
    label: "Postventa CAP",
    areaNegocio: "postventa",
    rotation: [
      [t("08:30","18:00"), t("08:30","18:00"), t("08:30","18:00"), t("08:30","18:00"), t("08:30","17:30"), L, L],
      [t("08:30","17:00"), t("08:30","17:00"), t("08:30","17:00"), t("08:30","17:00"), t("08:30","16:30"), t("09:00","14:00"), L],
    ],
    hours: [42, 42],
  },
  {
    id: "postventa_mall_mqt",
    label: "Postventa Mall (Movicenter / Tobalaba / Quilín)",
    areaNegocio: "postventa",
    rotation: [
      [t("08:30","18:00"), t("08:30","18:00"), t("08:30","18:00"), t("08:30","18:00"), t("08:30","17:30"), L, L],
      [t("08:30","17:00"), t("08:30","17:00"), t("08:30","17:00"), t("08:30","17:00"), t("08:30","16:30"), t("09:00","14:00"), L],
    ],
    hours: [42, 42],
  },
  {
    id: "postventa_mall_oeste",
    label: "Postventa Mall Plaza Oeste",
    areaNegocio: "postventa",
    rotation: [
      [t("08:00","17:30"), t("08:00","17:30"), t("08:00","17:30"), t("08:00","17:30"), t("08:00","17:00"), L, L],
      [t("08:00","16:30"), t("08:00","16:30"), t("08:00","16:30"), t("08:00","16:30"), t("08:00","16:00"), t("09:00","14:00"), L],
    ],
    hours: [42, 42],
  },
];

async function main() {
  const base = new Date("2026-01-01T00:00:00Z");
  for (let i = 0; i < patterns.length; i++) {
    const p = patterns[i];
    await prisma.shiftPattern.upsert({
      where: { id: p.id },
      update: {
        label: p.label,
        areaNegocio: p.areaNegocio,
        rotationJson: JSON.stringify(p.rotation),
        weeklyHoursJson: JSON.stringify(p.hours),
      },
      create: {
        id: p.id,
        label: p.label,
        areaNegocio: p.areaNegocio,
        rotationJson: JSON.stringify(p.rotation),
        weeklyHoursJson: JSON.stringify(p.hours),
        createdAt: new Date(base.getTime() + i * 1000),
      },
    });
    console.log(`  ✓ ${p.id}`);
  }
  console.log(`\nSeeded ${patterns.length} patterns.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
