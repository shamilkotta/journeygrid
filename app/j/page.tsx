"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getMostRecentLocalJourney } from "@/lib/local-db";

export default function JourneyPage() {
  const router = useRouter();

  useEffect(() => {
    const redirectToJourney = async () => {
      try {
        // Get most recent journey from local storage
        const mostRecent = await getMostRecentLocalJourney();

        if (mostRecent) {
          router.replace(`/j/${mostRecent.id}`);
        } else {
          // No journeys, redirect to homepage
          router.replace("/");
        }
      } catch (error) {
        console.error("Failed to load journeys:", error);
        router.replace("/");
      }
    };

    redirectToJourney();
  }, [router]);

  return null;
}
