import { streamText } from "ai";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Simple type for operations
type Operation = {
  op:
    | "setName"
    | "setDescription"
    | "addNode"
    | "addEdge"
    | "removeNode"
    | "removeEdge"
    | "updateNode";
  name?: string;
  description?: string;
  node?: unknown;
  edge?: unknown;
  nodeId?: string;
  edgeId?: string;
  updates?: {
    position?: { x: number; y: number };
    data?: unknown;
  };
};

function encodeMessage(encoder: TextEncoder, message: object): Uint8Array {
  return encoder.encode(`${JSON.stringify(message)}\n`);
}

function shouldSkipLine(line: string): boolean {
  const trimmed = line.trim();
  return !trimmed || trimmed.startsWith("```");
}

function tryParseAndEnqueueOperation(
  line: string,
  encoder: TextEncoder,
  controller: ReadableStreamDefaultController,
  operationCount: number
): number {
  const trimmed = line.trim();

  if (shouldSkipLine(line)) {
    return operationCount;
  }

  try {
    const operation = JSON.parse(trimmed) as Operation;
    const newCount = operationCount + 1;

    console.log(`[API] Operation ${newCount}:`, operation.op);

    controller.enqueue(
      encodeMessage(encoder, {
        type: "operation",
        operation,
      })
    );

    return newCount;
  } catch {
    console.warn("[API] Skipping invalid JSON line:", trimmed.substring(0, 50));
    return operationCount;
  }
}

function processBufferLines(
  buffer: string,
  encoder: TextEncoder,
  controller: ReadableStreamDefaultController,
  operationCount: number
): { remainingBuffer: string; newOperationCount: number } {
  const lines = buffer.split("\n");
  const remainingBuffer = lines.pop() || "";
  let newOperationCount = operationCount;

  for (const line of lines) {
    newOperationCount = tryParseAndEnqueueOperation(
      line,
      encoder,
      controller,
      newOperationCount
    );
  }

  return { remainingBuffer, newOperationCount };
}

async function processOperationStream(
  textStream: AsyncIterable<string>,
  encoder: TextEncoder,
  controller: ReadableStreamDefaultController
): Promise<void> {
  let buffer = "";
  let operationCount = 0;
  let chunkCount = 0;

  for await (const chunk of textStream) {
    chunkCount += 1;
    buffer += chunk;

    const result = processBufferLines(
      buffer,
      encoder,
      controller,
      operationCount
    );
    buffer = result.remainingBuffer;
    operationCount = result.newOperationCount;
  }

  // Process any remaining buffer content
  operationCount = tryParseAndEnqueueOperation(
    buffer,
    encoder,
    controller,
    operationCount
  );

  console.log(
    `[API] Stream complete. Chunks: ${chunkCount}, Operations: ${operationCount}`
  );

  // Send completion
  controller.enqueue(
    encodeMessage(encoder, {
      type: "complete",
    })
  );
}

