import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { journeys } from "@/lib/db/schema";

// Helper to strip sensitive data from nodes for public viewing
function sanitizeNodesForPublicView(
  nodes: Record<string, unknown>[]
): Record<string, unknown>[] {
  return nodes.map((node) => {
    const sanitizedNode = { ...node };
    if (
      sanitizedNode.data &&
      typeof sanitizedNode.data === "object" &&
      sanitizedNode.data !== null
    ) {
      const data = { ...(sanitizedNode.data as Record<string, unknown>) };
      sanitizedNode.data = data;
    }
    return sanitizedNode;
  });
}

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

    // For public journeys viewed by non-owners, sanitize sensitive data
    const responseData = {
      ...journey,
      nodes: isOwner
        ? journey.nodes
        : sanitizeNodesForPublicView(
            journey.nodes as Record<string, unknown>[]
          ),
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
function buildUpdateData(body: Record<string, any>): Record<string, unknown> {
  const updateData: Record<string, unknown> = {
    updatedAt: body.updatedAt ? new Date(body.updatedAt) : new Date(),
  };

  if (body.name !== undefined) {
    updateData.name = body.name;
  }
  if (body.description !== undefined) {
    updateData.description = body.description;
  }
  if (body.nodes !== undefined) {
    updateData.nodes = body.nodes;
  }
  if (body.edges !== undefined) {
    updateData.edges = body.edges;
  }
  if (body.visibility !== undefined) {
    updateData.visibility = body.visibility;
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

    const [updatedJourney] = await db
      .update(journeys)
      .set(updateData)
      .where(eq(journeys.id, journeyId))
      .returning();

    console.log({ update: updatedJourney, updateData });

    if (!updatedJourney) {
      return NextResponse.json({ error: "Journey not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...updatedJourney,
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
