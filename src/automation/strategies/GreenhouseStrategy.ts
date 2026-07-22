import type { StrategyInput } from '../types';
import { GenericApplyStrategy } from './GenericApplyStrategy';

export class GreenhouseStrategy extends GenericApplyStrategy {
  override readonly id = 'greenhouse';
  override readonly name = 'Greenhouse supervisé';

  override async canHandle(input: StrategyInput): Promise<boolean> {
    return /greenhouse\.io|boards\.greenhouse/i.test(input.url);
  }
}
