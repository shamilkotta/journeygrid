import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { journeys } from "@/lib/db/schema";
import { generateId } from "@/lib/utils/id";

// Node type for type-safe node manipulation
type JourneyNodeLike = {
  id: string;
  data?: {
    status?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

// Helper to reset node statuses when duplicating
function resetNodeStatuses(nodes: JourneyNodeLike[]): JourneyNodeLike[] {
  return nodes.map((node) => {
    const newNode: JourneyNodeLike = { ...node, id: nanoid() };
    if (newNode.data) {
      const data = { ...newNode.data };
      // Reset status to not-started
      data.status = "not-started";
      newNode.data = data;
    }
    return newNode;
  });
}

// Edge type for type-safe edge manipulation
type JourneyEdgeLike = {
  id: string;
  source: string;
  target: string;
  [key: string]: unknown;
};

// Helper to update edge references to new node IDs
function updateEdgeReferences(
  edges: JourneyEdgeLike[],
  oldNodes: JourneyNodeLike[],
  newNodes: JourneyNodeLike[]
): JourneyEdgeLike[] {
  // Create mapping from old node IDs to new node IDs
  const idMap = new Map<string, string>();
  oldNodes.forEach((oldNode, index) => {
    idMap.set(oldNode.id, newNodes[index].id);
  });

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

    // Generate new IDs for nodes
    const oldNodes = sourceJourney.nodes as JourneyNodeLike[];
    const newNodes = resetNodeStatuses(oldNodes);
    const newEdges = updateEdgeReferences(
      sourceJourney.edges as JourneyEdgeLike[],
      oldNodes,
      newNodes
    );

    // Count user's journeys to generate unique name
    const userJourneys = await db.query.journeys.findMany({
      where: eq(journeys.userId, session.user.id),
    });

    // Generate a unique name
    const baseName = `${sourceJourney.name} (Copy)`;
    let journeyName = baseName;
    const existingNames = new Set(userJourneys.map((r) => r.name));

    if (existingNames.has(journeyName)) {
      let counter = 2;
      while (existingNames.has(`${baseName} ${counter}`)) {
        counter += 1;
      }
      journeyName = `${baseName} ${counter}`;
    }

    // Create the duplicated journey
    const newJourneyId = generateId();
    const [newJourney] = await db
      .insert(journeys)
      .values({
        id: newJourneyId,
        name: journeyName,
        description: sourceJourney.description,
        nodes: newNodes,
        edges: newEdges,
        userId: session.user.id,
        visibility: "private", // Duplicated journeys are always private
      })
      .returning();

    return NextResponse.json({
      ...newJourney,
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
