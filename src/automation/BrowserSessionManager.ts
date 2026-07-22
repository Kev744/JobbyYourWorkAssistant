import type { Browser, BrowserContext, Page } from 'playwright';

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

export interface BrowserSessionOptions {
  headed?: boolean;
  persistSession?: boolean;
}

export class BrowserSessionManager {
  async createSession(options: BrowserSessionOptions = {}): Promise<BrowserSession> {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({
      headless: options.headed === false,
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    return { browser, context, page };
  }

  async closeSession(session: BrowserSession): Promise<void> {
    await session.context.close();
    await session.browser.close();
  }
}
