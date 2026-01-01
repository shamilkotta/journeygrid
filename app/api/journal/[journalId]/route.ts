import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { journals } from "@/lib/db/schema";

export async function GET(
  request: Request,
  context: { params: Promise<{ journalId: string }> }
) {
  try {
    const { journalId } = await context.params;
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const journal = await db.query.journals.findFirst({
      where: and(
        eq(journals.id, journalId),
        eq(journals.userId, session.user.id)
      ),
    });

    if (!journal) {
      return NextResponse.json({ error: "Journal not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: journal.id,
      content: journal.content,
      createdAt: journal.createdAt.toISOString(),
      updatedAt: journal.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Failed to get journal:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to get journal",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ journalId: string }> }
) {
  try {
    const { journalId } = await context.params;
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership
    const existingJournal = await db.query.journals.findFirst({
      where: and(
        eq(journals.id, journalId),
        eq(journals.userId, session.user.id)
      ),
    });

    if (!existingJournal) {
      return NextResponse.json({ error: "Journal not found" }, { status: 404 });
    }

    const body = await request.json();

    const [updatedJournal] = await db
      .update(journals)
      .set({
        content: body.content,
        updatedAt: new Date(),
      })
      .where(eq(journals.id, journalId))
      .returning();

    return NextResponse.json({
      id: updatedJournal.id,
      content: updatedJournal.content,
      createdAt: updatedJournal.createdAt.toISOString(),
      updatedAt: updatedJournal.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Failed to update journal:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update journal",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ journalId: string }> }
) {
  try {
    const { journalId } = await context.params;
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership
    const existingJournal = await db.query.journals.findFirst({
      where: and(
        eq(journals.id, journalId),
        eq(journals.userId, session.user.id)
      ),
    });

    if (!existingJournal) {
      return NextResponse.json({ error: "Journal not found" }, { status: 404 });
    }

    await db.delete(journals).where(eq(journals.id, journalId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete journal:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete journal",
      },
      { status: 500 }
    );
  }
}
