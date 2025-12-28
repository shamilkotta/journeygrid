import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { type JourneyNodeDB, journeyNodes, journeys } from "@/lib/db/schema";
import { generateId } from "@/lib/utils/id";
import {
  createDefaultMilestoneNode,
  type ReactFlowNodeInput,
  transformNodeToDB,
  transformNodeToReactFlow,
} from "@/lib/utils/node-transforms";

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

    const journeyName = body.name;

    // Use provided ID or generate a new one
    const journeyId = body.id || generateId();

    const [newJourney] = await db
      .insert(journeys)
      .values({
        id: journeyId,
        name: journeyName,
        description: body.description,
        edges: body.edges,
        journalId: body.journalId || null,
        userId: session.user.id,
      })
      .returning();

    const dbNodesToInsert = nodes.map((node: ReactFlowNodeInput) =>
      transformNodeToDB(node, journeyId)
    );

    // Insert all nodes in one query
    await db.insert(journeyNodes).values(dbNodesToInsert);

    // Return the normalized nodes we just persisted (no extra DB round-trip)
    const responseNodes = (dbNodesToInsert as JourneyNodeDB[]).map(
      transformNodeToReactFlow
    );

    return NextResponse.json({
      id: newJourney.id,
      name: newJourney.name,
      description: newJourney.description,
      userId: newJourney.userId,
      edges: newJourney.edges,
      journalId: newJourney.journalId,
      visibility: newJourney.visibility,
      nodes: responseNodes,
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
