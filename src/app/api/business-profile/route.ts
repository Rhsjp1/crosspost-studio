import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: fetch business profile (singleton — return first or defaults)
export async function GET() {
  try {
    let profile = await db.businessProfile.findFirst();
    if (!profile) {
      profile = await db.businessProfile.create({ data: {} });
    }
    return NextResponse.json(profile);
  } catch (error) {
    console.error("[business-profile GET]", error);
    return NextResponse.json({ error: "Failed to fetch business profile" }, { status: 500 });
  }
}

// POST: upsert business profile
export async function POST(req: Request) {
  try {
    const body = await req.json();
    let profile = await db.businessProfile.findFirst();

    if (profile) {
      profile = await db.businessProfile.update({
        where: { id: profile.id },
        data: {
          businessName: body.businessName,
          city: body.city,
          state: body.state,
          serviceArea: body.serviceArea,
          services: body.services,
          targetKeywords: body.targetKeywords,
          websiteUrl: body.websiteUrl,
          phone: body.phone,
        },
      });
    } else {
      profile = await db.businessProfile.create({ data: body });
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error("[business-profile POST]", error);
    return NextResponse.json({ error: "Failed to save business profile" }, { status: 500 });
  }
}
