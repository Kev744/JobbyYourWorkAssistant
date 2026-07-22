import type { StrategyInput } from '../types';
import { GenericApplyStrategy } from './GenericApplyStrategy';

export class SmartRecruitersStrategy extends GenericApplyStrategy {
  override readonly id = 'smartrecruiters';
  override readonly name = 'SmartRecruiters supervisé';

  override async canHandle(input: StrategyInput): Promise<boolean> {
    return /smartrecruiters\.com/i.test(input.url);
  }
}
