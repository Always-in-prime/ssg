const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const CONFIG = {
  contentDir: './content',
  outputDir: './dist',
  templateDir: './templates',
  publicDir: './public',
  siteTitle: 'Мое портфолио | Фрилансер',
  siteUrl: 'https://always-in-prime.github.io/ssg',
  author: 'always-in-prime',
  email: 'your@email.com',
  github: 'https://github.com/always-in-prime',
  telegram: 'https://t.me/always-in-prime',
  basePath: process.env.GITHUB_ACTIONS ? '/ssg' : ''
};

// Создаем output директорию
if (!fs.existsSync(CONFIG.outputDir)) {
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
}

// Загружаем шаблон
function loadTemplate() {
  const templatePath = path.join(CONFIG.templateDir, 'layout.html');
  if (fs.existsSync(templatePath)) {
    return fs.readFileSync(templatePath, 'utf-8');
  }
  
  return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}} | {{siteTitle}}</title>
    <meta name="description" content="{{description}}">
    <meta name="author" content="{{author}}">
    <link rel="stylesheet" href="{{basePath}}/css/style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body>
    <header>
        <nav>
            <div class="container nav-container">
                <a href="{{basePath}}/" class="logo">{{siteTitle}}</a>
                <button class="mobile-menu-btn" aria-label="Menu">
                    <i class="fas fa-bars"></i>
                </button>
                <ul class="nav-menu">
                    {{navigation}}
                </ul>
            </div>
        </nav>
    </header>

    <main>
        {{content}}
    </main>

    <footer>
        <div class="container">
            <div class="footer-content">
                <div class="footer-section">
                    <h4>{{author}}</h4>
                    <p>Фриланс разработчик</p>
                </div>
                <div class="footer-section">
                    <h4>Контакты</h4>
                    <p><i class="fas fa-envelope"></i> {{email}}</p>
                    <div class="social-links">
                        <a href="{{github}}" target="_blank"><i class="fab fa-github"></i></a>
                        <a href="{{telegram}}" target="_blank"><i class="fab fa-telegram"></i></a>
                    </div>
                </div>
            </div>
            <div class="footer-bottom">
                <p>&copy; {{year}} {{author}}. Все права защищены.</p>
            </div>
        </div>
    </footer>

    <script src="{{basePath}}/js/main.js"></script>
</body>
</html>`;
}

function parseFrontmatter(content) {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
  const match = content.match(frontmatterRegex);
  
  let metadata = {
    title: 'Без названия',
    description: '',
    date: new Date().toISOString().split('T')[0],
    tags: [],
    technologies: [],
    image: '',
    link: '',
    github: '',
    type: 'work' // work, blog, etc.
  };
  
  let markdownContent = content;
  
  if (match) {
    const frontmatterStr = match[1];
    markdownContent = content.slice(match[0].length);
    
    frontmatterStr.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length) {
        const value = valueParts.join(':').trim();
        
        if (key.trim() === 'technologies') {
          metadata.technologies = value.split(',').map(t => t.trim());
        } else if (key.trim() === 'tags') {
          metadata.tags = value.split(',').map(t => t.trim());
        } else {
          metadata[key.trim()] = value;
        }
      }
    });
  }
  
  return { metadata, markdownContent };
}

function generateWorksPage(pages) {
  const works = pages.filter(p => p.metadata.type === 'work' && !p.metadata.draft);
  
  let worksHtml = `
<section class="works-section">
    <div class="container">
        <h1>Мои работы</h1>
        <div class="works-grid">
  `;
  
  works.forEach(work => {
    worksHtml += `
    <div class="work-card">
        ${work.metadata.image ? `<img src="${CONFIG.basePath}${work.metadata.image}" alt="${work.metadata.title}" class="work-image">` : ''}
        <div class="work-content">
            <h3>${work.metadata.title}</h3>
            <p>${work.metadata.description}</p>
            <div class="work-technologies">
                ${work.metadata.technologies.map(tech => `<span class="tech-tag">${tech}</span>`).join('')}
            </div>
            <div class="work-links">
                ${work.metadata.link ? `<a href="${work.metadata.link}" target="_blank" class="btn btn-primary">Посмотреть</a>` : ''}
                ${work.metadata.github ? `<a href="${work.metadata.github}" target="_blank" class="btn btn-secondary">GitHub</a>` : ''}
                <a href="${CONFIG.basePath}${work.url}" class="btn btn-outline">Подробнее</a>
            </div>
        </div>
    </div>
    `;
  });
  
  worksHtml += `
        </div>
    </div>
