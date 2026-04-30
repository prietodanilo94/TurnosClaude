const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

function fix(name) {
  return name.replace(/\blocal\b/gi, "").replace(/\bseminuevos\b/gi, "Usados").replace(/\s+/g, " ").trim();
}

p.branch.findMany({ select: { id: true, nombre: true } }).then(async (branches) => {
  for (const b of branches) {
    const n = fix(b.nombre);
    if (n !== b.nombre) await p.branch.update({ where: { id: b.id }, data: { nombre: n } });
  }
  await p.$disconnect();
});
