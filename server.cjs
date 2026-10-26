const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);

  // Главная страница
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/public/index.html';
  }

  // Если запрос на /assets/..., проверяем также и public/assets/...
  let filePath = path.join(ROOT, reqPath);

  if (!fs.existsSync(filePath)) {
    // Пробуем искать внутри public/
    const altPath = path.join(ROOT, 'public', reqPath);
    if (fs.existsSync(altPath)) {
      filePath = altPath;
    }
  }

  // Безопасность путей
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Доступ запрещен');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Файл не найден: ' + reqPath);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });

    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log('----------------------------------------------------');
  console.log(`🐾 Детская игра «Энциклопедия Животных» (VK Mini App)`);
  console.log(`🌐 Сервер запущен: http://localhost:${PORT}`);
  console.log('📌 Для остановки сервера закройте это окно или нажмите Ctrl+C');
  console.log('----------------------------------------------------');
});
