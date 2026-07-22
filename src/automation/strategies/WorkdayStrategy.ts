import type { StrategyInput } from '../types';
import { GenericApplyStrategy } from './GenericApplyStrategy';

export class WorkdayStrategy extends GenericApplyStrategy {
  override readonly id = 'workday';
  override readonly name = 'Workday supervisé';

  override async canHandle(input: StrategyInput): Promise<boolean> {
    return /myworkdayjobs\.com|workdayjobs/i.test(input.url);
  }
}
