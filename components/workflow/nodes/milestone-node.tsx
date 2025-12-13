"use client";

import type { NodeProps } from "@xyflow/react";
import { Calendar, Flag } from "lucide-react";
import { memo } from "react";
import { Node, NodeTitle } from "@/components/ai-elements/node";
import { cn } from "@/lib/utils";
import type { JourneyNodeData } from "@/lib/workflow-store";

type MilestoneNodeProps = NodeProps & {
  data?: JourneyNodeData;
};

export const MilestoneNode = memo(({ data, selected }: MilestoneNodeProps) => {
  if (!data) {
    return null;
  }

  const displayTitle = data.label || "Milestone";
  const displayDescription = data.description || "Milestone";
  const status = data.status;
  const milestoneDate = data.milestoneDate;

  return (
    <Node
      className={cn(
        "flex h-32 w-32 flex-col items-center justify-center shadow-none transition-all duration-150 ease-out",
        selected && "border-primary"
      )}
      handles={{ target: false, source: true }}
    >
      {/* Status indicator badge in top right */}
      {status && (
        <div
          className={cn(
            "absolute top-1 right-1 rounded-full px-1.5 py-0.5 font-medium text-[10px]",
            status === "completed" && "bg-green-500/50 text-white",
            status === "in-progress" && "bg-blue-500/50 text-white",
            status === "not-started" && "bg-gray-500/50 text-white"
          )}
        >
          {status === "completed" && "Done"}
          {status === "in-progress" && "Active"}
          {status === "not-started" && "Pending"}
        </div>
      )}

      <div className="flex flex-col items-center justify-center gap-1.5 p-3">
        <Flag className="size-8 text-blue-500" strokeWidth={1.5} />
        <div className="flex flex-col items-center gap-0.5 text-center">
          <NodeTitle className="line-clamp-1 text-sm">{displayTitle}</NodeTitle>
          {milestoneDate && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Calendar className="size-2.5" />
              {new Date(milestoneDate).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    </Node>
  );
});

MilestoneNode.displayName = "MilestoneNode";
