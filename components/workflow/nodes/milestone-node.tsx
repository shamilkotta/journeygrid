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
  ({ id, data, selected, height }: MilestoneNodeProps) => {
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

    // Calculate line count based on height
    // ~45px reserved for padding (16px), header (20px), gap (6px) + buffer
    // ~13px per line (10px font size * 1.25 leading)
    const lineCount = height ? Math.max(1, Math.floor((height - 45) / 13)) : 2;

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
            <div
              className="w-full text-left text-[10px] text-muted-foreground leading-tight"
              style={{
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: lineCount,
                overflow: "hidden",
              }}
            >
              {displayDescription}
            </div>
          )}
        </Node>
      </>
    );
  }
);

MilestoneNode.displayName = "MilestoneNode";