</section>
  `;
  
  return worksHtml;
}

function generatePage(markdownFile, template, navigationHtml, allPages = []) {
  const content = fs.readFileSync(markdownFile, 'utf-8');
  const { metadata, markdownContent } = parseFrontmatter(content);
  
  if (metadata.draft && process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  let htmlContent = marked.parse(markdownContent);
  
  // Специальная обработка для страницы работ
  if (markdownFile.includes('works.md') || markdownFile.includes('index.md') && metadata.showWorks) {
    htmlContent = generateWorksPage(allPages) + htmlContent;
  }
  
  const url = path.basename(markdownFile, '.md') === 'index' ? '/' : 
              `/${path.basename(markdownFile, '.md')}.html`;
  
  let pageHtml = template
    .replace(/{{title}}/g, metadata.title)
    .replace(/{{description}}/g, metadata.description)
    .replace(/{{content}}/g, htmlContent)
    .replace(/{{siteTitle}}/g, CONFIG.siteTitle)
    .replace(/{{year}}/g, new Date().getFullYear())
    .replace(/{{author}}/g, CONFIG.author)
    .replace(/{{email}}/g, CONFIG.email)
    .replace(/{{github}}/g, CONFIG.github)
    .replace(/{{telegram}}/g, CONFIG.telegram)
    .replace(/{{basePath}}/g, CONFIG.basePath)
    .replace(/{{navigation}}/g, navigationHtml);
  
  return pageHtml;
}

function getAllPages() {
  const pages = [];
  
  function scanDirectory(dir, basePath = '') {
    if (!fs.existsSync(dir)) return;
    
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
          outputPath: path.join(CONFIG.outputDir, file === 'index.md' ? 'index.html' : `${file.replace('.md', '.html')}`),
          dir: basePath
        });
      }
    });
  }
  
  scanDirectory(CONFIG.contentDir);
  return pages;
}

function generateNavigation() {
  const pages = getAllPages();
  const navItems = [
    { title: 'Главная', url: '/' },
    { title: 'Работы', url: '/works.html' },
    { title: 'Обо мне', url: '/about.html' },
    { title: 'Контакты', url: '/contact.html' }
  ];
  
  return navItems.map(item => 
    `<li><a href="${CONFIG.basePath}${item.url}">${item.title}</a></li>`
  ).join('\n');
}

function copyPublicFiles() {
  if (fs.existsSync(CONFIG.publicDir)) {
    copyFolderRecursive(CONFIG.publicDir, CONFIG.outputDir);
  }
}

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
    }
  });
}

async function build() {
  console.log('\n🚀 Генерация портфолио...\n');
  
  const template = loadTemplate();
  const pages = getAllPages();
  const navigationHtml = generateNavigation();
  
  // Создаем отдельную страницу со всеми работами
  const worksPage = pages.find(p => p.url === '/works.html');
  if (worksPage) {
    const worksHtml = generateWorksPage(pages);
    const templateWithWorks = template.replace('{{content}}', worksHtml);
    const finalHtml = templateWithWorks
      .replace(/{{title}}/g, 'Мои работы')
      .replace(/{{description}}/g, 'Портфолио моих проектов')
      .replace(/{{navigation}}/g, navigationHtml)
      .replace(/{{siteTitle}}/g, CONFIG.siteTitle)
      .replace(/{{year}}/g, new Date().getFullYear())
      .replace(/{{author}}/g, CONFIG.author)
      .replace(/{{email}}/g, CONFIG.email)
      .replace(/{{github}}/g, CONFIG.github)
      .replace(/{{telegram}}/g, CONFIG.telegram)
      .replace(/{{basePath}}/g, CONFIG.basePath);
    
    fs.writeFileSync(path.join(CONFIG.outputDir, 'works.html'), finalHtml);
    console.log('✅ Страница работ сгенерирована');
  }
  
  // Генерируем остальные страницы
  for (const page of pages) {
    if (page.url !== '/works.html') {
      console.log(`📝 ${page.filePath}`);
      const pageHtml = generatePage(page.filePath, template, navigationHtml, pages);
      if (pageHtml) {
        const outputDir = path.dirname(page.outputPath);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        fs.writeFileSync(page.outputPath, pageHtml);
      }
    }
  }
  
  copyPublicFiles();
  
  console.log('\n✅ Готово!');
  console.log(`📁 Сайт: ${CONFIG.outputDir}\n`);
}

if (require.main === module) {
  build().catch(console.error);
}

module.exports = { build };
