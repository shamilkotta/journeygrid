"use client";

import type { NodeProps } from "@xyflow/react";
import { SquareDashedMousePointer } from "lucide-react";
import { useTransition } from "react";
import { newJourney } from "@/app/api/journey/new";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type AddNodeData = {
  onClick?: () => void;
};

export function AddNode({ data }: NodeProps & { data?: AddNodeData }) {
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(newJourney);
  };

  return (
    <div className="flex flex-col items-center justify-center gap-8 rounded-lg border border-border border-dashed bg-background/50 p-8 backdrop-blur-sm">
      <div className="text-center">
        <h1 className="mb-2 font-bold text-3xl">Journeygrid</h1>
        <p className="text-muted-foreground text-sm">
          Create journeys for your projects and learning paths
        </p>
      </div>
      <Button
        className="gap-2 shadow-lg"
        disabled={pending}
        onClick={handleClick}
        size="default"
      >
        {pending ? (
          <Spinner className="size-4" />
        ) : (
          <SquareDashedMousePointer className="h-4 w-4" />
        )}
        Start a new journey
      </Button>
    </div>
  );
}
