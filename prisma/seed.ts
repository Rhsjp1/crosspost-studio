import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  const hashedPassword = await bcrypt.hash("admin12345678", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@local" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@local",
      password: hashedPassword,
      role: "admin",
    },
  });
  console.log(`✅ Admin user created: ${admin.email}`);

  console.log("🎉 Seeding complete!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seed error:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
