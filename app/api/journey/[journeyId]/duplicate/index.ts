"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { journeys } from "@/lib/db/schema";
import { generateId } from "@/lib/utils/id";
import {
  type JourneyEdgeLike,
  type JourneyNodeLike,
  resetNodeStatuses,
  updateEdgeReferences,
} from "./route";

export const duplicateJourney = async (journeyId: string) => {
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

  // Find the journey to duplicate
  const sourceJourney = await db.query.journeys.findFirst({
    where: eq(journeys.id, journeyId),
  });

  if (!sourceJourney) {
    throw new Error("Journey not found");
  }

  const isOwner = user.id === sourceJourney.userId;

  // If not owner, check if journey is public
  if (!isOwner && sourceJourney.visibility !== "public") {
    throw new Error("Journey not found");
  }

  // Generate new IDs for nodes
  const oldNodes = sourceJourney.nodes as JourneyNodeLike[];
  const newNodes = resetNodeStatuses(oldNodes);
  const newEdges = updateEdgeReferences(
    sourceJourney.edges as JourneyEdgeLike[],
    oldNodes,
    newNodes
  );

  // Generate a unique name
  const baseName = `${sourceJourney.name} (Copy)`;

  // Create the duplicated journey
  const newJourneyId = generateId();
  const [newJourney] = await db
    .insert(journeys)
    .values({
      id: newJourneyId,
      name: baseName,
      description: sourceJourney.description,
      nodes: newNodes,
      edges: newEdges,
      userId: user.id,
      visibility: "private",
    })
    .returning();

  redirect(`/j/${newJourney.id}`);
};
