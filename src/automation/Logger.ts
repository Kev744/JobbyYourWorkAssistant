import { redactLogRecord } from './security/Redaction';
import type { AutoApplyErrorReason } from './types';

export interface AutoApplyLogRecord {
  runId: string;
  offerId?: string;
  strategyId?: string;
  stepName: string;
  status: 'info' | 'success' | 'error';
  reason?: AutoApplyErrorReason;
  url?: string;
  timestamp: string;
}

export class AutoApplyLogger {
  private readonly records: AutoApplyLogRecord[] = [];

  log(record: Omit<AutoApplyLogRecord, 'timestamp'>): void {
    this.records.push(
      redactLogRecord({
        ...record,
        timestamp: new Date().toISOString(),
      }),
    );
  }

  all(): AutoApplyLogRecord[] {
    return [...this.records];
  }
}
