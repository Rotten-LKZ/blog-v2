import { createServer as createHttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile, readdir, lstat, mkdir, open, rename, rm, rmdir } from 'node:fs/promises';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import { parseDocument, isMap } from 'yaml';
import ts from 'typescript-api';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contentRoot = join(root, 'src/content');
const albumsFile = join(root, 'src/data/albums.ts');
const albumImagesRoot = join(root, 'src/data/images');
const adminIndex = join(root, 'admin/index.html');
const port = Number(process.env.ADMIN_PORT || 4322);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid ADMIN_PORT');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function invalid(message) { throw new HttpError(400, message); }
function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function safeSegment(value, field) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value) || value.endsWith('.')) {
    invalid(`Invalid ${field}`);
  }
  return value;
}
function collectionId(value) { return safeSegment(value, 'collection id'); }
function postSlug(value) {
  if (typeof value !== 'string') invalid('Invalid post slug');
  const suffix = value.match(/\.(md|mdx)$/i);
  const stem = suffix ? value.slice(0, -suffix[0].length) : value;
  const segments = stem.split('/');
  if (!segments.length || segments.some(segment => !segment || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(segment) || segment.endsWith('.'))) {
    invalid('Invalid post slug');
  }
  return { stem: segments.join('/'), extension: suffix?.[1].toLowerCase() };
}
function postLocation(kind, collection) {
  if (kind === 'blog') {
    if (collection !== undefined && collection !== '') invalid('Blog posts cannot have a collection');
    return join(contentRoot, 'blog');
  }
  if (kind !== 'collection') invalid('Invalid post kind');
  return join(contentRoot, 'collections', collectionId(collection));
}
async function statFile(path) {
  try { return await lstat(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function directory(path, create = false) {
  const stat = await statFile(path);
  if (!stat && create) {
    await mkdir(path);
    return true;
  }
  if (!stat) return false;
  if (!stat.isDirectory()) throw new HttpError(400, 'Not a directory');
  return true;
}
async function regularFile(path) {
  const stat = await statFile(path);
  if (stat && !stat.isFile()) throw new HttpError(400, 'Not a regular file');
  return Boolean(stat);
}
async function atomicWrite(path, content) {
  const temporary = join(dirname(path), `.${randomUUID()}.tmp`);
  let file;
  try {
    file = await open(temporary, 'wx', 0o666);
    await file.writeFile(content);
    await file.sync();
    await file.close();
    file = null;
    await rename(temporary, path);
    const parent = await open(dirname(path), 'r');
    try { await parent.sync(); }
    finally { await parent.close(); }
  } finally {
    if (file) await file.close();
    await rm(temporary, { force: true });
  }
}
async function jsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 8 * 1024 * 1024) throw new HttpError(413, 'Request body too large');
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks, size).toString('utf8'));
    if (!isObject(value)) invalid('Expected a JSON object');
    return value;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    invalid('Invalid JSON');
  }
}
function sendJson(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
}
async function readJsonFile(path) { return JSON.parse(await readFile(path, 'utf8')); }

function parseFrontmatter(source) {
  const matched = /^(\uFEFF)?---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(source);
  if (!matched) {
    if (/^\uFEFF?---[ \t]*(?:\r?\n|$)/.test(source)) invalid('Unclosed YAML frontmatter');
    return null;
  }
  const doc = parseDocument(matched[2] || '', { uniqueKeys: true });
  if (doc.errors.length || (doc.contents !== null && !isMap(doc.contents))) invalid('Invalid YAML frontmatter');
  return { doc, prefix: matched[1] || '', body: source.slice(matched[0].length), newline: matched[0].includes('\r\n') ? '\r\n' : '\n' };
}
function timestampPost(source, previous) {
  const current = parseFrontmatter(source);
  const original = previous === null ? null : parseFrontmatter(previous);
  const newline = current?.newline || (source.includes('\r\n') ? '\r\n' : '\n');
  const doc = current?.doc || parseDocument('');
  if (doc.contents === null) doc.contents = doc.createNode({});
  const createdAt = original?.doc.get('createdAt') ?? doc.get('createdAt') ?? new Date().toISOString();
  doc.set('createdAt', createdAt);
  doc.set('updatedAt', new Date().toISOString());
  const yaml = doc.toString({ lineWidth: 0 }).trimEnd().replace(/\n/g, newline);
  return `${current?.prefix || ''}---${newline}${yaml}${newline}---${newline}${current ? current.body : `${newline}${source}`}`;
}

