"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function JourneyPage() {
  const router = useRouter();

  useEffect(() => {
    const redirectToJourney = async () => {
      router.replace("/");
    };

    redirectToJourney();
  }, [router]);

  return null;
}
