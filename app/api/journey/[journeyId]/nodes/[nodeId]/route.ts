import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { journeyNodes, journeys } from "@/lib/db/schema";
import {
  type NodeType,
  transformNodeToReactFlow,
} from "@/lib/utils/node-transforms";

export async function GET(
  request: Request,
  context: { params: Promise<{ journeyId: string; nodeId: string }> }
) {
  try {
    const { journeyId, nodeId } = await context.params;
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    // Verify journey exists and user has access
    const journey = await db.query.journeys.findFirst({
      where: eq(journeys.id, journeyId),
    });

    if (!journey) {
      return NextResponse.json({ error: "Journey not found" }, { status: 404 });
    }

    const isOwner = session?.user?.id === journey.userId;
    if (!isOwner && journey.visibility !== "public") {
      return NextResponse.json({ error: "Journey not found" }, { status: 404 });
    }

    const node = await db.query.journeyNodes.findFirst({
      where: and(
        eq(journeyNodes.id, nodeId),
        eq(journeyNodes.journeyId, journeyId)
      ),
    });

    if (!node) {
      return NextResponse.json({ error: "Node not found" }, { status: 404 });
    }

    return NextResponse.json(transformNodeToReactFlow(node));
  } catch (error) {
    console.error("Failed to get node:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get node" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ journeyId: string; nodeId: string }> }
) {
  try {
    const { journeyId, nodeId } = await context.params;
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership of journey
    const journey = await db.query.journeys.findFirst({
      where: and(
        eq(journeys.id, journeyId),
        eq(journeys.userId, session.user.id)
      ),
    });

    if (!journey) {
      return NextResponse.json({ error: "Journey not found" }, { status: 404 });
    }

    // Verify node exists
    const existingNode = await db.query.journeyNodes.findFirst({
      where: and(
        eq(journeyNodes.id, nodeId),
        eq(journeyNodes.journeyId, journeyId)
      ),
    });

    if (!existingNode) {
      return NextResponse.json({ error: "Node not found" }, { status: 404 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.title !== undefined) {
      updateData.title = body.title;
    }
    if (body.icon !== undefined) {
      updateData.icon = body.icon;
    }
    if (body.description !== undefined) {
      updateData.description = body.description;
    }
    if (body.type !== undefined) {
      updateData.type = body.type as NodeType;
    }
    if (body.positionX !== undefined) {
      updateData.positionX = body.positionX;
    }
    if (body.positionY !== undefined) {
      updateData.positionY = body.positionY;
    }
    if (body.journalId !== undefined) {
      updateData.journalId = body.journalId;
    }

    const [updatedNode] = await db
      .update(journeyNodes)
      .set(updateData)
      .where(eq(journeyNodes.id, nodeId))
      .returning();

    return NextResponse.json(transformNodeToReactFlow(updatedNode));
  } catch (error) {
    console.error("Failed to update node:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update node",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ journeyId: string; nodeId: string }> }
) {
  try {
    const { journeyId, nodeId } = await context.params;
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership of journey
    const journey = await db.query.journeys.findFirst({
      where: and(
        eq(journeys.id, journeyId),
        eq(journeys.userId, session.user.id)
      ),
    });

    if (!journey) {
      return NextResponse.json({ error: "Journey not found" }, { status: 404 });
    }

    // Verify node exists
    const existingNode = await db.query.journeyNodes.findFirst({
      where: and(
        eq(journeyNodes.id, nodeId),
        eq(journeyNodes.journeyId, journeyId)
      ),
    });

    if (!existingNode) {
      return NextResponse.json({ error: "Node not found" }, { status: 404 });
    }

    await db.delete(journeyNodes).where(eq(journeyNodes.id, nodeId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete node:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to delete node",
      },
      { status: 500 }
    );
  }
}
