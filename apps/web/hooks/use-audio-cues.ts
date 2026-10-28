"use client";

import * as React from "react";
import {
  AUDIO_CUES_STORAGE_KEY,
  type AudioCueType,
  isAudioCuesEnabled,
  playAudioCue,
} from "@/lib/audio-cues";

export function useAudioCues() {
  const [enabled, setEnabledState] = React.useState<boolean>(true);

  React.useEffect(() => {
    setEnabledState(isAudioCuesEnabled());

    const handleStorage = (event: StorageEvent) => {
      if (event.key === AUDIO_CUES_STORAGE_KEY) {
        setEnabledState(event.newValue === null ? true : event.newValue === "true");
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const setEnabled = React.useCallback((value: boolean) => {
    setEnabledState(value);
    try {
      window.localStorage.setItem(AUDIO_CUES_STORAGE_KEY, String(value));
    } catch {}
  }, []);

  const play = React.useCallback((type: AudioCueType, force = false) => {
    playAudioCue(type, force);
  }, []);

  return {
    enabled,
    setEnabled,
    play,
  };
}
