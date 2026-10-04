import type {
  FileOptions,
  SearchOptions,
  StorageError,
} from "@supabase/storage-js";
import { createClient } from "@supabase/supabase-js";

/**
 * Returns a configured Supabase client for storage operations.
 * Reads SUPABASE_URL and either SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY.
 *
 * For backend operations requiring administrative access (or bypassing RLS),
 * SUPABASE_SERVICE_ROLE_KEY should be set.
 */
export function getSupabaseStorageClient() {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase Storage requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) environment variables.",
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export interface UploadStorageFileOptions extends FileOptions {
  bucket: string;
  path: string;
  fileBody:
    | ArrayBuffer
    | ArrayBufferView
    | Blob
    | Buffer
    | File
    | FormData
    | NodeJS.ReadableStream
    | ReadableStream<Uint8Array>
    | URLSearchParams
    | string;
}

export interface StorageFileResult {
  data: { id?: string; path: string; fullPath?: string } | null;
  error: StorageError | null;
}

export interface StorageSignedUrlResult {
  data: { signedUrl: string } | null;
  error: StorageError | null;
}

export interface StoragePublicUrlResult {
  data: { publicUrl: string };
}

export interface StorageDownloadResult {
  data: Blob | null;
  error: StorageError | null;
}

export interface StorageDeleteResult {
  data: { name: string }[] | null;
  error: StorageError | null;
}

export interface StorageListResult {
  data:
    | {
        name: string;
        id: string | null;
        updated_at: string | null;
        created_at: string | null;
        last_accessed_at: string | null;
        metadata: Record<string, unknown> | null;
      }[]
    | null;
  error: StorageError | null;
}

/**
 * Upload an object to a Supabase storage bucket.
 * If `upsert: true` is specified, it will overwrite any existing file at that path.
 */
export async function uploadStorageObject(
  options: UploadStorageFileOptions,
): Promise<StorageFileResult> {
  const supabase = getSupabaseStorageClient();
  const { bucket, path, fileBody, ...uploadOptions } = options;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, fileBody, {
      upsert: false,
      ...uploadOptions,
    });

  return { data, error };
}

/**
 * Update / Overwrite an existing object in a Supabase storage bucket.
 * Uses storage.from(bucket).update(...)
 */
export async function updateStorageObject(
  options: UploadStorageFileOptions,
): Promise<StorageFileResult> {
  const supabase = getSupabaseStorageClient();
  const { bucket, path, fileBody, ...uploadOptions } = options;

  const { data, error } = await supabase.storage
    .from(bucket)
    .update(path, fileBody, {
      upsert: true,
      ...uploadOptions,
    });

  return { data, error };
}

/**
 * Download / Get an object's binary content (Blob) from Supabase storage.
 */
export async function getStorageObject(
  bucket: string,
  path: string,
): Promise<StorageDownloadResult> {
  const supabase = getSupabaseStorageClient();
  const { data, error } = await supabase.storage.from(bucket).download(path);
  return { data, error };
}

/**
 * Get the public URL for an object in a public Supabase storage bucket.
 */
export function getStoragePublicUrl(
  bucket: string,
  path: string,
  options?: {
    download?: string | boolean;
    transform?: {
      width?: number;
      height?: number;
      resize?: "cover" | "contain" | "fill";
      quality?: number;
      format?: "origin";
    };
  },
): StoragePublicUrlResult {
  const supabase = getSupabaseStorageClient();
  const { data } = supabase.storage.from(bucket).getPublicUrl(path, options);
  return { data };
}

/**
 * Create a signed temporary URL for downloading or viewing an object in a private bucket.
 * @param expiresIn Seconds until the signed URL expires (default: 3600s = 1 hour)
 */
export async function getStorageSignedUrl(
  bucket: string,
  path: string,
  expiresIn = 3600,
  options?: {
    download?: string | boolean;
    transform?: {
      width?: number;
      height?: number;
      resize?: "cover" | "contain" | "fill";
      quality?: number;
      format?: "origin";
    };
  },
): Promise<StorageSignedUrlResult> {
  const supabase = getSupabaseStorageClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn, options);
  return { data, error };
}

/**
 * Delete one or more objects from a Supabase storage bucket.
 */
export async function deleteStorageObjects(
  bucket: string,
  paths: string[],
): Promise<StorageDeleteResult> {
  const supabase = getSupabaseStorageClient();
  const { data, error } = await supabase.storage.from(bucket).remove(paths);
  return { data, error };
}

/**
 * Delete a single object from a Supabase storage bucket.
 */
export async function deleteStorageObject(
  bucket: string,
  path: string,
): Promise<StorageDeleteResult> {
  return deleteStorageObjects(bucket, [path]);
}

/**
 * List objects within a bucket path/folder.
 */
export async function listStorageObjects(
  bucket: string,
  path?: string,
  options?: SearchOptions,
): Promise<StorageListResult> {
  const supabase = getSupabaseStorageClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(path || "", options);
  return { data, error };
}
