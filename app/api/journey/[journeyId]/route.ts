import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { journeyNodes, journeys } from "@/lib/db/schema";
import {
  type ReactFlowNodeInput,
  transformNodeToDB,
  transformNodeToReactFlow,
} from "@/lib/utils/node-transforms";

export async function GET(
  request: Request,
  context: { params: Promise<{ journeyId: string }> }
) {
  try {
    const { journeyId } = await context.params;
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    // First, try to find the journey
    const journey = await db.query.journeys.findFirst({
      where: eq(journeys.id, journeyId),
    });

    if (!journey) {
      return NextResponse.json({ error: "Journey not found" }, { status: 404 });
    }

    const isOwner = session?.user?.id === journey.userId;

    // If not owner, check if journey is public
    if (!isOwner && journey.visibility !== "public") {
      return NextResponse.json({ error: "Journey not found" }, { status: 404 });
    }

    // Fetch nodes from journeyNodes table
    const nodes = await db.query.journeyNodes.findMany({
      where: eq(journeyNodes.journeyId, journeyId),
    });

    // Transform nodes to ReactFlow format
    const transformedNodes = nodes.map(transformNodeToReactFlow);

    const responseData = {
      id: journey.id,
      name: journey.name,
      description: journey.description,
      userId: journey.userId,
      edges: journey.edges,
      journalId: journey.journalId,
      visibility: journey.visibility,
      nodes: transformedNodes,
      createdAt: journey.createdAt.toISOString(),
      updatedAt: journey.updatedAt.toISOString(),
      isOwner,
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Failed to get journey:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to get journey",
      },
      { status: 500 }
    );
  }
}

// Helper to build update data from request body
function buildUpdateData(
  body: Record<string, unknown>
): Record<string, unknown> {
  const updateData: Record<string, unknown> = {
    updatedAt: body.updatedAt ? new Date(body.updatedAt as string) : new Date(),
  };

  if (body.name !== undefined) {
    updateData.name = body.name;
  }
  if (body.description !== undefined) {
    updateData.description = body.description;
  }
  if (body.edges !== undefined) {
    updateData.edges = body.edges;
  }
  if (body.visibility !== undefined) {
    updateData.visibility = body.visibility;
  }
  if (body.journalId !== undefined) {
    updateData.journalId = body.journalId;
  }

  return updateData;
}

export async function PATCH(
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

    // Verify ownership
    const existingJourney = await db.query.journeys.findFirst({
      where: and(
        eq(journeys.id, journeyId),
        eq(journeys.userId, session.user.id)
      ),
    });

    if (!existingJourney) {
      return NextResponse.json({ error: "Journey not found" }, { status: 404 });
    }

    const body = await request.json();

    // Validate visibility value if provided
    if (
      body.visibility !== undefined &&
      body.visibility !== "private" &&
      body.visibility !== "public"
    ) {
      return NextResponse.json(
        { error: "Invalid visibility value. Must be 'private' or 'public'" },
        { status: 400 }
      );
    }

    const updateData = buildUpdateData(body);
    updateData.userId = session.user.id;

    // Update journey metadata (name, description, edges, visibility, journalId)
    const [updatedJourney] = await db
      .update(journeys)
      .set(updateData)
      .where(eq(journeys.id, journeyId))
      .returning();

    if (!updatedJourney) {
      return NextResponse.json({ error: "Journey not found" }, { status: 404 });
    }

    // Handle nodes update if provided
    if (body.nodes !== undefined && Array.isArray(body.nodes)) {
      // Get existing node IDs
      const existingNodes = await db.query.journeyNodes.findMany({
        where: eq(journeyNodes.journeyId, journeyId),
        columns: { id: true },
      });
      const existingNodeIds = new Set(existingNodes.map((n) => n.id));

      // Get incoming node IDs
      const incomingNodeIds = new Set(
        body.nodes.map((n: { id: string }) => n.id)
      );

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
      for (const node of body.nodes as ReactFlowNodeInput[]) {
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

    // Fetch updated nodes
    const nodes = await db.query.journeyNodes.findMany({
      where: eq(journeyNodes.journeyId, journeyId),
    });
    const transformedNodes = nodes.map(transformNodeToReactFlow);

    return NextResponse.json({
      id: updatedJourney.id,
      name: updatedJourney.name,
      description: updatedJourney.description,
      userId: updatedJourney.userId,
      edges: updatedJourney.edges,
      journalId: updatedJourney.journalId,
      visibility: updatedJourney.visibility,
      nodes: transformedNodes,
      createdAt: updatedJourney.createdAt.toISOString(),
      updatedAt: updatedJourney.updatedAt.toISOString(),
      isOwner: true,
    });
  } catch (error) {
    console.error("Failed to update journey:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update journey",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // Verify ownership
    const existingJourney = await db.query.journeys.findFirst({
      where: and(
        eq(journeys.id, journeyId),
        eq(journeys.userId, session.user.id)
      ),
    });

    if (!existingJourney) {
      return NextResponse.json({ error: "Journey not found" }, { status: 404 });
    }

    await db.delete(journeys).where(eq(journeys.id, journeyId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete journey:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete journey",
      },
      { status: 500 }
    );
  }
}
