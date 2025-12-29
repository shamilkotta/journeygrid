import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { JourneyData } from "@/lib/api-client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { journeyNodes, journeys } from "@/lib/db/schema";
import { generateId } from "@/lib/utils/id";
import {
  type ReactFlowNodeInput,
  transformNodeToDB,
} from "@/lib/utils/node-transforms";

type SyncNode = ReactFlowNodeInput;

type SyncJourney = {
  id: string;
  name: string;
  description?: string;
  nodes: SyncNode[];
  edges: unknown[];
  journalId?: string | null;
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

async function syncNodes(journeyId: string, nodes: SyncNode[]) {
  // Get existing node IDs
  const existingNodes = await db.query.journeyNodes.findMany({
    where: eq(journeyNodes.journeyId, journeyId),
    columns: { id: true },
  });
  const existingNodeIds = new Set(existingNodes.map((n) => n.id));

  // Get incoming node IDs
  const incomingNodeIds = new Set(nodes.map((n) => n.id));

  // Delete nodes that are no longer present
  const nodesToDelete = [...existingNodeIds].filter(
    (id) => !incomingNodeIds.has(id)
  );
  if (nodesToDelete.length > 0) {
    await db
      .delete(journeyNodes)
      .where(inArray(journeyNodes.id, nodesToDelete));
  }

  // Upsert nodes
  for (const node of nodes) {
    if (existingNodeIds.has(node.id)) {
      // Update existing node
      const dbNode = transformNodeToDB(node, journeyId);
      await db
        .update(journeyNodes)
        .set({
          title: dbNode.title,
          icon: dbNode.icon,
          description: dbNode.description,
          type: dbNode.type,
          positionX: dbNode.positionX,
          positionY: dbNode.positionY,
          journalId: dbNode.journalId,
          updatedAt: new Date(),
        })
        .where(eq(journeyNodes.id, node.id));
    } else {
      // Insert new node
      const dbNode = transformNodeToDB(node, journeyId);
      await db.insert(journeyNodes).values({
        id: dbNode.id,
        journeyId: dbNode.journeyId,
        title: dbNode.title,
        icon: dbNode.icon,
        description: dbNode.description,
        type: dbNode.type,
        positionX: dbNode.positionX,
        positionY: dbNode.positionY,
        journalId: dbNode.journalId,
      });
    }
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
                edges: journey.edges,
                journalId: journey.journalId || null,
                visibility: journey.visibility || "private",
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(journeys.id, journey.id),
                  eq(journeys.userId, session.user.id)
                )
              );

            // Sync nodes
            await syncNodes(journey.id, journey.nodes);
          }
        } else if (journey.userId === session.user.id) {
          // Create new journey
          const journeyId = generateId();
          await db.insert(journeys).values({
            id: journeyId,
            name: journey.name,
            description: journey.description,
            edges: journey.edges,
            journalId: journey.journalId || null,
            visibility: journey.visibility || "private",
            userId: session.user.id,
          });

          // Insert nodes in bulk
          if (journey.nodes.length > 0) {
            const dbNodesToInsert = journey.nodes.map(
              (node: ReactFlowNodeInput) => transformNodeToDB(node, journeyId)
            );
            await db.insert(journeyNodes).values(dbNodesToInsert);
          }
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
