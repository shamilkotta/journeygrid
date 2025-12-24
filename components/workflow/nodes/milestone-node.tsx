"use client";

import { type NodeProps, NodeResizeControl } from "@xyflow/react";
import { useSetAtom } from "jotai";
import { Flag } from "lucide-react";
import { memo } from "react";
import { Node, NodeTitle } from "@/components/ai-elements/node";
import { cn } from "@/lib/utils";
import { type JourneyNodeData, resizeNodeAtom } from "@/lib/workflow-store";

type MilestoneNodeProps = NodeProps & {
  data?: JourneyNodeData;
};

export const MilestoneNode = memo(
  ({ id, data, selected }: MilestoneNodeProps) => {
    const resizeNode = useSetAtom(resizeNodeAtom);

    if (!data) {
      return null;
    }

    const displayTitle = data.label || "Milestone";
    const displayDescription = data.description || "Milestone";

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
                top: -10,
                left: 0,
                width: "100%",
                height: 20,
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
                right: -10,
                top: 0,
                height: "100%",
                width: 20,
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
                bottom: -10,
                left: 0,
                width: "100%",
                height: 20,
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
                left: -10,
                top: 0,
                height: "100%",
                width: 20,
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
          handles={{ target: false, source: true }}
        >
          {/* Top Row: Icon and Title */}
          <div className="flex w-full items-center gap-2">
            <Flag className="size-4 shrink-0 text-blue-500" strokeWidth={1.5} />
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

MilestoneNode.displayName = "MilestoneNode";
