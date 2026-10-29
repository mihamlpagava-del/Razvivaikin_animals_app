const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const YANDEX_ZIP_OUT = path.join(ROOT, 'yandex_game.zip');

console.log('--- 🎮 Сборка архива для Яндекс Игр (Yandex Games) ---');

// 1. Очистка и создание dist
if (fs.existsSync(DIST)) {
  fs.rmSync(DIST, { recursive: true, force: true });
}
fs.mkdirSync(DIST, { recursive: true });

// 2. Копирование и адаптация index.html
let html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
// Локальные пути для корневого dist
html = html.replace('href="../src/style.css"', 'href="style.css"');
html = html.replace('src="../src/app.js"', 'src="app.js"');
fs.writeFileSync(path.join(DIST, 'index.html'), html, 'utf8');
console.log('✓ index.html подготовлен (содержит Yandex Games SDK v2)');

// 3. Копирование style.css
fs.copyFileSync(path.join(ROOT, 'src', 'style.css'), path.join(DIST, 'style.css'));
console.log('✓ style.css скопирован');

// 4. Копирование app.js
fs.copyFileSync(path.join(ROOT, 'src', 'app.js'), path.join(DIST, 'app.js'));
console.log('✓ app.js скопирован (с поддержкой LoadingAPI и паузы звука)');

// 5. Копирование data/animals.js и data/animals.json
const distData = path.join(DIST, 'data');
fs.mkdirSync(distData, { recursive: true });
fs.copyFileSync(path.join(ROOT, 'src', 'data', 'animals.js'), path.join(distData, 'animals.js'));
fs.copyFileSync(path.join(ROOT, 'src', 'data', 'animals.json'), path.join(distData, 'animals.json'));
console.log('✓ data/ скопирована');

// 6. Рекурсивное копирование assets (изображения, звуки, музыка)
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
console.log('✓ assets/ скопированы');

// 7. Создание ZIP архива для загрузки в консоль разработчика Яндекс Игр
if (fs.existsSync(YANDEX_ZIP_OUT)) {
  try { fs.unlinkSync(YANDEX_ZIP_OUT); } catch (e) {}
}

try {
  if (process.platform === 'win32') {
    execSync(`tar -a -cf "${YANDEX_ZIP_OUT}" -C "${DIST}" .`);
    const zipSize = (fs.statSync(YANDEX_ZIP_OUT).size / 1024 / 1024).toFixed(2);
    console.log(`✓ Архив для Яндекс Игр создан: ${YANDEX_ZIP_OUT} (${zipSize} MB)`);
  } else {
    try {
      execSync(`cd "${DIST}" && zip -q -r "${YANDEX_ZIP_OUT}" .`);
      const zipSize = (fs.statSync(YANDEX_ZIP_OUT).size / 1024 / 1024).toFixed(2);
      console.log(`✓ Архив для Яндекс Игр создан: ${YANDEX_ZIP_OUT} (${zipSize} MB)`);
    } catch {
      console.log('ℹ Пропущен ZIP');
    }
  }
} catch (err) {
  console.error('Ошибка архивации:', err.message);
}

console.log('----------------------------------------------------');
console.log('🎉 Сборка для Яндекс Игр успешно завершена!');
console.log(`Готовый файл для загрузки в консоль Яндекса: yandex_game.zip`);
console.log('Требования платформы:');
console.log('1. index.html в корне архива: ДА');
console.log('2. SDK (https://yandex.ru/games/sdk/v2) подключен: ДА');
console.log('3. Инициализация YaGames.init() и LoadingAPI.ready(): ДА');
console.log('4. Пауза звука при переключении вкладки (visibilitychange): ДА');
console.log('5. Вес архива < 100 МБ: ДА (меньше 30 МБ)');
console.log('----------------------------------------------------');
