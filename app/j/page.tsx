import { nanoid } from "nanoid";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { journeyNodes, journeys } from "@/lib/db/schema";
import { generateId } from "@/lib/utils/id";

function createDefaultMilestoneNode() {
  return {
    id: nanoid(),
    title: "Start",
    icon: null,
    description: "",
    type: "milestone" as const,
    positionX: 0,
    positionY: 0,
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

  // Create journey first
  const [newJourney] = await db
    .insert(journeys)
    .values({
      id: journeyId,
      name: "Untitled Journey",
      userId: session.user.id,
      edges: [],
      journalId: null,
      visibility: "private",
    })
    .returning();

  // Then create the default milestone node
  await db.insert(journeyNodes).values({
    id: node.id,
    journeyId,
    title: node.title,
    icon: node.icon,
    description: node.description,
    type: node.type,
    positionX: node.positionX,
    positionY: node.positionY,
    journalId: null,
  });

  redirect(`/j/${newJourney.id}`);
}
