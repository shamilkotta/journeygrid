"use client";

import { useEffect } from "react";
import { ErrorFallback } from "@/components/ui-state";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[v0] Error boundary triggered:", error);
  }, [error]);

  return <ErrorFallback error={error} reset={reset} />;
}
