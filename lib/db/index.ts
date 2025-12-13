import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import postgres from "postgres";

import {
  accounts,
  journeyNodes,
  journeyNodesRelations,
  journeys,
  sessions,
  users,
  verifications,
} from "./schema";

// Construct schema object for drizzle
const schema = {
  users,
  sessions,
  accounts,
  verifications,
  journeys,
  journeyNodes,
  journeyNodesRelations,
};

const connectionString =
  process.env.DATABASE_URL || "postgres://localhost:5432/workflow";

// For migrations
export const migrationClient = postgres(connectionString, { max: 1 });

// For queries
const client = new Pool({
  connectionString,
});
export const db = drizzle(client, { schema, casing: "snake_case" });
export { client };
