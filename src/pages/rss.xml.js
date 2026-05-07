import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';

export async function GET(context) {
	const blogPosts = await getCollection('blog');
	const collectedPosts = await getCollection('collectedPosts');

	const blogItems = blogPosts.map((post) => ({
		...post.data,
		pubDate: post.data.updatedAt || post.data.createdAt,
		link: `/blog/${post.id}/`,
	}));

	const collectionItems = collectedPosts.map((post) => {
		const [folderName, postFileName] = post.id.split('/');
		return {
			...post.data,
			pubDate: post.data.updatedAt || post.data.createdAt,
			link: `/collections/${folderName}/${postFileName}/`,
		};
	});

	const items = [...blogItems, ...collectionItems];

	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items: items.sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf()),
	});
}
