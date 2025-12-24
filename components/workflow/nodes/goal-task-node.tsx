"use client";

import { type NodeProps, NodeResizeControl } from "@xyflow/react";
import { useSetAtom } from "jotai";
import { CheckCircle2, Target } from "lucide-react";
import { memo } from "react";
import { Node, NodeTitle } from "@/components/ai-elements/node";
import { cn } from "@/lib/utils";
import { type JourneyNodeData, resizeNodeAtom } from "@/lib/workflow-store";

type GoalTaskNodeProps = NodeProps & {
  data?: JourneyNodeData;
};

export const GoalTaskNode = memo(
  ({ id, data, selected }: GoalTaskNodeProps) => {
    const resizeNode = useSetAtom(resizeNodeAtom);

    if (!data) {
      return null;
    }

    const displayTitle = data.label || (data.type === "goal" ? "Goal" : "Task");
    const displayDescription = data.description || "";
    const status = data.status || "not-started";

    // Select icon based on node type
    const NodeIcon = data.type === "goal" ? Target : CheckCircle2;

    const handleResizeEnd = (
      _: unknown,
      params: { width: number; height: number }
    ) => {
      resizeNode({
        id,
        style: { width: params.width, height: params.height },
      });
    };

    const minWidth = 200;
    const minHeight = 50;

    // Common style for resize controls to ensure large hit area and correct positioning
    const controlStyle = {
      position: "absolute" as const,
      background: "transparent",
      border: "none",
    };

    return (
      <>
        {selected && (
          <>
            <NodeResizeControl
              minHeight={minHeight}
              minWidth={minWidth}
              onResizeEnd={handleResizeEnd}
              position="top"
              style={{
                ...controlStyle,
                top: 2.5,
                width: "100%",
                height: 10,
                cursor: "ns-resize",
                zIndex: 50,
              }}
            />
            <NodeResizeControl
              minHeight={minHeight}
              minWidth={minWidth}
              onResizeEnd={handleResizeEnd}
              position="right"
              style={{
                ...controlStyle,
                right: 2.5,
                height: "100%",
                width: 10,
                cursor: "ew-resize",
                zIndex: 50,
              }}
            />
            <NodeResizeControl
              minHeight={minHeight}
              minWidth={minWidth}
              onResizeEnd={handleResizeEnd}
              position="bottom"
              style={{
                ...controlStyle,
                bottom: 2.5,
                width: "100%",
                height: 10,
                cursor: "ns-resize",
                zIndex: 50,
              }}
            />
            <NodeResizeControl
              minHeight={minHeight}
              minWidth={minWidth}
              onResizeEnd={handleResizeEnd}
              position="left"
              style={{
                ...controlStyle,
                left: 2.5,
                height: "100%",
                width: 10,
                cursor: "ew-resize",
                zIndex: 50,
              }}
            />
          </>
        )}
        <Node
          className={cn(
            "flex size-full min-h-[50px] min-w-[200px] flex-col items-start justify-center gap-1.5 px-3 py-2 shadow-none transition-all duration-150 ease-out",
            selected && "border-primary"
          )}
          handles={{ target: true, source: true }}
        >
          {/* Top Row: Icon and Title */}
          <div className="flex w-full items-center gap-2">
            <NodeIcon
              className={cn(
                "size-4 shrink-0",
                status === "completed" && "text-green-500",
                status === "in-progress" && "text-blue-500",
                status === "not-started" && "text-muted-foreground"
              )}
              strokeWidth={1.5}
            />
            <NodeTitle className="line-clamp-1 flex-1 text-left font-medium text-sm leading-none">
              {displayTitle}
            </NodeTitle>
          </div>

          {/* Bottom Row: Description */}
          {displayDescription && (
            <div className="line-clamp-2 w-full text-left text-[10px] text-muted-foreground leading-tight">
              {displayDescription}
            </div>
          )}
        </Node>
      </>
    );
  }
);

GoalTaskNode.displayName = "GoalTaskNode";
