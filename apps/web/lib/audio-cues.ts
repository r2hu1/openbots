export type AudioCueType = "finish" | "attention" | "error";

const SOUND_PATHS: Record<AudioCueType, string> = {
  finish: "/sounds/finish.mp3",
  attention: "/sounds/attention.mp3",
  error: "/sounds/error.mp3",
};

export const AUDIO_CUES_STORAGE_KEY = "openbots:audio-cues";

/**
 * Returns true if audio cues are enabled in localStorage.
 * Defaults to true.
 */
export function isAudioCuesEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const item = window.localStorage.getItem(AUDIO_CUES_STORAGE_KEY);
    return item === null ? true : item === "true";
  } catch {
    return true;
  }
}

const audioCache = new Map<string, HTMLAudioElement>();

/**
 * Plays an audio cue tone.
 * @param type "finish" | "attention" | "error"
 * @param force If true, bypasses the user audio-cues toggle (useful for manual test playback)
 */
export function playAudioCue(type: AudioCueType, force = false): void {
  if (typeof window === "undefined") return;
  if (!force && !isAudioCuesEnabled()) return;

  const src = SOUND_PATHS[type];
  if (!src) return;

  try {
    let audio = audioCache.get(src);
    if (!audio) {
      audio = new Audio(src);
      audio.preload = "auto";
      audioCache.set(src, audio);
    } else {
      audio.currentTime = 0;
    }

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        // Autoplay may be restricted before initial user gesture
        console.debug("Audio cue playback was prevented by browser policy:", err);
      });
    }
  } catch (err) {
    console.debug("Failed to play audio cue:", err);
  }
}

// Bounded set to prevent duplicate sounds for the same run across multiple SSE callbacks
const playedRunSoundKeys = new Set<string>();

/**
 * Plays an audio cue once per runId + type combination.
 * Useful when multiple SSE stream callbacks (e.g. stream onDone and agent onRunStatus)
 * report the same terminal event.
 */
export function playRunAudioCue(
  runId: string | null | undefined,
  type: AudioCueType,
  force = false
): void {
  if (runId) {
    const key = `${runId}:${type}`;
    if (playedRunSoundKeys.has(key)) return;
    playedRunSoundKeys.add(key);

    if (playedRunSoundKeys.size > 200) {
      const first = playedRunSoundKeys.values().next().value;
      if (first) playedRunSoundKeys.delete(first);
    }
  }

  playAudioCue(type, force);
}
