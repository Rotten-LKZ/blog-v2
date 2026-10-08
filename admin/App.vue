<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

type Post = { kind: 'blog' | 'collection'; collection?: string; slug: string; extension?: 'md' | 'mdx'; source: string };
type Chapter = { chapterName: string; posts: { slug: string; title?: string }[] };
type Collection = { id: string; meta: { title: string; description: string; structure: Chapter[]; [key: string]: unknown } };
type Image = { id: string; title?: string; description?: string; url: string };
type Album = { id: string; title: string; description?: string; cover?: string; children?: Album[]; images?: Image[] };
const posts = ref<Post[]>([]), collections = ref<Collection[]>([]), albums = ref<Album[]>([]), components = ref<string[]>([]);
const section = ref<'posts' | 'collections' | 'albums'>('posts');
const current = ref<Post | null>(null), selectedCollection = ref<Collection | null>(null), selectedAlbum = ref<Album | null>(null);
const source = ref(''), metaText = ref(''), status = ref(''), error = ref(''), search = ref('');
const textarea = ref<HTMLTextAreaElement | null>(null), suggestion = ref(''), suggestionStart = ref(0);
const selectedIndex = ref(0);
const slugInput = ref('');
const filtered = computed(() => posts.value.filter(p => `${p.collection || ''}/${p.slug}`.toLowerCase().includes(search.value.toLowerCase())));
const preview = computed(() => {
  const body = source.value.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '').replace(/^import\s+.+?;?\s*$/gm, '');
  const withImages = body.replace(/(!\[[^\]]*\]\()album:([\w/.-]+)(\))/g, (full, open, ref, close) => {
    const image = findImage(ref);
    return image ? `${open}${image.url}${close}` : full;
  });
  return DOMPurify.sanitize(marked.parse(withImages.replace(/<([A-Z][\w]*)\b[^>]*\/>/g, '\n> 组件：$1\n'), { async: false }) as string);
});
function findImage(ref: string): Image | undefined {
  const slash = ref.lastIndexOf('/');
  return findAlbum(ref.slice(0, slash))?.images?.find(image => image.id === ref.slice(slash + 1));
}
const matches = computed(() => {
  if (!suggestion.value) return [];
  const names = suggestion.value.startsWith('album:') ? albumRefs.value : components.value;
  const query = suggestion.value.startsWith('album:') ? suggestion.value.slice(6) : suggestion.value.slice(1);
  return names.filter(x => x.toLowerCase().includes(query.toLowerCase())).slice(0, 10);
});
const albumRefs = computed(() => {
  const result: string[] = [];
  function walk(nodes: Album[]) { for (const album of nodes) { for (const image of album.images || []) result.push(`album:${album.id}/${image.id}`); walk(album.children || []); } }
  walk(albums.value);
  return result;
});
const albumList = computed(() => {
  const result: { album: Album; depth: number }[] = [];
  function walk(nodes: Album[], depth: number) { for (const album of nodes) { result.push({ album, depth }); walk(album.children || [], depth + 1); } }
  walk(albums.value, 0);
  return result;
});
async function request(path: string, options?: RequestInit) {
  const response = await fetch(`/api/admin${path}`, options);
  let data: any;
  try { data = await response.json(); } catch { throw new Error(`HTTP ${response.status}`); }
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}
async function load() {
  try {
    const data = await request('');
    posts.value = data.posts; collections.value = data.collections; albums.value = data.albums; components.value = data.components;
    if (current.value) current.value = posts.value.find(p => p.kind === current.value?.kind && p.collection === current.value?.collection && p.slug === current.value?.slug) || null;
    if (selectedCollection.value) selectedCollection.value = collections.value.find(c => c.id === selectedCollection.value?.id) || null;
    if (selectedAlbum.value) selectedAlbum.value = findAlbum(selectedAlbum.value.id);
  } catch (e) { error.value = String(e); }
}
onMounted(load);
function notice(message: string) { status.value = message; error.value = ''; }
function fail(e: unknown) { error.value = e instanceof Error ? e.message : String(e); }
function choosePost(post: Post) { current.value = post; source.value = post.source; slugInput.value = post.slug; section.value = 'posts'; suggestion.value = ''; notice(''); }
function newPost() {
  const slug = prompt('文件名（英文、数字、连字符；MDX 组件请以 .mdx 结尾）');
  if (!slug) return;
  const collection = prompt('合集 ID（普通文章留空）') || '';
  if (collection && !collections.value.some(c => c.id === collection)) { fail('合集不存在，请先创建合集'); return; }
  const post: Post = { kind: collection ? 'collection' : 'blog', ...(collection ? { collection } : {}), slug, source: '' };
  current.value = post; slugInput.value = slug;
  source.value = `---\ntitle: "新文章"\ndescription: ""\ntags: []\ntoc: false\n---\n\n# 新文章\n`;
  section.value = 'posts'; notice('新文章尚未保存');
}
async function savePost() {
  if (!current.value) return;
  try {
    const post = await request('/post', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: current.value.kind, collection: current.value.collection, slug: slugInput.value, source: source.value }) });
    await load(); const saved = posts.value.find(p => p.kind === post.kind && p.collection === post.collection && p.slug === post.slug);
    if (saved) choosePost(saved);
    notice('文章已保存，时间戳已更新');
  } catch (e) { fail(e); }
}
async function deletePost() {
  if (!current.value || !posts.value.some(p => p.kind === current.value?.kind && p.collection === current.value?.collection && p.slug === current.value?.slug)) return;
  if (!confirm(`删除 ${current.value.slug}？此操作不可撤销。`)) return;
  try {
    const p = current.value;
    await request(`/post?${new URLSearchParams({ kind: p.kind, collection: p.collection || '', slug: p.slug })}`, { method: 'DELETE' });
    current.value = null; source.value = ''; await load(); notice('文章已删除');
  } catch (e) { fail(e); }
}
function updateSuggestion() {
  const node = textarea.value; if (!node) return;
  const before = source.value.slice(0, node.selectionStart);
  const match = before.match(/(?:album:[\w/.-]*|@[\w.-]*)$/);
  suggestion.value = match?.[0] || ''; suggestionStart.value = node.selectionStart - suggestion.value.length; selectedIndex.value = 0;
}
function insertSuggestion(value: string) {
  const node = textarea.value; if (!node) return;
  const isAlbum = suggestion.value.startsWith('album:');
  let insertion = value;
  let end = node.selectionStart;
  if (!isAlbum) {
    const name = value.replace(/\.(astro|vue)$/, '');
    insertion = `<${name}${value.endsWith('.vue') ? ' client:load' : ''} />`;
    const baseDepth = current.value?.kind === 'collection' ? 3 : 2;
    const nestedDepth = (current.value?.slug.match(/\//g) || []).length;
    const folder = '../'.repeat(baseDepth + nestedDepth) + 'components/';
    const path = `${folder}${value.endsWith('.vue') ? 'vue/' : ''}${value}`;
    const statement = `import ${name} from '${path}';`;
    if (!source.value.includes(statement)) {
      if (current.value?.extension === 'mdx' || current.value?.slug.endsWith('.mdx')) {
        const frontmatter = source.value.match(/^---\s*\n[\s\S]*?\n---\s*\n?/);
        const position = frontmatter?.[0].length || 0;
        source.value = source.value.slice(0, position) + `\n${statement}\n` + source.value.slice(position);
        if (position <= suggestionStart.value) { suggestionStart.value += statement.length + 2; end += statement.length + 2; }
      } else { fail('请先使用 .mdx 文件以插入组件'); suggestion.value = ''; return; }
    }
  }
  source.value = source.value.slice(0, suggestionStart.value) + insertion + source.value.slice(end);
  suggestion.value = '';
  nextTick(() => { node.focus(); const pos = suggestionStart.value + insertion.length; node.setSelectionRange(pos, pos); });
}
function editorKey(e: KeyboardEvent) {
  if (!matches.value.length) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); selectedIndex.value = (selectedIndex.value + 1) % matches.value.length; }
  if (e.key === 'ArrowUp') { e.preventDefault(); selectedIndex.value = (selectedIndex.value + matches.value.length - 1) % matches.value.length; }
  if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertSuggestion(matches.value[selectedIndex.value]); }
  if (e.key === 'Escape') suggestion.value = '';
}
function chooseCollection(c: Collection) { selectedCollection.value = c; metaText.value = JSON.stringify(c.meta, null, 2); section.value = 'collections'; notice(''); }
function newCollection() {
  const id = prompt('合集 ID（英文、数字、连字符）'); if (!id) return;
  chooseCollection({ id, meta: { title: '新合集', description: '', structure: [] } });
}
async function saveCollection() {
  if (!selectedCollection.value) return;
  try {
    const meta = JSON.parse(metaText.value);
    await request('/collection', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selectedCollection.value.id, meta }) });
    await load(); notice('合集已保存');
  } catch (e) { fail(e); }
}
async function deleteCollection() {
  if (!selectedCollection.value || !confirm(`删除合集 ${selectedCollection.value.id}？合集必须为空。`)) return;
  try { await request(`/collection?id=${encodeURIComponent(selectedCollection.value.id)}`, { method: 'DELETE' }); selectedCollection.value = null; await load(); notice('合集已删除'); } catch (e) { fail(e); }
}
function findAlbum(id: string, nodes = albums.value): Album | null { for (const node of nodes) { if (node.id === id) return node; const child = findAlbum(id, node.children || []); if (child) return child; } return null; }
function chooseAlbum(album: Album) { selectedAlbum.value = album; section.value = 'albums'; notice(''); }
function addAlbum(parent?: Album) {
  const name = prompt('新相册 ID（英文、数字、连字符）'); if (!name) return;
  const id = parent ? `${parent.id}/${name}` : name;
  if (findAlbum(id)) return fail('相册 ID 已存在');
  const album: Album = { id, title: name, images: [] };
  if (parent) (parent.children ||= []).push(album); else albums.value.push(album);
  chooseAlbum(album);
}
function removeAlbum(id: string, nodes = albums.value): boolean {
  const i = nodes.findIndex(a => a.id === id);
  if (i !== -1) { nodes.splice(i, 1); return true; }
  return nodes.some(a => removeAlbum(id, a.children || []));
}
async function saveAlbums() {
  try { await request('/albums', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ albums: albums.value }) }); await load(); notice('相册与图片已保存'); } catch (e) { fail(e); }
}
function deleteAlbum() {
  if (!selectedAlbum.value || !confirm(`删除 ${selectedAlbum.value.id} 以及其下所有相册和图片？`)) return;
  removeAlbum(selectedAlbum.value.id); selectedAlbum.value = null; saveAlbums();
}
</script>

