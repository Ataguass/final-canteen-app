import type { EventSubscription } from "expo-modules-core";

export const ExpoKeepAwakeTag = "ExpoKeepAwakeDefaultTag";

export function useKeepAwake(_tag?: string): void {
  // Intentionally no-op in this project to avoid dev-mode keep-awake activation crashes.
}

export async function isAvailableAsync(): Promise<boolean> {
  return false;
}

export async function activateKeepAwakeAsync(_tag: string = ExpoKeepAwakeTag): Promise<void> {
  // no-op
}

export async function deactivateKeepAwake(_tag: string = ExpoKeepAwakeTag): Promise<void> {
  // no-op
}

export function addListener(): EventSubscription {
  return {
    remove: () => undefined
  };
}

