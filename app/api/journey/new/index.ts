"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { nanoid } from "nanoid";
import { generateId } from "@/lib/utils/id";
import { journeys } from "@/lib/db/schema";
import { redirect } from "next/navigation";

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

export const newJourney = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  let user = session?.user;
  if (!user) {
    const result = await auth.api.signInAnonymous({
      headers: await headers(),
    });
    if (!result?.user) {
      throw new Error("Failed to create journey. Please try again.");
    }
    user = result.user;
  }
  const node = createDefaultMilestoneNode();
  const journeyId = generateId();
  const [newJourney] = await db
    .insert(journeys)
    .values({
      id: journeyId,
      name: "Untitled Journey",
      userId: user.id,
      nodes: [node],
      edges: [],
      visibility: "private",
    })
    .returning();

  redirect(`/j/${newJourney.id}`);
};
