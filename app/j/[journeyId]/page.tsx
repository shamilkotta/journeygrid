import { and, eq, or } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { journeys } from "@/lib/db/schema";
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
  });

  if (journey) {
    journey = {
      ...journey,
      updatedAt: journey.updatedAt.toISOString(),
      createdAt: journey.createdAt.toISOString(),
      isOwner: journey.userId == session?.user.id,
    };
  }

  return <JourneyEditor journey={journey} journeyId={journeyId} />;
};

export default JourneyPage;
