import { and, eq, or } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { journeys } from "@/lib/db/schema";
import { transformNodeToReactFlow } from "@/lib/utils/node-transforms";
import JourneyEditor from "./_components/JourneyEditor";

type JourneyPageProps = {
  params: Promise<{ journeyId: string }>;
};

const JourneyPage = async ({ params }: JourneyPageProps) => {
  const { journeyId } = await params;
  const header = await headers();
  const session = await auth.api.getSession({
    headers: header,
  });

  const orCond = [
    and(eq(journeys.id, journeyId), eq(journeys.visibility, "public")),
  ];

  if (session?.user) {
    orCond.push(
      and(eq(journeys.id, journeyId), eq(journeys.userId, session.user.id))!
    );
  }

  let journey: any = await db.query.journeys.findFirst({
    where: or(...orCond),
    with: {
      nodes: true,
    },
  });

  if (journey) {
    // Transform nodes to ReactFlow format
    const transformedNodes = journey.nodes
      ? journey.nodes.map(transformNodeToReactFlow)
      : [];

    journey = {
      ...journey,
      updatedAt: journey.updatedAt.toISOString(),
      createdAt: journey.createdAt.toISOString(),
      isOwner: journey.userId == session?.user.id,
      journalId: journey.journalId,
      nodes: transformedNodes,
    };
  }

  return <JourneyEditor journey={journey} journeyId={journeyId} />;
};

export default JourneyPage;
