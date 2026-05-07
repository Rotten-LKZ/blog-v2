import { visit } from 'unist-util-visit';
import { findImageByPath, getFullAlbumTitle } from './albums';

/**
 * 一个 Remark 插件，将 ![](@/album/image) 路径替换为实际 URL。
 */
export function remarkAlbumImages() {
	return (tree) => {
		visit(tree, 'image', (node) => {
			if (node.url.startsWith('@/')) {
				const result = findImageByPath(node.url);
				if (result) {
					node.url = result.image.url;
					node.title = result.image.title;
					// 传递相册信息，便于后续展示。Remark 节点可以用 data 属性携带额外信息。
					node.data = node.data || {};
					node.data.hProperties = node.data.hProperties || {};
					node.data.hProperties['data-album-title'] = getFullAlbumTitle(result.album.id);
					node.data.hProperties['data-album-id'] = result.album.id;
				}
			}
		});
	};
}
