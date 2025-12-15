import { and, eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { journeys } from "@/lib/db/schema";
import JourneyEditor from "./_components/JourneyEditor";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

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

  return <JourneyEditor journeyId={journeyId} journey={journey} />;
};

export default JourneyPage;
