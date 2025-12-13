"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { nanoid } from "nanoid";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { createLocalJourney } from "@/lib/local-db";
import {
  currentJourneyNameAtom,
  edgesAtom,
  hasSidebarBeenShownAtom,
  isTransitioningFromHomepageAtom,
  type JourneyNode,
  nodesAtom,
} from "@/lib/workflow-store";

// Helper function to create a default milestone node
function createDefaultMilestoneNode() {
  return {
    id: nanoid(),
    type: "milestone" as const,
    position: { x: 0, y: 0 },
    data: {
      label: "Start",
      description: "",
      type: "milestone" as const,
      status: "not-started" as const,
    },
  };
}

const Home = () => {
  const router = useRouter();
  const nodes = useAtomValue(nodesAtom);
  const edges = useAtomValue(edgesAtom);
  const setNodes = useSetAtom(nodesAtom);
  const setEdges = useSetAtom(edgesAtom);
  const setCurrentJourneyName = useSetAtom(currentJourneyNameAtom);
  const setHasSidebarBeenShown = useSetAtom(hasSidebarBeenShownAtom);
  const setIsTransitioningFromHomepage = useSetAtom(
    isTransitioningFromHomepageAtom
  );
  const hasCreatedJourneyRef = useRef(false);
  const currentJourneyName = useAtomValue(currentJourneyNameAtom);

  // Reset sidebar animation state when on homepage
  useEffect(() => {
    setHasSidebarBeenShown(false);
  }, [setHasSidebarBeenShown]);

  // Handler to add the first node (replaces the "add" node)
  const handleAddNode = useCallback(() => {
    const newNode: JourneyNode = createDefaultMilestoneNode();
    // Replace all nodes (removes the "add" node)
    setNodes([newNode]);
  }, [setNodes]);

  // Initialize with a temporary "add" node on mount
  useEffect(() => {
    const addNodePlaceholder: JourneyNode = {
      id: "add-node-placeholder",
      type: "add",
      position: { x: 0, y: 0 },
      data: {
        label: "",
        type: "add",
        onClick: handleAddNode,
      },
      draggable: false,
      selectable: false,
    };
    setNodes([addNodePlaceholder]);
    setEdges([]);
    setCurrentJourneyName("New Journey");
    hasCreatedJourneyRef.current = false;
  }, [setNodes, setEdges, setCurrentJourneyName, handleAddNode]);

  // Create journey locally when first real node is added
  useEffect(() => {
    const createJourneyAndRedirect = async () => {
      // Filter out the placeholder "add" node
      const realNodes = nodes.filter((node) => node.type !== "add");

      // Only create when we have at least one real node and haven't created a journey yet
      if (realNodes.length === 0 || hasCreatedJourneyRef.current) {
        return;
      }
      hasCreatedJourneyRef.current = true;

      try {
        // Create journey locally in IndexedDB (no auth required)
        const newJourney = await createLocalJourney({
          description: "",
          nodes: realNodes,
          edges,
        });

        // Set flags to indicate we're coming from homepage (for sidebar animation)
        sessionStorage.setItem("animate-sidebar", "true");
        setIsTransitioningFromHomepage(true);

        router.replace(`/j/${newJourney.id}`);
      } catch (error) {
        console.error("Failed to create journey:", error);
        toast.error("Failed to create journey");
      }
    };

    createJourneyAndRedirect();
  }, [nodes, edges, router, setIsTransitioningFromHomepage]);

  // Canvas and toolbar are rendered by PersistentCanvas in the layout
  return null;
};

export default Home;
