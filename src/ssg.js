const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

// Конфигурация для GitHub Pages
const CONFIG = {
  contentDir: './content',
  outputDir: './dist',
  templateDir: './templates',
  publicDir: './public',
  siteTitle: 'Мой SSG Сайт',
  siteUrl: 'https://Always-in-prime.github.io/REPO_NAME',
  // Автоматически определяем basePath для GitHub Pages
  basePath: process.env.GITHUB_ACTIONS ? '/REPO_NAME' : ''
};

// Настройка marked
marked.setOptions({
  highlight: function(code, lang) {
    return `<pre><code class="language-${lang}">${code}</code></pre>`;
  }
});

// Создаем папку для вывода
if (!fs.existsSync(CONFIG.outputDir)) {
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
}

// Копируем публичные файлы
function copyPublicFiles() {
  if (fs.existsSync(CONFIG.publicDir)) {
    console.log('📁 Копируем статические файлы...');
    copyFolderRecursive(CONFIG.publicDir, CONFIG.outputDir);
  }
}

// Загружаем шаблон
function loadTemplate() {
  const templatePath = path.join(CONFIG.templateDir, 'layout.html');
  if (fs.existsSync(templatePath)) {
    return fs.readFileSync(templatePath, 'utf-8');
  }
  
  // Расширенный дефолтный шаблон
  return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}} | {{siteTitle}}</title>
    <meta name="description" content="{{description}}">
    <meta name="generator" content="Custom SSG">
    <link rel="stylesheet" href="{{basePath}}/css/style.css">
    <link rel="canonical" href="{{siteUrl}}{{url}}">
