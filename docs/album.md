# Album Feature 技术实现与架构

## 概述

Album 功能是一个分层级、可嵌套的相册管理系统，支持 Markdown 文章通过自定义语法引用相册图片，并提供完整的浏览、导航和 Lightbox 交互体验。

## 核心架构

### 1. 数据模型

```typescript
// src/data/albums.ts
interface AlbumImage {
  id: string;        // 唯一标识，如 "hkg-lunch"
  title?: string;    // 图片标题
  description?: string;
  url: string;       // 远程或本地图片 URL
}

interface Album {
  id: string;        // 路径标识，如 "travel/japan/2025"
  title: string;
  description?: string;
  cover?: string;
  children?: Album[]; // 嵌套子相册
  images?: AlbumImage[];
}
```

### 2. 数据分层存储

采用**索引+数据分离**的设计：

```
src/data/
├── albums.ts              # 相册索引（树形结构）
└── images/
    └── travel.japan.2025.ts  # 实际图片数据
```

**优势**：
- 避免单文件臃肿
- 支持按主题/时间分文件管理
- 便于版本控制和并行编辑

**引用方式**：
```typescript
// albums.ts
import travelJapan2025 from './images/travel.japan.2025';

export const ALBUMS: Album[] = [{
  id: 'travel/japan/2025',
  title: '2025 暑假',
  images: travelJapan2025,  // 引用外部数据
}];
```

## 图片引用系统

### Markdown 语法

```markdown
![图片描述](album:travel/japan/2025/hkg-lunch)
```

格式：`album:{album-id}/{image-id}`

- 兼容旧写法 `@/`（但推荐使用 `album:` 避免与 Astro 别名冲突）
- 支持多级嵌套相册路径

### Remark 插件处理流

```
Markdown --[remark-album.mjs]--> 解析 album: 路径 --> 替换为真实 URL --> 注入 data-album-* 属性
```

**核心实现** (`src/lib/remark-album.mjs`):

1. **动态加载相册数据**：通过源码级解析读取 `albums.ts`
   - 解析 `import` 语句递归加载分文件数据
   - 提取并计算 `ALBUMS` 导出值

2. **路径解析**：
   ```javascript
   album:travel/japan/2025/hkg-lunch
   ↓
   albumId: "travel/japan/2025"
   imageId: "hkg-lunch"
   ```

3. **节点转换**：
   ```javascript
   node.url = image.url;           // 替换为真实图片地址
   node.data.hProperties = {
     'data-album-title': '旅游 - 日本 - 2025 暑假',
     'data-album-id': 'travel/japan/2025'
   };
   ```

## 前端展示

### 1. 相册浏览页 (`/albums/[...id]`)

- 层级导航（Breadcrumb）
- 子相册卡片网格
- 图片网格布局（AlbumGallery 组件）
- 递归统计子相册图片总数

### 2. Lightbox 交互 (ImageZoom)

基于 PhotoSwipe 5.x，增加自定义功能：

```astro
<!-- src/components/ImageZoom.astro -->
- 点击放大浏览
- 底部 Caption 显示
- 右上角相册标签（可跳转回相册页）
- EXIF 信息按钮（通过 exifr 库解析）
```

**Vite 配置**：
```javascript
// astro.config.mjs
vite: {
  optimizeDeps: {
    include: ['photoswipe', 'photoswipe/lightbox']
  }
}
```

### 3. 文章内嵌图片

Markdown 中的 `album:` 图片在编译时被 remark 插件替换为真实 URL，同时保留相册元数据。ImageZoom 组件自动为 `.prose img` 绑定 Lightbox 行为。

## 服务端兜底解析

为解决 Astro content cache/HMR 不触发 remark 插件重跑的问题，提供服务端 HTML 兜底处理：

```typescript
// src/lib/albums.ts
export function resolveAlbumImageHtml(html: string): string
```

