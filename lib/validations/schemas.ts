import { z } from "zod";

// ID validation schema - IDs are generated using nanoid with lowercase alphanumeric characters (21 chars)
export const nanoidSchema = z
  .string()
  .min(10)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "Invalid NanoID format");

// Base schemas
export const positionSchema = z.object({
  x: z.number().min(-10_000).max(10_000),
  y: z.number().min(-10_000).max(10_000),
});

export const nodeDataSchema = z.object({
  label: z.string().max(500).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  icon: z.string().optional().nullable(),
  type: z.string().min(1).optional().nullable(),
  journalId: nanoidSchema.nullable(),
});

export const reactFlowNodeSchema = z.object({
  id: nanoidSchema,
  type: z.string().optional(),
  position: positionSchema,
  data: nodeDataSchema,
});

export const reactFlowEdgeSchema = z.object({
  id: nanoidSchema,
  source: nanoidSchema,
  target: nanoidSchema,
  type: z.string().default("default"),
});

export const journeyVisibilitySchema = z.enum(["private", "public"]);

// Composite schemas for API requests

// AI Generate schema
export const existingWorkflowSchema = z.object({
  nodes: z.array(reactFlowNodeSchema).optional(),
  edges: z.array(reactFlowEdgeSchema).optional(),
});

export const aiGenerateSchema = z.object({
  prompt: z.string().min(1).max(10_000),
  existingWorkflow: existingWorkflowSchema.optional(),
});

// Journey schemas
export const createJourneySchema = z.object({
  name: z.string().min(1).max(200),
  nodes: z.array(reactFlowNodeSchema),
  edges: z.array(reactFlowEdgeSchema),
  description: z.string().max(5000).optional(),
  journalId: nanoidSchema.nullable(),
  id: nanoidSchema.optional(),
});

export const updateJourneySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  edges: z.array(reactFlowEdgeSchema).optional(),
  nodes: z.array(reactFlowNodeSchema).optional(),
  visibility: journeyVisibilitySchema.optional(),
  journalId: nanoidSchema.optional().nullable(),
  updatedAt: z.iso.datetime().optional(),
});

// Sync journey schema
export const syncJourneySchema = z.object({
  id: nanoidSchema,
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  nodes: z.array(reactFlowNodeSchema),
  edges: z.array(reactFlowEdgeSchema),
  journalId: nanoidSchema.nullable(),
  visibility: journeyVisibilitySchema.optional(),
  createdAt: z.iso.datetime().optional(),
  updatedAt: z.iso.datetime().optional(),
  userId: nanoidSchema.optional(),
});

export const syncJourneysSchema = z.object({
  journeys: z.array(syncJourneySchema),
});

// Journal schemas
export const createJournalSchema = z.object({
  journeyId: nanoidSchema,
  content: z.string().max(1_048_576), // ~1MB
});

export const updateJournalSchema = z.object({
  content: z.string().max(1_048_576), // Can be empty string
});

// Sync journal schema
export const syncJournalSchema = z.object({
  id: nanoidSchema,
  content: z.string().max(1_048_576),
  userId: nanoidSchema,
  createdAt: z.iso.datetime().optional(),
  updatedAt: z.iso.datetime(),
});

export const syncJournalsSchema = z.object({
  journals: z.array(syncJournalSchema),
});

// User schema
export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  // email: z.string().email().optional(),
});

// Route parameter schemas
export const journeyIdParamSchema = z.object({
  journeyId: nanoidSchema,
});

export const journalIdParamSchema = z.object({
  journalId: nanoidSchema,
});

// Type exports for use in API routes
export type Position = z.infer<typeof positionSchema>;
export type NodeData = z.infer<typeof nodeDataSchema>;
export type ReactFlowNode = z.infer<typeof reactFlowNodeSchema>;
export type ReactFlowEdge = z.infer<typeof reactFlowEdgeSchema>;
export type JourneyVisibility = z.infer<typeof journeyVisibilitySchema>;
export type AIGenerateInput = z.infer<typeof aiGenerateSchema>;
export type CreateJourneyInput = z.infer<typeof createJourneySchema>;
export type UpdateJourneyInput = z.infer<typeof updateJourneySchema>;
export type SyncJourneysInput = z.infer<typeof syncJourneysSchema>;
export type CreateJournalInput = z.infer<typeof createJournalSchema>;
export type UpdateJournalInput = z.infer<typeof updateJournalSchema>;
export type SyncJournalsInput = z.infer<typeof syncJournalsSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type JourneyIdParam = z.infer<typeof journeyIdParamSchema>;
export type JournalIdParam = z.infer<typeof journalIdParamSchema>;
