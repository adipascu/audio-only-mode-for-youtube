import { readFile } from 'node:fs/promises';

const { version, description } = JSON.parse(
  await readFile(new URL('./package.json', import.meta.url), 'utf8')
);

const icons = {
  16: 'icons/icon-16.png',
  32: 'icons/icon-32.png',
  48: 'icons/icon-48.png',
  128: 'icons/icon-128.png'
};

const matches = ['*://*.youtube.com/*', '*://*.youtube-nocookie.com/*'];

const base = {
  manifest_version: 3,
  name: 'Earshot',
  version,
  description,
  icons,
  permissions: ['storage'],
  action: {
    default_icon: icons,
    default_title: 'Earshot'
  },
  content_scripts: [
    {
      matches,
      js: ['page/radio.js'],
      run_at: 'document_start',
      all_frames: true,
      world: 'MAIN'
    },
    {
      matches,
      js: ['content/curtain.js', 'content/bridge.js'],
      run_at: 'document_start',
      all_frames: true
    }
  ]
};

export const targets = {
  chrome: {
    ...base,
    minimum_chrome_version: '111',
    background: {
      service_worker: 'background.js'
    }
  },
  firefox: {
    ...base,
    browser_specific_settings: {
      gecko: {
        id: 'earshot@pascu.be',
        strict_min_version: '128.0'
      }
    },
    background: {
      scripts: ['background.js']
    }
  }
};
