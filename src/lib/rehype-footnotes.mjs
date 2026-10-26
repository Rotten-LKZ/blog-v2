import { visit } from 'unist-util-visit';

/**
 * 一个 Rehype 插件：调整 GFM 脚注区块展示。
 * - 标题「Footnotes」(sr-only) 改为可见的中文「脚注」
 * - 解包脚注条目内的 <p>：避免 .prose p 的 text-indent 段首缩进
 *   （脚注是列表条目，直接用 li 承载内容）
 */
export function rehypeFootnotesLabel() {
	/** @param {import('hast').Root} tree */
	return (tree) => {
		visit(tree, 'element', (node) => {
			if (node.tagName === 'h2' && node.properties?.id === 'footnote-label') {
				node.properties.className = [];
				node.children = [{ type: 'text', value: '脚注' }];
			}
			if (node.tagName === 'section' && Array.isArray(node.properties?.className) && node.properties.className.includes('footnotes')) {
				unwrapParagraphs(node);
			}
		});
	};
}

/** 递归把子树里的 <p> 替换为其子节点 */
function unwrapParagraphs(node) {
	if (!Array.isArray(node.children)) return;
	node.children = node.children.flatMap((child) =>
		child.type === 'element' && child.tagName === 'p' ? child.children : [child],
	);
	for (const child of node.children) {
		if (child.type === 'element') unwrapParagraphs(child);
	}
}
