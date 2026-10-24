import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { user } from "./auth.js";

export const memories = pgTable(
  "memories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, {
        onDelete: "cascade",
      }),
    key: text("key").notNull(),
    content: text("content").notNull(),
    category: text("category").notNull().default("general"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("memories_user_id_idx").on(table.userId),
    index("memories_agent_id_idx").on(table.agentId),
    index("memories_key_idx").on(table.key),
    index("memories_category_idx").on(table.category),
    index("memories_agent_key_idx").on(table.agentId, table.key),
  ],
);

export const memoriesRelations = relations(memories, ({ one }) => ({
  user: one(user, {
    fields: [memories.userId],
    references: [user.id],
  }),
  agent: one(agents, {
    fields: [memories.agentId],
    references: [agents.id],
  }),
}));

export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;