在 `BlogPost` 布局渲染时，通过 `Astro.slots.render('default')` 拿到文章 HTML，再用 `resolveAlbumImageHtml` 做二次替换：
- 将残留的 `album:` / `__astro_image_` 引用替换为真实 URL
- 若遇到无法解析的引用，直接 throw error（不会 silent failure）

这确保 **build 和 dev (HMR) 都能正确替换相册图片**。

## 运行时数据校验

`pnpm dev` / `pnpm build` 时会自动校验相册数据完整性：

1. **Remark 插件**（`src/lib/remark-album.mjs`）在首次加载时校验：
   - `album.id` 在整棵树中唯一
   - `image.id` 在所属 album 内唯一（跨 album 可重复，如 `travel/japan/2025/hkg-lunch` 和 `travel/japan/2024/hkg-lunch` 不算重复）
   - 若有重复，抛出 `[album] Validation failed` 错误

2. **图片引用校验**：
   - Remark 插件处理 `album:` 引用时，若找不到对应图片，抛出带文章路径的 error
   - `resolveAlbumImageHtml` 兜底时若仍无法解析，也会抛出 error

3. **错误信息示例**：
   ```
   [album] Validation failed:
     Duplicate image id "foo" in album "travel/japan/2025"
   ```
   ```
   [album] Image not found: album:travel/japan/2025/nonexistent (in /path/to/article.md)
   ```

## 与 Collection 系统的集成

合集文章（`/collections/*`）可直接引用相册图片：

```markdown
---
title: "启程"
---

![咖喱牛腩饭](album:travel/japan/2025/hkg-lunch)
```

图片在文章中渲染时：
1. 显示带 `data-album-*` 属性的 `<img>`
2. ImageZoom 自动绑定 Lightbox
3. 点击放大后显示相册标签，可跳转回对应相册页

## 相关文件概览

| 文件 | 变更说明 |
|------|---------|
| `src/data/albums.ts` | 改为索引结构，引用外部图片数据文件 |
| `src/data/images/*.ts` | 新增分文件图片数据 |
| `src/lib/albums.ts` | 增加递归统计、服务端 HTML 解析 |
| `src/lib/remark-album.mjs` | 重写为源码级解析，支持 import 递归 |
| `src/components/ImageZoom.astro` | 相册标签、EXIF 按钮样式优化 |
| `astro.config.mjs` | 添加 PhotoSwipe 预构建配置 |
| `src/pages/albums/[...id].astro` | 使用递归统计图片数 |
| `src/pages/collections/[...slug].astro` | 合集文章页面支持相册图片引用与合集内导航 |

## 使用示例

### 1. 添加新相册

```typescript
// src/data/images/new.trip.ts
import type { AlbumImage } from '../albums';

export default [
  { id: 'photo-1', title: '照片1', url: 'https://...' }
] as AlbumImage[];

// src/data/albums.ts
import newTrip from './images/new.trip';

export const ALBUMS: Album[] = [
  {
    id: 'travel',
    title: '旅游',
    children: [
      {
        id: 'travel/new',
        title: '新旅程',
        images: newTrip,
      },
    ],
  },
];
```

### 2. 文章引用

```markdown
![照片1](album:travel/new/photo-1)
```

### 3. 嵌套结构

```typescript
{
  id: 'travel',
  title: '旅游',
  children: [
    {
      id: 'travel/japan',
      title: '日本',
      children: [
        { id: 'travel/japan/2025', images: travelJapan2025 }
      ]
    }
  ]
}
```

## 注意事项

1. **图片 ID 唯一性**：在同一 album 路径 namespace 内必须唯一（`albumId/imageId` 全路径不重复即可），跨 album 可重复
2. **路径格式**：`album:` 后跟完整相册路径（支持多级嵌套）
3. **缓存机制**：remark 插件有模块缓存，修改数据文件后可能需要重启 dev server
4. **构建优化**：PhotoSwipe 已配置为预构建依赖，避免 504 错误
5. **运行时校验**：`pnpm dev` / `pnpm build` 会自动检测重复 ID 和无效引用，遇到问题会直接报错终止
