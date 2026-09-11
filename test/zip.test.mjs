import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { crc32 } from '../src/crc32.mjs';
import { zip } from '../src/zip.mjs';

const END_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

const directory = await mkdtemp(join(tmpdir(), 'audio-only-mode-zip-'));
const root = pathToFileURL(`${directory}/`);

after(() => rm(directory, { recursive: true, force: true }));

const read = (archive) => {
  const end = archive.length - 22;
  assert.equal(archive.readUInt32LE(end), END_SIGNATURE);
  const count = archive.readUInt16LE(end + 10);
  let cursor = archive.readUInt32LE(end + 16);
  const entries = [];
  for (let index = 0; index < count; index += 1) {
    assert.equal(archive.readUInt32LE(cursor), CENTRAL_SIGNATURE);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const offset = archive.readUInt32LE(cursor + 42);
    const name = archive.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');

    assert.equal(archive.readUInt32LE(offset), LOCAL_SIGNATURE);
    const localNameLength = archive.readUInt16LE(offset + 26);
    const extraLength = archive.readUInt16LE(offset + 28);
    const compressedSize = archive.readUInt32LE(offset + 18);
    const start = offset + 30 + localNameLength + extraLength;

    entries.push({
      name,
      flags: archive.readUInt16LE(cursor + 8),
      method: archive.readUInt16LE(cursor + 10),
      checksum: archive.readUInt32LE(cursor + 16),
      declaredSize: archive.readUInt32LE(cursor + 24),
      local: {
        name: archive.subarray(offset + 30, offset + 30 + localNameLength).toString('utf8'),
        flags: archive.readUInt16LE(offset + 6),
        method: archive.readUInt16LE(offset + 8),
        checksum: archive.readUInt32LE(offset + 14),
        declaredSize: archive.readUInt32LE(offset + 22)
      },
      body: inflateRawSync(archive.subarray(start, start + compressedSize))
    });
    cursor +=
      46 + nameLength + archive.readUInt16LE(cursor + 30) + archive.readUInt16LE(cursor + 32);
  }
  return entries;
};

await mkdir(new URL('nested/', root), { recursive: true });
await writeFile(new URL('manifest.json', root), '{"name":"test"}\n');
await writeFile(new URL('nested/script.js', root), 'const value = 1;\n'.repeat(40));

test('writes an archive a reader can walk end to end', async () => {
  const entries = read(await zip(root));
  assert.deepEqual(entries.map((entry) => entry.name).sort(), [
    'manifest.json',
    'nested/script.js'
  ]);
});

test('round-trips every file byte for byte', async () => {
  const entries = read(await zip(root));
  const manifest = entries.find((entry) => entry.name === 'manifest.json');
  const script = entries.find((entry) => entry.name === 'nested/script.js');
  assert.equal(manifest.body.toString('utf8'), '{"name":"test"}\n');
  assert.equal(script.body.toString('utf8'), 'const value = 1;\n'.repeat(40));
});

test('records the checksum and size of the uncompressed file', async () => {
  for (const entry of read(await zip(root))) {
    assert.equal(entry.checksum, crc32(entry.body));
    assert.equal(entry.declaredSize, entry.body.length);
  }
});

test('nests directories with forward slashes rather than flattening them', async () => {
  const entries = read(await zip(root));
  assert.ok(entries.some((entry) => entry.name === 'nested/script.js'));
  assert.ok(!entries.some((entry) => entry.name.includes('\\')));
});

test('produces the same bytes twice so a rebuild is reproducible', async () => {
  assert.deepEqual(await zip(root), await zip(root));
});

test('actually compresses repetitive content', async () => {
  const archive = await zip(root);
  const raw = 'const value = 1;\n'.repeat(40).length;
  assert.ok(archive.length < raw, `archive ${archive.length} should beat ${raw} raw bytes`);
});

test('declares deflate as the compression method', async () => {
  for (const entry of read(await zip(root))) {
    assert.equal(entry.method, 8);
    assert.equal(entry.local.method, 8);
  }
});

test('says the same thing in the local header and the central directory', async () => {
  for (const entry of read(await zip(root))) {
    assert.equal(entry.local.name, entry.name);
    assert.equal(entry.local.flags, entry.flags);
    assert.equal(entry.local.checksum, entry.checksum);
    assert.equal(entry.local.declaredSize, entry.declaredSize);
  }
});

test('leaves the utf-8 flag clear while every name is ascii', async () => {
  for (const entry of read(await zip(root))) {
    assert.equal(entry.flags, 0);
  }
});

test('reads the file the name actually points at, not a url resolved from it', async () => {
  const awkward = await mkdtemp(join(tmpdir(), 'audio-only-mode-zip-names-'));
  const names = [
    'plain.js',
    'hash#fragment.js',
    'query?string.js',
    'percent%20encoded.js',
    'a b.js'
  ];
  for (const name of names) {
    await writeFile(join(awkward, name), `body of ${name}\n`);
  }
  const entries = read(await zip(pathToFileURL(`${awkward}/`)));
  assert.deepEqual(entries.map((entry) => entry.name).sort(), [...names].sort());
  for (const entry of entries) {
    assert.equal(entry.body.toString('utf8'), `body of ${entry.name}\n`);
  }
  await rm(awkward, { recursive: true, force: true });
});

test('sets the utf-8 flag on names that need it', async () => {
  const accented = await mkdtemp(join(tmpdir(), 'audio-only-mode-zip-utf8-'));
  await writeFile(join(accented, 'café.js'), 'const value = 1;\n');
  await writeFile(join(accented, 'plain.js'), 'const value = 2;\n');
  const entries = read(await zip(pathToFileURL(`${accented}/`)));
  assert.equal(entries.find((entry) => entry.name === 'café.js').flags, 0x800);
  assert.equal(entries.find((entry) => entry.name === 'plain.js').flags, 0);
  await rm(accented, { recursive: true, force: true });
});
