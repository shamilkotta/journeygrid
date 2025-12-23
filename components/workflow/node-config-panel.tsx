import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { MenuIcon, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  allJourneysAtom,
  currentJourneyAtom,
  currentJourneyIdAtom,
  deleteEdgeAtom,
  deleteNodeAtom,
  deleteSelectedItemsAtom,
  edgesAtom,
  isGeneratingAtom,
  nodesAtom,
  propertiesPanelActiveTabAtom,
  selectedEdgeAtom,
  selectedNodeAtom,
  showClearDialogAtom,
  showDeleteDialogAtom,
  updateCurrentJourneyAtom,
  updateNodeDataAtom,
} from "@/lib/workflow-store";
import { Panel } from "../ai-elements/panel";
import { Drawer, DrawerContent, DrawerTrigger } from "../ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

// Multi-selection panel component
const MultiSelectionPanel = ({
  selectedNodes,
  selectedEdges,
  onDelete,
}: {
  selectedNodes: { id: string; selected?: boolean }[];
  selectedEdges: { id: string; selected?: boolean }[];
  onDelete: () => void;
}) => {
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);

  const nodeText = selectedNodes.length === 1 ? "node" : "nodes";
  const edgeText = selectedEdges.length === 1 ? "line" : "lines";
  const selectionParts: string[] = [];

  if (selectedNodes.length > 0) {
    selectionParts.push(`${selectedNodes.length} ${nodeText}`);
  }
  if (selectedEdges.length > 0) {
    selectionParts.push(`${selectedEdges.length} ${edgeText}`);
  }

  const selectionText = selectionParts.join(" and ");

  const handleDelete = () => {
    onDelete();
    setShowDeleteAlert(false);
  };

  return (
    <>
      <div className="flex size-full flex-col">
        <div className="flex h-14 w-full shrink-0 items-center border-b bg-transparent px-4">
          <h2 className="font-semibold text-foreground">Properties</h2>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="space-y-2">
            <Label>Selection</Label>
            <p className="text-muted-foreground text-sm">
              {selectionText} selected
            </p>
          </div>
        </div>
        <div className="shrink-0 border-t p-4">
          <Button
            onClick={() => setShowDeleteAlert(true)}
            size="icon"
            variant="ghost"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <AlertDialog onOpenChange={setShowDeleteAlert} open={showDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Items</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectionText}? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Complex UI logic with multiple conditions
export const PanelInner = () => {
  const [selectedNodeId] = useAtom(selectedNodeAtom);
  const [selectedEdgeId] = useAtom(selectedEdgeAtom);
  const [nodes] = useAtom(nodesAtom);
  const edges = useAtomValue(edgesAtom);
  const [isGenerating] = useAtom(isGeneratingAtom);
  const currentJourneyId = useAtomValue(currentJourneyIdAtom);
  const currentJourney = useAtomValue(currentJourneyAtom);
  const updateCurrentJourney = useSetAtom(updateCurrentJourneyAtom);
  const updateNodeData = useSetAtom(updateNodeDataAtom);
  const deleteNode = useSetAtom(deleteNodeAtom);
  const deleteEdge = useSetAtom(deleteEdgeAtom);
  const deleteSelectedItems = useSetAtom(deleteSelectedItemsAtom);
  const setShowClearDialog = useSetAtom(showClearDialogAtom);
  const setShowDeleteDialog = useSetAtom(showDeleteDialogAtom);
  const [allJourneys, setAllJourneys] = useAtom(allJourneysAtom);
  const [showDeleteNodeAlert, setShowDeleteNodeAlert] = useState(false);
  const [showDeleteEdgeAlert, setShowDeleteEdgeAlert] = useState(false);
  const [activeTab, setActiveTab] = useAtom(propertiesPanelActiveTabAtom);
  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId);

  // Count multiple selections
  const selectedNodes = nodes.filter((node) => node.selected);
  const selectedEdges = edges.filter((edge) => edge.selected);
  const hasMultipleSelections = selectedNodes.length + selectedEdges.length > 1;

  const handleDelete = () => {
    if (selectedNodeId) {
      deleteNode(selectedNodeId);
      setShowDeleteNodeAlert(false);
    }
  };

  const handleUpdateStatus = (
    status: "not-started" | "in-progress" | "completed"
  ) => {
    if (selectedNode) {
      updateNodeData({
        id: selectedNode.id,
        data: { status },
      });
    }
  };

  const handleDeleteEdge = () => {
    if (selectedEdgeId) {
      deleteEdge(selectedEdgeId);
      setShowDeleteEdgeAlert(false);
    }
  };

  const handleUpdateLabel = (label: string) => {
    if (selectedNode) {
      updateNodeData({ id: selectedNode.id, data: { label } });
    }
  };

  const handleUpdateDescription = (description: string) => {
    if (selectedNode) {
      updateNodeData({ id: selectedNode.id, data: { description } });
    }
  };

  const handleUpdateJourneyName = async (newName: string) => {
    // Save to local IndexedDB if journey exists
    if (currentJourneyId) {
      try {
        await updateCurrentJourney(
          {
            name: newName,
          },
          { immediate: true }
        );
        // Refresh the journey list to update the dropdown
        setAllJourneys(
          allJourneys.map((journey) =>
            journey.id === currentJourneyId
              ? { ...journey, name: newName }
              : journey
          )
        );
      } catch (error) {
        console.error("Failed to update journey name:", error);
        toast.error("Failed to update journey name");
      }
    }
  };

  // If multiple items are selected, show multi-selection properties
  if (hasMultipleSelections) {
    return (
      <MultiSelectionPanel
        onDelete={deleteSelectedItems}
        selectedEdges={selectedEdges}
        selectedNodes={selectedNodes}
      />
    );
  }

  const isOwner = currentJourney?.isOwner;
  const currentJourneyName = currentJourney?.name;

  // If an edge is selected, show edge properties
  if (selectedEdge) {
    return (
      <>
        <div className="flex size-full flex-col">
          <div className="flex h-14 w-full shrink-0 items-center border-b bg-transparent px-4">
            <h2 className="font-semibold text-foreground">Properties</h2>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <div className="space-y-2">
              <Label className="ml-1" htmlFor="edge-id">
                Edge ID
              </Label>
              <Input disabled id="edge-id" value={selectedEdge.id} />
            </div>
            <div className="space-y-2">
              <Label className="ml-1" htmlFor="edge-source">
                Source
              </Label>
              <Input disabled id="edge-source" value={selectedEdge.source} />
            </div>
            <div className="space-y-2">
              <Label className="ml-1" htmlFor="edge-target">
                Target
              </Label>
              <Input disabled id="edge-target" value={selectedEdge.target} />
            </div>
          </div>
          <div className="shrink-0 border-t p-4">
            <Button
              onClick={() => setShowDeleteEdgeAlert(true)}
              size="icon"
              variant="ghost"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>

        <AlertDialog
          onOpenChange={setShowDeleteEdgeAlert}
          open={showDeleteEdgeAlert}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Edge</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this connection? This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteEdge}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // If no node is selected, show workspace properties and runs
  if (!selectedNode) {
    return (
      <>
        <Tabs
          className="size-full"
          defaultValue="properties"
          onValueChange={setActiveTab}
          value={activeTab}
        >
          <TabsList className="h-14 w-full shrink-0 rounded-none border-b bg-transparent px-4 py-2.5">
            <TabsTrigger
              className="bg-transparent text-muted-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none"
              value="properties"
            >
              Properties
            </TabsTrigger>
          </TabsList>
          <TabsContent
            className="flex flex-col overflow-hidden"
            value="properties"
          >
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <div className="space-y-2">
                <Label className="ml-1" htmlFor="journey-name">
                  Journey Name
                </Label>
                <Input
                  disabled={!isOwner}
                  id="journey-name"
                  onChange={(e) => handleUpdateJourneyName(e.target.value)}
                  value={currentJourneyName}
                />
              </div>
              <div className="space-y-2">
                <Label className="ml-1" htmlFor="journey-id">
                  Journey ID
                </Label>
                <Input
                  disabled
                  id="journey-id"
                  value={currentJourneyId || "Not saved"}
                />
              </div>
              {!isOwner && (
                <div className="rounded-lg border border-muted bg-muted/30 p-3">
                  <p className="text-muted-foreground text-sm">
                    You are viewing a public journey. Duplicate it to make
                    changes.
                  </p>
                </div>
              )}
            </div>
            {isOwner && (
              <div className="flex shrink-0 items-center gap-2 border-t p-4">
                <Button
                  onClick={() => setShowClearDialog(true)}
                  variant="ghost"
                >
                  Clear
                </Button>
                <Button
                  onClick={() => setShowDeleteDialog(true)}
                  variant="ghost"
                >
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </>
    );
  }

  return (
    <>
      <Tabs
        className="size-full"
        data-testid="properties-panel"
        defaultValue="properties"
        onValueChange={setActiveTab}
        value={activeTab}
      >
        <TabsList className="h-14 w-full shrink-0 rounded-none border-b bg-transparent px-4 py-2.5">
          <TabsTrigger
            className="bg-transparent text-muted-foreground data-[state=active]:text-foreground data-[state=active]:shadow-none"
            value="properties"
          >
            Properties
          </TabsTrigger>
        </TabsList>
        <TabsContent
          className="flex flex-col overflow-hidden"
          value="properties"
        >
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <div className="space-y-2">
              <Label className="ml-1" htmlFor="label">
                Label
              </Label>
              <Input
                disabled={isGenerating || !isOwner}
                id="label"
                onChange={(e) => handleUpdateLabel(e.target.value)}
                value={selectedNode.data.label}
              />
            </div>

            <div className="space-y-2">
              <Label className="ml-1" htmlFor="description">
                Description
              </Label>
              <Input
                disabled={isGenerating || !isOwner}
                id="description"
                onChange={(e) => handleUpdateDescription(e.target.value)}
                placeholder="Optional description"
                value={selectedNode.data.description || ""}
              />
            </div>

            <div className="space-y-2">
              <Label className="ml-1">Status</Label>
              <div className="flex gap-2">
                <Button
                  disabled={isGenerating || !isOwner}
                  onClick={() => handleUpdateStatus("not-started")}
                  size="sm"
                  variant={
                    selectedNode.data.status === "not-started"
                      ? "default"
                      : "outline"
                  }
                >
                  Not Started
                </Button>
                <Button
                  disabled={isGenerating || !isOwner}
                  onClick={() => handleUpdateStatus("in-progress")}
                  size="sm"
                  variant={
                    selectedNode.data.status === "in-progress"
                      ? "default"
                      : "outline"
                  }
                >
                  In Progress
                </Button>
                <Button
                  disabled={isGenerating || !isOwner}
                  onClick={() => handleUpdateStatus("completed")}
                  size="sm"
                  variant={
                    selectedNode.data.status === "completed"
                      ? "default"
                      : "outline"
                  }
                >
                  Completed
                </Button>
              </div>
            </div>

            {!isOwner && (
              <div className="rounded-lg border border-muted bg-muted/30 p-3">
                <p className="text-muted-foreground text-sm">
                  You are viewing a public journey. Duplicate it to make
                  changes.
                </p>
              </div>
            )}
          </div>
          {isOwner && (
            <div className="flex shrink-0 items-center justify-end border-t p-4">
              <Button
                onClick={() => setShowDeleteNodeAlert(true)}
                size="icon"
                variant="ghost"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog
        onOpenChange={setShowDeleteNodeAlert}
        open={showDeleteNodeAlert}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Node</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this node? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
export const NodeConfigPanel = () => {
  return (
    <>
      {/* Mobile: Drawer */}
      <div className="md:hidden">
        <Drawer>
          <DrawerTrigger asChild>
            <Panel position="bottom-right">
              <Button className="h-8 w-8" size="icon" variant="ghost">
                <MenuIcon className="size-4" />
              </Button>
            </Panel>
          </DrawerTrigger>
          <DrawerContent>
            <PanelInner />
          </DrawerContent>
        </Drawer>
      </div>

      {/* Desktop: Docked sidebar - now resizable */}
      <div className="hidden size-full flex-col bg-background md:flex">
        <PanelInner />
      </div>
    </>
  );
};
