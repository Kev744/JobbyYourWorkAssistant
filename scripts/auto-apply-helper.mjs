import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

const HOST = '127.0.0.1';
const PORT = 43789;
const MAX_BODY_BYTES = 1_000_000;
const activeBrowsers = new Set();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const server = createServer(async (request, response) => {
  try {
    if (request.method === 'OPTIONS') {
      sendJson(response, 204, {});
      return;
    }

    const url = new URL(request.url ?? '/', `http://${HOST}:${PORT}`);

    if (request.method === 'GET' && url.pathname === '/health') {
      sendJson(response, 200, {
        status: 'ok',
        service: 'matchingcv-auto-apply-helper',
        version: 1,
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/runs') {
      const payload = await readJsonBody(request);
      const summary = await runAutoApply(payload);

      sendJson(response, 200, summary);
      return;
    }

    sendJson(response, 404, { error: 'Route inconnue.' });
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Erreur du helper local.',
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`MatchingCV auto-apply helper listening on http://${HOST}:${PORT}`);
  console.log('Keep this terminal open while running supervised auto-apply sessions.');
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await closeBrowsers();
    process.exit(0);
  });
}

async function runAutoApply(payload) {
  const runId = randomUUID();
  const request = validateRunRequest(payload?.request);
  const offers = validateOffers(payload?.offers).slice(0, request.dailyApplicationLimit);
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const results = [];

  activeBrowsers.add(browser);

  for (const offer of offers) {
    const startedAt = new Date().toISOString();
    const page = await context.newPage();
    let finalUrl = offer.applicationUrl;
    let reason = 'FORM_FIELD_UNMAPPED';
    let userVisibleMessage =
      'Page ouverte et champs sûrs préparés. La revue finale et la soumission restent manuelles.';
    let lastSuccessfulStep = 'open_application_page';

    try {
      await page.goto(offer.applicationUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      finalUrl = page.url();
      lastSuccessfulStep = 'open_application_page';

      const blockingIssue = await detectBlockingIssue(page);

      if (blockingIssue) {
        reason = blockingIssue.reason;
        userVisibleMessage = blockingIssue.userVisibleMessage;
      } else {
        const filledEmail = await fillFirstMatchingField(page, request.emailAddress, [
          () => page.getByLabel(/e-?mail|courriel|adresse e-mail/i),
          () => page.locator('input[type="email"]'),
          () => page.locator('input[name*="email" i]'),
        ]);

        if (filledEmail) {
          lastSuccessfulStep = 'fill_email';
        }
      }
    } catch {
      reason = 'NETWORK_ERROR';
      userVisibleMessage = "Impossible d'ouvrir correctement la page de candidature.";
    }

    results.push({
      offerId: offer.offerId,
      status: 'Error',
      reason,
      website: offer.sourceWebsite,
      finalUrl,
      emailUsed: request.emailAddress,
      strategyId: inferStrategyId(offer.applicationUrl),
      startedAt,
      finishedAt: new Date().toISOString(),
      lastSuccessfulStep,
      requiresManualAction: true,
      userVisibleMessage,
    });
  }

  return {
    runId,
    successCount: 0,
    errorCount: results.length,
    stoppedReason: results.length === 0 ? 'NO_ELIGIBLE_OFFERS' : 'BLOCKED',
    results,
  };
}

async function detectBlockingIssue(page) {
  const bodyText = await page.locator('body').innerText({ timeout: 5_000 }).catch(() => '');

  if (/captcha|robot|challenge/i.test(bodyText)) {
    return {
      reason: 'CAPTCHA_OR_CHALLENGE_BLOCKED',
      userVisibleMessage: 'Un contrôle anti-robot demande une action manuelle.',
    };
  }

  if (/403|forbidden|access denied/i.test(bodyText)) {
    return {
      reason: 'WEBSITE_POLICY_BLOCKED',
      userVisibleMessage: "Le site bloque l'accès automatisé ou refuse la page.",
    };
  }

  if (/429|too many requests|rate limit/i.test(bodyText)) {
    return {
      reason: 'RATE_LIMITED',
      userVisibleMessage: 'Le site demande de ralentir ou bloque temporairement les requêtes.',
    };
  }

  return null;
}

async function fillFirstMatchingField(page, value, locatorFactories) {
  for (const factory of locatorFactories) {
    const locator = factory().first();

    if ((await locator.count().catch(() => 0)) === 0) {
      continue;
    }

    if (!(await locator.isVisible().catch(() => false))) {
      continue;
    }

    await locator.fill(value);
    return true;
  }

  return false;
}

function validateRunRequest(value) {
  if (!value || typeof value !== 'object') {
    throw new Error('Configuration de session invalide.');
  }

  if (!Number.isInteger(value.dailyApplicationLimit) || value.dailyApplicationLimit < 1) {
    throw new Error('Nombre de candidatures invalide.');
  }

  if (value.applicationMode !== 'review-before-submit') {
    throw new Error('La revue avant soumission est obligatoire.');
  }

  if (!value.siteConsent) {
    throw new Error('Consentement utilisateur manquant.');
  }

  if (typeof value.emailAddress !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.emailAddress)) {
    throw new Error('Adresse e-mail invalide.');
  }

  return value;
}

function validateOffers(value) {
  if (!Array.isArray(value)) {
    throw new Error('Liste des offres invalide.');
  }

  return value.filter(
    (offer) =>
      offer &&
      typeof offer.offerId === 'string' &&
      typeof offer.title === 'string' &&
      typeof offer.sourceWebsite === 'string' &&
      typeof offer.applicationUrl === 'string' &&
      /^https?:\/\//i.test(offer.applicationUrl),
  );
}

function inferStrategyId(url) {
  if (/greenhouse\.io|boards\.greenhouse/i.test(url)) return 'greenhouse';
  if (/lever\.co|jobs\.lever/i.test(url)) return 'lever';
  if (/myworkdayjobs\.com|workdayjobs/i.test(url)) return 'workday';
  if (/smartrecruiters\.com/i.test(url)) return 'smartrecruiters';

  return 'generic';
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;

    if (size > MAX_BODY_BYTES) {
      throw new Error('Payload trop volumineux.');
    }

    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    ...corsHeaders,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });

  if (status === 204) {
    response.end();
    return;
  }

  response.end(JSON.stringify(payload));
}

async function closeBrowsers() {
  await Promise.all([...activeBrowsers].map((browser) => browser.close().catch(() => undefined)));
  activeBrowsers.clear();
}
