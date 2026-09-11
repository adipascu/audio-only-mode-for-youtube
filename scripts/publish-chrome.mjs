import { createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/chromewebstore';
const API = 'https://chromewebstore.googleapis.com';
const JWT_GRANT = 'urn:ietf:params:oauth:grant-type:jwt-bearer';
const TOKEN_LIFETIME_SECONDS = 3600;
const UPLOAD_POLL_INTERVAL_MS = 5000;
const UPLOAD_POLL_ATTEMPTS = 60;

const PUBLISHED_STATES = ['PENDING_REVIEW', 'STAGED', 'PUBLISHED', 'PUBLISHED_TO_TESTERS'];

export const CREDENTIAL_VARIABLES = [
  'CHROME_SERVICE_ACCOUNT_KEY',
  'CHROME_PUBLISHER_ID',
  'CHROME_EXTENSION_ID'
];

export const readCredentials = (environment) => {
  const missing = CREDENTIAL_VARIABLES.filter((name) => !environment[name]);
  if (missing.length > 0) {
    throw new Error(`missing credentials: ${missing.join(', ')}`);
  }
  const key = JSON.parse(environment.CHROME_SERVICE_ACCOUNT_KEY);
  if (!key.client_email || !key.private_key) {
    throw new Error('CHROME_SERVICE_ACCOUNT_KEY needs a client_email and a private_key');
  }
  return {
    key,
    name: `publishers/${environment.CHROME_PUBLISHER_ID}/items/${environment.CHROME_EXTENSION_ID}`
  };
};

const encodeSegment = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

export const signAssertion = (key, issuedAt) => {
  const body = [
    encodeSegment({ alg: 'RS256', typ: 'JWT' }),
    encodeSegment({
      iss: key.client_email,
      scope: SCOPE,
      aud: TOKEN_ENDPOINT,
      iat: issuedAt,
      exp: issuedAt + TOKEN_LIFETIME_SECONDS
    })
  ].join('.');
  const signature = createSign('RSA-SHA256')
    .update(body)
    .sign(key.private_key)
    .toString('base64url');
  return `${body}.${signature}`;
};

const parseBody = async (response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { unparsed: text.slice(0, 300) };
  }
};

const describe = (response, payload) =>
  payload.error?.message ?? payload.unparsed ?? `HTTP ${response.status}`;

export const requestAccessToken = async (key, fetchImpl = fetch, issuedAt) => {
  const response = await fetchImpl(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: JWT_GRANT,
      assertion: signAssertion(key, issuedAt ?? Math.floor(Date.now() / 1000))
    })
  });
  const payload = await parseBody(response);
  if (!response.ok || !payload.access_token) {
    throw new Error(
      `token request failed: ${payload.error_description ?? describe(response, payload)}`
    );
  }
  return payload.access_token;
};

const call = async (token, url, options, fetchImpl) => {
  const response = await fetchImpl(url, {
    ...options,
    headers: { ...options.headers, authorization: `Bearer ${token}` }
  });
  return { response, payload: await parseBody(response) };
};

export const fetchStatus = async ({ token, name }, fetchImpl = fetch) => {
  const { response, payload } = await call(
    token,
    `${API}/v2/${name}:fetchStatus`,
    { method: 'GET' },
    fetchImpl
  );
  if (!response.ok) {
    throw new Error(`status check failed: ${describe(response, payload)}`);
  }
  return payload;
};

export const uploadArchive = async ({ token, name, archive }, fetchImpl = fetch, wait = delay) => {
  const { response, payload } = await call(
    token,
    `${API}/upload/v2/${name}:upload`,
    { method: 'POST', body: archive },
    fetchImpl
  );
  if (!response.ok) {
    throw new Error(`upload failed: ${describe(response, payload)}`);
  }

  let state = payload.uploadState;
  for (
    let attempt = 0;
    state === 'UPLOAD_IN_PROGRESS' && attempt < UPLOAD_POLL_ATTEMPTS;
    attempt += 1
  ) {
    await wait(UPLOAD_POLL_INTERVAL_MS);
    state = (await fetchStatus({ token, name }, fetchImpl)).uploadState;
  }
  if (state !== 'SUCCESS') {
    throw new Error(`upload did not succeed: ${state ?? describe(response, payload)}`);
  }
  return payload;
};

export const publishItem = async ({ token, name, publishType }, fetchImpl = fetch) => {
  const { response, payload } = await call(
    token,
    `${API}/v2/${name}:publish`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(publishType ? { publishType } : {})
    },
    fetchImpl
  );
  if (!response.ok) {
    throw new Error(`publish failed: ${describe(response, payload)}`);
  }
  if (!PUBLISHED_STATES.includes(payload.state)) {
    throw new Error(`publish returned state ${payload.state ?? 'none'}`);
  }
  return payload;
};

export const publishChrome = async (
  { environment, archive, publishType },
  fetchImpl = fetch,
  wait
) => {
  const { key, name } = readCredentials(environment);
  const token = await requestAccessToken(key, fetchImpl);
  await uploadArchive({ token, name, archive }, fetchImpl, wait);
  return publishItem({ token, name, publishType }, fetchImpl);
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , archivePath, publishType] = process.argv;
  const archive = await readFile(archivePath);
  const result = await publishChrome({ environment: process.env, archive, publishType });
  console.log(`published ${archivePath}, item is now ${result.state}`);
  for (const warning of result.warningInfo?.warnings ?? []) {
    console.log(`warning: ${warning.reason} ${warning.description ?? ''}`.trim());
  }
}
