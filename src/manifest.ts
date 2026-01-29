import type { ManifestV3Export } from '@crxjs/vite-plugin';

const manifest: ManifestV3Export = {
  manifest_version: 3,
  name: 'ElementAgent for React',
  version: '0.1.0',
  description: 'Select React components and send change requests to AI coding agents',

  icons: {
    '16': 'icons/icon16.png',
    '48': 'icons/icon48.png',
    '128': 'icons/icon128.png',
  },

  devtools_page: 'src/devtools/devtools.html',

  permissions: ['activeTab', 'clipboardWrite', 'storage', 'scripting'],

  host_permissions: ['http://localhost:*/*', 'https://*/*'],

  background: {
    service_worker: 'src/background/background.ts',
    type: 'module',
  },

  content_scripts: [
    {
      matches: ['http://localhost:*/*', 'https://*/*'],
      js: ['src/content/content.ts'],
    },
  ],
};

export default manifest;
