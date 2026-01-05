import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { JournalData } from "@/lib/api-client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { journals } from "@/lib/db/schema";
import { generateId } from "@/lib/utils/id";
import { syncJournalsSchema } from "@/lib/validations/schemas";
import { parseInput, ValidationError } from "@/lib/validations/utils";

type SyncResponse = {
  journals: JournalData[];
  errors: { id: string; error: string }[];
};

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedBody = parseInput(syncJournalsSchema, body);

    const response: SyncResponse = {
      journals: [],
      errors: [],
    };

    // Filter to only journals belonging to this user
    const userJournals = validatedBody.journals.filter(
      (j) => j.userId === session.user.id
    );

    if (userJournals.length === 0) {
      return NextResponse.json(response);
    }

    // Get IDs of journals being synced
    const syncIds = userJournals.map((j) => j.id);

    // Check which ones already exist for this user
    const existingJournals = await db
      .select({ id: journals.id, updatedAt: journals.updatedAt })
      .from(journals)
      .where(
        and(eq(journals.userId, session.user.id), inArray(journals.id, syncIds))
      );

    const existingIds = new Set(existingJournals.map((j) => j.id));

    // Process each journal
    for (const journal of userJournals) {
      try {
        if (existingIds.has(journal.id)) {
          // Update existing journal if local version is newer
          const existingJournal = existingJournals.find(
            (j) => j.id === journal.id
          );
          if (
            journal.updatedAt &&
            existingJournal!.updatedAt < new Date(journal.updatedAt)
          ) {
            await db
              .update(journals)
              .set({
                content: journal.content,
                updatedAt: new Date(journal.updatedAt),
              })
              .where(
                and(
                  eq(journals.id, journal.id),
                  eq(journals.userId, session.user.id)
                )
              );
          }
        } else {
          // Create new journal
          await db.insert(journals).values({
            id: journal.id || generateId(),
            userId: session.user.id,
            content: journal.content,
            createdAt: journal.createdAt
              ? new Date(journal.createdAt)
              : undefined,
            updatedAt: journal.updatedAt
              ? new Date(journal.updatedAt)
              : undefined,
          });
        }
      } catch (error) {
        response.errors.push({
          id: journal.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Return all user's journals
    const allJournals = await db
      .select({
        id: journals.id,
        content: journals.content,
        createdAt: journals.createdAt,
        updatedAt: journals.updatedAt,
      })
      .from(journals)
      .where(eq(journals.userId, session.user.id));

    response.journals = allJournals.map((j) => ({
      id: j.id,
      content: j.content,
      createdAt: j.createdAt.toISOString(),
      updatedAt: j.updatedAt.toISOString(),
    }));

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ValidationError) {
      return error.toResponse();
    }
    console.error("Failed to sync journals:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to sync journals",
      },
      { status: 500 }
    );
  }
}
