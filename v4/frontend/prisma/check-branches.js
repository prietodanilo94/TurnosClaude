const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient({ datasources: { db: { url: "file:./prisma/dev.db" } } });
p.branch.findMany({ select: { nombre: true } }).then((bs) => {
  bs.forEach((b) => console.log(b.nombre));
  p.$disconnect();
});
