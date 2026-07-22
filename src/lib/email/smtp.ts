import type { TLSSocket } from 'node:tls';
import { connect as createTlsConnection } from 'node:tls';
import { connect as createTcpConnection, type Socket } from 'node:net';
import { Buffer } from 'node:buffer';

type RawSmtpResponse = {
  code: number;
  lines: string[];
};

type SmtpSocket = Socket | TLSSocket;

interface SmtpOptions {
  host: string;
  port: number;
  secure: boolean;
  startTls: boolean;
  username?: string;
  password?: string;
  heloHost: string;
  fromEmail: string;
  fromName?: string;
}

const DEFAULT_SMTP_PORT = 587;
const CRLF = '\r\n';
const SMTP_TIMEOUT_MS = 10000;

function getSmtpOptions(): SmtpOptions | null {
  const host = process.env.SMTP_HOST?.trim();
  const fromEmail = process.env.SMTP_FROM?.trim();

  if (!host || !fromEmail) {
    return null;
  }

  const rawPort = process.env.SMTP_PORT?.trim();
  const port = rawPort ? Number.parseInt(rawPort, 10) : DEFAULT_SMTP_PORT;
  if (!Number.isInteger(port) || port <= 0) {
    return null;
  }

  const username = process.env.SMTP_USER?.trim() || process.env.SMTP_USERNAME?.trim();
  const password = process.env.SMTP_PASS?.trim() || process.env.SMTP_PASSWORD?.trim();

  return {
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true',
    startTls: process.env.SMTP_STARTTLS !== 'false',
    username,
    password,
    heloHost: process.env.SMTP_HELLO_HOST?.trim() || host,
    fromEmail,
    fromName: process.env.SMTP_FROM_NAME?.trim(),
  };
}

