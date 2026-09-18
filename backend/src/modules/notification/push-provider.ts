import crypto from 'node:crypto';
import http2 from 'node:http2';
import config from '@/config';

export type PushPayload = {
  title: string;
  body?: string | null;
  notificationId: string;
  resource?: string | null;
  action?: string | null;
  referenceId?: string | null;
};

export type PushResult =
  | { kind: 'sent'; messageId?: string }
  | { kind: 'invalid-token'; reason: string }
  | { kind: 'retry'; reason: string }
  | { kind: 'config-missing'; reason: string };

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

function text(value: unknown, max = 500): string {
  return String(value ?? 'Unknown provider error').replace(/[\r\n]+/g, ' ').slice(0, max);
}

let cachedFcmToken: { value: string; expiresAt: number } | undefined;

async function fcmAccessToken(): Promise<string | null> {
  const credentials = config.push.fcm;
  if (!credentials.projectId || !credentials.clientEmail || !credentials.privateKey) return null;
  if (cachedFcmToken && cachedFcmToken.expiresAt > Date.now() + 60_000) return cachedFcmToken.value;

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64Url(JSON.stringify({
    iss: credentials.clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claims}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), credentials.privateKey).toString('base64url');
  const assertion = `${unsigned}.${signature}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const body = await response.json() as { access_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !body.access_token) {
    throw new Error(`FCM OAuth failed: ${text(body.error_description ?? response.status)}`);
  }
  cachedFcmToken = {
    value: body.access_token,
    expiresAt: Date.now() + Math.max(60, body.expires_in ?? 3600) * 1000,
  };
  return cachedFcmToken.value;
}

function providerData(payload: PushPayload): Record<string, string> {
  const pairs = {
    notificationId: payload.notificationId,
    resource: payload.resource,
    action: payload.action,
    referenceId: payload.referenceId,
  };
  return Object.fromEntries(Object.entries(pairs).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

export async function sendFcm(token: string, payload: PushPayload): Promise<PushResult> {
  try {
    const accessToken = await fcmAccessToken();
    if (!accessToken) return { kind: 'config-missing', reason: 'FCM credentials are incomplete' };
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(config.push.fcm.projectId)}/messages:send`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: payload.title, body: payload.body ?? '' },
            data: providerData(payload),
          },
        }),
      },
    );
    const body = await response.json().catch(() => ({})) as any;
    if (response.ok) return { kind: 'sent', messageId: body.name };

    const errorCode = body?.error?.details?.find?.((detail: any) => detail?.errorCode)?.errorCode;
    if (errorCode === 'UNREGISTERED' || errorCode === 'SENDER_ID_MISMATCH') {
      return { kind: 'invalid-token', reason: errorCode };
    }
    if (response.status === 429 || response.status >= 500) {
      return { kind: 'retry', reason: text(body?.error?.message ?? `FCM HTTP ${response.status}`) };
    }
    return { kind: 'retry', reason: text(body?.error?.message ?? `FCM HTTP ${response.status}`) };
  } catch (error) {
    return { kind: 'retry', reason: text(error instanceof Error ? error.message : error) };
  }
}

let cachedApnsJwt: { value: string; expiresAt: number } | undefined;

function apnsJwt(): string | null {
  const credentials = config.push.apns;
  if (!credentials.keyId || !credentials.teamId || !credentials.bundleId || !credentials.privateKey) return null;
  if (cachedApnsJwt && cachedApnsJwt.expiresAt > Date.now() + 60_000) return cachedApnsJwt.value;
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'ES256', kid: credentials.keyId }));
  const claims = base64Url(JSON.stringify({ iss: credentials.teamId, iat: now }));
  const unsigned = `${header}.${claims}`;
  const signature = crypto.sign('sha256', Buffer.from(unsigned), {
    key: credentials.privateKey,
    dsaEncoding: 'ieee-p1363',
  }).toString('base64url');
  cachedApnsJwt = { value: `${unsigned}.${signature}`, expiresAt: Date.now() + 50 * 60_000 };
  return cachedApnsJwt.value;
}

export async function sendApns(token: string, payload: PushPayload): Promise<PushResult> {
  const jwt = apnsJwt();
  if (!jwt) return { kind: 'config-missing', reason: 'APNs credentials are incomplete' };
  const origin = config.push.apns.sandbox ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com';
  const requestBody = JSON.stringify({
    aps: {
      alert: { title: payload.title, body: payload.body ?? '' },
      sound: 'default',
    },
    ...providerData(payload),
  });
  if (Buffer.byteLength(requestBody, 'utf8') > 4096) {
    return { kind: 'retry', reason: 'APNs payload exceeds 4096 bytes' };
  }

  return new Promise<PushResult>((resolve) => {
    const client = http2.connect(origin);
    let settled = false;
    const finish = (result: PushResult) => {
      if (settled) return;
      settled = true;
      client.close();
      resolve(result);
    };
    client.once('error', (error) => finish({ kind: 'retry', reason: text(error.message) }));
    const request = client.request({
      ':method': 'POST',
      ':path': `/3/device/${encodeURIComponent(token)}`,
      authorization: `bearer ${jwt}`,
      'apns-topic': config.push.apns.bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    });
    const chunks: Buffer[] = [];
    let status = 500;
    let messageId: string | undefined;
    request.on('response', (headers) => {
      status = Number(headers[':status'] ?? 500);
      messageId = typeof headers['apns-id'] === 'string' ? headers['apns-id'] : undefined;
    });
    request.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    request.on('end', () => {
      const response = Buffer.concat(chunks).toString('utf8');
      let reason = `APNs HTTP ${status}`;
      try { reason = JSON.parse(response)?.reason ?? reason; } catch { /* provider may return an empty body */ }
      if (status === 200) return finish({ kind: 'sent', messageId });
      if (status === 410 || ['BadDeviceToken', 'Unregistered', 'DeviceTokenNotForTopic'].includes(reason)) {
        return finish({ kind: 'invalid-token', reason: text(reason) });
      }
      return finish({ kind: 'retry', reason: text(reason) });
    });
    request.setTimeout(10_000, () => {
      request.close(http2.constants.NGHTTP2_CANCEL);
      finish({ kind: 'retry', reason: 'APNs request timed out' });
    });
    request.end(requestBody);
  });
}
