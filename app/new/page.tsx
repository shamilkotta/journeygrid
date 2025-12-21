import { nanoid } from "nanoid";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { journeys } from "@/lib/db/schema";
import { generateId } from "@/lib/utils/id";

function createDefaultMilestoneNode() {
  return {
    id: nanoid(),
    type: "milestone" as const,
    position: { x: 0, y: 0 },
    data: {
      label: "Start",
      description: "",
      type: "milestone" as const,
      status: "not-started" as const,
    },
  };
}

export default async function NewJourneyPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/");
  }

  const journeyId = generateId();
  const node = createDefaultMilestoneNode();
  const [newJourney] = await db
    .insert(journeys)
    .values({
      id: journeyId,
      name: "Untitled Journey",
      userId: session.user.id,
      nodes: [node],
      edges: [],
      visibility: "private",
    })
    .returning();

  redirect(`/j/${newJourney.id}`);
}
