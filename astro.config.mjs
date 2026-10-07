// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';

export default defineConfig({
  output: 'static',
  integrations: [react(), mdx()],
  vite: {
    // One dependency cache per npm script. `astro check` and `astro build` prepare React in
    // production mode; sharing a cache with `astro dev` breaks the running dev server.
    cacheDir: `node_modules/.vite/${process.env.npm_lifecycle_event ?? 'astro'}`,
  },
});