<template>
  <div class="shell">
    <aside class="sidebar">
      <h1>博客管理 <small>本地工作台</small></h1>
      <nav><button v-for="tab in (['posts','collections','albums'] as const)" :key="tab" :class="{active:section===tab}" @click="section=tab">{{ {posts:'文章',collections:'合集',albums:'相册'}[tab] }}</button></nav>
      <template v-if="section==='posts'">
        <input v-model="search" placeholder="搜索文章 / 合集" aria-label="搜索文章" />
        <button class="primary" @click="newPost">＋ 新建文章</button>
        <button v-for="p in filtered" :key="p.kind + p.collection + p.slug" class="item" :class="{chosen:current?.slug===p.slug && current?.collection===p.collection}" @click="choosePost(p)"><small>{{p.collection || '普通文章'}}</small>{{p.slug}}</button>
      </template>
      <template v-else-if="section==='collections'">
        <button class="primary" @click="newCollection">＋ 新建合集</button>
        <button v-for="c in collections" :key="c.id" class="item" :class="{chosen:selectedCollection?.id===c.id}" @click="chooseCollection(c)"><small>{{c.id}}</small>{{c.meta.title}}</button>
      </template>
      <template v-else>
        <button class="primary" @click="addAlbum()">＋ 新建顶级相册</button>
        <button v-for="entry in albumList" :key="entry.album.id" class="item" :class="{chosen:selectedAlbum?.id===entry.album.id}" :style="{paddingLeft:`${12 + entry.depth * 18}px`}" @click="chooseAlbum(entry.album)">{{entry.album.title}}</button>
      </template>
    </aside>
    <main>
      <div class="toolbar"><span>{{ section==='posts' ? current?.slug || '选择文章' : section==='collections' ? selectedCollection?.id || '选择合集' : selectedAlbum?.id || '选择相册' }}</span><span class="message" role="status">{{status}}</span><span class="error" role="alert">{{error}}</span>
        <template v-if="section==='posts' && current"><button @click="deletePost">删除</button><button class="primary" @click="savePost">保存文章</button></template>
        <template v-if="section==='collections' && selectedCollection"><button @click="deleteCollection">删除</button><button class="primary" @click="saveCollection">保存合集</button></template>
        <template v-if="section==='albums'"><button v-if="selectedAlbum" @click="deleteAlbum">删除相册</button><button class="primary" @click="saveAlbums">保存相册</button></template>
      </div>
      <div v-if="section==='posts' && current" class="workspace">
        <div class="preview"><h2>实时预览</h2><article class="prose" v-html="preview"></article></div>
        <div class="editor"><div class="editor-head"><label>文件名 <input v-model="slugInput" :disabled="posts.some(p=>p.kind===current?.kind && p.collection===current?.collection && p.slug===current?.slug)" /></label><span>输入 @ 搜索组件，输入 album: 搜索图片</span></div><textarea ref="textarea" v-model="source" spellcheck="false" aria-label="文章源码" @input="updateSuggestion" @click="updateSuggestion" @keydown="editorKey"></textarea><div v-if="matches.length" class="suggestions"><button v-for="(name,i) in matches" :key="name" :class="{active:i===selectedIndex}" @mousedown.prevent="insertSuggestion(name)">{{name}}</button></div></div>
      </div>
      <div v-else-if="section==='collections' && selectedCollection" class="panel"><p>编辑 meta.json：title、description、category、tags、structure（章节与文章 slug）等。文章通过左侧「文章」新建并指定合集 ID。</p><textarea v-model="metaText" spellcheck="false" aria-label="合集元数据"></textarea></div>
      <div v-else-if="section==='albums'" class="panel album-panel"><template v-if="selectedAlbum"><h2>{{selectedAlbum.id}}</h2><label>名称<input v-model="selectedAlbum.title" /></label><label>描述<input v-model="selectedAlbum.description" /></label><label>封面 URL<input v-model="selectedAlbum.cover" /></label><button @click="addAlbum(selectedAlbum)">＋ 子相册</button><h3>图片列表</h3><div v-for="(image,i) in selectedAlbum.images || []" :key="i" class="image-row"><img :src="image.url" alt="" /><label>图片 ID<input v-model="image.id" /></label><label>标题<input v-model="image.title" /></label><label>描述<input v-model="image.description" /></label><label>图片 URL<input v-model="image.url" /></label><button @click="selectedAlbum.images?.splice(i,1)">移除</button></div><button @click="(selectedAlbum.images ||= []).push({id:'',title:'',url:''})">＋ 添加图片</button></template><p v-else>从左侧选择相册或创建相册。</p></div>
      <div v-else class="empty">选择一项开始编辑</div>
    </main>
  </div>
</template>
