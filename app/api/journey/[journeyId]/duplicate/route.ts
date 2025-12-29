import { eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { journals, journeyNodes, journeys } from "@/lib/db/schema";
import { generateId } from "@/lib/utils/id";
import {
  type NodeType,
  transformNodeToReactFlow,
} from "@/lib/utils/node-transforms";

// Node type for type-safe node manipulation
export type JourneyNodeLike = {
  id: string;
  title: string;
  icon: string | null;
  description: string | null;
  type: string;
  positionX: number;
  positionY: number;
  journalId: string | null;
};

// Edge type for type-safe edge manipulation
export type JourneyEdgeLike = {
  id: string;
  source: string;
  target: string;
  [key: string]: unknown;
};

// Helper to generate new IDs for nodes when duplicating
export function duplicateNodesWithIdMapping(
  nodes: JourneyNodeLike[],
  journalIdMap: Map<string, string>
): {
  newNodes: JourneyNodeLike[];
  idMap: Map<string, string>;
} {
  const idMap = new Map<string, string>();
  const newNodes = nodes.map((node) => {
    const newId = nanoid();
    idMap.set(node.id, newId);
    return {
      ...node,
      id: newId,
      journalId: node.journalId
        ? journalIdMap.get(node.journalId) || null
        : null,
    };
  });
  return { newNodes, idMap };
}

// Helper to update edge references to new node IDs
export function updateEdgeReferences(
  edges: JourneyEdgeLike[],
  idMap: Map<string, string>
): JourneyEdgeLike[] {
  return edges.map((edge) => ({
    ...edge,
    id: nanoid(),
    source: idMap.get(edge.source) || edge.source,
    target: idMap.get(edge.target) || edge.target,
  }));
}

export async function POST(
  request: Request,
  context: { params: Promise<{ journeyId: string }> }
) {
  try {
    const { journeyId } = await context.params;
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find the journey to duplicate
    const sourceJourney = await db.query.journeys.findFirst({
      where: eq(journeys.id, journeyId),
    });

    if (!sourceJourney) {
      return NextResponse.json({ error: "Journey not found" }, { status: 404 });
    }

    const isOwner = session.user.id === sourceJourney.userId;

    // If not owner, check if journey is public
    if (!isOwner && sourceJourney.visibility !== "public") {
      return NextResponse.json({ error: "Journey not found" }, { status: 404 });
    }

    // Get source nodes from journeyNodes table
    const sourceNodes = await db.query.journeyNodes.findMany({
      where: eq(journeyNodes.journeyId, journeyId),
    });

    // Collect all unique journal IDs (journey-level + node-level)
    const uniqueJournalIds = new Set<string>();
    if (sourceJourney.journalId) {
      uniqueJournalIds.add(sourceJourney.journalId);
    }
    for (const node of sourceNodes) {
      if (node.journalId) {
        uniqueJournalIds.add(node.journalId);
      }
    }

    // Fetch all journals at once
    const sourceJournals =
      uniqueJournalIds.size > 0
        ? await db.query.journals.findMany({
            where: inArray(journals.id, Array.from(uniqueJournalIds)),
          })
        : [];

    // Bulk insert all new journals
    const journalIdMap = new Map<string, string>();
    if (sourceJournals.length > 0) {
      const newJournals = await db
        .insert(journals)
        .values(
          sourceJournals.map((journal) => ({
            userId: session.user.id,
            content: journal.content,
          }))
        )
        .returning();

      // Build the map from old journal ID to new journal ID
      for (let i = 0; i < sourceJournals.length; i++) {
        journalIdMap.set(sourceJournals[i].id, newJournals[i].id);
      }
    }

    // Get the new journey-level journal ID
    const newJourneyJournalId = sourceJourney.journalId
      ? journalIdMap.get(sourceJourney.journalId) || null
      : null;

    // Generate new IDs for nodes
    const { newNodes, idMap } = duplicateNodesWithIdMapping(
      sourceNodes as JourneyNodeLike[],
      journalIdMap
    );
    const newEdges = updateEdgeReferences(
      sourceJourney.edges as JourneyEdgeLike[],
      idMap
    );

    // Generate a unique name
    const baseName = `${sourceJourney.name} (Copy)`;

    // Create the duplicated journey
    const newJourneyId = generateId();
    const [newJourney] = await db
      .insert(journeys)
      .values({
        id: newJourneyId,
        name: baseName,
        description: sourceJourney.description,
        edges: newEdges,
        journalId: newJourneyJournalId,
        userId: session.user.id,
        visibility: "private", // Duplicated journeys are always private
      })
      .returning();

    // Insert duplicated nodes into journeyNodes table
    // const insertedNodes: JourneyNodeLike[] = [];
    const insertedNodes = await db
      .insert(journeyNodes)
      .values(
        newNodes.map((node) => ({
          ...node,
          journeyId: newJourneyId,
          type: node.type as NodeType,
        }))
      )
      .returning();

    // Transform nodes to ReactFlow format for response
    const responseNodes = insertedNodes.map(transformNodeToReactFlow);

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
      isOwner: true,
    });
  } catch (error) {
    console.error("Failed to duplicate journey:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to duplicate journey",
      },
      { status: 500 }
    );
  }
}
