"use client";

export interface ModelPickerProps {
  model?: string;
  onModelChange?: (model: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Modular model/mode picker subcomponent.
 * Ready for agent model switching or execution mode selection.
 */
export function ModelPicker(_props: ModelPickerProps) {
  // Mode / model selector placeholder for multi-model conversational routing
  return null;
}
