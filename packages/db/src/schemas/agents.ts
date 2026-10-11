import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { agentTools } from "./agent-tools.js";
import { user } from "./auth.js";
import { conversations } from "./conversations.js";
import { runs } from "./runs.js";

export const agentStatusEnum = pgEnum("agent_status", [
  "active",
  "paused",
  "archived",
]);

export const agentAutonomyEnum = pgEnum("agent_autonomy", [
  "manual",
  "approved",
  "autonomous",
]);

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    instructions: text("instructions").notNull(),
    model: text("model").notNull().default("google/gemini-2.5-flash"),
    status: agentStatusEnum("status").notNull().default("active"),
    autonomy: agentAutonomyEnum("autonomy").notNull().default("manual"),
    maxSteps: integer("max_steps").notNull().default(10),
    sandboxId: text("sandbox_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("agents_user_id_idx").on(table.userId)],
);

export const agentsRelations = relations(agents, ({ one, many }) => ({
  user: one(user, {
    fields: [agents.userId],
    references: [user.id],
  }),
  tools: many(agentTools),
  conversations: many(conversations),
  runs: many(runs),
}));

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
