"use client";

import type { NodeProps } from "@xyflow/react";
import { Calendar, CheckCircle2, Target } from "lucide-react";
import { memo } from "react";
import { Node, NodeTitle } from "@/components/ai-elements/node";
import { cn } from "@/lib/utils";
import type { JourneyNodeData } from "@/lib/workflow-store";

type GoalTaskNodeProps = NodeProps & {
  data?: JourneyNodeData;
};

export const GoalTaskNode = memo(({ data, selected }: GoalTaskNodeProps) => {
  if (!data) {
    return null;
  }

  const displayTitle = data.label || (data.type === "goal" ? "Goal" : "Task");
  const displayDescription = data.description || "";
  const status = data.status || "not-started";
  const deadline = data.deadline;
  const todos = data.todos || [];
  const completedTodos = todos.filter((t) => t.completed).length;
  const totalTodos = todos.length;
  const progress = totalTodos > 0 ? (completedTodos / totalTodos) * 100 : 0;

  // Select icon based on node type
  const NodeIcon = data.type === "goal" ? Target : CheckCircle2;

  return (
    <Node
      className={cn(
        "flex h-32 w-32 flex-col items-center justify-center shadow-none transition-all duration-150 ease-out",
        selected && "border-primary"
      )}
      handles={{ target: true, source: true }}
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
        <NodeIcon
          className={cn(
            "size-8",
            status === "completed" && "text-green-500",
            status === "in-progress" && "text-blue-500",
            status === "not-started" && "text-muted-foreground"
          )}
          strokeWidth={1.5}
        />
        <div className="flex flex-col items-center gap-0.5 text-center">
          <NodeTitle className="line-clamp-1 text-sm">{displayTitle}</NodeTitle>
          {totalTodos > 0 && (
            <div className="text-[10px] text-muted-foreground">
              {completedTodos}/{totalTodos} todos
            </div>
          )}
          {deadline && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Calendar className="size-2.5" />
              {new Date(deadline).toLocaleDateString()}
            </div>
          )}
          {totalTodos > 0 && (
            <div className="mt-1 w-full">
              <div className="h-1 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </Node>
  );
});

GoalTaskNode.displayName = "GoalTaskNode";
