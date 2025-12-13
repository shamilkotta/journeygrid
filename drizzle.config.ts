import { config } from "dotenv";
import type { Config } from "drizzle-kit";

config();

console.log({ db: process.env.DATABASE_URL });

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgres://localhost:5432/workflow",
  },
} satisfies Config;
