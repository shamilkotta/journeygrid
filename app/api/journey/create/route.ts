import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { type JourneyNodeDB, journeyNodes, journeys } from "@/lib/db/schema";
import { generateId } from "@/lib/utils/id";

type NodeType = "goal" | "task" | "milestone" | "add";

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
    },
  };
}

// Transform ReactFlow node to DB format
function transformNodeToDB(
  node: {
    id: string;
    position: { x: number; y: number };
    data: {
      label?: string;
      description?: string;
      icon?: string;
      type?: string;
      journalId?: string;
    };
  },
  journeyId: string
) {
  const nodeType = (node.data.type || "goal") as NodeType;
  return {
    id: node.id,
    journeyId,
    title: node.data.label || "Untitled",
    icon: node.data.icon || null,
    description: node.data.description || null,
    type: nodeType,
    positionX: node.position.x,
    positionY: node.position.y,
    journalId: node.data.journalId || null,
  };
}

// Transform DB node to ReactFlow format
function transformNodeToReactFlow(dbNode: {
  id: string;
  title: string;
  icon: string | null;
  description: string | null;
  type: string;
  positionX: number;
  positionY: number;
  journalId: string | null;
}) {
  return {
    id: dbNode.id,
    type: "default",
    position: { x: dbNode.positionX, y: dbNode.positionY },
    data: {
      label: dbNode.title,
      description: dbNode.description,
      icon: dbNode.icon,
      type: dbNode.type,
      journalId: dbNode.journalId,
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

    const journeyName = body.name;

    // Use provided ID or generate a new one
    const journeyId = body.id || generateId();

    // Create the journey first (without nodes)
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

    // Insert nodes into journeyNodes table
    const insertedNodes: JourneyNodeDB[] = [];
    for (const node of nodes) {
      const dbNode = transformNodeToDB(node, journeyId);
      const [inserted] = await db
        .insert(journeyNodes)
        .values({
          id: dbNode.id,
          journeyId: dbNode.journeyId,
          title: dbNode.title,
          icon: dbNode.icon,
          description: dbNode.description,
          type: dbNode.type,
          positionX: dbNode.positionX,
          positionY: dbNode.positionY,
          journalId: dbNode.journalId,
        })
        .returning();
      insertedNodes.push(inserted);
    }

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
