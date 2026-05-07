// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import vue from '@astrojs/vue';
import { defineConfig } from 'astro/config';
import { remarkAlbumImages } from './src/lib/remark-album.mjs';

// https://astro.build/config
export default defineConfig({
	site: 'https://example.com',
	integrations: [
		mdx({
			remarkPlugins: [remarkAlbumImages],
		}),
		sitemap(),
		vue(),
	],
	markdown: {
		remarkPlugins: [remarkAlbumImages],
	},
});
