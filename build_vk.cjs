const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const VK_ZIP_OUT = path.join(ROOT, 'vk_app.zip');
const YANDEX_ZIP_OUT = path.join(ROOT, 'yandex_game.zip');

console.log('--- 🚀 Начинаем сборку для VK Mini App и Яндекс Игр ---');

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
console.log('✓ index.html подготовлен (с Yandex SDK v2 и VK Bridge)');

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

// 6. Рекурсивное копирование assets (картинки и звуки)
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

// 7. Создание ZIP архивов для VK и Яндекс Игр
function createZip(outPath, label) {
  if (fs.existsSync(outPath)) {
    try { fs.unlinkSync(outPath); } catch (e) {}
  }

  try {
    if (process.platform === 'win32') {
      execSync(`tar -a -cf "${outPath}" -C "${DIST}" .`);
      const zipSize = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
      console.log(`✓ Архив для ${label} создан: ${outPath} (${zipSize} MB)`);
    } else {
      try {
        execSync(`cd "${DIST}" && zip -q -r "${outPath}" .`);
        const zipSize = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
        console.log(`✓ Архив для ${label} создан: ${outPath} (${zipSize} MB)`);
      } catch {
        console.log(`ℹ Пропущен ZIP для ${label}`);
      }
    }
  } catch (err) {
    console.error(`Ошибка при создании архива ${label}:`, err.message);
  }
}

createZip(VK_ZIP_OUT, 'VK Mini App');
createZip(YANDEX_ZIP_OUT, 'Яндекс Игр');

console.log('----------------------------------------------------');
console.log('🎉 Сборка успешно завершена!');
console.log('1. Папка для прямого деплоя: /dist');
console.log('2. Готовый архив для VK: vk_app.zip');
console.log('3. Готовый архив для Яндекс Игр: yandex_game.zip');
console.log('----------------------------------------------------');
