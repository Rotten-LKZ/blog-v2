import { ALBUMS, type Album, type AlbumImage } from '../data/albums';

/**
 * 展平相册，方便查找
 */
export function getAllAlbums(albums: Album[] = ALBUMS): Album[] {
	let result: Album[] = [];
	for (const album of albums) {
		result.push(album);
		if (album.children) {
			result = result.concat(getAllAlbums(album.children));
		}
	}
	return result;
}

/**
 * 通过路径查找图片，例如 "album:travel/japan/tokyo-tower"。
 * 兼容旧写法 "@/travel/japan/tokyo-tower"，但推荐使用 album:，避免和 Astro 的 @/ 别名冲突。
 */
export function findImageByPath(path: string): { image: AlbumImage; album: Album } | null {
	let fullPath: string;

	if (path.startsWith('album:')) {
		fullPath = path.slice('album:'.length);
	} else if (path.startsWith('@/')) {
		fullPath = path.slice(2);
	} else {
		return null;
	}

	const parts = fullPath.split('/').filter(Boolean);
	const imageId = parts.pop();
	const albumId = parts.join('/');
	if (!imageId || !albumId) return null;

	const albums = getAllAlbums();
	const album = albums.find((a) => a.id === albumId);
	if (!album || !album.images) return null;

	const image = album.images.find((img) => img.id === imageId);
	if (!image) return null;

	return { image, album };
}

/**
 * 获取相册的完整层级标题，例如 "旅游 - 日本"
 */
export function getFullAlbumTitle(albumId: string): string {
	const parts = albumId.split('/');
	const albums = getAllAlbums();
	const titles: string[] = [];
	
	let currentId = '';
	for (const part of parts) {
		currentId = currentId ? `${currentId}/${part}` : part;
		const album = albums.find(a => a.id === currentId);
		if (album) {
			titles.push(album.title);
		}
	}
	
	return titles.length > 0 ? titles.join(' - ') : albumId;
}

/**
 * 递归获取相册及其子相册的所有图片
 */
export function getImagesRecursive(album: Album): { image: AlbumImage; album: Album }[] {
	let results: { image: AlbumImage; album: Album }[] = [];

	// 添加当前相册的图片
	if (album.images) {
		results = results.concat(album.images.map(img => ({ image: img, album })));
	}

	// 递归添加子相册的图片
	if (album.children) {
		for (const child of album.children) {
			results = results.concat(getImagesRecursive(child));
		}
	}

	return results;
}

/**
 * 递归统计相册及其所有子相册的图片总数
 */
export function getImageCountRecursive(album: Album): number {
	let count = album.images?.length || 0;

	if (album.children) {
		for (const child of album.children) {
			count += getImageCountRecursive(child);
		}
	}

	return count;
}

function escapeHtmlAttribute(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function decodeHtmlAttribute(value: string): string {
	return value
		.replace(/&quot;/g, '"')
		.replace(/&#x22;/g, '"')
		.replace(/&#34;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&#x27;/g, "'")
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&');
}

function getHtmlAttribute(tag: string, name: string): string | null {
	const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
	if (!match) return null;
	return decodeHtmlAttribute(match[1] ?? match[2] ?? match[3] ?? '');
}

function removeHtmlAttribute(tag: string, name: string): string {
	return tag.replace(new RegExp(`\\s${name}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)`, 'ig'), '');
}

function setHtmlAttribute(tag: string, name: string, value: string): string {
	const escapedValue = escapeHtmlAttribute(value);
	const attrPattern = new RegExp(`\\s${name}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)`, 'i');

	if (attrPattern.test(tag)) {
		return tag.replace(attrPattern, ` ${name}="${escapedValue}"`);
	}

	return tag.replace(/\s*\/?>$/, (ending) => ` ${name}="${escapedValue}"${ending.trim() === '/>' ? ' />' : '>'}`);
}

function getAlbumPathFromImageTag(tag: string): { path: string; alt?: string } | null {
	const src = getHtmlAttribute(tag, 'src');
	if (src?.startsWith('album:') || src?.startsWith('@/')) {
		return { path: src };
	}

	const astroImage = getHtmlAttribute(tag, '__astro_image_');
	if (!astroImage) return null;

	try {
		const data = JSON.parse(astroImage) as { src?: string; alt?: string };
		if (data.src?.startsWith('album:') || data.src?.startsWith('@/')) {
			return { path: data.src, alt: data.alt };
		}
	} catch {
		return null;
	}

	return null;
}

/**
 * 服务端兜底解析文章 HTML 中残留的相册图片引用。
 * Astro dev 的 content cache/HMR 有时不会因 src/data/albums.ts 更新而重跑 remark 插件，
 * 这里在布局渲染时再次替换，确保最终 HTML 不会留下 album: 或 __astro_image_。
 */
export function resolveAlbumImageHtml(html: string): string {
	return html.replace(/<img\b[^>]*>/gi, (tag) => {
		const albumRef = getAlbumPathFromImageTag(tag);
		if (!albumRef) return tag;

		const result = findImageByPath(albumRef.path);
		if (!result) return tag;

		let nextTag = removeHtmlAttribute(tag, '__astro_image_');
		nextTag = setHtmlAttribute(nextTag, 'src', result.image.url);
		if (albumRef.alt && !getHtmlAttribute(nextTag, 'alt')) {
			nextTag = setHtmlAttribute(nextTag, 'alt', albumRef.alt);
		}
		if (result.image.title) {
			nextTag = setHtmlAttribute(nextTag, 'title', result.image.title);
		}
		nextTag = setHtmlAttribute(nextTag, 'data-album-title', getFullAlbumTitle(result.album.id));
		nextTag = setHtmlAttribute(nextTag, 'data-album-id', result.album.id);

		return nextTag;
	});
}
