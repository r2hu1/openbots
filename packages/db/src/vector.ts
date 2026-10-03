import { google } from "@ai-sdk/google";
import { embed } from "ai";
import { and, cosineDistance, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "./client.js";
import { memories } from "./schemas/index.js";


const EMBEDDING_DIMENSIONS = 768;

type EmbeddingTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";


export async function vectorize(
  text: string,
  taskType: EmbeddingTaskType = "RETRIEVAL_DOCUMENT",
): Promise<number[]> {
  const { embedding } = await embed({
    model: google.textEmbeddingModel("gemini-embedding-001"),
    value: text,
    providerOptions: {
      google: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType },
    },
  });
  return embedding;
}


export async function saveMemory(params: {
  userId: string;
  content: string;
  metadata?: Record<string, unknown>;
}) {
  const content = params.content.trim();
  if (!content) throw new Error("Cannot save an empty memory");

  const embedding = await vectorize(content, "RETRIEVAL_DOCUMENT");

  const [row] = await db
    .insert(memories)
    .values({
      userId: params.userId,
      content,
      metadata: params.metadata ?? null,
      embedding,
    })
    .returning();

  return row;
}


export async function getMemory(params: {
  userId: string;
  query: string;
  limit?: number;
  minSimilarity?: number;
}) {
  const { userId, query, limit = 5, minSimilarity = 0.3 } = params;

  const queryEmbedding = await vectorize(query, "RETRIEVAL_QUERY");
  const similarity = sql<number>`1 - (${cosineDistance(memories.embedding, queryEmbedding)})`;

  return db
    .select({
      id: memories.id,
      content: memories.content,
      metadata: memories.metadata,
      createdAt: memories.createdAt,
      similarity,
    })
    .from(memories)
    .where(and(eq(memories.userId, userId), gt(similarity, minSimilarity)))
    .orderBy(desc(similarity))
    .limit(limit);
}

export async function deleteMemory(params: { userId: string; id: string }) {
  await db
    .delete(memories)
    .where(and(eq(memories.id, params.id), eq(memories.userId, params.userId)));
}