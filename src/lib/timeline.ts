import { getCollection, type CollectionEntry } from 'astro:content';

export type TimelineItem = {
	title: string;
	description: string;
	category?: string;
	tags: string[];
	date: Date;
	url: string;
	source: 'blog' | 'collection' | 'collection-post';
};

export type TimelineYearGroup = {
	year: number;
	items: TimelineItem[];
};

export type TaxonomyCount = {
	name: string;
	count: number;
};

let taxonomyTimelineItemsPromise: Promise<TimelineItem[]> | undefined;
let blogArchiveTimelineItemsPromise: Promise<TimelineItem[]> | undefined;

const sortTimelineItems = (items: TimelineItem[]) => items.sort((a, b) => b.date.valueOf() - a.date.valueOf());
const sortTaxonomyCounts = (counts: Map<string, number>) =>
	[...counts.entries()]
		.map(([name, count]) => ({ name, count }))
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

const blogUrl = (id: string) => `/blog/${id}/`;
const collectionUrl = (id: string) => `/collections/${id}/`;

export const categoryUrl = (category: string) => `/categories/${encodeURIComponent(category)}`;
export const tagUrl = (tag: string) => `/tags/${encodeURIComponent(tag)}`;

async function getBlogPosts(): Promise<CollectionEntry<'blog'>[]> {
	try {
		return await getCollection('blog');
	} catch (error) {
		if (error instanceof Error && error.message.includes('collection "blog"') && error.message.includes('does not exist or is empty')) {
			return [];
		}
		throw error;
	}
}

const blogPostToTimelineItem = (post: CollectionEntry<'blog'>): TimelineItem => ({
	title: post.data.title,
	description: post.data.description,
	category: post.data.category,
	tags: post.data.tags,
	date: post.data.createdAt,
	url: blogUrl(post.id),
	source: 'blog',
});

const collectedPostToTimelineItem = (post: CollectionEntry<'collectedPosts'>): TimelineItem => ({
	title: post.data.title,
	description: post.data.description,
	category: post.data.category,
	tags: post.data.tags,
	date: post.data.createdAt,
	url: collectionUrl(post.id),
	source: 'collection-post',
});

async function loadTaxonomyTimelineItems() {
	const [blogPosts, collectedPosts] = await Promise.all([
		getBlogPosts(),
		getCollection('collectedPosts'),
	]);

	return sortTimelineItems([
		...blogPosts.map(blogPostToTimelineItem),
		...collectedPosts.map(collectedPostToTimelineItem),
	]);
}

async function loadBlogArchiveTimelineItems() {
	const [blogPosts, collectionMetas, collectedPosts] = await Promise.all([
		getBlogPosts(),
		getCollection('collectionMeta'),
		getCollection('collectedPosts'),
	]);

	const items = blogPosts.map(blogPostToTimelineItem);

	for (const meta of collectionMetas) {
		const folderName = meta.id.split('/')[0];
		const relatedPosts = collectedPosts.filter((post) => post.id.startsWith(`${folderName}/`));

		if (meta.data.isCollapsed) {
			const latestDate = new Date(Math.max(...relatedPosts.map((post) => (post.data.updatedAt || post.data.createdAt).getTime())));
			items.push({
				title: meta.data.title,
				description: meta.data.description,
				category: meta.data.category,
				tags: meta.data.tags,
				date: latestDate,
				url: collectionUrl(folderName),
				source: 'collection',
			});
		} else {
			items.push(...relatedPosts.map(collectedPostToTimelineItem));
		}
	}

	return sortTimelineItems(items);
}

export function getTaxonomyTimelineItems() {
	taxonomyTimelineItemsPromise ??= loadTaxonomyTimelineItems();
	return taxonomyTimelineItemsPromise;
}

export function getBlogArchiveTimelineItems() {
	blogArchiveTimelineItemsPromise ??= loadBlogArchiveTimelineItems();
	return blogArchiveTimelineItemsPromise;
}

export function groupTimelineItemsByYear(items: TimelineItem[]): TimelineYearGroup[] {
	const groups = new Map<number, TimelineItem[]>();

	for (const item of items) {
		const year = item.date.getFullYear();
		const group = groups.get(year) ?? [];
		group.push(item);
		groups.set(year, group);
	}

	return [...groups.entries()]
		.sort(([a], [b]) => b - a)
		.map(([year, groupItems]) => ({ year, items: groupItems }));
}

export function groupTimelineItemsByCategory(items: TimelineItem[]) {
	const groups = new Map<string, TimelineItem[]>();

	for (const item of items) {
		if (!item.category) continue;
		const group = groups.get(item.category) ?? [];
		group.push(item);
		groups.set(item.category, group);
	}

	return groups;
}

export function groupTimelineItemsByTag(items: TimelineItem[]) {
	const groups = new Map<string, TimelineItem[]>();

	for (const item of items) {
		for (const tag of item.tags) {
			const group = groups.get(tag) ?? [];
			group.push(item);
			groups.set(tag, group);
		}
	}

	return groups;
}

export function getCategoryCounts(items: TimelineItem[]): TaxonomyCount[] {
	const counts = new Map<string, number>();

	for (const item of items) {
		if (!item.category) continue;
		counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
	}

	return sortTaxonomyCounts(counts);
}

export function getTagCounts(items: TimelineItem[]): TaxonomyCount[] {
	const counts = new Map<string, number>();

	for (const item of items) {
		for (const tag of item.tags) {
			counts.set(tag, (counts.get(tag) ?? 0) + 1);
		}
	}

	return sortTaxonomyCounts(counts);
}
