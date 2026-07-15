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

  const content1 = await prisma.content.create({
    data: {
      title: "5 Tips for a Cleaner Home This Spring",
      body: "Spring cleaning doesn't have to be overwhelming. Start with one room at a time, declutter first, then deep clean surfaces, floors, and windows. Use natural cleaning solutions for a healthier home environment.",
      topic: "home cleaning tips",
      tags: JSON.stringify(["cleaning", "spring", "tips", "home"]),
      brief: "Quick spring cleaning guide for homeowners",
      tone: "friendly",
      status: "approved",
      contentType: "social_post",
      metaTitle: "5 Tips for a Cleaner Home This Spring | Right Hand Services",
      metaDescription: "Discover easy spring cleaning tips to keep your home spotless all season long.",
      targetKeyword: "spring cleaning tips",
      locationTag: "Troy, NC",
      authorId: admin.id,
    },
  });
  console.log(`✅ Content created: ${content1.title}`);

  const content2 = await prisma.content.create({
    data: {
      title: "Why Professional Handyperson Services Save You Time",
      body: "Hiring a professional handyperson means getting expert repairs done right the first time. From plumbing fixes to drywall patching, skilled professionals bring the right tools and experience to every job.",
      topic: "handyperson benefits",
      tags: JSON.stringify(["handyperson", "repairs", "time-saving", "professional"]),
      brief: "Benefits of hiring professional handyperson services",
      tone: "professional",
      status: "draft",
      contentType: "blog_post",
      metaTitle: "Why Professional Handyperson Services Save You Time",
      metaDescription: "Learn how professional handyperson services can save you time and money on home repairs.",
      targetKeyword: "handyperson services",
      authorId: admin.id,
    },
  });
  console.log(`✅ Content created: ${content2.title}`);

  const scheduledDate1 = new Date();
  scheduledDate1.setDate(scheduledDate1.getDate() + 2);
  scheduledDate1.setHours(10, 0, 0, 0);

  const scheduled1 = await prisma.scheduledPost.create({
    data: {
      contentId: content1.id,
      platform: "facebook",
      scheduledFor: scheduledDate1,
      status: "queued",
      idempotencyKey: `fb-${content1.id}-${Date.now()}`,
      leadCaptureEmail: "leads@righthandservices.com",
    },
  });
  console.log(`✅ Scheduled post created: ${scheduled1.platform} on ${scheduled1.scheduledFor.toISOString()}`);

  const scheduledDate2 = new Date();
  scheduledDate2.setDate(scheduledDate2.getDate() + 5);
  scheduledDate2.setHours(14, 30, 0, 0);

  const scheduled2 = await prisma.scheduledPost.create({
    data: {
      contentId: content1.id,
      platform: "instagram",
      scheduledFor: scheduledDate2,
      status: "queued",
      idempotencyKey: `ig-${content1.id}-${Date.now()}`,
    },
  });
  console.log(`✅ Scheduled post created: ${scheduled2.platform} on ${scheduled2.scheduledFor.toISOString()}`);

  const event1 = await prisma.historyEvent.create({
    data: {
      action: "content_created",
      platform: "facebook",
      contentId: content1.id,
      userId: admin.id,
      details: JSON.stringify({ title: content1.title }),
    },
  });
  console.log(`✅ History event created: ${event1.action}`);

  const event2 = await prisma.historyEvent.create({
    data: {
      action: "content_approved",
      platform: null,
      contentId: content1.id,
      userId: admin.id,
      details: JSON.stringify({ title: content1.title, approvedBy: admin.name }),
    },
  });
  console.log(`✅ History event created: ${event2.action}`);

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
