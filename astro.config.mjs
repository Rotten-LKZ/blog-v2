// @ts-check

import { unified } from '@astrojs/markdown-remark';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import vue from '@astrojs/vue';
import { defineConfig } from 'astro/config';
import remarkGfm from 'remark-gfm';
import { remarkAlbumImages } from './src/lib/remark-album.mjs';

const processor = unified({ remarkPlugins: [remarkGfm, remarkAlbumImages] });

// https://astro.build/config
export default defineConfig({
	site: 'https://rotcool.me',
	integrations: [mdx(), sitemap(), vue()],
	markdown: { processor },
	vite: {
		optimizeDeps: {
			include: ['photoswipe', 'photoswipe/lightbox'],
		},
	},
});
