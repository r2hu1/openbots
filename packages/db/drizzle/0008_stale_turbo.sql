DROP INDEX "memories_user_key_idx";--> statement-breakpoint
ALTER TABLE "memories" ALTER COLUMN "agent_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "memories_agent_key_idx" ON "memories" USING btree ("agent_id","key");