import type { StrategyInput } from '../types';
import { GenericApplyStrategy } from './GenericApplyStrategy';

export class LeverStrategy extends GenericApplyStrategy {
  override readonly id = 'lever';
  override readonly name = 'Lever supervisé';

  override async canHandle(input: StrategyInput): Promise<boolean> {
    return /lever\.co|jobs\.lever/i.test(input.url);
  }
}
