import { visit } from 'unist-util-visit';

/**
 * 一个 Remark 插件：支持 blockquote 标记语法 `> [!tag]`（类似 GFM alerts）。
 * 引用块第一行若为 [!tag]，移除该标记并将 tag 作为 class 加到 blockquote 元素上。
 * 例如：
 *   > [!no-indent]
 *   > 版权声明：……
 * 渲染为 <blockquote class="no-indent">，配合样式取消段首缩进。
 */
export function remarkBlockquoteTags() {
	/** @param {import('mdast').Root} tree */
	return (tree) => {
		visit(tree, 'blockquote', (node) => {
			const first = node.children[0];
			if (first?.type !== 'paragraph') return;
			const head = first.children[0];
			if (head?.type !== 'text') return;
			const m = head.value.match(/^\[!([\w-]+)\][ \t]*\n?/);
			if (!m) return;
			head.value = head.value.slice(m[0].length);
			if (!head.value) first.children.shift();
			if (first.children.length === 0) node.children.shift();
			node.data ??= {};
			const prev = node.data.hProperties?.className;
			const tags = new Set([...(Array.isArray(prev) ? prev : [prev].filter(Boolean)), m[1].toLowerCase()]);
			node.data.hProperties = { ...node.data.hProperties, className: [...tags] };
		});
	};
}
