import { fetchImagePart } from "./abort-and-sanitize.js";

export async function prepareInputMessages(params: {
  historyMessages: Array<any>;
  runRecord: any;
}) {
  const { historyMessages, runRecord } = params;
  const inputMessages: Array<any> = [];

  for (const m of historyMessages) {
    if (m.role === "user") {
      const contentObj = (
        m.content && typeof m.content === "object" ? m.content : {}
      ) as any;
      const textContent =
        typeof m.content === "string"
          ? m.content
          : (contentObj.text ?? contentObj.prompt ?? "");
      const images: string[] = Array.isArray(contentObj.images)
        ? contentObj.images
        : [];
      const attachments: Array<any> = Array.isArray(contentObj.attachments)
        ? contentObj.attachments
        : [];

      let combinedText = textContent;
      if (attachments.length > 0) {
        const docNotes = attachments
          .map(
            (a) =>
              `[Attached document: "${a.name}" (${a.mimeType || "document"})\nURL: ${a.url}\nUse parse_document tool with this URL to extract its text, structure, sheets, slides, or styles]`,
          )
          .join("\n\n");
        combinedText = combinedText
          ? `${combinedText}\n\n${docNotes}`
          : docNotes;
      }

      if (images.length > 0) {
        const parts: Array<any> = [];
        if (combinedText) {
          parts.push({ type: "text", text: combinedText });
        }
        for (const imgUrl of images) {
          parts.push(await fetchImagePart(imgUrl));
        }
        inputMessages.push({
          role: "user",
          content: parts,
        });
      } else {
        inputMessages.push({
          role: "user",
          content:
            combinedText ||
            (typeof m.content === "string"
              ? m.content
              : JSON.stringify(m.content)),
        });
      }
    } else if (m.role === "assistant" || m.role === "system") {
      let textContent = "";
      if (typeof m.content === "string") {
        textContent = m.content;
      } else if (m.content && typeof m.content === "object") {
        textContent =
          (m.content as any).text ??
          (m.content as any).prompt ??
          JSON.stringify(m.content);
      }
      inputMessages.push({
        role: m.role,
        content: textContent,
      });
    }
  }

  // Add current run input
  const inputObj = runRecord.input as any;
  const promptText =
    typeof inputObj === "string"
      ? inputObj
      : (inputObj?.prompt ??
        inputObj?.text ??
        (inputObj?.messages ? null : ""));
  const runImages: string[] = Array.isArray(inputObj?.images)
    ? inputObj.images
    : [];
  const runAttachments: Array<any> = Array.isArray(inputObj?.attachments)
    ? inputObj.attachments
    : [];

  let promptWithDocs = promptText;
  if (runAttachments.length > 0) {
    const docNotes = runAttachments
      .map(
        (a) =>
          `[Attached document: "${a.name}" (${a.mimeType || "document"})\nURL: ${a.url}\nUse parse_document tool with this URL to extract its text, structure, sheets, slides, or styles]`,
      )
      .join("\n\n");
    promptWithDocs = promptWithDocs
      ? `${promptWithDocs}\n\n${docNotes}`
      : docNotes;
  }

  if (promptWithDocs || runImages.length > 0) {
    const isScheduleTrigger = runRecord.triggerType === "schedule";
    const effectiveUserPrompt = isScheduleTrigger
      ? `[SYSTEM NOTIFICATION: The timer/scheduled alarm for this task has elapsed now.]\nDeliver this reminder/scheduled alert directly to the user:\n"${promptWithDocs}"`
      : promptWithDocs;

    // Check if already in history as the last message
    const lastMsg = inputMessages[inputMessages.length - 1];
    const isDuplicate =
      lastMsg &&
      lastMsg.role === "user" &&
      (typeof lastMsg.content === "string"
        ? lastMsg.content === effectiveUserPrompt && runImages.length === 0
        : false);

    if (!isDuplicate) {
      if (runImages.length > 0) {
        const parts: Array<any> = [];
        if (effectiveUserPrompt) {
          parts.push({ type: "text", text: effectiveUserPrompt });
        }
        for (const imgUrl of runImages) {
          parts.push(await fetchImagePart(imgUrl));
        }
        inputMessages.push({
          role: "user",
          content: parts,
        });
      } else if (effectiveUserPrompt) {
        inputMessages.push({
          role: "user",
          content: effectiveUserPrompt,
        });
      }
    }
  } else if (Array.isArray(inputObj?.messages)) {
    for (const m of inputObj.messages) {
      inputMessages.push(m);
    }
  }

  return inputMessages;
}