async function postFiles(base, relative = '') {
  if (!await directory(join(base, relative))) return [];
  const entries = await readdir(join(base, relative), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) files.push(...await postFiles(base, join(relative, entry.name)));
    else if (entry.isFile() && /\.(md|mdx)$/.test(entry.name)) files.push(join(relative, entry.name));
  }
  return files;
}
async function listPosts() {
  const posts = [];
  async function collect(base, kind, collection) {
    for (const relative of await postFiles(base)) {
      const extension = relative.endsWith('.mdx') ? 'mdx' : 'md';
      posts.push({ kind, ...(collection ? { collection } : {}), slug: relative.slice(0, -extension.length - 1).split(sep).join('/'), extension, source: await readFile(join(base, relative), 'utf8') });
    }
  }
  await collect(join(contentRoot, 'blog'), 'blog');
  const collectionsRoot = join(contentRoot, 'collections');
  if (await directory(collectionsRoot)) {
    for (const entry of await readdir(collectionsRoot, { withFileTypes: true })) {
      if (entry.isDirectory() && await regularFile(join(collectionsRoot, entry.name, 'meta.json'))) {
        await collect(join(collectionsRoot, entry.name), 'collection', entry.name);
      }
    }
  }
  return posts.sort((a, b) => `${a.kind}/${a.collection || ''}/${a.slug}`.localeCompare(`${b.kind}/${b.collection || ''}/${b.slug}`));
}
async function listCollections() {
  const base = join(contentRoot, 'collections');
  if (!await directory(base)) return [];
  const result = [];
  for (const entry of await readdir(base, { withFileTypes: true })) {
    if (entry.isDirectory() && await regularFile(join(base, entry.name, 'meta.json'))) {
      result.push({ id: entry.name, meta: await readJsonFile(join(base, entry.name, 'meta.json')) });
    }
  }
  return result.sort((a, b) => a.id.localeCompare(b.id));
}
async function listComponents() {
  const base = join(root, 'src/components');
  const astro = (await readdir(base, { withFileTypes: true })).filter(item => item.isFile() && item.name.endsWith('.astro')).map(item => item.name);
  const vue = (await readdir(join(base, 'vue'), { withFileTypes: true })).filter(item => item.isFile() && item.name.endsWith('.vue')).map(item => item.name);
  return [...astro, ...vue].sort();
}
async function locatePost(base, slug) {
  let parent = base;
  for (const segment of slug.stem.split('/').slice(0, -1)) {
    parent = join(parent, segment);
    if (!await directory(parent)) return { parent: null, matches: [] };
  }
  const stemPath = join(base, slug.stem);
  const matches = [];
  for (const extension of ['md', 'mdx']) {
    if (await regularFile(`${stemPath}.${extension}`)) matches.push(extension);
  }
  return { parent, stemPath, matches };
}
async function putPost(body) {
  if (typeof body.source !== 'string') invalid('Post source must be a string');
  const base = postLocation(body.kind, body.collection);
  const slug = postSlug(body.slug);
  const baseExists = await directory(base);
  if (body.kind === 'collection' && (!baseExists || !await regularFile(join(base, 'meta.json')))) throw new HttpError(404, 'Collection not found');
  const { matches } = await locatePost(base, slug);
  if (matches.length > 1 && !slug.extension) throw new HttpError(409, 'Multiple extensions exist; specify one');
  const extension = slug.extension || matches[0] || 'md';
  if (slug.extension && !matches.includes(extension) && matches.length) throw new HttpError(409, 'Post exists with another extension');
  if (!baseExists) await mkdir(base);
  let parent = base;
  for (const segment of slug.stem.split('/').slice(0, -1)) {
    parent = join(parent, segment);
    await directory(parent, true);
  }
  const path = join(base, `${slug.stem}.${extension}`);
  const previous = await regularFile(path) ? await readFile(path, 'utf8') : null;
  const source = timestampPost(body.source, previous);
  await atomicWrite(path, source);
  return { kind: body.kind, ...(body.kind === 'collection' ? { collection: body.collection } : {}), slug: slug.stem, extension, source };
}
async function deletePost(query) {
  const base = postLocation(query.get('kind'), query.get('collection') || undefined);
  const slug = postSlug(query.get('slug'));
  if (!await directory(base)) throw new HttpError(404, 'Post not found');
  const { matches } = await locatePost(base, slug);
  if (matches.length > 1 && !slug.extension) throw new HttpError(409, 'Multiple extensions exist; specify one');
  const extension = slug.extension || matches[0];
  if (!extension || !matches.includes(extension)) throw new HttpError(404, 'Post not found');
  await rm(join(base, `${slug.stem}.${extension}`));
  return { ok: true };
}
async function putCollection(body) {
  const id = collectionId(body.id);
  if (!isObject(body.meta)) invalid('Collection meta must be an object');
  const base = join(contentRoot, 'collections');
  await directory(base, true);
  await directory(join(base, id), true);
  const file = join(base, id, 'meta.json');
  await regularFile(file);
  await atomicWrite(file, JSON.stringify(body.meta, null, 2) + '\n');
  return { id, meta: body.meta };
}
async function deleteCollection(query) {
  const id = collectionId(query.get('id'));
  const base = join(contentRoot, 'collections', id);
  if (!await directory(base)) throw new HttpError(404, 'Collection not found');
  if (!await regularFile(join(base, 'meta.json'))) throw new HttpError(404, 'Collection not found');
  const contents = await readdir(base);
  if (contents.some(name => name !== 'meta.json')) throw new HttpError(409, 'Collection is not empty');
  await rm(join(base, 'meta.json'));
  await rmdir(base);
  return { ok: true };
}
function parseAlbumModule(source, file) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (ast.parseDiagnostics.length) throw new Error(`Invalid album TypeScript: ${file}`);
  return ast;
}

