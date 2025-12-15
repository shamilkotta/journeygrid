"use server";

import { headers } from "next/headers";
import { auth } from "./auth";
import { db } from "./db";
import { nanoid } from "nanoid";
import { generateId } from "./utils/id";
import { journeys } from "./db/schema";
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

export const createNewJourney = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  let user = session?.user;
  if (!user) {
    console.log("reached ehre.........");
    const result = await auth.api.signInAnonymous({
      headers: await headers(),
    });
    if (!result?.user) {
      throw new Error("Failed to create journey. Please try again.");
    }
    user = result.user;
  }
  console.log({ user });
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
