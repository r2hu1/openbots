"use client";

export interface VoiceInputProps {
  onTranscript?: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Modular voice/audio input subcomponent.
 * Ready for speech-to-text integration while maintaining presentational parity.
 */
export function VoiceInput(_props: VoiceInputProps) {
  // Voice input placeholder for speech recognition / audio recording capabilities
  return null;
}
