export interface ManualHandoffViewModel {
  reason: string;
  lastReachedUrl?: string;
  lastSuccessfulStep?: string;
  suggestedNextAction: string;
}

export function buildManualHandoffViewModel(input: ManualHandoffViewModel): ManualHandoffViewModel {
  return input;
}