function formatSmtpAddress(address: string, displayName?: string) {
  if (!displayName) {
    return address;
  }

  const safeName = displayName.replace(/"/g, '\\"');
  return `"${safeName}" <${address}>`;
}

function buildWelcomeMessage(to: string, fromAddress: string, fromName?: string) {
  const subject = 'Bienvenue sur MatchingCV AI';
  const content = [
    'Bonjour,',
    '',
    'Votre compte vient d etre cree sur MatchingCV AI.',
    'Vous pouvez maintenant utiliser votre identifiant pour vous connecter.',
    '',
    "Merci d utiliser l'application.",
  ];

  const headers = [
    `From: ${formatSmtpAddress(fromAddress, fromName)}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    `Date: ${new Date().toUTCString()}`,
    '',
    ...content,
  ];

  return headers.join(CRLF);
}

function splitSmtpLines(value: string) {
  const normalized = value.replace(/\r?\n/g, CRLF);
  return normalized
    .split(CRLF)
    .map((line) => (line.startsWith('.') ? `.${line}` : line))
    .join(CRLF);
}

async function readResponse(socket: SmtpSocket): Promise<RawSmtpResponse> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    let done = false;

    const onData = (chunk: Buffer) => {
      if (done) {
        return;
      }

      buffer += chunk.toString('utf8');
      const lines = buffer.split(CRLF);
      buffer = lines.pop() ?? '';

      const responseLines: string[] = [];
      for (const line of lines) {
        if (!line) {
          continue;
        }

        responseLines.push(line);

        if (/^\d{3}\s/.test(line)) {
          done = true;
          socket.off('data', onData);
          socket.off('error', onError);
          socket.off('close', onClose);
          resolve({
            code: Number.parseInt(line.slice(0, 3), 10),
            lines: responseLines,
          });
          break;
        }
      }
    };

    const onError = (error: Error) => {
      if (done) {
        return;
      }
      done = true;
      socket.off('data', onData);
      socket.off('error', onError);
      socket.off('close', onClose);
      reject(error);
    };

    const onClose = () => {
      if (done) {
        return;
      }
      done = true;
      socket.off('data', onData);
      socket.off('error', onError);
      socket.off('close', onClose);
      reject(new Error('Connexion SMTP interrompue.'));
    };

    socket.on('data', onData);
    socket.once('error', onError);
    socket.once('close', onClose);
  });
}

function applySmtpTimeout(socket: SmtpSocket) {
  socket.setTimeout(SMTP_TIMEOUT_MS, () => {
    const timeoutError = new Error('Temps limite SMTP depasse.');
    socket.destroy(timeoutError);
  });
}

async function sendSmtpCommand(socket: SmtpSocket, command: string): Promise<RawSmtpResponse> {
  socket.write(`${command}${CRLF}`);
  return readResponse(socket);
}

async function upgradeToStartTls(
  socket: Socket,
  options: { host: string },
): Promise<TLSSocket> {
  return new Promise((resolve, reject) => {
    const tlsSocket = createTlsConnection({
      socket,
      host: options.host,
      servername: options.host,
    });

    tlsSocket.once('error', reject);
    tlsSocket.once('secureConnect', () => resolve(tlsSocket));
  });
}

function ensureSmtpResponse(
  response: RawSmtpResponse,
  expected: number,
  detail?: string,
): void {
  if (response.code !== expected) {
    const lines = response.lines.join(CRLF);
    throw new Error(
      detail ? `${detail}. SMTP:${response.code}. ${lines}` : `SMTP:${response.code}. ${lines}`,
    );
  }
}

export async function sendWelcomeEmail(to: string): Promise<boolean> {
  const options = getSmtpOptions();
  if (!options) {
    return false;
  }

  let socket: SmtpSocket | null = options.secure
    ? createTlsConnection({
        host: options.host,
        port: options.port,
      })
      : createTcpConnection({
        host: options.host,
        port: options.port,
      });
  applySmtpTimeout(socket);

  try {
    const greeting = await readResponse(socket);
    ensureSmtpResponse(greeting, 220, 'Erreur de connexion SMTP');

    let ehlo = await sendSmtpCommand(socket, `EHLO ${options.heloHost}`);
    ensureSmtpResponse(ehlo, 250, "Erreur de reponse EHLO");

    const supportsStartTls = ehlo.lines.some((line) => line.includes('STARTTLS'));
    if (!options.secure && options.startTls && supportsStartTls) {
      const startTls = await sendSmtpCommand(socket, 'STARTTLS');
      ensureSmtpResponse(startTls, 220, 'Erreur STARTTLS');
      socket = await upgradeToStartTls(socket as Socket, { host: options.host });

      ehlo = await sendSmtpCommand(socket, `EHLO ${options.heloHost}`);
      ensureSmtpResponse(ehlo, 250, 'Erreur de reponse EHLO apres STARTTLS');
    }

    if (options.username && options.password) {
      const authStart = await sendSmtpCommand(socket, 'AUTH LOGIN');
      ensureSmtpResponse(authStart, 334, 'Erreur AUTH LOGIN');
      const authUser = await sendSmtpCommand(socket, Buffer.from(options.username, 'utf8').toString('base64'));
      ensureSmtpResponse(authUser, 334, 'Utilisateur SMTP invalide');
      const authPass = await sendSmtpCommand(socket, Buffer.from(options.password, 'utf8').toString('base64'));
      ensureSmtpResponse(authPass, 235, 'Mot de passe SMTP invalide');
    }

    const mailFrom = await sendSmtpCommand(
      socket,
      `MAIL FROM:<${options.fromEmail}>`,
    );
    ensureSmtpResponse(mailFrom, 250, 'Erreur MAIL FROM');

    const rcptTo = await sendSmtpCommand(socket, `RCPT TO:<${to}>`);
    ensureSmtpResponse(rcptTo, 250, 'Erreur RCPT TO');

    const dataReady = await sendSmtpCommand(socket, 'DATA');
    ensureSmtpResponse(dataReady, 354, "Erreur DATA");

    const rawMessage = splitSmtpLines(buildWelcomeMessage(to, options.fromEmail, options.fromName));
    socket.write(`${rawMessage}${CRLF}.${CRLF}`);
    const dataResponse = await readResponse(socket);
    ensureSmtpResponse(dataResponse, 250, "Erreur envoi message");

    await sendSmtpCommand(socket, 'QUIT');
    socket.setTimeout(0);
    socket.end();
    return true;
  } catch {
    try {
      socket.end();
    } catch {
      // ignore cleanup errors
    }
    return false;
  } finally {
    if (socket) {
      socket.destroy();
    }
  }
}
