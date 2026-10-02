import { blobatar } from "blobatar";

export function toGrayscaleSvg(svg: string): string {
  // Convert any fill/stroke hex colors to luminance grayscale
  return svg.replace(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g, (match) => {
    let hex = match.slice(1);
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    const grayHex = gray.toString(16).padStart(2, "0");
    return `#${grayHex}${grayHex}${grayHex}`;
  });
}

export function generateBlobatarSvg(
  name: string,
  options?: Parameters<typeof blobatar>[1] & { grayscale?: boolean },
): string {
  const { grayscale, ...rest } = options ?? {};
  const svg = blobatar(name, rest);
  if (grayscale) {
    return toGrayscaleSvg(svg);
  }
  return svg;
}
