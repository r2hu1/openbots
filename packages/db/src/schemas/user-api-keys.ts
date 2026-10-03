import { relations } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";

export const userApiKeys = pgTable(
  "user_api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // 'openai' | 'anthropic' | 'openrouter' | 'google' | 'groq' | 'xai' | 'deepseek'
    encryptedKey: text("encrypted_key").notNull(),
    iv: text("iv").notNull(),
    authTag: text("auth_tag").notNull(),
    keyHint: text("key_hint").notNull(), // e.g. "4a2b" or last 4 chars
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("user_api_keys_user_id_idx").on(table.userId),
    unique("user_api_keys_user_provider_unique").on(
      table.userId,
      table.provider,
    ),
  ],
);

export const userApiKeysRelations = relations(userApiKeys, ({ one }) => ({
  user: one(user, {
    fields: [userApiKeys.userId],
    references: [user.id],
  }),
}));

export type UserApiKey = typeof userApiKeys.$inferSelect;
export type NewUserApiKey = typeof userApiKeys.$inferInsert;
