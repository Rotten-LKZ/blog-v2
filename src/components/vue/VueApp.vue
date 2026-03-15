<template>
	<div class="vue-app">
		<nav class="app-nav">
			<button
				v-for="tab in tabs"
				:key="tab.id"
				class="app-nav-btn"
				:class="{ active: currentTab === tab.id }"
				@click="switchTab(tab.id)"
			>
				{{ tab.label }}
			</button>
		</nav>

		<div class="app-content">
			<transition name="fade" mode="out-in">
				<!-- 友链 -->
				<div v-if="currentTab === 'friends'" :key="'friends'" class="tab-panel">
					<h2>友情链接</h2>
					<p class="section-desc">欢迎互换友链，共同交流学习~</p>
					<div class="friends-grid">
						<a v-for="friend in friends" :key="friend.url" :href="friend.url" target="_blank" class="friend-card" :style="{ '--friend-color': friend.color }">
							<img :src="friend.avatar" :alt="friend.name" class="friend-avatar" />
							<div class="friend-info">
								<div class="friend-name">{{ friend.name }}</div>
								<div class="friend-blog">{{ friend.blog }}</div>
								<div class="friend-desc">{{ friend.desc }}</div>
							</div>
						</a>
					</div>
				</div>

				<!-- 首页 -->
				<div v-else-if="currentTab === 'home'" :key="'home'" class="tab-panel">
					<h2>Vue 应用首页</h2>
					<p>这是一个运行在 Astro 内部的 Vue 单页应用 (SPA)。使用上方的标签在不同模块间导航。</p>
					<p>这展示了如何通过嵌入完整的 Vue 组件，为您的 Astro 博客增加丰富的交互功能。</p>
				</div>

				<!-- 工具 -->
				<div v-else-if="currentTab === 'tools'" :key="'tools'" class="tab-panel">
					<h2>交互工具箱</h2>
					<div class="tool-card">
						<h3>调色盘</h3>
						<div class="color-demo">
							<input type="color" v-model="pickedColor" class="color-input" />
							<span class="color-value" :style="{ color: pickedColor }">{{ pickedColor }}</span>
						</div>
					</div>
					<div class="tool-card">
						<h3>文本统计</h3>
						<textarea
							v-model="textInput"
							placeholder="在此处输入文字..."
							class="text-area"
						></textarea>
						<p class="text-stats">
							字符数: <strong>{{ textInput.length }}</strong> |
							单词数: <strong>{{ wordCount }}</strong>
						</p>
					</div>
				</div>

				<!-- 画廊 -->
				<div v-else-if="currentTab === 'gallery'" :key="'gallery'" class="tab-panel">
					<h2>交互画廊</h2>
					<p>这是一个占位画廊区域。您可以在这里展示您的插画或摄影作品！</p>
					<div class="gallery-grid">
						<div v-for="n in 6" :key="n" class="gallery-item">
							<div class="gallery-placeholder">{{ n }}</div>
						</div>
					</div>
				</div>
			</transition>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import friendsData from '../../data/friends.json';

const tabs = [
	{ id: 'friends', label: '友链' },
	{ id: 'home', label: '首页' },
	{ id: 'tools', label: '工具' },
	{ id: 'gallery', label: '画廊' },
];

const friends = ref(friendsData);
const currentTab = ref('friends');
const pickedColor = ref('#5DADE2');
const textInput = ref('');

const wordCount = computed(() => {
	const trimmed = textInput.value.trim();
	return trimmed ? trimmed.split(/\s+/).length : 0;
});

const switchTab = (tabId: string) => {
	currentTab.value = tabId;
	const url = new URL(window.location.href);
	url.searchParams.set('tab', tabId);
	window.history.pushState({}, '', url);
};

onMounted(() => {
	const params = new URLSearchParams(window.location.search);
	const tabFromUrl = params.get('tab');
	if (tabFromUrl && tabs.find(t => t.id === tabFromUrl)) {
		currentTab.value = tabFromUrl;
	}

	window.addEventListener('popstate', () => {
		const updatedParams = new URLSearchParams(window.location.search);
		const updatedTab = updatedParams.get('tab');
		if (updatedTab && tabs.find(t => t.id === updatedTab)) {
			currentTab.value = updatedTab;
		}
	});
});
</script>

