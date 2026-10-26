const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const ZIP_OUT = path.join(ROOT, 'vk_app.zip');

console.log('--- Начинаем сборку для VK Mini App ---');

// 1. Очистка / создание dist
if (fs.existsSync(DIST)) {
  fs.rmSync(DIST, { recursive: true, force: true });
}
fs.mkdirSync(DIST, { recursive: true });

// 2. Копирование и адаптация index.html
let html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
// Меняем пути к скриптам на локальные для dist
html = html.replace('href="../src/style.css"', 'href="style.css"');
html = html.replace('src="../src/app.js"', 'src="app.js"');
fs.writeFileSync(path.join(DIST, 'index.html'), html, 'utf8');
console.log('✓ index.html подготовлен');

// 3. Копирование style.css
fs.copyFileSync(path.join(ROOT, 'src', 'style.css'), path.join(DIST, 'style.css'));
console.log('✓ style.css скопирован');

// 4. Копирование app.js
fs.copyFileSync(path.join(ROOT, 'src', 'app.js'), path.join(DIST, 'app.js'));
console.log('✓ app.js скопирован');

// 5. Копирование data/animals.js и animals.json
const distData = path.join(DIST, 'data');
fs.mkdirSync(distData, { recursive: true });
fs.copyFileSync(path.join(ROOT, 'src', 'data', 'animals.js'), path.join(distData, 'animals.js'));
fs.copyFileSync(path.join(ROOT, 'src', 'data', 'animals.json'), path.join(distData, 'animals.json'));
console.log('✓ data/ скопирована');

// 6. Рекурсивное копирование assets (картинки, звуки)
function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDirRecursive(path.join(ROOT, 'public', 'assets'), path.join(DIST, 'assets'));
console.log('✓ assets/ (картинки и звуки) скопированы');

// 7. Создание ZIP архива для ручной загрузки в VK Хостинг (опционально)
if (fs.existsSync(ZIP_OUT)) {
  try { fs.unlinkSync(ZIP_OUT); } catch (e) {}
}

try {
  if (process.platform === 'win32') {
    execSync(`tar -a -cf "${ZIP_OUT}" -C "${DIST}" .`);
    const zipSize = (fs.statSync(ZIP_OUT).size / 1024 / 1024).toFixed(2);
    console.log(`✓ Архив создан: ${ZIP_OUT} (${zipSize} MB)`);
  } else {
    // В среде Linux CI (GitHub Actions)
    try {
      execSync(`cd "${DIST}" && zip -q -r "${ZIP_OUT}" .`);
      console.log(`✓ Архив создан: ${ZIP_OUT}`);
    } catch {
      // Для CI архивирование не обязательно, так как деплоится папка dist/
      console.log('ℹ Пропущен ZIP на CI (деплоится напрямую папка dist/)');
    }
  }
} catch (err) {
  console.log('ℹ Пропущен ZIP (деплоится напрямую папка dist/)');
}

console.log('----------------------------------------------------');
console.log('🎉 Сборка для VK Mini App успешно завершена!');
console.log('Папка для деплоя: /dist');
console.log('Готовый архив для загрузки в VK: vk_app.zip');
console.log('----------------------------------------------------');

