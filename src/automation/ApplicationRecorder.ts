import type { AutoApplyApplicationResult } from './types';

export class ApplicationRecorder {
  private readonly results: AutoApplyApplicationResult[] = [];

  record(result: AutoApplyApplicationResult): void {
    this.results.push(result);
  }

  all(): AutoApplyApplicationResult[] {
    return [...this.results];
  }
}