<style scoped>
.vue-app {
	min-height: 600px;
}

.section-desc {
	color: var(--color-text-light);
	margin-bottom: 2rem;
}

.app-nav {
	display: flex;
	gap: 0.5rem;
	margin-bottom: 2rem;
	border-bottom: 2px solid var(--color-border);
	padding: 0;
}

.app-nav-btn {
	padding: 0.75rem 1.25rem;
	border: none;
	background: none;
	font-size: 1em;
	font-weight: 600;
	color: var(--color-text-light);
	cursor: pointer;
	border-radius: 8px 8px 0 0;
	transition: all 0.2s;
	font-family: inherit;
	position: relative;
	margin-bottom: -2px;
	border-bottom: 3px solid transparent;
}

.app-nav-btn:hover {
	color: var(--color-primary);
	background: var(--color-primary-pale);
}

.app-nav-btn.active {
	color: var(--color-primary);
	border-bottom: 3px solid var(--color-primary);
}

/* Friends Grid */
.friends-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
	gap: 1.25rem;
}

.friend-card {
	display: flex;
	align-items: center;
	gap: 1rem;
	padding: 1.25rem;
	background: var(--color-bg-card);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-lg);
	text-decoration: none;
	color: inherit;
	transition: all 0.3s cubic-bezier(0.165, 0.84, 0.44, 1);
	border-left: 4px solid var(--friend-color, var(--color-primary));
}

.friend-card:hover {
	transform: translateY(-4px) scale(1.02);
	box-shadow: var(--shadow-hover);
	border-color: var(--friend-color, var(--color-primary));
}

.friend-avatar {
	width: 60px;
	height: 60px;
	border-radius: 50%;
	object-fit: cover;
	border: 2px solid var(--color-border);
	transition: transform 0.5s ease;
}

.friend-card:hover .friend-avatar {
	transform: rotate(360deg);
}

.friend-info {
	flex: 1;
	min-width: 0;
}

.friend-name {
	font-weight: 800;
	font-size: 1.1em;
	color: var(--color-text);
	margin-bottom: 0.1rem;
}

.friend-blog {
	font-size: 0.85em;
	color: var(--color-primary);
	font-weight: 600;
	margin-bottom: 0.25rem;
}

.friend-desc {
	font-size: 0.8em;
	color: var(--color-text-light);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

/* Tab Switch Animation */
.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
	opacity: 0;
	transform: translateY(4px);
}

.tab-panel h2 {
	margin-bottom: 0.5rem;
	color: var(--color-primary);
}

.tool-card {
	background: var(--color-bg-card);
	border-radius: 12px;
	padding: 1.25rem;
	margin-bottom: 1rem;
	box-shadow: var(--shadow-soft);
	border: 1px solid var(--color-border);
}

.tool-card h3 {
	margin: 0 0 0.75rem;
	font-size: 1.1em;
}

.color-demo {
	display: flex;
	align-items: center;
	gap: 1rem;
}

.color-input {
	width: 50px;
	height: 40px;
	border: 2px solid var(--color-border);
	border-radius: 8px;
	cursor: pointer;
	padding: 2px;
}

.color-value {
	font-weight: 700;
	font-size: 1.1em;
	font-family: monospace;
}

.text-area {
	width: 100%;
	min-height: 80px;
	padding: 0.75rem;
	border: 2px solid var(--color-border);
	border-radius: 8px;
	font-family: inherit;
	font-size: 0.95em;
	resize: vertical;
	background: var(--color-bg);
	color: var(--color-text);
}

.text-area:focus {
	outline: none;
	border-color: var(--color-primary);
}

.text-stats {
	margin: 0.5rem 0 0;
	color: var(--color-text-light);
	font-size: 0.9em;
}

.gallery-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
	gap: 1rem;
	margin-top: 1rem;
}

.gallery-placeholder {
	aspect-ratio: 1;
	background: linear-gradient(135deg, var(--color-primary-pale), var(--color-accent));
	border-radius: 12px;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 1.5em;
	font-weight: 700;
	color: white;
}
</style>