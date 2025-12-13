"use client";

import { useAtom } from "jotai";
import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { edgesAtom, nodesAtom, type JourneyNode } from "@/lib/workflow-store";

type TemplateAutocompleteProps = {
  isOpen: boolean;
  position: { top: number; left: number };
  onSelect: (template: string) => void;
  onClose: () => void;
  currentNodeId?: string;
  filter?: string;
};

type SchemaField = {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  itemType?: "string" | "number" | "boolean" | "object";
  fields?: SchemaField[];
  description?: string;
};

// Helper to get a display name for a node
const getNodeDisplayName = (node: JourneyNode): string => {
  if (node.data.label) {
    return node.data.label;
  }

  // For journey nodes, just return the label or type
  if (node.data.type === "milestone" || node.data.type === "goal" || node.data.type === "task") {
    return node.data.label || node.data.type;
  }

  return "Node";
};

// Convert schema fields to field descriptions
const schemaToFields = (
  schema: SchemaField[],
  prefix = ""
): Array<{ field: string; description: string }> => {
  const fields: Array<{ field: string; description: string }> = [];

  for (const schemaField of schema) {
    const fieldPath = prefix
      ? `${prefix}.${schemaField.name}`
      : schemaField.name;
    const typeLabel =
      schemaField.type === "array"
        ? `${schemaField.itemType}[]`
        : schemaField.type;
    const description = schemaField.description || `${typeLabel}`;

    fields.push({ field: fieldPath, description });

    // Add nested fields for objects
    if (
      schemaField.type === "object" &&
      schemaField.fields &&
      schemaField.fields.length > 0
    ) {
      fields.push(...schemaToFields(schemaField.fields, fieldPath));
    }

    // Add nested fields for array items that are objects
    if (
      schemaField.type === "array" &&
      schemaField.itemType === "object" &&
      schemaField.fields &&
      schemaField.fields.length > 0
    ) {
      const arrayItemPath = `${fieldPath}[0]`;
      fields.push(...schemaToFields(schemaField.fields, arrayItemPath));
    }
  }

  return fields;
};


// Get common fields based on journey node type
const getCommonFields = (node: JourneyNode) => {
  // For journey nodes, return basic fields
  return [
    { field: "label", description: "Node label" },
    { field: "description", description: "Node description" },
    { field: "status", description: "Node status" },
  ];
};

export function TemplateAutocomplete({
  isOpen,
  position,
  onSelect,
  onClose,
  currentNodeId,
  filter = "",
}: TemplateAutocompleteProps) {
  const [nodes] = useAtom(nodesAtom);
  const [edges] = useAtom(edgesAtom);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  // Ensure we're mounted before trying to use portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Find all nodes that come before the current node
  const getUpstreamNodes = () => {
    if (!currentNodeId) {
      return [];
    }

    const visited = new Set<string>();
    const upstream: string[] = [];

    const traverse = (nodeId: string) => {
      if (visited.has(nodeId)) {
        return;
      }
      visited.add(nodeId);

      const incomingEdges = edges.filter((edge) => edge.target === nodeId);
      for (const edge of incomingEdges) {
        upstream.push(edge.source);
        traverse(edge.source);
      }
    };

    traverse(currentNodeId);

    return nodes.filter((node) => upstream.includes(node.id));
  };

  const upstreamNodes = getUpstreamNodes();

  // Build list of all available options (nodes + their fields)
  const options: Array<{
    type: "node" | "field";
    nodeId: string;
    nodeName: string;
    field?: string;
    description?: string;
    template: string;
  }> = [];

  for (const node of upstreamNodes) {
    const nodeName = getNodeDisplayName(node);
    const fields = getCommonFields(node);

    // Add node itself
    options.push({
      type: "node",
      nodeId: node.id,
      nodeName,
      template: `{{@${node.id}:${nodeName}}}`,
    });

    // Add fields
    for (const field of fields) {
      options.push({
        type: "field",
        nodeId: node.id,
        nodeName,
        field: field.field,
        description: field.description,
        template: `{{@${node.id}:${nodeName}.${field.field}}}`,
      });
    }
  }

  // Filter options based on search term
  const filteredOptions = filter
    ? options.filter(
        (opt) =>
          opt.nodeName.toLowerCase().includes(filter.toLowerCase()) ||
          (opt.field && opt.field.toLowerCase().includes(filter.toLowerCase()))
      )
    : options;

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredOptions.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredOptions[selectedIndex]) {
            onSelect(filteredOptions[selectedIndex].template);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredOptions, selectedIndex, onSelect, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (menuRef.current) {
      const selectedElement = menuRef.current.children[
        selectedIndex
      ] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  if (!isOpen || filteredOptions.length === 0 || !mounted) {
    return null;
  }

  // Ensure position is within viewport
  const adjustedPosition = {
    top: Math.min(position.top, window.innerHeight - 300), // Keep 300px from bottom
    left: Math.min(position.left, window.innerWidth - 320), // Keep menu (320px wide) within viewport
  };

  const menuContent = (
    <div
      className="fixed z-[9999] w-80 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
      ref={menuRef}
      style={{
        top: `${adjustedPosition.top}px`,
        left: `${adjustedPosition.left}px`,
      }}
    >
      <div className="max-h-60 overflow-y-auto">
        {filteredOptions.map((option, index) => (
          <div
            className={cn(
              "flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-sm transition-colors",
              index === selectedIndex
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent/50"
            )}
            key={`${option.nodeId}-${option.field || "root"}`}
            onClick={() => onSelect(option.template)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <div className="flex-1">
              <div className="font-medium">
                {option.type === "node" ? (
                  option.nodeName
                ) : (
                  <>
                    <span className="text-muted-foreground">
                      {option.nodeName}.
                    </span>
                    {option.field}
                  </>
                )}
              </div>
              {option.description && (
                <div className="text-muted-foreground text-xs">
                  {option.description}
                </div>
              )}
            </div>
            {index === selectedIndex && <Check className="h-4 w-4" />}
          </div>
        ))}
      </div>
    </div>
  );

  // Use portal to render at document root to avoid clipping issues
  return createPortal(menuContent, document.body);
}

