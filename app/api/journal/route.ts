import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { journals, journeys } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const journey = await db.query.journeys.findFirst({
    where: and(
      eq(journeys.userId, session.user.id),
      eq(journeys.id, body.journeyId)
    ),
  });
  if (!journey) {
    return NextResponse.json({ error: "Journey not found" }, { status: 404 });
  }

  const [journal] = await db
    .insert(journals)
    .values({
      userId: session.user.id,
      content: body.content,
    })
    .returning();

  return NextResponse.json({
    id: journal.id,
    content: journal.content,
    createdAt: journal.createdAt.toISOString(),
    updatedAt: journal.updatedAt.toISOString(),
  });
}