</head>
<body>
    <header>
        <nav>
            <div class="nav-container">
                <a href="{{basePath}}/" class="logo">{{siteTitle}}</a>
                <ul class="nav-menu">
                    {{navigation}}
                </ul>
            </div>
        </nav>
    </header>
    
    <main class="container">
        <article>
            <h1>{{title}}</h1>
            {{#if date}}
            <div class="post-meta">
                📅 {{date}} | 🏷️ {{#each tags}}{{this}} {{/each}}
            </div>
            {{/if}}
            <div class="content">
                {{content}}
            </div>
        </article>
    </main>
    
    <footer>
        <div class="container">
            <p>© {{year}} {{siteTitle}}. Сгенерировано с ❤️</p>
            <p>Последнее обновление: {{buildDate}}</p>
        </div>
    </footer>
</body>
</html>`;
}

// Парсинг frontmatter
function parseFrontmatter(content) {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
  const match = content.match(frontmatterRegex);
  
  let metadata = {
    title: 'Untitled',
    description: '',
    date: new Date().toISOString().split('T')[0],
    tags: [],
    draft: false
  };
  
  let markdownContent = content;
  
  if (match) {
    const frontmatterStr = match[1];
    markdownContent = content.slice(match[0].length);
    
    frontmatterStr.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length) {
        const value = valueParts.join(':').trim();
        
        if (key.trim() === 'tags') {
          metadata.tags = value.split(',').map(t => t.trim());
        } else if (key.trim() === 'draft') {
          metadata.draft = value === 'true';
        } else {
          metadata[key.trim()] = value;
        }
      }
    });
  }
  
  return { metadata, markdownContent };
}

// Генерация HTML
function generatePage(markdownFile, template, navigationHtml) {
  const content = fs.readFileSync(markdownFile, 'utf-8');
  const { metadata, markdownContent } = parseFrontmatter(content);
  
  // Пропускаем черновики
  if (metadata.draft && process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  const htmlContent = marked.parse(markdownContent);
  
  // Получаем URL страницы
  const url = markdownFile === 'index.md' ? '/' : 
              `/${path.basename(markdownFile, '.md')}.html`;
  
  let pageHtml = template
    .replace(/{{title}}/g, metadata.title)
    .replace(/{{description}}/g, metadata.description)
    .replace(/{{content}}/g, htmlContent)
    .replace(/{{siteTitle}}/g, CONFIG.siteTitle)
    .replace(/{{year}}/g, new Date().getFullYear())
    .replace(/{{date}}/g, metadata.date)
    .replace(/{{url}}/g, url)
    .replace(/{{basePath}}/g, CONFIG.basePath)
    .replace(/{{siteUrl}}/g, CONFIG.siteUrl)
    .replace(/{{buildDate}}/g, new Date().toLocaleString('ru-RU'))
    .replace(/{{navigation}}/g, navigationHtml);
  
  // Обработка условных блоков
  if (metadata.tags && metadata.tags.length) {
    const tagsHtml = metadata.tags.map(tag => `<span class="tag">${tag}</span>`).join(' ');
    pageHtml = pageHtml.replace(/{{#if tags}}(.*?){{\/if}}/gs, (match, content) => {
      return content.replace('{{tags}}', tagsHtml);
    });
  } else {
    pageHtml = pageHtml.replace(/{{#if tags}}[\s\S]*?{{\/if}}/g, '');
  }
  
  return pageHtml;
}

// Генерация навигации
function generateNavigation() {
  const pages = getAllPages();
  let navHtml = '';
  
  pages.forEach(page => {
    if (!page.metadata.hideFromNav) {
      navHtml += `<li><a href="${CONFIG.basePath}${page.url}">${page.metadata.title}</a></li>\n`;
    }
  });
  
  return navHtml;
}

// Получение всех страниц
function getAllPages() {
  const pages = [];
  
  function scanDirectory(dir, basePath = '') {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        scanDirectory(filePath, path.join(basePath, file));
      } else if (file.endsWith('.md')) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const { metadata } = parseFrontmatter(content);
        
        let url;
        if (file === 'index.md') {
          url = basePath ? `/${basePath}/` : '/';
        } else {
          url = `/${basePath}/${file.replace('.md', '.html')}`;
        }
        
        pages.push({
          filePath,
          url: url.replace(/\/\//g, '/'),
          metadata,
          outputPath: path.join(CONFIG.outputDir, file === 'index.md' ? 'index.html' : file.replace('.md', '.html'))
        });
      }
    });
  }
  
  scanDirectory(CONFIG.contentDir);
  return pages;
}

// Копирование папки
function copyFolderRecursive(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
  
  const files = fs.readdirSync(source);
  files.forEach(file => {
    const sourcePath = path.join(source, file);
    const targetPath = path.join(target, file);
    
    if (fs.statSync(sourcePath).isDirectory()) {
      copyFolderRecursive(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`  📄 Копирован: ${file}`);
    }
  });
}

// Генерация sitemap.xml
function generateSitemap(pages) {
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(page => `  <url>
    <loc>${CONFIG.siteUrl}${page.url}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <priority>${page.url === '/' ? '1.0' : '0.8'}</priority>
  </url>`).join('\n')}
</urlset>`;
  
  fs.writeFileSync(path.join(CONFIG.outputDir, 'sitemap.xml'), sitemap);
  console.log('🗺️ Sitemap сгенерирован');
}

// Генерация robots.txt
function generateRobots() {
  const robots = `User-agent: *
Allow: /
Sitemap: ${CONFIG.siteUrl}/sitemap.xml
`;
  fs.writeFileSync(path.join(CONFIG.outputDir, 'robots.txt'), robots);
  console.log('🤖 robots.txt сгенерирован');
}

// Основная функция сборки
async function build() {
  console.log('\n🚀 Начинаем генерацию сайта...\n');
  console.log(`📁 Контент: ${CONFIG.contentDir}`);
  console.log(`📁 Вывод: ${CONFIG.outputDir}`);
  console.log(`🌍 Base Path: ${CONFIG.basePath || '/'}\n`);
  
  const template = loadTemplate();
  const pages = getAllPages();
  
  console.log(`📄 Найдено страниц: ${pages.length}\n`);
  
  const navigationHtml = generateNavigation();
  
  // Генерируем страницы
  for (const page of pages) {
    if (page.metadata.draft) {
      console.log(`⏭️ Пропуск черновика: ${page.filePath}`);
      continue;
    }
    
    console.log(`📝 Генерация: ${path.relative(CONFIG.contentDir, page.filePath)} -> ${path.relative(CONFIG.outputDir, page.outputPath)}`);
    
    const pageHtml = generatePage(page.filePath, template, navigationHtml);
    if (pageHtml) {
      // Создаем директорию если нужно
      const outputDir = path.dirname(page.outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      fs.writeFileSync(page.outputPath, pageHtml);
    }
  }
  
  // Копируем публичные файлы
  copyPublicFiles();
  
  // Генерируем SEO файлы
  generateSitemap(pages);
  generateRobots();
  
  console.log('\n✅ Генерация завершена!');
  console.log(`📊 Всего сгенерировано страниц: ${pages.length}`);
  console.log(`📁 Сайт в папке: ${CONFIG.outputDir}\n`);
}

// Обработка ошибок
process.on('unhandledRejection', (error) => {
  console.error('❌ Ошибка:', error);
  process.exit(1);
});

// Запуск
if (require.main === module) {
  build();
}

module.exports = { build };
