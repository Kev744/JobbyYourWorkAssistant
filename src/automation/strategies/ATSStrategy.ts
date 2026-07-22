import type { BlockingIssue, StrategyInput, StrategyResult } from '../types';

export interface StrategyContext {
  page: unknown;
  input: StrategyInput;
  reviewBeforeSubmit: boolean;
  signal?: AbortSignal;
}

export interface ATSStrategy {
  id: string;
  name: string;
  canHandle(input: StrategyInput): Promise<boolean>;
  prepare?(ctx: StrategyContext): Promise<void>;
  apply(ctx: StrategyContext): Promise<StrategyResult>;
  detectSuccess(ctx: StrategyContext): Promise<boolean>;
  detectBlockingIssue(ctx: StrategyContext): Promise<BlockingIssue | null>;
}
