import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVerify, generateKeyPairSync } from 'node:crypto';
import {
  CREDENTIAL_VARIABLES,
  fetchStatus,
  publishChrome,
  publishItem,
  readCredentials,
  requestAccessToken,
  signAssertion,
  uploadArchive
} from '../scripts/publish-chrome.mjs';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

const KEY = {
  client_email: 'publisher@example.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' })
};

const ENVIRONMENT = {
  CHROME_SERVICE_ACCOUNT_KEY: JSON.stringify(KEY),
  CHROME_PUBLISHER_ID: 'publisher-1',
  CHROME_EXTENSION_ID: 'item-1'
};

const NAME = 'publishers/publisher-1/items/item-1';

const stubFetch = (replies) => {
  const calls = [];
  const queue = [...replies];
  const impl = async (url, options) => {
    calls.push({ url, options });
    const next = queue.shift() ?? { body: {} };
    return {
      ok: next.ok ?? true,
      status: next.status ?? 200,
      text: async () => next.text ?? JSON.stringify(next.body ?? {})
    };
  };
  impl.calls = calls;
  return impl;
};

const nap = async () => {};

const TOKEN_REPLY = { body: { access_token: 'granted' } };
const UPLOAD_DONE = { body: { uploadState: 'SUCCESS', crxVersion: '0.1.0' } };
const PUBLISH_DONE = { body: { state: 'PENDING_REVIEW' } };

test('names the three credentials the workflow has to supply', () => {
  assert.deepEqual(CREDENTIAL_VARIABLES, [
    'CHROME_SERVICE_ACCOUNT_KEY',
    'CHROME_PUBLISHER_ID',
    'CHROME_EXTENSION_ID'
  ]);
});

test('builds the v2 resource name out of the publisher and the item', () => {
  assert.equal(readCredentials(ENVIRONMENT).name, NAME);
});

test('names the missing credentials rather than failing vaguely', () => {
  assert.throws(
    () => readCredentials({ CHROME_PUBLISHER_ID: 'publisher-1' }),
    /CHROME_SERVICE_ACCOUNT_KEY, CHROME_EXTENSION_ID/
  );
});

test('rejects a service account key that cannot sign', () => {
  assert.throws(
    () => readCredentials({ ...ENVIRONMENT, CHROME_SERVICE_ACCOUNT_KEY: '{"client_email":"a"}' }),
    /client_email and a private_key/
  );
});

test('signs an assertion google can verify', () => {
  const assertion = signAssertion(KEY, 1_000_000);
  const [header, claims, signature] = assertion.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url').toString()), {
    alg: 'RS256',
    typ: 'JWT'
  });
  const payload = JSON.parse(Buffer.from(claims, 'base64url').toString());
  assert.equal(payload.iss, KEY.client_email);
  assert.equal(payload.scope, 'https://www.googleapis.com/auth/chromewebstore');
  assert.equal(payload.aud, 'https://oauth2.googleapis.com/token');
  assert.equal(payload.iat, 1_000_000);
  assert.equal(payload.exp, 1_000_000 + 3600);
  assert.ok(
    createVerify('RSA-SHA256')
      .update(`${header}.${claims}`)
      .verify(publicKey, Buffer.from(signature, 'base64url')),
    'signature should verify against the public key'
  );
});

