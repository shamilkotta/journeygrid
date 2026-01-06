import { nanoid } from "nanoid";
import type { JourneyNodeDB } from "@/lib/db/schema";

export type NodeType = "goal" | "task" | "milestone" | "add";

export type ReactFlowNodeInput = {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: {
    label?: string | null;
    description?: string | null;
    icon?: string | null;
    type?: string | null;
    journalId: string | null;
  };
};

export type ReactFlowNodeOutput = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    description: string | null;
    icon: string | null;
    type: string;
    journalId: string | null;
  };
};

// Helper function to create a default milestone node
export function createDefaultMilestoneNode(): ReactFlowNodeInput {
  return {
    id: nanoid(),
    type: "milestone",
    position: { x: 0, y: 0 },
    data: {
      label: "Start",
      description: "",
      type: "milestone",
      journalId: null,
    },
  };
}

// Transform ReactFlow node to DB format
export function transformNodeToDB(
  node: ReactFlowNodeInput,
  journeyId: string,
  isNewNode = false
): {
  id: string;
  journeyId: string;
  title: string;
  icon: string | null;
  description: string | null;
  type: NodeType;
  positionX: number;
  positionY: number;
  journalId: string | null;
} {
  const nodeType = (node.data.type || "goal") as NodeType;
  return {
    id: isNewNode ? nanoid() : node.id,
    journeyId,
    title: node.data.label || "",
    icon: node.data.icon || null,
    description: node.data.description || null,
    type: nodeType,
    positionX: node.position.x,
    positionY: node.position.y,
    journalId: node.data.journalId || null,
  };
}

// Transform DB node to ReactFlow format
export function transformNodeToReactFlow(
  dbNode:
    | JourneyNodeDB
    | {
        id: string;
        title: string;
        icon: string | null;
        description: string | null;
        type: string;
        positionX: number;
        positionY: number;
        journalId: string | null;
      }
): ReactFlowNodeOutput {
  return {
    id: dbNode.id,
    type: dbNode.type,
    position: { x: dbNode.positionX, y: dbNode.positionY },
    data: {
      label: dbNode.title,
      description: dbNode.description,
      icon: dbNode.icon,
      type: dbNode.type,
      journalId: dbNode.journalId,
    },
  };
}
