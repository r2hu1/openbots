export async function uploadConversationImage(
  userId: string,
  file: File | Blob,
  fileName?: string,
) {
  // Validate file size: 25MB maximum for docs/media
  const MAX_FILE_SIZE = 25 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    return {
      error: "File size exceeds the 25MB maximum limit.",
      status: 400 as const,
    };
  }

  const rawName = fileName || (file as any).name || "file.bin";
  const extension = rawName.includes(".")
    ? rawName.split(".").pop()!.toLowerCase()
    : "bin";

  const mimeMap: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ppt: "application/vnd.ms-powerpoint",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    csv: "text/csv",
    txt: "text/plain",
    md: "text/markdown",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
  };

  const contentType =
    file.type || mimeMap[extension] || "application/octet-stream";
  const uniqueId = crypto.randomUUID();
  const bucket =
    process.env.SUPABASE_STORAGE_BUCKET || "conversation-attachments";
  const path = `${userId}/${uniqueId}_${rawName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const { uploadStorageObject, getStoragePublicUrl } = await import(
    "@openbots/db"
  );
  const arrayBuffer = await file.arrayBuffer();

  const { data, error } = await uploadStorageObject({
    bucket,
    path,
    fileBody: arrayBuffer,
    contentType,
    upsert: false,
  });

  if (error || !data) {
    console.error("Failed to upload file to Supabase storage:", error);
    return {
      error: error?.message || "Failed to upload file to storage.",
      status: 500 as const,
    };
  }

  const { data: publicUrlData } = getStoragePublicUrl(bucket, path);

  return {
    success: true,
    url: publicUrlData.publicUrl,
    path,
    name: rawName,
    mimeType: contentType,
    sizeBytes: file.size,
    status: 200 as const,
  };
}

export async function deleteConversationImage(
  userId: string,
  filePathOrUrl: string,
) {
  const bucket =
    process.env.SUPABASE_STORAGE_BUCKET || "conversation-attachments";
  let targetPath = filePathOrUrl;

  // If a full public URL was provided, extract the path after bucket name
  if (
    filePathOrUrl.startsWith("http://") ||
    filePathOrUrl.startsWith("https://")
  ) {
    const urlParts = filePathOrUrl.split(`/${bucket}/`);
    if (urlParts.length > 1) {
      targetPath = decodeURIComponent(urlParts[1]!.split("?")[0]!);
    }
  }

  // Security check: ensure user owns this file path
  if (!targetPath.startsWith(`${userId}/`)) {
    return {
      error: "Unauthorized to delete this file",
      status: 403 as const,
    };
  }

  const { deleteStorageObject } = await import("@openbots/db");
  const { error } = await deleteStorageObject(bucket, targetPath);

  if (error) {
    console.warn("Failed to delete object from storage:", error);
    return {
      error: error.message || "Failed to delete file from storage.",
      status: 500 as const,
    };
  }

  return {
    success: true,
    path: targetPath,
    status: 200 as const,
  };
}