test('trades a signed assertion for an access token', async () => {
  const fetchImpl = stubFetch([TOKEN_REPLY]);
  assert.equal(await requestAccessToken(KEY, fetchImpl, 1), 'granted');
  const [call] = fetchImpl.calls;
  assert.equal(call.options.body.get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  assert.equal(call.options.body.get('assertion').split('.').length, 3);
});

test('surfaces why a token was refused', async () => {
  const fetchImpl = stubFetch([
    { ok: false, status: 400, body: { error_description: 'invalid signature' } }
  ]);
  await assert.rejects(requestAccessToken(KEY, fetchImpl, 1), /invalid signature/);
});

test('uploads to the v2 upload host as the request body', async () => {
  const fetchImpl = stubFetch([UPLOAD_DONE]);
  const archive = Buffer.from('zip bytes');
  await uploadArchive({ token: 'granted', name: NAME, archive }, fetchImpl, nap);
  const [call] = fetchImpl.calls;
  assert.equal(call.options.method, 'POST');
  assert.equal(call.url, `https://chromewebstore.googleapis.com/upload/v2/${NAME}:upload`);
  assert.equal(call.options.headers.authorization, 'Bearer granted');
  assert.equal(call.options.body, archive);
});

test('waits out an upload that is still processing', async () => {
  const fetchImpl = stubFetch([
    { body: { uploadState: 'UPLOAD_IN_PROGRESS' } },
    { body: { uploadState: 'UPLOAD_IN_PROGRESS' } },
    { body: { uploadState: 'SUCCESS' } }
  ]);
  await uploadArchive({ token: 'granted', name: NAME, archive: Buffer.alloc(0) }, fetchImpl, nap);
  assert.equal(fetchImpl.calls.length, 3);
  assert.match(fetchImpl.calls[1].url, /:fetchStatus$/);
  assert.equal(fetchImpl.calls[1].options.method, 'GET');
});

test('fails when the store rejects the package', async () => {
  const fetchImpl = stubFetch([{ body: { uploadState: 'FAILURE' } }]);
  await assert.rejects(
    uploadArchive({ token: 'granted', name: NAME, archive: Buffer.alloc(0) }, fetchImpl, nap),
    /upload did not succeed: FAILURE/
  );
});

test('repeats the store error when the upload is refused outright', async () => {
  const fetchImpl = stubFetch([
    { ok: false, status: 404, body: { error: { message: 'Item not found' } } }
  ]);
  await assert.rejects(
    uploadArchive({ token: 'granted', name: NAME, archive: Buffer.alloc(0) }, fetchImpl, nap),
    /upload failed: Item not found/
  );
});

test('reports an html error page instead of a json parse failure', async () => {
  const fetchImpl = stubFetch([
    { ok: false, status: 502, text: '<html><title>502 Server Error</title></html>' }
  ]);
  await assert.rejects(
    uploadArchive({ token: 'granted', name: NAME, archive: Buffer.alloc(0) }, fetchImpl, nap),
    /502 Server Error/
  );
});

test('reads the upload state back off the status endpoint', async () => {
  const fetchImpl = stubFetch([{ body: { uploadState: 'SUCCESS' } }]);
  assert.equal(
    (await fetchStatus({ token: 'granted', name: NAME }, fetchImpl)).uploadState,
    'SUCCESS'
  );
  assert.equal(
    fetchImpl.calls[0].url,
    `https://chromewebstore.googleapis.com/v2/${NAME}:fetchStatus`
  );
});

test('treats going to review as a successful publish', async () => {
  const fetchImpl = stubFetch([PUBLISH_DONE]);
  const result = await publishItem({ token: 'granted', name: NAME }, fetchImpl);
  assert.equal(result.state, 'PENDING_REVIEW');
  assert.equal(fetchImpl.calls[0].url, `https://chromewebstore.googleapis.com/v2/${NAME}:publish`);
});

test('passes a publish type through only when one is asked for', async () => {
  const fetchImpl = stubFetch([PUBLISH_DONE, PUBLISH_DONE]);
  await publishItem({ token: 'granted', name: NAME }, fetchImpl);
  assert.deepEqual(JSON.parse(fetchImpl.calls[0].options.body), {});
  await publishItem({ token: 'granted', name: NAME, publishType: 'STAGED_PUBLISH' }, fetchImpl);
  assert.deepEqual(JSON.parse(fetchImpl.calls[1].options.body), { publishType: 'STAGED_PUBLISH' });
});

test('treats a rejected item as a failure', async () => {
  const fetchImpl = stubFetch([{ body: { state: 'REJECTED' } }]);
  await assert.rejects(
    publishItem({ token: 'granted', name: NAME }, fetchImpl),
    /publish returned state REJECTED/
  );
});

test('refuses to call a stateless reply a success', async () => {
  const fetchImpl = stubFetch([{ body: {} }]);
  await assert.rejects(
    publishItem({ token: 'granted', name: NAME }, fetchImpl),
    /publish returned state none/
  );
});

test('runs token, upload and publish in that order', async () => {
  const fetchImpl = stubFetch([TOKEN_REPLY, UPLOAD_DONE, PUBLISH_DONE]);
  const result = await publishChrome(
    { environment: ENVIRONMENT, archive: Buffer.from('zip bytes') },
    fetchImpl,
    nap
  );
  assert.equal(result.state, 'PENDING_REVIEW');
  assert.deepEqual(
    fetchImpl.calls.map((call) => call.options.method),
    ['POST', 'POST', 'POST']
  );
  assert.match(fetchImpl.calls[1].url, /upload\/v2\//);
  assert.match(fetchImpl.calls[2].url, /:publish$/);
});

test('never reaches the network when a credential is missing', async () => {
  const fetchImpl = stubFetch([TOKEN_REPLY]);
  await assert.rejects(
    publishChrome({ environment: {}, archive: Buffer.alloc(0) }, fetchImpl, nap),
    /missing credentials/
  );
  assert.equal(fetchImpl.calls.length, 0);
});
