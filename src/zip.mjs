import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';
import { crc32 } from './crc32.mjs';

const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const END_SIGNATURE = 0x06054b50;
const DEFLATED = 8;
const VERSION = 20;
const UTF8_NAMES = 0x800;
const HIGHEST_ASCII_BYTE = 0x7f;
const DOS_EPOCH_TIME = 0;
const DOS_EPOCH_DATE = 0x0021;
const LOCAL_HEADER_SIZE = 30;
const CENTRAL_HEADER_SIZE = 46;
const END_RECORD_SIZE = 22;

const collect = async (directory, prefix = '') => {
  const entries = await readdir(directory, { withFileTypes: true });
  const named = [...entries].sort((left, right) => (left.name < right.name ? -1 : 1));
  const files = [];
  for (const entry of named) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collect(path, `${prefix}${entry.name}/`)));
    } else {
      files.push({ name: `${prefix}${entry.name}`, body: await readFile(path) });
    }
  }
  return files;
};

export const zip = async (directory) => {
  const files = await collect(fileURLToPath(directory));
  const body = [];
  const central = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8');
    const flags = name.some((byte) => byte > HIGHEST_ASCII_BYTE) ? UTF8_NAMES : 0;
    const compressed = deflateRawSync(file.body, { level: 9 });
    const checksum = crc32(file.body);

    const local = Buffer.alloc(LOCAL_HEADER_SIZE + name.length);
    local.writeUInt32LE(LOCAL_SIGNATURE, 0);
    local.writeUInt16LE(VERSION, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(DEFLATED, 8);
    local.writeUInt16LE(DOS_EPOCH_TIME, 10);
    local.writeUInt16LE(DOS_EPOCH_DATE, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(file.body.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, LOCAL_HEADER_SIZE);

    const entry = Buffer.alloc(CENTRAL_HEADER_SIZE + name.length);
    entry.writeUInt32LE(CENTRAL_SIGNATURE, 0);
    entry.writeUInt16LE(VERSION, 4);
    entry.writeUInt16LE(VERSION, 6);
    entry.writeUInt16LE(flags, 8);
    entry.writeUInt16LE(DEFLATED, 10);
    entry.writeUInt16LE(DOS_EPOCH_TIME, 12);
    entry.writeUInt16LE(DOS_EPOCH_DATE, 14);
    entry.writeUInt32LE(checksum, 16);
    entry.writeUInt32LE(compressed.length, 20);
    entry.writeUInt32LE(file.body.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt16LE(0, 30);
    entry.writeUInt16LE(0, 32);
    entry.writeUInt16LE(0, 34);
    entry.writeUInt16LE(0, 36);
    entry.writeUInt32LE(0, 38);
    entry.writeUInt32LE(offset, 42);
    name.copy(entry, CENTRAL_HEADER_SIZE);

    body.push(local, compressed);
    central.push(entry);
    offset += local.length + compressed.length;
  }

  const directoryBytes = Buffer.concat(central);
  const end = Buffer.alloc(END_RECORD_SIZE);
  end.writeUInt32LE(END_SIGNATURE, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directoryBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...body, directoryBytes, end]);
};
