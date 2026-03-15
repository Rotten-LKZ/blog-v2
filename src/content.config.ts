import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			createdAt: z.coerce.date(),
			updatedAt: z.coerce.date().optional(),
			cover: image().optional(),
			tags: z.array(z.string()).default([]),
			category: z.string().optional(),
			toc: z.boolean().default(false),
		}),
});

// 新增：合集元数据
const collectionMeta = defineCollection({
	loader: glob({ base: './src/content/collections', pattern: '*/meta.json' }),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			cover: image().optional(),
			category: z.string().optional(),
			tags: z.array(z.string()).default([]),
			isCollapsed: z.boolean().default(true),
			showTocAbove: z.boolean().default(true),
			structure: z.array(z.object({
				chapterName: z.string(),
				posts: z.array(z.object({
					slug: z.string(), // 对应文件名（不含扩展名）
					title: z.string().optional(), // 覆盖 md 里的标题
				}))
			}))
		}),
});

// 新增：合集文章
const collectedPosts = defineCollection({
	loader: glob({ base: './src/content/collections', pattern: '**/*.{md,mdx}' }),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			createdAt: z.coerce.date(),
			updatedAt: z.coerce.date().optional(),
			cover: image().optional(),
			tags: z.array(z.string()).default([]),
			category: z.string().optional(),
			toc: z.boolean().default(false),
		}),
});

export const collections = { blog, collectionMeta, collectedPosts };
