"use server";

import { eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { journals, journeyNodes, journeys } from "@/lib/db/schema";
import { generateId } from "@/lib/utils/id";
import {
  duplicateNodesWithIdMapping,
  type JourneyEdgeLike,
  type JourneyNodeLike,
  updateEdgeReferences,
} from "./route";

type NodeType = "goal" | "task" | "milestone" | "add";

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

  // Get source nodes from journeyNodes table
  const sourceNodes = await db.query.journeyNodes.findMany({
    where: eq(journeyNodes.journeyId, journeyId),
  });

  // Collect all unique journal IDs (journey-level + node-level)
  const uniqueJournalIds = new Set<string>();
  if (sourceJourney.journalId) {
    uniqueJournalIds.add(sourceJourney.journalId);
  }
  for (const node of sourceNodes) {
    if (node.journalId) {
      uniqueJournalIds.add(node.journalId);
    }
  }

  // Fetch all journals at once
  const sourceJournals =
    uniqueJournalIds.size > 0
      ? await db.query.journals.findMany({
          where: inArray(journals.id, Array.from(uniqueJournalIds)),
        })
      : [];

  // Bulk insert all new journals
  const journalIdMap = new Map<string, string>();
  if (sourceJournals.length > 0) {
    const userId = user.id;
    const newJournals = await db
      .insert(journals)
      .values(
        sourceJournals.map((journal) => ({
          userId,
          content: journal.content,
        }))
      )
      .returning();

    // Build the map from old journal ID to new journal ID
    for (let i = 0; i < sourceJournals.length; i++) {
      journalIdMap.set(sourceJournals[i].id, newJournals[i].id);
    }
  }

  // Get the new journey-level journal ID
  const newJourneyJournalId = sourceJourney.journalId
    ? journalIdMap.get(sourceJourney.journalId) || null
    : null;

  // Generate new IDs for nodes
  const { newNodes, idMap } = duplicateNodesWithIdMapping(
    sourceNodes as JourneyNodeLike[],
    journalIdMap
  );
  const newEdges = updateEdgeReferences(
    sourceJourney.edges as JourneyEdgeLike[],
    idMap
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
      edges: newEdges,
      journalId: newJourneyJournalId,
      userId: user.id,
      visibility: "private",
    })
    .returning();

  // Insert duplicated nodes into journeyNodes table in bulk
  if (newNodes.length > 0) {
    await db.insert(journeyNodes).values(
      newNodes.map((node) => ({
        id: node.id,
        journeyId: newJourneyId,
        title: node.title,
        icon: node.icon,
        description: node.description,
        type: node.type as NodeType,
        positionX: node.positionX,
        positionY: node.positionY,
        journalId: node.journalId,
      }))
    );
  }

  redirect(`/j/${newJourney.id}`);
};
