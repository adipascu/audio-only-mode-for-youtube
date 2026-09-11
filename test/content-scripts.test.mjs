import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createDomDocument, createExtensionApi, readSource } from './support.mjs';
import { targets } from '../manifest.config.mjs';

const ALREADY_DECLARED = /has already been declared/;

const isolatedScripts = targets.chrome.content_scripts.find(
  (script) => script.world === undefined
).js;

const sources = await Promise.all(isolatedScripts.map((path) => readSource(path)));

const freshContext = () =>
  vm.createContext({
    document: createDomDocument(),
    chrome: createExtensionApi(),
    CustomEvent
  });

test('more than one script shares the isolated world', () => {
  assert.ok(isolatedScripts.length > 1);
});

test('the isolated-world scripts declare nothing that collides', () => {
  const context = freshContext();
  for (const [index, source] of sources.entries()) {
    assert.doesNotThrow(
      () => vm.runInContext(source, context),
      `${isolatedScripts[index]} collided`
    );
  }
});

test('two scripts in one context really do share a lexical scope, so that check means something', () => {
  const context = freshContext();
  vm.runInContext('const extension = 1;', context);
  assert.throws(() => vm.runInContext('const extension = 2;', context), ALREADY_DECLARED);
});
