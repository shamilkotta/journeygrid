import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { journals, journeys } from "@/lib/db/schema";
import { createJournalSchema } from "@/lib/validations/schemas";
import { parseInput, ValidationError } from "@/lib/validations/utils";

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedBody = parseInput(createJournalSchema, body);

    const journey = await db.query.journeys.findFirst({
      where: and(
        eq(journeys.userId, session.user.id),
        eq(journeys.id, validatedBody.journeyId)
      ),
    });
    if (!journey) {
      return NextResponse.json({ error: "Journey not found" }, { status: 404 });
    }

    const [journal] = await db
      .insert(journals)
      .values({
        userId: session.user.id,
        content: validatedBody.content,
      })
      .returning();

    return NextResponse.json({
      id: journal.id,
      content: journal.content,
      createdAt: journal.createdAt.toISOString(),
      updatedAt: journal.updatedAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return error.toResponse();
    }
    console.error("Failed to create journal:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create journal",
      },
      { status: 500 }
    );
  }
}