function albumImageImports(ast) {
  const imports = new Map();
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause?.name || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const specifier = statement.moduleSpecifier.text;
    if (!specifier.startsWith('./images/')) continue;
    const match = /^\.\/images\/([A-Za-z0-9][A-Za-z0-9._-]*)$/.exec(specifier);
    if (!match) throw new Error(`Unsupported album image import: ${specifier}`);
    const stem = match[1].endsWith('.ts') ? match[1].slice(0, -3) : match[1];
    if (!stem || stem.endsWith('.')) throw new Error(`Invalid album image import: ${specifier}`);
    imports.set(statement.importClause.name.text, { path: join(albumImagesRoot, `${stem}.ts`), statement });
  }
  return imports;
}

async function readAlbums() {
  if (!await regularFile(albumsFile)) throw new Error('Missing src/data/albums.ts');
  const source = await readFile(albumsFile, 'utf8');
  const ast = parseAlbumModule(source, albumsFile);
  const imports = albumImageImports(ast);
  const imagesByArray = new WeakMap();
  const importedValues = new Map();

  async function value(node) {
    while (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node) || ts.isTypeAssertionExpression(node)) node = node.expression;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (node.kind === ts.SyntaxKind.NullKeyword) return null;
    if (ts.isArrayLiteralExpression(node)) return Promise.all(node.elements.map(value));
    if (ts.isObjectLiteralExpression(node)) {
      const result = Object.create(null);
      for (const property of node.properties) {
        if (!ts.isPropertyAssignment(property) || !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) {
          throw new Error('Unsupported album property in TypeScript');
        }
        result[property.name.text] = await value(property.initializer);
      }
      return result;
    }
    if (ts.isIdentifier(node) && imports.has(node.text)) {
      const path = imports.get(node.text).path;
      if (!importedValues.has(path)) {
        if (!await regularFile(path)) throw new Error(`Missing album image file: ${path}`);
        const imageAst = parseAlbumModule(await readFile(path, 'utf8'), path);
        const exported = imageAst.statements.find(ts.isExportAssignment);
        if (!exported || exported.isExportEquals) throw new Error(`Missing default image export: ${path}`);
        importedValues.set(path, await value(exported.expression));
      }
      const images = importedValues.get(path);
      if (!Array.isArray(images)) throw new Error(`Invalid image export: ${path}`);
      imagesByArray.set(images, path);
      return images;
    }
    throw new Error(`Unsupported album TypeScript expression: ${node.getText()}`);
  }

  const declaration = ast.statements.filter(ts.isVariableStatement)
    .flatMap(statement => [...statement.declarationList.declarations])
    .find(item => ts.isIdentifier(item.name) && item.name.text === 'ALBUMS');
  if (!declaration?.initializer) throw new Error('Missing ALBUMS export in src/data/albums.ts');
  const albums = await value(declaration.initializer);
  validateAlbums(albums);
  const imagePaths = new Map();
  function collect(nodes) {
    for (const album of nodes) {
      if (album.images && imagesByArray.has(album.images)) imagePaths.set(album.id, imagesByArray.get(album.images));
      if (album.children) collect(album.children);
    }
  }
  collect(albums);
  return { albums, imagePaths, source, ast, imports, declaration };
}

