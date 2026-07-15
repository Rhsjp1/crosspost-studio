// Workaround for Prisma v6 missing type re-exports from @prisma/client
// The generated types live at .prisma/client but @prisma/client/default.js
// has no corresponding .d.ts. This prevents "implicitly has 'any' type" errors.
declare module "@prisma/client" {
  export { PrismaClient } from ".prisma/client";
  export { Prisma } from ".prisma/client";
}
