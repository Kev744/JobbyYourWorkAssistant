import type { StrategyInput } from '../types';
import type { ATSStrategy } from './ATSStrategy';
import { GenericApplyStrategy } from './GenericApplyStrategy';

export class ATSStrategyRegistry {
  private readonly strategies: ATSStrategy[];
  private readonly genericStrategy: ATSStrategy;

  constructor(strategies: ATSStrategy[] = [], genericStrategy: ATSStrategy = new GenericApplyStrategy()) {
    this.strategies = strategies;
    this.genericStrategy = genericStrategy;
  }

  async resolve(input: StrategyInput): Promise<ATSStrategy> {
    for (const strategy of this.strategies) {
      if (await strategy.canHandle(input)) {
        return strategy;
      }
    }

    return this.genericStrategy;
  }
}
