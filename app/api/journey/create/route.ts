import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { journeys } from "@/lib/db/schema";
import { generateId } from "@/lib/utils/id";

// Helper function to create a default milestone node
function createDefaultMilestoneNode() {
  return {
    id: nanoid(),
    type: "milestone" as const,
    position: { x: 0, y: 0 },
    data: {
      label: "Start",
      description: "",
      type: "milestone" as const,
      status: "not-started" as const,
    },
  };
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

    if (!(body.name && body.nodes && body.edges)) {
      return NextResponse.json(
        { error: "Name, nodes, and edges are required" },
        { status: 400 }
      );
    }

    // Ensure there's always a milestone node (only add one if nodes array is empty)
    let nodes = body.nodes;
    if (nodes.length === 0) {
      nodes = [createDefaultMilestoneNode()];
    }

    // Generate "Untitled N" name if the provided name is "Untitled Journey"
    let journeyName = body.name;
    if (body.name === "Untitled Journey" || body.name === "Untitled Workflow") {
      const userJourneys = await db.query.journeys.findMany({
        where: eq(journeys.userId, session.user.id),
      });
      const count = userJourneys.length + 1;
      journeyName = `Untitled ${count}`;
    }

    // Use provided ID or generate a new one
    const journeyId = body.id || generateId();

    const [newJourney] = await db
      .insert(journeys)
      .values({
        id: journeyId,
        name: journeyName,
        description: body.description,
        nodes,
        edges: body.edges,
        userId: session.user.id,
      })
      .returning();

    return NextResponse.json({
      ...newJourney,
      createdAt: newJourney.createdAt.toISOString(),
      updatedAt: newJourney.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Failed to create journey:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create journey",
      },
      { status: 500 }
    );
  }
}
