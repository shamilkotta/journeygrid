import { desc, eq } from "drizzle-orm";
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
import { createJourneySchema } from "@/lib/validations/schemas";
import { parseInput, ValidationError } from "@/lib/validations/utils";

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

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedBody = parseInput(createJourneySchema, body);

    // Ensure there's always a milestone node (only add one if nodes array is empty)
    let nodes = validatedBody.nodes;
    if (nodes.length === 0) {
      nodes = [createDefaultMilestoneNode()];
    }

    const journeyName = validatedBody.name;

    // Use provided ID or generate a new one
    const journeyId = validatedBody.id || generateId();

    const [newJourney] = await db
      .insert(journeys)
      .values({
        id: journeyId,
        name: journeyName,
        description: validatedBody.description,
        edges: validatedBody.edges,
        journalId: validatedBody.journalId || null,
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
    if (error instanceof ValidationError) {
      return error.toResponse();
    }
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
