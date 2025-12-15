"use client";

import { useSetAtom } from "jotai";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

import {
  edgesAtom,
  hasSidebarBeenShownAtom,
  type JourneyNode,
  nodesAtom,
} from "@/lib/workflow-store";

const Home = () => {
  const router = useRouter();
  const setNodes = useSetAtom(nodesAtom);
  const setEdges = useSetAtom(edgesAtom);
  const setHasSidebarBeenShown = useSetAtom(hasSidebarBeenShownAtom);

  // Reset sidebar animation state when on homepage
  useEffect(() => {
    setHasSidebarBeenShown(false);
  }, [setHasSidebarBeenShown]);

  const handleAddNode = useCallback(() => {
    sessionStorage.setItem("animate-sidebar", "true");
    router.push("/new");
  }, [router]);

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
  }, [setNodes, setEdges, handleAddNode]);

  // Canvas and toolbar are rendered by PersistentCanvas in the layout
  return null;
};

export default Home;
