import confetti from "canvas-confetti"

export const QUICK_REACTIONS = ["👍", "👎", "❤️", "🔥", "🎉", "👏", "👀", "🤝"]

export function fireEmojiConfetti(emoji: string, origin?: { x: number; y: number }) {
  if (typeof window === "undefined") return
  try {
    const clampedOrigin = origin
      ? {
          x: Math.min(Math.max(origin.x, 0.05), 0.95),
          y: Math.min(Math.max(origin.y, 0.05), 0.95),
        }
      : { x: 0.85, y: 0.7 }

    const shape = confetti.shapeFromText({ text: emoji, scalar: 2.2 })
    confetti({
      shapes: [shape],
      scalar: 2.2,
      particleCount: 20,
      spread: 55,
      startVelocity: 24,
      decay: 0.9,
      origin: clampedOrigin,
      ticks: 120,
      disableForReducedMotion: true,
    })
  } catch (err) {
    console.warn("Failed to trigger emoji confetti:", err)
  }
}
