import travelJapan2025 from './images/travel.japan.2025';

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
				children: [
					{
						id: 'travel/japan/2025',
						title: '2025 暑假',
						images: travelJapan2025,
					},
				],
			},
		],
	},
];
