import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { visit } from 'unist-util-visit';

const albumsFilePath = resolve(dirname(fileURLToPath(import.meta.url)), '../data/albums.ts');
const moduleCache = new Map();

function resolveModulePath(fromFilePath, specifier) {
	const basePath = resolve(dirname(fromFilePath), specifier);
	const knownExtensions = new Set(['.ts', '.mts', '.js', '.mjs', '.json']);
	const candidates = [basePath];

	if (!knownExtensions.has(extname(basePath))) {
		candidates.push(
			`${basePath}.ts`,
			`${basePath}.mts`,
			`${basePath}.js`,
			`${basePath}.mjs`,
			`${basePath}.json`,
			resolve(basePath, 'index.ts'),
			resolve(basePath, 'index.mts'),
			resolve(basePath, 'index.js'),
			resolve(basePath, 'index.mjs'),
			resolve(basePath, 'index.json'),
		);
	}

	for (const candidate of candidates) {
		if (existsSync(candidate)) return candidate;
	}

	throw new Error(`Could not resolve import ${specifier} from ${fromFilePath}`);
}

function extractBalancedLiteral(source, startIndex) {
	const open = source[startIndex];
	const close = open === '[' ? ']' : open === '{' ? '}' : null;

	if (!close) {
		throw new Error(`Unsupported export literal starting with ${open}`);
	}

	let depth = 0;
	let quote = null;
	let escaped = false;

	for (let i = startIndex; i < source.length; i++) {
		const char = source[i];

		if (quote) {
			if (escaped) {
				escaped = false;
			} else if (char === '\\') {
				escaped = true;
			} else if (char === quote) {
				quote = null;
			}
			continue;
		}

		if (char === '"' || char === '\'' || char === '`') {
			quote = char;
			continue;
		}

		if (char === open) depth++;
		if (char === close) {
			depth--;
			if (depth === 0) return source.slice(startIndex, i + 1);
		}
	}

	throw new Error('Could not parse export literal');
}

function evaluateLiteral(literal, context) {
	const keys = Object.keys(context);
	const values = Object.values(context);
	return Function(...keys, '"use strict"; return (' + literal + ');')(...values);
}

function loadDefaultExport(filePath) {
	return loadExportValue(filePath, 'default');
}

function loadExportValue(filePath, exportName) {
	const cacheKey = `${filePath}::${exportName}`;
	if (moduleCache.has(cacheKey)) return moduleCache.get(cacheKey);

	const source = readFileSync(filePath, 'utf8');
	const context = {};

	for (const line of source.split('\n')) {
		if (/^\s*import\s+type\b/.test(line)) continue;

		const defaultImportMatch = line.match(/^\s*import\s+([\w$]+)\s+from\s+['"]([^'"]+)['"]\s*;?\s*$/);
		if (defaultImportMatch) {
			const [, localName, specifier] = defaultImportMatch;
			context[localName] = loadDefaultExport(resolveModulePath(filePath, specifier));
		}
	}

	let exportStart = -1;
	if (exportName === 'default') {
		const match = source.match(/export\s+default\s+/);
		if (!match) {
			throw new Error(`Could not find default export in ${filePath}`);
		}
		exportStart = source.indexOf(match[0]) + match[0].length;
	} else {
		const pattern = new RegExp(`export\\s+const\\s+${exportName}(?:\\s*:[^=]+)?\\s*=\\s*`);
		const match = source.match(pattern);
		if (!match || match.index === undefined) {
			throw new Error(`Could not find ${exportName} export in ${filePath}`);
		}
		exportStart = match.index + match[0].length;
	}

	while (exportStart < source.length && /\s/.test(source[exportStart])) exportStart++;
	const literal = extractBalancedLiteral(source, exportStart);
	const value = evaluateLiteral(literal, context);
	moduleCache.set(cacheKey, value);
	return value;
}

/**
 * 校验相册数据完整性：
 * - album.id 在整棵树中唯一
 * - image.id 在所属 album 内唯一（跨 album 可重复）
 */
function validateAlbums(albums) {
	const albumIdSet = new Set();
	const errors = [];

	function walk(nodes) {
		for (const album of nodes) {
			if (albumIdSet.has(album.id)) {
				errors.push(`Duplicate album id: "${album.id}"`);
			}
			albumIdSet.add(album.id);

			if (album.images) {
				const imageIdSet = new Set();
				for (const img of album.images) {
					if (imageIdSet.has(img.id)) {
						errors.push(`Duplicate image id "${img.id}" in album "${album.id}"`);
					}
					imageIdSet.add(img.id);
				}
			}

			if (album.children) {
				walk(album.children);
			}
		}
	}

	walk(albums);

	if (errors.length > 0) {
		throw new Error(`[album] Validation failed:\n  ${errors.join('\n  ')}`);
	}
}

function loadAlbums() {
	const albums = loadExportValue(albumsFilePath, 'ALBUMS');
	validateAlbums(albums);
	return albums;
}

function getAllAlbums(albums) {
	let result = [];
	for (const album of albums) {
		result.push(album);
		if (album.children) {
			result = result.concat(getAllAlbums(album.children));
		}
	}
	return result;
}

function findImageByPath(path, albums) {
	let fullPath;

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

	const album = getAllAlbums(albums).find((a) => a.id === albumId);
	if (!album || !album.images) return null;

	const image = album.images.find((img) => img.id === imageId);
	if (!image) return null;

	return { image, album };
}

function getFullAlbumTitle(albumId, albums) {
	const parts = albumId.split('/');
	const flatAlbums = getAllAlbums(albums);
	const titles = [];

	let currentId = '';
	for (const part of parts) {
		currentId = currentId ? `${currentId}/${part}` : part;
		const album = flatAlbums.find((a) => a.id === currentId);
		if (album) titles.push(album.title);
	}

	return titles.length > 0 ? titles.join(' - ') : albumId;
}

/**
 * 一个 Remark 插件，将 ![](album:album/image) 路径替换为实际 URL。
 * 兼容旧写法 ![](@/album/image)，但推荐使用 album:，避免和 Astro 的 @/ 别名冲突。
 */
export function remarkAlbumImages() {
	return (tree, file) => {
		const albums = loadAlbums();
		const filePath = file?.history?.[0] || file?.path || '<unknown>';

		visit(tree, 'image', (node) => {
			if (typeof node.url !== 'string') return;
			if (!node.url.startsWith('album:') && !node.url.startsWith('@/')) return;

			const result = findImageByPath(node.url, albums);
			if (!result) {
				throw new Error(`[album] Image not found: ${node.url} (in ${filePath})`);
			}

			node.url = result.image.url;
			node.title = result.image.title;
			// 传递相册信息，便于后续展示。Remark 节点可以用 data 属性携带额外信息。
			node.data = node.data || {};
			node.data.hProperties = node.data.hProperties || {};
			node.data.hProperties['data-album-title'] = getFullAlbumTitle(result.album.id, albums);
			node.data.hProperties['data-album-id'] = result.album.id;
		});
	};
}
