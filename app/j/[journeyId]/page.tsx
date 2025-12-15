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
      isOwner: journey.userId == session?.user.id,
    };
  }

  // if (!journey && refererPath && ["new", "j"].includes(refererPath)) {
  //   console.log("Creating new journey");
  //   const node = {
  //     id: nanoid(),
  //     type: "milestone" as const,
  //     position: { x: 0, y: 0 },
  //     data: {
  //       label: "Start",
  //       description: "",
  //       type: "milestone" as const,
  //       status: "not-started" as const,
  //     },
  //   };
  //   journey = {
  //     id: journeyId,
  //     userId: session?.user.id || "",
  //     name: "Untitled Journey",
  //     description: null,
  //     nodes: [node],
  //     edges: [],
  //     visibility: "private",
  //     createdAt: new Date().toISOString(),
  //     updatedAt: new Date().toISOString(),
  //     isOwner: true,
  //     isDirty: true,
  //   };
  // }

  console.log({ journey });

  return <JourneyEditor journeyId={journeyId} journey={journey} />;
};

export default JourneyPage;
