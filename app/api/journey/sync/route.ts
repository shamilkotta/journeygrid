import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { JourneyData } from "@/lib/api-client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { journeys } from "@/lib/db/schema";
import { generateId } from "@/lib/utils/id";

type SyncJourney = {
  id: string;
  name: string;
  description?: string;
  nodes: unknown[];
  edges: unknown[];
  visibility?: "private" | "public";
  createdAt?: string;
  updatedAt?: string;
  userId?: string;
};

type SyncRequest = {
  journeys: SyncJourney[];
};

type SyncResponse = {
  journeys: Partial<JourneyData>[];
  errors: { id: string; error: string }[];
};

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as SyncRequest;

    if (!(body.journeys && Array.isArray(body.journeys))) {
      return NextResponse.json(
        { error: "journeys array is required" },
        { status: 400 }
      );
    }

    const response: SyncResponse = {
      journeys: [],
      errors: [],
    };

    // Get IDs of journeys being synced
    const syncIds = body.journeys.map((r) => r.id);

    // Check which ones already exist for this user
    const existingJourneys = await db
      .select({ id: journeys.id, updatedAt: journeys.updatedAt })
      .from(journeys)
      .where(
        and(eq(journeys.userId, session.user.id), inArray(journeys.id, syncIds))
      );

    const existingIds = new Set(existingJourneys.map((r) => r.id));

    // Process each journey
    for (const journey of body.journeys) {
      try {
        if (existingIds.has(journey.id)) {
          // Update existing journey
          const updatedJourney = existingJourneys.find(
            (r) => r.id === journey.id
          );
          if (
            journey.updatedAt &&
            updatedJourney!.updatedAt < new Date(journey.updatedAt!)
          ) {
            await db
              .update(journeys)
              .set({
                name: journey.name,
                description: journey.description,
                nodes: journey.nodes,
                edges: journey.edges,
                visibility: journey.visibility || "private",
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(journeys.id, journey.id),
                  eq(journeys.userId, session.user.id)
                )
              );
          }
        } else if (journey.userId == session.user.id) {
          // Create new journey
          await db.insert(journeys).values({
            id: generateId(),
            name: journey.name,
            description: journey.description,
            nodes: journey.nodes,
            edges: journey.edges,
            visibility: journey.visibility || "private",
            userId: session.user.id,
          });
        }
      } catch (error) {
        response.errors.push({
          id: journey.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const allJourneys = await db
      .select({
        id: journeys.id,
        name: journeys.name,
        createdAt: journeys.createdAt,
        updatedAt: journeys.updatedAt,
      })
      .from(journeys)
      .where(eq(journeys.userId, session.user.id));

    response.journeys = allJourneys.map((r) => ({
      id: r.id,
      name: r.name,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to sync journeys:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to sync journeys",
      },
      { status: 500 }
    );
  }
}
