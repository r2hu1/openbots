import { relations } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { user } from "./auth.js";
import { conversations } from "./conversations.js";

export const scheduleStatusEnum = pgEnum("schedule_status", [
  "active",
  "paused",
]);

export const schedules = pgTable(
  "schedules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id").references(
      () => conversations.id,
      { onDelete: "set null" },
    ),
    name: text("name").notNull(),
    prompt: text("prompt").notNull(),
    cronExpression: text("cron_expression").notNull(),
    timezone: text("timezone").notNull().default("UTC"),
    triggerScheduleId: text("trigger_schedule_id"),
    status: scheduleStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("schedules_user_id_idx").on(table.userId),
    index("schedules_agent_id_idx").on(table.agentId),
    index("schedules_conversation_id_idx").on(table.conversationId),
  ],
);

export const schedulesRelations = relations(schedules, ({ one }) => ({
  user: one(user, {
    fields: [schedules.userId],
    references: [user.id],
  }),
  agent: one(agents, {
    fields: [schedules.agentId],
    references: [agents.id],
  }),
  conversation: one(conversations, {
    fields: [schedules.conversationId],
    references: [conversations.id],
  }),
}));

export type Schedule = typeof schedules.$inferSelect;
export type NewSchedule = typeof schedules.$inferInsert;
