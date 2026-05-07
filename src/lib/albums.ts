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
 * 通过路径查找图片，例如 "@travel/japan/tokyo-tower"
 * 匹配逻辑：@/相册ID/图片ID
 */
export function findImageByPath(path: string): { image: AlbumImage; album: Album } | null {
	if (!path.startsWith('@/')) return null;
	const fullPath = path.slice(2); // 去掉 @/
	const parts = fullPath.split('/');
	const imageId = parts.pop();
	const albumId = parts.join('/');

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
