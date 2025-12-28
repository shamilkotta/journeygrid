"use client";

import { type NodeProps, NodeResizeControl } from "@xyflow/react";
import { useSetAtom } from "jotai";
import { memo } from "react";
import { Node, NodeTitle } from "@/components/ai-elements/node";
import { extractDescriptionText } from "@/components/ui/notion-description-editor";
import { extractTextFromHtml } from "@/components/ui/notion-title-editor";
import { cn } from "@/lib/utils";
import { getNodeIcon } from "@/lib/utils/icon-mapper";
import { type JourneyNodeData, resizeNodeAtom } from "@/lib/workflow-store";

type GoalTaskNodeProps = NodeProps & {
  data?: JourneyNodeData;
};

export const GoalTaskNode = memo(
  ({ id, data, selected, height }: GoalTaskNodeProps) => {
    const resizeNode = useSetAtom(resizeNodeAtom);

    if (!data) {
      return null;
    }

    // Extract plain text from HTML content for display
    const rawTitle = extractTextFromHtml(data.label);
    const displayTitle = rawTitle || (data.type === "goal" ? "Goal" : "Task");
    const displayDescription = extractDescriptionText(data.description);

    // Get icon based on stored icon key or default for node type
    const NodeIcon = getNodeIcon(data.icon, data.type);

    const handleResizeEnd = (
      _: unknown,
      params: { width: number; height: number }
    ) => {
      resizeNode({
        id,
        style: { width: params.width, height: params.height },
      });
    };

    const minWidth = 230;
    const minHeight = 60;

    // Calculate line count based on height
    // ~65px reserved for padding (24px), header (30px), gap (8px) + buffer
    // ~18px per line (14px font size * 1.25 leading)
    const lineCount = height ? Math.max(1, Math.floor((height - 65) / 16)) : 2;

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
              autoScale={false}
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
              autoScale={false}
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
              autoScale={false}
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
              autoScale={false}
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
            "flex size-full min-h-[60px] min-w-[230px] flex-col items-start justify-center gap-2 px-4 py-2 shadow-none transition-all duration-150 ease-out",
            selected && "border-primary"
          )}
          handles={{ target: true, source: true }}
        >
          {/* Top Row: Icon and Title */}
          <div className="flex w-full items-center gap-2.5">
            <NodeIcon
              className="size-5 shrink-0 text-muted-foreground"
              strokeWidth={1.5}
            />
            <NodeTitle className="line-clamp-1 flex-1 text-left font-medium text-lg">
              {displayTitle}
            </NodeTitle>
          </div>

          {/* Bottom Row: Description */}
          {displayDescription && (
            <div
              className="w-full text-left text-muted-foreground text-sm leading-tight"
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

GoalTaskNode.displayName = "GoalTaskNode";
