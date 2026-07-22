import type { BlockingIssue, StrategyInput, StrategyResult } from '../types';
import type { ATSStrategy, StrategyContext } from './ATSStrategy';

const BLOCKING_PATTERNS: Array<{ pattern: RegExp; reason: BlockingIssue['reason']; message: string }> = [
  {
    pattern: /captcha|robot|challenge/i,
    reason: 'CAPTCHA_OR_CHALLENGE_BLOCKED',
    message: 'Un contrôle anti-robot demande une action manuelle.',
  },
  {
    pattern: /403|forbidden|access denied/i,
    reason: 'WEBSITE_POLICY_BLOCKED',
    message: "Le site bloque l'accès automatisé ou refuse la page.",
  },
  {
    pattern: /429|too many requests|rate limit/i,
    reason: 'RATE_LIMITED',
    message: 'Le site demande de ralentir ou bloque temporairement les requêtes.',
  },
];

export class GenericApplyStrategy implements ATSStrategy {
  readonly id: string = 'generic';
  readonly name: string = 'Stratégie générique supervisée';

  async canHandle(input: StrategyInput): Promise<boolean> {
    void input;
    return true;
  }

  async apply(ctx: StrategyContext): Promise<StrategyResult> {
    void ctx;
    return {
      status: 'Error',
      reason: 'FORM_FIELD_UNMAPPED',
      lastSuccessfulStep: 'open_application_page',
      requiresManualAction: true,
      userVisibleMessage:
        "Le site n'a pas de stratégie validée. Ouvrez la page et finalisez la candidature manuellement.",
    };
  }

  async detectSuccess(ctx: StrategyContext): Promise<boolean> {
    void ctx;
    return false;
  }

  async detectBlockingIssue(ctx: StrategyContext): Promise<BlockingIssue | null> {
    const text = typeof ctx.page === 'string' ? ctx.page : ctx.input.website;

    for (const issue of BLOCKING_PATTERNS) {
      if (issue.pattern.test(text)) {
        return {
          reason: issue.reason,
          userVisibleMessage: issue.message,
        };
      }
    }

    return null;
  }
}