function renderAlbumTree(albums, imageImports, depth = 0) {
  if (!albums.length) return '[]';
  const indent = '\t'.repeat(depth);
  const items = albums.map(album => {
    const properties = Object.entries(album).map(([key, item]) => {
      let rendered;
      if (key === 'children') rendered = renderAlbumTree(item, imageImports, depth + 2);
      else if (key === 'images') rendered = imageImports.get(album.id);
      else rendered = JSON.stringify(item);
      return `${indent}\t\t${JSON.stringify(key)}: ${rendered},`;
    });
    return `${indent}\t{\n${properties.join('\n')}\n${indent}\t}`;
  });
  return `[\n${items.join(',\n')}\n${indent}]`;
}

async function putAlbums(albums) {
  validateAlbums(albums);
  const current = await readAlbums();
  if (JSON.stringify(albums) === JSON.stringify(current.albums)) return { albums };
  const currentAlbums = new Map();
  function index(nodes) {
    for (const album of nodes) {
      currentAlbums.set(album.id, album);
      if (album.children) index(album.children);
    }
  }
  index(current.albums);
  const usedPaths = new Set();
  const imageImports = new Map();
  const newImports = [];
  const importNames = new Map([...current.imports].map(([name, info]) => [info.path, name]));
  const reservedNames = new Set(current.imports.keys());
  let nextImport = 0;
  async function assign(nodes) {
    for (const album of nodes) {
      if (album.images !== undefined) {
        let path = current.imagePaths.get(album.id);
        if (!path || usedPaths.has(path)) {
          const base = `album-${Buffer.from(album.id).toString('hex')}`;
          let suffix = 0;
          do {
            path = join(albumImagesRoot, `${base}${suffix ? `-${suffix}` : ''}.ts`);
            suffix++;
          } while (usedPaths.has(path) || await regularFile(path));
        }
        usedPaths.add(path);
        let name = importNames.get(path);
        if (!name || [...imageImports.values()].includes(name)) {
          do { name = `adminAlbumImages${nextImport++}`; } while (reservedNames.has(name));
          reservedNames.add(name);
        }
        imageImports.set(album.id, name);
        newImports.push(`import ${name} from './images/${basename(path, '.ts')}';`);
        if (path !== current.imagePaths.get(album.id) || JSON.stringify(album.images) !== JSON.stringify(currentAlbums.get(album.id)?.images)) {
          await atomicWrite(path, `import type { AlbumImage } from '../albums';\n\nexport default ${JSON.stringify(album.images, null, 2)} as AlbumImage[];\n`);
        }
      }
      if (album.children) await assign(album.children);
    }
  }
  await assign(albums);

  const initializer = current.declaration.initializer;
  const edits = [[initializer.getStart(current.ast), initializer.getEnd(), renderAlbumTree(albums, imageImports)]];
  const oldImports = [...current.imports.values()].map(item => item.statement);
  if (oldImports.length) {
    oldImports.forEach((statement, index) => edits.push([statement.getStart(current.ast), statement.getEnd(), index ? '' : newImports.join('\n')]));
  } else if (newImports.length) {
    edits.push([0, 0, `${newImports.join('\n')}\n\n`]);
  }
  let source = current.source;
  for (const [start, end, replacement] of edits.sort((a, b) => b[0] - a[0])) {
    source = source.slice(0, start) + replacement + source.slice(end);
  }
  await atomicWrite(albumsFile, source);
  return { albums };
}