function getSystemPrompt(): string {
  return `You are a journey planning expert. Generate a journey for projects or learning paths based on the user's description.

CRITICAL: Output your journey as INDIVIDUAL OPERATIONS, one per line in JSONL format.
Each line must be a complete, separate JSON object.

Operations you can output:
1. {"op": "setName", "name": "Journey Name"}
2. {"op": "setDescription", "description": "Brief description"}
3. {"op": "addNode", "node": {COMPLETE_NODE_OBJECT}}
4. {"op": "addEdge", "edge": {COMPLETE_EDGE_OBJECT}}
5. {"op": "removeNode", "nodeId": "node-id-to-remove"}
6. {"op": "removeEdge", "edgeId": "edge-id-to-remove"}
7. {"op": "updateNode", "nodeId": "node-id", "updates": {"position": {"x": 100, "y": 200}}}

IMPORTANT RULES:
- Every journey should start with at least ONE milestone node
- Output ONE operation per line
- Each line must be complete, valid JSON
- Start with setName and setDescription
- Then add nodes one at a time
- Finally add edges one at a time to CONNECT ALL NODES
- CRITICAL: Every node (except the last) MUST be connected to at least one other node
- To update node positions or properties, use updateNode operation
- NEVER output explanatory text - ONLY JSON operations
- Do NOT wrap in markdown code blocks
- Do NOT add explanatory text

Node structure:
{
  "id": "unique-id",
  "type": "milestone" | "goal" | "task",
  "position": {"x": number, "y": number},
  "data": {
    "label": "Node Label",
    "description": "Node description",
    "type": "milestone" | "goal" | "task",
    "todos": [{"id": "todo-1", "text": "Complete task", "completed": false}],
    "milestoneDate": "2024-01-15",
    "deadline": "2024-01-30",
    "startDate": "2024-01-01",
    "resources": [{"id": "res-1", "url": "https://...", "title": "Resource"}],
    "status": "not-started" | "in-progress" | "completed"
  }
}

NODE POSITIONING RULES:
- Nodes are squares, so use equal spacing in both directions
- Horizontal spacing between sequential nodes: 250px (e.g., x: 100, then x: 350, then x: 600)
- Vertical spacing for parallel branches: 250px (e.g., y: 75, y: 325, y: 575)
- Start milestone node at position {"x": 100, "y": 200}
- For linear journeys: increment x by 250 for each subsequent node, keep y constant
- For branching journeys: keep x the same for parallel branches, space y by 250px per branch
- When adding nodes to existing journeys, position new nodes 250px away from existing nodes

Node types:
- Milestone: Major checkpoints or phases (e.g., "Project kickoff", "MVP launch", "Beta release")
- Goal: Learning objectives or project goals (e.g., "Learn React fundamentals", "Build authentication system")
- Task: Specific actionable items (e.g., "Set up development environment", "Create user dashboard")

Journey structure examples:
- Learning paths: "Full-stack web development", "Machine learning basics"
- Project journeys: "SaaS product launch", "Mobile app development"
- Career paths: "Frontend developer path", "DevOps engineer path"

When generating journeys:
- Include relevant todos for each node (especially for goals and tasks)
- Add milestone dates for important checkpoints
- Add deadlines for time-sensitive goals/tasks
- Include start dates when appropriate
- Add resources (links to documentation, tutorials, etc.) for learning paths
- Use descriptive labels and descriptions

Edge structure:
{
  "id": "edge-id",
  "source": "source-node-id",
  "target": "target-node-id",
  "type": "default"
}

JOURNEY FLOW:
- Milestones connect to goals or other milestones
- Goals connect to tasks or other goals
- Tasks connect to other tasks or goals
- ALWAYS create edges to connect the journey flow
- For linear journeys: milestone -> goal1 -> task1 -> task2 -> goal2 -> etc
- For branching: one source can connect to multiple targets (e.g., one milestone leading to multiple goals)

Example output (linear learning path journey with 250px horizontal spacing):
{"op": "setName", "name": "React Learning Path"}
{"op": "setDescription", "description": "Complete journey for learning React from basics to advanced"}
{"op": "addNode", "node": {"id": "milestone-1", "type": "milestone", "position": {"x": 100, "y": 200}, "data": {"label": "Getting Started", "description": "Foundation phase", "type": "milestone", "milestoneDate": "2024-01-15", "status": "not-started"}}}
{"op": "addNode", "node": {"id": "goal-1", "type": "goal", "position": {"x": 350, "y": 200}, "data": {"label": "Learn React Fundamentals", "description": "Understand core concepts", "type": "goal", "todos": [{"id": "todo-1", "text": "Learn JSX syntax", "completed": false}, {"id": "todo-2", "text": "Understand components", "completed": false}], "deadline": "2024-01-30", "status": "not-started"}}}
{"op": "addNode", "node": {"id": "task-1", "type": "task", "position": {"x": 600, "y": 200}, "data": {"label": "Set up development environment", "description": "Install Node.js and create first React app", "type": "task", "todos": [{"id": "todo-3", "text": "Install Node.js", "completed": false}, {"id": "todo-4", "text": "Create React app with Vite", "completed": false}], "startDate": "2024-01-01", "status": "not-started"}}}
{"op": "addEdge", "edge": {"id": "e1", "source": "milestone-1", "target": "goal-1", "type": "default"}}
{"op": "addEdge", "edge": {"id": "e2", "source": "goal-1", "target": "task-1", "type": "default"}}

Example output (branching project journey with 250px vertical spacing):
{"op": "setName", "name": "SaaS Product Launch"}
{"op": "setDescription", "description": "Journey for launching a new SaaS product"}
{"op": "addNode", "node": {"id": "milestone-1", "type": "milestone", "position": {"x": 100, "y": 200}, "data": {"label": "Project Kickoff", "type": "milestone", "milestoneDate": "2024-01-01", "status": "not-started"}}}
{"op": "addNode", "node": {"id": "goal-frontend", "type": "goal", "position": {"x": 350, "y": 75}, "data": {"label": "Build Frontend", "type": "goal", "deadline": "2024-02-15", "status": "not-started"}}}
{"op": "addNode", "node": {"id": "goal-backend", "type": "goal", "position": {"x": 350, "y": 325}, "data": {"label": "Build Backend API", "type": "goal", "deadline": "2024-02-15", "status": "not-started"}}}
{"op": "addEdge", "edge": {"id": "e1", "source": "milestone-1", "target": "goal-frontend", "type": "default"}}
{"op": "addEdge", "edge": {"id": "e2", "source": "milestone-1", "target": "goal-backend", "type": "default"}}

REMEMBER: After adding all nodes, you MUST add edges to connect them! Every node should be reachable from the starting milestone.`;
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { prompt, existingWorkflow } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "AI API key not configured on server. Please contact support.",
        },
        { status: 500 }
      );
    }

    // Build the user prompt
    let userPrompt = prompt;
    if (existingWorkflow) {
      // Identify nodes and their labels for context
      const nodesList = (existingWorkflow.nodes || [])
        .map(
          (n: { id: string; data?: { label?: string } }) =>
            `- ${n.id} (${n.data?.label || "Unlabeled"})`
        )
        .join("\n");

      const edgesList = (existingWorkflow.edges || [])
        .map(
          (e: { id: string; source: string; target: string }) =>
            `- ${e.id}: ${e.source} -> ${e.target}`
        )
        .join("\n");

      userPrompt = `I have an existing journey. I want you to make ONLY the changes I request.

Current journey nodes:
${nodesList}

Current journey edges:
${edgesList}

Full journey data (DO NOT recreate these, they already exist):
${JSON.stringify(existingWorkflow, null, 2)}

User's request: ${prompt}

IMPORTANT: Output ONLY the operations needed to make the requested changes.
- If adding new nodes: output "addNode" operations for NEW nodes only, then IMMEDIATELY output "addEdge" operations to connect them to the journey
- If adding new edges: output "addEdge" operations for NEW edges only  
- If removing nodes: output "removeNode" operations with the nodeId to remove
- If removing edges: output "removeEdge" operations with the edgeId to remove
- If changing name/description: output "setName"/"setDescription" only if changed
- CRITICAL: New nodes MUST be connected with edges - always add edges after adding nodes
- When connecting nodes, look at the node IDs in the current journey list above
- DO NOT output operations for existing nodes/edges unless specifically modifying them
- Keep the existing journey structure and only add/modify/remove what was requested
- POSITIONING: When adding new nodes, look at existing node positions and place new nodes 250px away (horizontally or vertically) from existing nodes. Never overlap nodes.

Example: If user says "connect node A to node B", output:
{"op": "addEdge", "edge": {"id": "e-new", "source": "A", "target": "B", "type": "default"}}`;
    }

    const result = streamText({
      model: "openai/gpt-5.1-instant",
      system: getSystemPrompt(),
      prompt: userPrompt,
    });

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await processOperationStream(result.textStream, encoder, controller);
          controller.close();
        } catch (error) {
          controller.enqueue(
            encodeMessage(encoder, {
              type: "error",
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to generate journey",
            })
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Failed to generate journey:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate journey",
      },
      { status: 500 }
    );
  }
}
