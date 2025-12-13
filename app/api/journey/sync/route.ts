import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { journeys } from "@/lib/db/schema";

type SyncJourney = {
  id: string;
  name: string;
  description?: string;
  nodes: unknown[];
  edges: unknown[];
  visibility?: "private" | "public";
  createdAt?: string;
  updatedAt?: string;
};

type SyncRequest = {
  journeys: SyncJourney[];
};

type SyncResponse = {
  created: string[];
  updated: string[];
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
      created: [],
      updated: [],
      errors: [],
    };

    // Get IDs of journeys being synced
    const syncIds = body.journeys.map((r) => r.id);

    // Check which ones already exist for this user
    const existingJourneys = await db
      .select({ id: journeys.id })
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
          response.updated.push(journey.id);
        } else {
          // Create new journey
          await db.insert(journeys).values({
            id: journey.id,
            name: journey.name,
            description: journey.description,
            nodes: journey.nodes,
            edges: journey.edges,
            visibility: journey.visibility || "private",
            userId: session.user.id,
          });
          response.created.push(journey.id);
        }
      } catch (error) {
        response.errors.push({
          id: journey.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

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