function validateAlbums(albums) {
  if (!Array.isArray(albums)) invalid('Albums must be an array');
  const ids = new Set();
  function check(nodes, parent = '') {
    for (const album of nodes) {
      if (!isObject(album)) invalid('Invalid album');
      const id = album.id;
      if (typeof id !== 'string' || (parent && !id.startsWith(`${parent}/`))) invalid('Invalid album id');
      const part = parent ? id.slice(parent.length + 1) : id;
      safeSegment(part, 'album id');
      if (ids.has(id)) invalid(`Duplicate album id: ${id}`);
      ids.add(id);
      if (typeof album.title !== 'string' || !album.title.trim()) invalid('Album title is required');
      for (const key of ['description', 'cover']) {
        if (album[key] !== undefined && typeof album[key] !== 'string') invalid(`Invalid album ${key}`);
      }
      if (album.images !== undefined) {
        if (!Array.isArray(album.images)) invalid('Album images must be an array');
        const imageIds = new Set();
        for (const image of album.images) {
          if (!isObject(image)) invalid('Invalid image');
          safeSegment(image.id, 'image id');
          if (imageIds.has(image.id)) invalid(`Duplicate image id: ${image.id}`);
          imageIds.add(image.id);
          if (typeof image.url !== 'string' || !image.url.trim()) invalid('Image URL is required');
          for (const key of ['title', 'description']) {
            if (image[key] !== undefined && typeof image[key] !== 'string') invalid(`Invalid image ${key}`);
          }
        }
      }
      if (album.children !== undefined) {
        if (!Array.isArray(album.children)) invalid('Album children must be an array');
        check(album.children, id);
      }
    }
  }
  check(albums);
}
async function api(request, response, url) {
  const path = url.pathname;
  const method = request.method;
  let result;
  if (path === '/api/admin' && method === 'GET') {
    const [posts, collections, { albums }, components] = await Promise.all([listPosts(), listCollections(), readAlbums(), listComponents()]);
    result = { posts, collections, albums, components };
  } else if (path === '/api/admin/post' && method === 'PUT') result = await putPost(await jsonBody(request));
  else if (path === '/api/admin/post' && method === 'DELETE') result = await deletePost(url.searchParams);
  else if (path === '/api/admin/collection' && method === 'PUT') result = await putCollection(await jsonBody(request));
  else if (path === '/api/admin/collection' && method === 'DELETE') result = await deleteCollection(url.searchParams);
  else if (path === '/api/admin/albums' && method === 'PUT') {
    const { albums } = await jsonBody(request);
    result = await putAlbums(albums);
  } else if (['/api/admin', '/api/admin/post', '/api/admin/collection', '/api/admin/albums'].includes(path)) {
    throw new HttpError(405, 'Method not allowed');
  } else throw new HttpError(404, 'Unknown admin endpoint');
  sendJson(response, 200, result);
}

let vite;
const server = createHttpServer(async (request, response) => {
  try {
    const host = request.headers.host;
    if (!host || !['127.0.0.1', 'localhost'].some(name => host === `${name}:${port}`)) throw new HttpError(403, 'Localhost only');
    if (request.headers.origin) {
      let origin;
      try { origin = new URL(request.headers.origin); }
      catch { throw new HttpError(403, 'Cross-origin requests are not allowed'); }
      if (origin.host !== host || origin.protocol !== 'http:') throw new HttpError(403, 'Cross-origin requests are not allowed');
    }
    const url = new URL(request.url, `http://${host}`);
    if (url.pathname === '/api/admin' || url.pathname.startsWith('/api/admin/')) {
      await api(request, response, url);
    } else if ((url.pathname === '/' || url.pathname === '/admin/' || url.pathname === '/admin/index.html') && request.method === 'GET') {
      const html = await vite.transformIndexHtml('/admin/index.html', await readFile(adminIndex, 'utf8'));
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(html);
    } else {
      vite.middlewares(request, response, error => {
        if (error) {
          console.error(error);
          if (!response.headersSent) response.writeHead(500);
          response.end('Internal server error');
        } else {
          response.writeHead(404);
          response.end('Not found');
        }
      });
    }
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (status === 500) console.error(error);
    if (!response.headersSent) sendJson(response, status, { error: status === 500 ? 'Internal server error' : error.message });
  }
});

vite = await createViteServer({
  root,
  configFile: false,
  plugins: [vue()],
  appType: 'custom',
  server: { middlewareMode: true, hmr: { server } },
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Admin editor: http://127.0.0.1:${port}/`);
});
