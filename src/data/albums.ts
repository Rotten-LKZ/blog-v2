export interface AlbumImage {
	id: string; // 唯一标识，用于文章引用，如 "japan/tokyo-tower" 或 "tokyo-tower" (在 album 内)
	title?: string;
	description?: string;
	url: string; // 远程链接或本地资产路径 (@/assets/...)
}

export interface Album {
	id: string; // URL 路径，如 "travel" 或 "travel/japan"
	title: string;
	description?: string;
	cover?: string;
	children?: Album[]; // 嵌套
	images?: AlbumImage[];
}

export const ALBUMS: Album[] = [
	{
		id: 'travel',
		title: '旅游',
		description: '我的旅行足迹',
		children: [
			{
				id: 'travel/japan',
				title: '日本',
				images: [
					{
						id: 'tokyo-tower',
						title: '东京铁塔',
						url: 'https://images.unsplash.com/photo-1540959733332-e94e270b4052',
					},
				],
			},
		],
		images: [
			{
				id: 'start',
				title: '出发',
				url: '/src/assets/blog-placeholder-1.jpg',
			},
		],
	},
];
