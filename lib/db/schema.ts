import { relations } from "drizzle-orm";
import {
  boolean,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { generateId } from "../utils/id";

// Better Auth tables
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  // Anonymous user tracking
  isAnonymous: boolean("is_anonymous").default(false),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

// Journals table for storing journal content (used by journeys and nodes)
export const journals = pgTable("journals", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  content: text("content"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Journal node type
export type JourneyNodeType = "goal" | "task" | "milestone" | "add";

// Journey visibility type
export type JourneyVisibility = "private" | "public";

// Journeys table with user association
export const journeys = pgTable("journeys", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId()),
  name: text("name").notNull(),
  description: text("description"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  // biome-ignore lint/suspicious/noExplicitAny: JSONB type - structure validated at application level
  edges: jsonb("edges").notNull().$type<any[]>(),
  journalId: text("journal_id").references(() => journals.id),
  visibility: text("visibility")
    .notNull()
    .default("private")
    .$type<JourneyVisibility>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Journey nodes table - stores all node data for a journey
export const journeyNodes = pgTable("journey_nodes", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId()),
  journeyId: text("journey_id")
    .notNull()
    .references(() => journeys.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  icon: text("icon"),
  description: text("description"),
  type: text("type").notNull().$type<JourneyNodeType>(),
  positionX: real("position_x").notNull(),
  positionY: real("position_y").notNull(),
  journalId: text("journal_id").references(() => journals.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Relations
export const journalsRelations = relations(journals, ({ one }) => ({
  user: one(users, {
    fields: [journals.userId],
    references: [users.id],
  }),
}));

export const journeysRelations = relations(journeys, ({ one, many }) => ({
  user: one(users, {
    fields: [journeys.userId],
    references: [users.id],
  }),
  journal: one(journals, {
    fields: [journeys.journalId],
    references: [journals.id],
  }),
  nodes: many(journeyNodes),
}));

export const journeyNodesRelations = relations(journeyNodes, ({ one }) => ({
  journey: one(journeys, {
    fields: [journeyNodes.journeyId],
    references: [journeys.id],
  }),
  journal: one(journals, {
    fields: [journeyNodes.journalId],
    references: [journals.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Journal = typeof journals.$inferSelect;
export type NewJournal = typeof journals.$inferInsert;
export type Journey = typeof journeys.$inferSelect;
export type NewJourney = typeof journeys.$inferInsert;
export type JourneyNodeDB = typeof journeyNodes.$inferSelect;
export type NewJourneyNodeDB = typeof journeyNodes.$inferInsert;
