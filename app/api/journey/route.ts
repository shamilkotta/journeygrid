import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { journeys } from "@/lib/db/schema";

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json([], { status: 200 });
    }

    const userJourneys = await db
      .select({
        id: journeys.id,
        name: journeys.name,
        updatedAt: journeys.updatedAt,
        createdAt: journeys.createdAt,
      })
      .from(journeys)
      .where(eq(journeys.userId, session.user.id))
      .orderBy(desc(journeys.updatedAt));

    const mappedJourneys = userJourneys.map((journey) => ({
      ...journey,
      createdAt: journey.createdAt.toISOString(),
      updatedAt: journey.updatedAt.toISOString(),
    }));

    return NextResponse.json(mappedJourneys);
  } catch (error) {
    console.error("Failed to get journeys:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get journeys",
      },
      { status: 500 }
    );
  }
}
