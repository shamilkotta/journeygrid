import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { journeys } from "@/lib/db/schema";
import { generateId } from "@/lib/utils/id";

const CURRENT_JOURNEY_NAME = "~~__CURRENT__~~";

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [currentJourney] = await db
      .select()
      .from(journeys)
      .where(
        and(
          eq(journeys.name, CURRENT_JOURNEY_NAME),
          eq(journeys.userId, session.user.id)
        )
      )
      .orderBy(desc(journeys.updatedAt))
      .limit(1);

    if (!currentJourney) {
      // Return empty journey if no current state exists
      return NextResponse.json({
        nodes: [],
        edges: [],
      });
    }

    return NextResponse.json({
      id: currentJourney.id,
      nodes: currentJourney.nodes,
      edges: currentJourney.edges,
    });
  } catch (error) {
    console.error("Failed to get current journey:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to get current journey",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { nodes, edges } = body;

    if (!(nodes && edges)) {
      return NextResponse.json(
        { error: "Nodes and edges are required" },
        { status: 400 }
      );
    }

    // Check if current journey exists
    const [existingJourney] = await db
      .select()
      .from(journeys)
      .where(
        and(
          eq(journeys.name, CURRENT_JOURNEY_NAME),
          eq(journeys.userId, session.user.id)
        )
      )
      .limit(1);

    if (existingJourney) {
      // Update existing current journey
      const [updatedJourney] = await db
        .update(journeys)
        .set({
          nodes,
          edges,
          updatedAt: new Date(),
        })
        .where(eq(journeys.id, existingJourney.id))
        .returning();

      return NextResponse.json({
        id: updatedJourney.id,
        nodes: updatedJourney.nodes,
        edges: updatedJourney.edges,
      });
    }

    // Create new current journey
    const journeyId = generateId();

    const [savedJourney] = await db
      .insert(journeys)
      .values({
        id: journeyId,
        name: CURRENT_JOURNEY_NAME,
        description: "Auto-saved current journey",
        nodes,
        edges,
        userId: session.user.id,
      })
      .returning();

    return NextResponse.json({
      id: savedJourney.id,
      nodes: savedJourney.nodes,
      edges: savedJourney.edges,
    });
  } catch (error) {
    console.error("Failed to save current journey:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save current journey",
      },
      { status: 500 }
    );
  }
}
