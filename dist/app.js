import { animals, mainCategories, subCategories } from './data/animals.js';

/**
 * Инициализация VK Mini App
 */
function initVKApp() {
  if (typeof window !== 'undefined' && window.vkBridge) {
    window.vkBridge.send('VKWebAppInit')
      .then(data => console.log('VK Mini App успешно инициализирован', data))
      .catch(error => console.warn('VK Bridge:', error));
  }
}

/**
 * Тактильная отдача (Taptic Engine) для мобильных устройств VK
 */
function tapticFeedback(style = 'light') {
  if (typeof window !== 'undefined' && window.vkBridge) {
    window.vkBridge.send('VKWebAppTapticImpactOccurred', { style }).catch(() => {});
  }
}

// Состояние приложения
const state = {
  selectedCategory: 'all',
  selectedSubCategory: 'all',
  searchQuery: '',
  currentIndex: 0,
  isPlayingAudio: false,
  audioAbortController: null,
  isAutoPlaying: false,
  mode: 'baby', // 'baby' (Малыш - звукоподражание) или 'nature' (Звуки природы)
  autoPlaySessionId: 0
};
let autoPlayTimeoutId = null;

// Ссылки на воспроизведение
let activeAudio = null;
let activeTimeoutId = null;
const lastPlayedSoundIndices = new Map();
const lastPlayedFileIndices = new Map();

// DOM элементы
const mainCategoriesBar = document.getElementById('mainCategoriesBar');
const subCategoriesBar = document.getElementById('subCategoriesBar');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');

const counterBadge = document.getElementById('counterBadge');
const paginationDots = document.getElementById('paginationDots');
const cardStage = document.getElementById('cardStage');
const mainCard = document.getElementById('mainCard');
const emptyState = document.getElementById('emptyState');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');

const cardTaxonomy = document.getElementById('cardTaxonomy');
const cardImage = document.getElementById('cardImage');
const cardTitle = document.getElementById('cardTitle');
const cardSoundHint = document.getElementById('cardSoundHint');
const factText = document.getElementById('factText');

const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

/**
 * Получение отфильтрованного списка животных
 */
function getFilteredAnimals() {
  const query = state.searchQuery.trim().toLowerCase();

  return animals.filter(animal => {
    // 1. Фильтр по главной категории (среда обитания)
    const matchCat = state.selectedCategory === 'all' || animal.category === state.selectedCategory;

    // 2. Фильтр по подкатегории (биологический класс)
    const matchSubCat = state.selectedSubCategory === 'all' || animal.subCategory === state.selectedSubCategory;

    // 3. Поиск по имени и звуку
    const matchQuery = !query || 
      animal.name.toLowerCase().includes(query) || 
      (animal.soundText && animal.soundText.toLowerCase().includes(query)) ||
      (Array.isArray(animal.sounds) && animal.sounds.some(s => s.toLowerCase().includes(query)));

    return matchCat && matchSubCat && matchQuery;
  });
}

/**
 * Получение текущего животного
 */
function getCurrentAnimal() {
  const list = getFilteredAnimals();
  if (list.length === 0) return null;
  if (state.currentIndex >= list.length) state.currentIndex = 0;
  if (state.currentIndex < 0) state.currentIndex = list.length - 1;
  return list[state.currentIndex];
}

/**
 * Формирование бейджа среды и класса (таксономия)
 */
function getTaxonomyText(animal) {
  const catObj = mainCategories.find(c => c.id === animal.category);
  const subObj = subCategories.find(s => s.id === animal.subCategory);
  const catName = catObj ? catObj.name : 'Мир';
  const subName = subObj ? `${subObj.name} ${subObj.icon}` : 'Животное 🐾';
  return `${catName} • ${subName}`;
}

/**
 * Мгновенная остановка любого текущего звука
 */

// ========================================================
// НЕГРОМКИЕ ПРИЯТНЫЕ ЗВУКОВЫЕ ЭФФЕКТЫ (SFX) ПРИ НАЖАТИИ
// ========================================================
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Мягкий негромкий пластилиновый звук нажатия (Soft Pop SFX)
function playSoftPopSFX(freq = 520) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.45, now + 0.08);

    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  } catch (e) {}
}

// Добрый звуковой эффект радости / аккорд колокольчиков для кнопки «Сказать спасибо»
function playJoyfulThanksSFX() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // До, Ми, Соль, До
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);

      gain.gain.setValueAtTime(0.001, now + idx * 0.07);
      gain.gain.linearRampToValueAtTime(0.08, now + idx * 0.07 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.32);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.35);
    });
  } catch (e) {}
}

function getCategoryEmoji(catId) {
  const emojis = {
    pets: '🐶',
    farm: '🐮',
    forest: '🌲',
    savanna: '🦁',
    ocean: '🌊',
    birds: '🦚',
    dinos: '🦖',
    all: '⭐'
  };
  return emojis[catId] || '🐾';
}

function stopAllAudio() {
  if (activeTimeoutId) {
    clearTimeout(activeTimeoutId);
    activeTimeoutId = null;
  }

  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
      activeAudio.onended = null;
      activeAudio.onerror = null;
    } catch (e) {}
    activeAudio = null;
  }

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  if (state.audioAbortController) {
    state.audioAbortController.abort();
    state.audioAbortController = null;
  }

  state.isPlayingAudio = false;
  if (mainCard) {
    mainCard.classList.remove('is-playing', 'bounce-active');
  }
}

/**
 * Речевой синтез фоллбек
 */
function speakFallback(text, pitch = 1.0, signal) {
  return new Promise(resolve => {
    if (signal && signal.aborted) return resolve();

    if (!('speechSynthesis' in window)) {
      const t = setTimeout(resolve, 600);
      if (signal) signal.addEventListener('abort', () => clearTimeout(t), { once: true });
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ru-RU';
    utterance.pitch = Math.max(0.75, Math.min(1.8, pitch * (0.94 + Math.random() * 0.14)));
    utterance.rate = 0.95;

    const voices = window.speechSynthesis.getVoices();
    const ruVoice = voices.find(v => v.lang.startsWith('ru') || v.lang.includes('RU'));
    if (ruVoice) utterance.voice = ruVoice;

    let finished = false;
    const cleanup = () => {
      if (!finished) {
        finished = true;
        resolve();
      }
    };

    utterance.onend = cleanup;
    utterance.onerror = cleanup;

    if (signal) {
      signal.addEventListener('abort', () => {
        window.speechSynthesis.cancel();
        cleanup();
      }, { once: true });
    }

    const timer = setTimeout(cleanup, 2200);
    utterance.onend = () => {
      clearTimeout(timer);
      cleanup();
    };

    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Воспроизведение трека или фоллбека
 */
function playTrack(src, fallbackText, pitch, signal, maxDurationMs = null) {
  return new Promise(resolve => {
    if (signal && signal.aborted) return resolve();

    if (!src) {
      speakFallback(fallbackText, pitch, signal).then(resolve);
      return;
    }

    const audio = new Audio(src);
    try { audio.playbackRate = 0.94 + Math.random() * 0.14; } catch (e) {}
    activeAudio = audio;

    let resolved = false;
    let maxTimer = null;
    const finish = () => {
      if (!resolved) {
        resolved = true;
        if (maxTimer) clearTimeout(maxTimer);
        try { audio.pause(); } catch (e) {}
        if (activeAudio === audio) activeAudio = null;
        resolve();
      }
    };

    if (maxDurationMs && maxDurationMs > 0) {
      maxTimer = setTimeout(finish, maxDurationMs);
    }

    audio.addEventListener('ended', finish, { once: true });
    audio.addEventListener('error', () => {
      activeAudio = null;
      speakFallback(fallbackText, pitch, signal).then(finish);
    }, { once: true });

    if (signal) {
      signal.addEventListener('abort', () => {
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch (e) {}
        finish();
      }, { once: true });
    }

    audio.play().catch(() => {
      speakFallback(fallbackText, pitch, signal).then(finish);
    });
  });
}

/**
 * Воспроизведение звука при тапе на карточку
 */
async function playAnimalAudio() {
  if (state.isPlayingAudio) return;

  const animal = getCurrentAnimal();
  if (!animal) return;

  state.isPlayingAudio = true;
  state.audioAbortController = new AbortController();
  const signal = state.audioAbortController.signal;

  mainCard.classList.remove('bounce-active');
  void mainCard.offsetWidth;
  mainCard.classList.add('bounce-active', 'is-playing');

  // Выбор случайного звукового файла без повтора подряд
  let soundSrc = animal.sound;
  if (Array.isArray(animal.soundFiles) && animal.soundFiles.length > 0) {
    if (animal.soundFiles.length === 1) {
      soundSrc = animal.soundFiles[0];
    } else {
      const lastFileIdx = lastPlayedFileIndices.get(animal.id);
      let newFileIdx;
      do {
        newFileIdx = Math.floor(Math.random() * animal.soundFiles.length);
      } while (newFileIdx === lastFileIdx);
      lastPlayedFileIndices.set(animal.id, newFileIdx);
      soundSrc = animal.soundFiles[newFileIdx];
    }
  }

  // Выбор случайного текста звука без повтора подряд
  let currentSoundText = animal.soundText;
  if (Array.isArray(animal.sounds) && animal.sounds.length > 0) {
    if (animal.sounds.length === 1) {
      currentSoundText = animal.sounds[0];
    } else {
      const lastTextIdx = lastPlayedSoundIndices.get(animal.id);
      let newTextIdx;
      do {
        newTextIdx = Math.floor(Math.random() * animal.sounds.length);
      } while (newTextIdx === lastTextIdx);
      lastPlayedSoundIndices.set(animal.id, newTextIdx);
      currentSoundText = animal.sounds[newTextIdx];
    }
  }

  // Динамически обновляем подсказку со звуком на карточке
  if (cardSoundHint) {
    cardSoundHint.textContent = `«${currentSoundText}» • Нажми, чтобы услышать 🐾`;
  }

  try {
    if (state.mode === 'baby') {
      // Режим «Малыш» (Звукоподражание):
      // 1. Короткий реальный голос животного (1.1 сек)
      await playTrack(soundSrc, currentSoundText, 1.25, signal, 1100);
      if (signal.aborted) return;

      // Пауза 220мс
      await new Promise(res => {
        activeTimeoutId = setTimeout(res, 220);
        signal.addEventListener('abort', () => {
          clearTimeout(activeTimeoutId);
          res();
        }, { once: true });
      });
      if (signal.aborted) return;

      // 2. Ласковый детский голос (например «Кошка говорит: мяу-мяу!»)
      const babyVoice = animal.voiceBaby || animal.voice;
      await playTrack(babyVoice, `${animal.name} говорит ${animal.soundText || currentSoundText}`, 1.0, signal);
    } else {
      // Обычный режим «Звуки природы»:
      // 1. Звук животного полной длительности
      await playTrack(soundSrc, currentSoundText, 1.25, signal);
      if (signal.aborted) return;

      // Пауза 260мс
      await new Promise(res => {
        activeTimeoutId = setTimeout(res, 260);
        signal.addEventListener('abort', () => {
          clearTimeout(activeTimeoutId);
          res();
        }, { once: true });
      });
      if (signal.aborted) return;

      // 2. Название животного диктором (например "Лев")
      await playTrack(animal.voice, animal.name, 1.0, signal);
    }
  } catch (err) {
    console.warn('Воспроизведение прервано:', err);
  } finally {
    if (!signal.aborted) {
      state.isPlayingAudio = false;
      mainCard.classList.remove('is-playing', 'bounce-active');
    }
  }
}

/**
 * Отрисовка точек пагинации
 */
function updatePagination(total, current) {
  paginationDots.innerHTML = '';
  const maxDots = Math.min(total, 12);
  for (let i = 0; i < maxDots; i++) {
    const dot = document.createElement('span');
    dot.className = `dot ${i === (current % maxDots) ? 'active' : ''}`;
    paginationDots.appendChild(dot);
  }
}

/**
 * Отрисовка текущей карточки
 */
function renderCard(direction = 'none') {
  const list = getFilteredAnimals();

  // Если ничего не найдено по фильтрам / поиску
  if (list.length === 0) {
    mainCard.style.display = 'none';
    emptyState.classList.remove('hidden');
    prevBtn.style.opacity = '0.3';
    prevBtn.style.pointerEvents = 'none';
    nextBtn.style.opacity = '0.3';
    nextBtn.style.pointerEvents = 'none';
    counterBadge.textContent = '0 из 0';
    paginationDots.innerHTML = '';
    return;
  }

  mainCard.style.display = 'flex';
  emptyState.classList.add('hidden');
  prevBtn.style.opacity = '1';
  prevBtn.style.pointerEvents = 'auto';
  nextBtn.style.opacity = '1';
  nextBtn.style.pointerEvents = 'auto';

  const total = list.length;
  if (state.currentIndex >= total) state.currentIndex = 0;
  if (state.currentIndex < 0) state.currentIndex = total - 1;
  const current = state.currentIndex;
  const animal = list[current];

  // Обновляем счетчик и точки
  counterBadge.textContent = `${current + 1} из ${total}`;
  updatePagination(total, current);

  // Анимация слайда
  mainCard.classList.remove('slide-in-right', 'slide-in-left');
  void mainCard.offsetWidth;

  if (direction === 'next') {
    mainCard.classList.add('slide-in-right');
  } else if (direction === 'prev') {
    mainCard.classList.add('slide-in-left');
  }

  // Обновление контента
    const worldTitles = {
    pets: 'Мир: Домашние 🐶',
    farm: 'Мир: Ферма 🐮',
    forest: 'Мир: Лесные 🌲',
    savanna: 'Мир: Саванна 🦁',
    ocean: 'Мир: Океан 🌊',
    birds: 'Мир: Птицы 🦚',
    dinos: 'Мир: Дино Мир 🦖',
    all: 'Мир: Все животные ⭐'
  };
  const worldName = worldTitles[state.selectedCategory] || `Мир: ${state.selectedCategory}`;
  const subObj = subCategories.find(s => s.id === animal.subCategory);
  const subText = subObj && subObj.id !== 'all' ? ` • ${subObj.name} ${subObj.icon}` : '';
  cardTaxonomy.textContent = `${worldName}${subText}`;

  cardImage.onerror = () => {
    // Векторный фоллбек, если PNG еще не сгенерирован
    const fallbackSvg = animal.image.replace(/\.png$/i, '.svg');
    if (cardImage.src !== fallbackSvg && !cardImage.src.endsWith(fallbackSvg)) {
      cardImage.src = fallbackSvg;
    }
  };
  cardImage.src = animal.image;
  cardImage.alt = animal.name;

  cardTitle.innerHTML = `<span class="card-title-emoji">${animal.emoji}</span> <span class="card-title-text">${animal.name}</span>`;
  if (state.mode === 'baby') {
    cardSoundHint.innerHTML = `<span class="baby-hint-badge">${animal.emoji || '🐾'} ${animal.name} делает: <strong>«${animal.soundText || 'Мяу!'}»</strong></span>`;
  } else {
    cardSoundHint.textContent = `«${animal.soundText}» • Нажми, чтобы услышать 🐾`;
  }
  factText.textContent = animal.funFact || 'Удивительное создание нашей планеты!';

  // Сброс ручных inline-трансформаций
  mainCard.style.transform = '';
  mainCard.style.opacity = '';
}

/**
 * Перелистывание вперед (зациклено)
 */
function nextAnimal() {
  playSoftPopSFX(580);
  const list = getFilteredAnimals();
  if (list.length <= 1) return;
  stopAllAudio();
  state.currentIndex = (state.currentIndex + 1) % list.length;
  renderCard('next');
}

/**
 * Перелистывание назад (зациклено)
 */
function prevAnimal() {
  playSoftPopSFX(500);
  const list = getFilteredAnimals();
  if (list.length <= 1) return;
  stopAllAudio();
  state.currentIndex = (state.currentIndex - 1 + list.length) % list.length;
  renderCard('prev');
}

/**
 * Построение кнопок главных категорий
 */

// Ссылки на экраны и элементы навигации
const menuScreen = document.getElementById('menu-screen') || document.getElementById('startScreen');
const gameScreen = document.getElementById('game-screen') || document.getElementById('gameScreen');
const worldsGrid = document.getElementById('worldsGrid');

// Детский режим и пагинация миров
const btnBabyMode = document.getElementById('btnBabyMode');
const modeToggleBtn = document.getElementById('modeToggleBtn');
let currentWorldsPage = 0;
let worldsAutoRotateTimer = null;

function setWorldsPage(pageIndex) {
  currentWorldsPage = pageIndex;
  const grid = document.getElementById('worldsGrid');
  if (!grid) return;
  const cards = grid.querySelectorAll('.world-card');
  const dots = document.querySelectorAll('.w-dot');

  cards.forEach(card => {
    card.style.display = 'flex';
  });

  dots.forEach((dot, idx) => {
    dot.classList.toggle('active', idx === pageIndex);
  });
}

function startWorldsAutoRotate() {
  // All 7 world cards are displayed simultaneously in 2 balanced rows
}


/**
 * Управление полноэкранным режимом (кнопка ⛶)
 */
function toggleFullscreen() {
  tapticFeedback('medium');
  playSoftPopSFX(550);
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }
}

function updateFullscreenIcons() {
  const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
  document.querySelectorAll('.fullscreen-btn .fs-icon').forEach(icon => {
    icon.textContent = isFs ? '✕' : '⛶';
  });
}

function updateModeToggleUI() {
  if (!modeToggleBtn) return;
  const isBaby = state.mode === 'baby';
  modeToggleBtn.classList.toggle('baby-active', isBaby);
  modeToggleBtn.innerHTML = isBaby
    ? '<span class="mode-icon">👶</span><span class="mode-text">Малыш</span>'
    : '<span class="mode-icon">🎓</span><span class="mode-text">Природа</span>';
}

const allAnimalsHeroBtn = document.getElementById('allAnimalsHeroBtn');
const backToMenuBtn = document.getElementById('backToMenuBtn');
const btnThanks = document.getElementById('btn-thanks');
const thanksModal = document.getElementById('thanks-modal');
const closeThanksModalBtn = document.getElementById('closeThanksModalBtn');
const thanksActionBtn = document.getElementById('thanksActionBtn');
const startDonateBtn = document.getElementById('startDonateBtn');
const thanksDonateBtn = document.getElementById('thanksDonateBtn');

let openDonateModal = () => {};

/**
 * Построение стартового меню выбора миров
 */
function buildWorldsGrid() {
  if (!worldsGrid) return;

  // Если карточки уже встроены в HTML (с кнопками .world-card), подключаем обработчики
  const existingCards = worldsGrid.querySelectorAll('.world-card');
  if (existingCards.length > 0) {
    existingCards.forEach(card => {
      const newCard = card.cloneNode(true);
      card.parentNode.replaceChild(newCard, card);
      
      newCard.addEventListener('click', (e) => {
        playSoftPopSFX(540);
        tapticFeedback('medium');
        const catId = newCard.dataset.category;
        const rect = newCard.getBoundingClientRect();
        spawnEmojiBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, getCategoryEmoji(catId));
        openCategory(catId);
      });
    });
    return;
  }

  // Динамическая генерация, если в HTML сетка пуста
  worldsGrid.innerHTML = '';
  mainCategories.filter(c => c.id !== 'all').forEach(cat => {
    const card = document.createElement('button');
    card.className = 'world-card';
    card.type = 'button';
    card.dataset.category = cat.id;

    const imgPath = cat.image || `assets/images/menu/world_${cat.id}.png`;
    card.innerHTML = `
      <img src="${imgPath}" alt="${cat.name}">
      <span>${cat.name}</span>
    `;

    card.addEventListener('click', (e) => {
      playSoftPopSFX(540);
      tapticFeedback('medium');
      const rect = card.getBoundingClientRect();
      spawnEmojiBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, cat.icon || '🐾');
      openCategory(cat.id);
    });

    worldsGrid.appendChild(card);
  });
}

/**
 * Управление автоматическим режимом (просмотр всех 73 животных подряд)
 */
function updateAutoPlayUI(isActive) {
  const badge = document.getElementById('autoPlayControlBtn');
  const backText = backToMenuBtn ? backToMenuBtn.querySelector('.back-text') : null;

  if (badge) {
    badge.classList.toggle('hidden', !isActive);
  }
  if (backText) {
    backText.textContent = isActive ? 'Назад' : 'Миры';
  }
  if (backToMenuBtn) {
    backToMenuBtn.classList.toggle('autoplay-active-back', isActive);
  }
}

function startAutoPlay() {
  state.isAutoPlaying = true;
  state.autoPlaySessionId = (state.autoPlaySessionId || 0) + 1;
  updateAutoPlayUI(true);
  runAutoPlayLoop();
}

function stopAutoPlay() {
  if (!state.isAutoPlaying) return;
  state.isAutoPlaying = false;
  state.autoPlaySessionId = (state.autoPlaySessionId || 0) + 1;
  if (autoPlayTimeoutId) {
    clearTimeout(autoPlayTimeoutId);
    autoPlayTimeoutId = null;
  }
  updateAutoPlayUI(false);
}

async function runAutoPlayLoop() {
  const currentToken = state.autoPlaySessionId;

  // Небольшая задержка перед стартом озвучки (350мс для плавного появления экрана)
  await new Promise(res => {
    autoPlayTimeoutId = setTimeout(res, 350);
  });

  while (state.isAutoPlaying && state.autoPlaySessionId === currentToken) {
    const list = getFilteredAnimals();
    if (list.length === 0) break;
    const animal = list[state.currentIndex];
    if (!animal) break;

    // 1. Озвучиваем текущее животное (настоящий звук + имя диктором)
    await playAnimalAudio(animal);

    if (!state.isAutoPlaying || state.autoPlaySessionId !== currentToken) break;

    // 2. Комфортная пауза для ребёнка (1.6 сек), чтобы рассмотреть пластилинового зверька
    await new Promise(res => {
      autoPlayTimeoutId = setTimeout(res, 1600);
    });

    if (!state.isAutoPlaying || state.autoPlaySessionId !== currentToken) break;

    // 3. Автоматически перелистываем к следующему животному по порядку
    state.currentIndex = (state.currentIndex + 1) % list.length;
    renderCard('next');
  }
}

/**
 * Переход из меню в режим игры с выбранной категорией
 */

/**
 * Управление фоновой музыкой меню с плавным затуханием (fade-out) и нарастанием (fade-in)
 */
let menuBGM = null;
let isMusicMuted = false;
let musicFadeInterval = null;

function initMenuBGM() {
  if (!menuBGM) {
    menuBGM = new Audio('assets/audio/menu_bgm.mp3');
    menuBGM.loop = true;
    menuBGM.volume = 0;
  }
}

function playMenuBGM(fadeIn = true) {
  if (isMusicMuted) return;
  initMenuBGM();
  if (musicFadeInterval) clearInterval(musicFadeInterval);

  menuBGM.play().catch(() => {});

  if (fadeIn) {
    const targetVol = 0.32;
    const step = 0.02;
    musicFadeInterval = setInterval(() => {
      if (menuBGM.volume < targetVol) {
        menuBGM.volume = Math.min(targetVol, menuBGM.volume + step);
      } else {
        clearInterval(musicFadeInterval);
        musicFadeInterval = null;
      }
    }, 40);
  } else {
    menuBGM.volume = 0.32;
  }
}

function stopMenuBGM(fadeOut = true) {
  if (!menuBGM) return;
  if (musicFadeInterval) clearInterval(musicFadeInterval);

  if (fadeOut) {
    const step = 0.03;
    musicFadeInterval = setInterval(() => {
      if (menuBGM.volume > 0.03) {
        menuBGM.volume = Math.max(0, menuBGM.volume - step);
      } else {
        menuBGM.volume = 0;
        menuBGM.pause();
        clearInterval(musicFadeInterval);
        musicFadeInterval = null;
      }
    }, 40);
  } else {
    menuBGM.volume = 0;
    menuBGM.pause();
  }
}

function toggleMusicMute() {
  isMusicMuted = !isMusicMuted;
  tapticFeedback('light');
  playSoftPopSFX(500);

  const btn = document.getElementById('musicToggleBtn');
  if (btn) {
    btn.classList.toggle('muted', isMusicMuted);
    const icon = btn.querySelector('.music-icon');
    if (icon) icon.textContent = isMusicMuted ? '🔇' : '🎵';
  }

  if (isMusicMuted) {
    stopMenuBGM(false);
  } else {
    const menuEl = document.getElementById('menu-screen') || document.getElementById('startScreen');
    if (menuEl && !menuEl.classList.contains('hidden')) {
      playMenuBGM(true);
    }
  }
}

function openCategory(categoryId) {
  stopMenuBGM(true);
  state.selectedCategory = categoryId;
  state.selectedSubCategory = 'all';
  state.searchQuery = '';
  state.currentIndex = 0; // Начинаем строго с 1-го животного выбранного мира

  if (searchInput) searchInput.value = '';
  if (clearSearchBtn) clearSearchBtn.classList.add('hidden');

  // Обновляем чипы категорий в шапке игры
  document.querySelectorAll('.cat-chip').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === categoryId);
  });
  document.querySelectorAll('.subcat-chip').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.subcategory === 'all');
  });

  // Переключаем экраны
  const menuEl = document.getElementById('menu-screen') || document.getElementById('startScreen');
  const gameEl = document.getElementById('game-screen') || document.getElementById('gameScreen');
  if (menuEl) menuEl.classList.add('hidden');
  if (gameEl) gameEl.classList.remove('hidden');

  renderCard('none');
}

/**
 * Возврат в стартовое меню
 */
function openStartMenu() {
  playMenuBGM(true);
  stopAutoPlay();
  stopAllAudio();
  playSoftPopSFX(440);
  tapticFeedback('light');

  const menuEl = document.getElementById('menu-screen') || document.getElementById('startScreen');
  const gameEl = document.getElementById('game-screen') || document.getElementById('gameScreen');
  if (gameEl) gameEl.classList.add('hidden');
  if (menuEl) {
    menuEl.classList.remove('hidden');
    menuEl.scrollTop = 0;
  }
}

function buildMainCategories() {
  mainCategoriesBar.innerHTML = '';
  mainCategories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = `cat-chip ${state.selectedCategory === cat.id ? 'active' : ''}`;
    btn.type = 'button';
    btn.dataset.category = cat.id;
    btn.innerHTML = `<span>${cat.icon}</span><span>${cat.name}</span>`;

    btn.addEventListener('click', () => {
      if (state.selectedCategory === cat.id) return;
      stopAutoPlay();
      stopAllAudio();
      state.selectedCategory = cat.id;
      state.currentIndex = 0;

      document.querySelectorAll('.cat-chip').forEach(b => {
        b.classList.toggle('active', b.dataset.category === cat.id);
      });

      renderCard('next');
    });

    mainCategoriesBar.appendChild(btn);
  });
}

/**
 * Построение кнопок подкатегорий (биологические классы)
 */
function buildSubCategories() {
  subCategoriesBar.innerHTML = '';
  subCategories.forEach(sub => {
    const btn = document.createElement('button');
    btn.className = `subcat-chip ${state.selectedSubCategory === sub.id ? 'active' : ''}`;
    btn.type = 'button';
    btn.dataset.subcategory = sub.id;
    btn.innerHTML = `<span>${sub.icon}</span><span>${sub.name}</span>`;

    btn.addEventListener('click', () => {
      stopAllAudio();
      state.selectedSubCategory = sub.id;
      state.currentIndex = 0;

      document.querySelectorAll('.subcat-chip').forEach(b => {
        b.classList.toggle('active', b.dataset.subcategory === sub.id);
      });

      renderCard('next');
    });

    subCategoriesBar.appendChild(btn);
  });
}

/**
 * Инициализация строки поиска
 */
function initSearch() {
  searchInput.addEventListener('input', (e) => {
    stopAllAudio();
    state.searchQuery = e.target.value;
    state.currentIndex = 0;

    if (state.searchQuery.length > 0) {
      clearSearchBtn.classList.remove('hidden');
    } else {
      clearSearchBtn.classList.add('hidden');
    }

    renderCard('none');
  });

  clearSearchBtn.addEventListener('click', () => {
    stopAllAudio();
    searchInput.value = '';
    state.searchQuery = '';
    state.currentIndex = 0;
    clearSearchBtn.classList.add('hidden');
    searchInput.focus();
    renderCard('none');
  });

  resetFiltersBtn.addEventListener('click', () => {
    stopAllAudio();
    searchInput.value = '';
    state.searchQuery = '';
    state.selectedCategory = 'all';
    state.selectedSubCategory = 'all';
    state.currentIndex = 0;
    clearSearchBtn.classList.add('hidden');

    document.querySelectorAll('.cat-chip').forEach(b => {
      b.classList.toggle('active', b.dataset.category === 'all');
    });
    document.querySelectorAll('.subcat-chip').forEach(b => {
      b.classList.toggle('active', b.dataset.subcategory === 'all');
    });

    renderCard('none');
  });
}

/**
 * Инициализация жестов свайпа (Touch)
 */
function initTouchEvents() {
  let touchStartX = 0;
  let touchStartY = 0;
  let touchCurrentX = 0;
  let isDragging = false;
  let isSwipingHorizontal = false;

  cardStage.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchCurrentX = touch.clientX;
    isDragging = true;
    isSwipingHorizontal = false;
  }, { passive: true });

  cardStage.addEventListener('touchmove', (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const diffX = touch.clientX - touchStartX;
    const diffY = touch.clientY - touchStartY;
    touchCurrentX = touch.clientX;

    if (!isSwipingHorizontal && Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 8) {
      isSwipingHorizontal = true;
    }

    if (isSwipingHorizontal) {
      const rotation = diffX * 0.04;
      mainCard.style.transform = `translate3d(${diffX * 0.75}px, 0, 0) rotate(${rotation}deg)`;
      mainCard.style.opacity = `${Math.max(0.5, 1 - Math.abs(diffX) / 450)}`;
    }
  }, { passive: true });

  const handleTouchEnd = () => {
    if (!isDragging) return;
    isDragging = false;

    const diffX = touchCurrentX - touchStartX;
    const swipeThreshold = 50;

    mainCard.style.transition = 'transform 0.2s ease, opacity 0.2s ease';

    if (isSwipingHorizontal && diffX < -swipeThreshold) {
      nextAnimal();
    } else if (isSwipingHorizontal && diffX > swipeThreshold) {
      prevAnimal();
    } else {
      mainCard.style.transform = '';
      mainCard.style.opacity = '';
    }

    setTimeout(() => {
      mainCard.style.transition = '';
    }, 220);

    isSwipingHorizontal = false;
  };

  cardStage.addEventListener('touchend', handleTouchEnd);
  cardStage.addEventListener('touchcancel', handleTouchEnd);
}

/**
 * Инициализация модального окна "Сказать спасибо" (Голоса VK)
 */
function initDonateModal() {
  const openDonateBtn = document.getElementById('openDonateBtn');
  const donateModal = document.getElementById('donateModal');
  const closeDonateBtn = document.getElementById('closeDonateBtn');
  const confirmDonateBtn = document.getElementById('confirmDonateBtn');
  const tierButtons = document.querySelectorAll('.donate-tier-btn');

  let selectedTier = {
    votes: 3,
    item: 'treat_3'
  };

  const openModal = () => {
    openDonateModal = openModal;
    tapticFeedback('light');
    donateModal.classList.remove('hidden');
    donateModal.setAttribute('aria-hidden', 'false');
  };

  const closeModal = () => {
    tapticFeedback('light');
    donateModal.classList.add('hidden');
    donateModal.setAttribute('aria-hidden', 'true');
  };

  if (openDonateBtn) openDonateBtn.addEventListener('click', openModal);
  if (closeDonateBtn) closeDonateBtn.addEventListener('click', closeModal);

  // Закрытие по клику на фон
  donateModal.addEventListener('click', (e) => {
    if (e.target === donateModal) closeModal();
  });

  // Выбор тарифа
  tierButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tapticFeedback('light');
      tierButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      selectedTier.votes = parseInt(btn.dataset.votes, 10);
      selectedTier.item = btn.dataset.item;

      let suffix = 'голоса';
      if (selectedTier.votes === 1) suffix = 'голос';
      else if (selectedTier.votes >= 5) suffix = 'голосов';

      confirmDonateBtn.textContent = `Поблагодарить (${selectedTier.votes} ${suffix})`;
    });
  });

  // Подтверждение и вызов VK Bridge
  if (confirmDonateBtn) {
    confirmDonateBtn.addEventListener('click', () => {
      tapticFeedback('medium');

      if (typeof window !== 'undefined' && window.vkBridge) {
        window.vkBridge.send('VKWebAppShowOrderBox', {
          type: 'votes',
          item: selectedTier.item
        })
        .then((data) => {
          tapticFeedback('heavy');
          alert('🎉 Огромное спасибо за поддержку! Зверята передают вам много тепла и радости! 🐾💖');
          closeModal();
        })
        .catch((err) => {
          console.log('VKWebAppShowOrderBox:', err);
          if (err && err.error_data && err.error_data.error_reason === 'User denied') {
            return; // Пользователь просто закрыл окно оплаты
          }
          alert(`🐾 Спасибо! В официальном клиенте ВКонтакте здесь откроется стандартное окно оплаты на ${selectedTier.votes} голосов.`);
          closeModal();
        });
      } else {
        alert(`🐾 Спасибо! В клиенте ВКонтакте здесь откроется стандартное окно оплаты на ${selectedTier.votes} голосов.`);
        closeModal();
      }
    });
  }
}

/**
 * Инициализация слушателей событий
 */

/**
 * Праздничный салют из эмодзи животного и звёздочек при нажатии
 */
function spawnEmojiBurst(x, y, animalEmoji) {
  if (typeof x !== 'number' || typeof y !== 'number' || (x === 0 && y === 0)) {
    const rect = mainCard.getBoundingClientRect();
    x = rect.left + rect.width / 2;
    y = rect.top + rect.height / 2;
  }

  // Эффект мягкого желейного подпрыгивания карточки
  mainCard.classList.remove('tap-pop');
  void mainCard.offsetWidth;
  mainCard.classList.add('tap-pop');
  setTimeout(() => mainCard.classList.remove('tap-pop'), 430);

  // Набор эффектов: эмодзи животного + яркие детские смайлики
  const sparkles = ['⭐', '✨', '🐾', '💖', '🌟', '🎈', '🎵', '🌈', '🍭', '🌸'];
  const count = 10 + Math.floor(Math.random() * 5); // 10-14 смайликов

  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    el.className = 'emoji-particle';

    // 45% вероятность эмодзи животного, 55% - звёздочки, сердечки и лапки
    const isAnimalEmoji = Math.random() < 0.45 && animalEmoji;
    el.textContent = isAnimalEmoji 
      ? animalEmoji 
      : sparkles[Math.floor(Math.random() * sparkles.length)];

    // Разлёт по кругу с преобладанием движения вверх (весёлый фонтан)
    const angle = (Math.random() * Math.PI * 2);
    const distance = 65 + Math.random() * 115;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance - (45 + Math.random() * 45);
    const rotation = (Math.random() - 0.5) * 130;
    const duration = 0.8 + Math.random() * 0.4;
    const size = isAnimalEmoji ? (2.2 + Math.random() * 0.7) : (1.4 + Math.random() * 0.6);

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.setProperty('--dx', `${dx}px`);
    el.style.setProperty('--dy', `${dy}px`);
    el.style.setProperty('--rot', `${rotation}deg`);
    el.style.setProperty('--duration', `${duration}s`);
    el.style.fontSize = `${size}rem`;

    document.body.appendChild(el);

    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, duration * 1000 + 80);
  }
}


/* ========================================================
   РАЗДЕЛ СКАЗОК: ДОКТОР АЙБОЛИТ (СИНХРОНИЗИРОВАННЫЕ ИЛЛЮСТРАЦИИ)
   ======================================================== */
const AIBOLIT_SCENES = [
  {
    startTime: 0,
    title: 'Добрый доктор Айболит',
    subtitle: 'Он под деревом сидит, всех излечит, исцелит!',
    image: 'assets/images/fairytales/aibolit/scene_1_tree.jpg',
  },
  {
    startTime: 106, // 01:46 - "И встал Айболит, побежал Айболит..."
    title: 'Сквозь метель на волках',
    subtitle: '«Садись, Айболит, верхом! Мы живо тебя довезём!»',
    image: 'assets/images/fairytales/aibolit/scene_2_wolves.jpg',
  },
  {
    startTime: 163, // 02:43 - "Но тут выплывает кит..."
    title: 'На спине синего кита',
    subtitle: '«Садись на меня, Айболит! Тебя повезу я вперёд!»',
    image: 'assets/images/fairytales/aibolit/scene_3_whale.jpg',
  },
  {
    startTime: 195, // 03:15 - "С высокой скалы к Айболиту слетели орлы..."
    title: 'Полёт над вершинами гор',
    subtitle: 'И горы встают перед ним на пути, а орлы несут сквозь тучи!',
    image: 'assets/images/fairytales/aibolit/scene_4_eagle.jpg',
  },
  {
    startTime: 286, // 04:46 - "Но вот поглядите, какая-то птица... и всем по порядку даёт шоколадку..."
    title: 'Айболит в Африке',
    subtitle: 'И всем по порядку даёт шоколадку, и ставит, и ставит градусники!',
    image: 'assets/images/fairytales/aibolit/scene_5_healing.jpg',
  },
  {
    startTime: 344, // 05:44 - "Вот и вылечил он их, Лимпопо! И пошли они смеяться..."
    title: 'Всеобщее ликование',
    subtitle: '«Слава, слава Айболиту! Слава добрым докторам!»',
    image: 'assets/images/fairytales/aibolit/scene_6_celebration.jpg',
  }
];

let currentTaleSceneIndex = -1;

function formatTaleTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateFairytaleScene(index) {
  if (index < 0 || index >= AIBOLIT_SCENES.length) return;
  if (currentTaleSceneIndex === index) return;
  currentTaleSceneIndex = index;

  const scene = AIBOLIT_SCENES[index];
  const imgEl = document.getElementById('fairytaleImage');
  const titleEl = document.getElementById('fairytaleSceneTitle');
  const textEl = document.getElementById('fairytaleSceneText');

  if (imgEl) {
    imgEl.classList.add('fade-out');
    setTimeout(() => {
      imgEl.src = scene.image;
      imgEl.alt = scene.title;
      imgEl.classList.remove('fade-out');
    }, 200);
  }

  if (titleEl) titleEl.textContent = scene.title;
  if (textEl) textEl.textContent = scene.subtitle;
}

function openFairytale() {
  stopMenuBGM(true);
  stopAllAudio();
  playSoftPopSFX(550);
  tapticFeedback('medium');

  const menuEl = document.getElementById('menu-screen') || document.getElementById('startScreen');
  const gameEl = document.getElementById('game-screen') || document.getElementById('gameScreen');
  const taleEl = document.getElementById('fairytale-screen');

  if (menuEl) menuEl.classList.add('hidden');
  if (gameEl) gameEl.classList.add('hidden');
  if (taleEl) taleEl.classList.remove('hidden');

  const audio = document.getElementById('fairytaleAudio');
  if (audio) {
    audio.currentTime = 0;
    currentTaleSceneIndex = -1;
    updateFairytaleScene(0);
    audio.play().then(() => {
      updateTalePlayIcon(true);
    }).catch(() => {
      updateTalePlayIcon(false);
    });
  }
}

function closeFairytale() {
  playSoftPopSFX(440);
  tapticFeedback('light');

  const audio = document.getElementById('fairytaleAudio');
  if (audio) {
    audio.pause();
    updateTalePlayIcon(false);
  }

  const menuEl = document.getElementById('menu-screen') || document.getElementById('startScreen');
  const taleEl = document.getElementById('fairytale-screen');

  if (taleEl) taleEl.classList.add('hidden');
  if (menuEl) {
    menuEl.classList.remove('hidden');
    playMenuBGM(true);
  }
}

function updateTalePlayIcon(isPlaying) {
  const icon = document.getElementById('talePlayIcon');
  if (icon) {
    icon.textContent = isPlaying ? '⏸' : '▶';
  }
}

function toggleFairytalePlay() {
  const audio = document.getElementById('fairytaleAudio');
  if (!audio) return;
  playSoftPopSFX(500);
  tapticFeedback('light');

  if (audio.paused) {
    audio.play().then(() => updateTalePlayIcon(true)).catch(() => {});
  } else {
    audio.pause();
    updateTalePlayIcon(false);
  }
}

function seekFairytale(e) {
  const track = document.getElementById('taleProgressTrack');
  const audio = document.getElementById('fairytaleAudio');
  if (!track || !audio || !audio.duration) return;

  const rect = track.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const ratio = Math.max(0, Math.min(1, clickX / rect.width));
  audio.currentTime = ratio * audio.duration;
  onFairytaleTimeUpdate();
}

function prevFairytaleScene() {
  const audio = document.getElementById('fairytaleAudio');
  if (!audio) return;
  playSoftPopSFX(480);
  tapticFeedback('light');

  const curTime = audio.currentTime;
  let targetIdx = 0;
  for (let i = AIBOLIT_SCENES.length - 1; i >= 0; i--) {
    if (curTime >= AIBOLIT_SCENES[i].startTime) {
      if (curTime - AIBOLIT_SCENES[i].startTime > 3 || i === 0) {
        targetIdx = i;
      } else {
        targetIdx = i - 1;
      }
      break;
    }
  }
  targetIdx = Math.max(0, targetIdx);
  audio.currentTime = AIBOLIT_SCENES[targetIdx].startTime;
  updateFairytaleScene(targetIdx);
  onFairytaleTimeUpdate();
}

function nextFairytaleScene() {
  const audio = document.getElementById('fairytaleAudio');
  if (!audio) return;
  playSoftPopSFX(520);
  tapticFeedback('light');

  const curTime = audio.currentTime;
  let targetIdx = AIBOLIT_SCENES.length - 1;
  for (let i = 0; i < AIBOLIT_SCENES.length; i++) {
    if (AIBOLIT_SCENES[i].startTime > curTime + 0.5) {
      targetIdx = i;
      break;
    }
  }
  audio.currentTime = AIBOLIT_SCENES[targetIdx].startTime;
  updateFairytaleScene(targetIdx);
  onFairytaleTimeUpdate();
}

function onFairytaleTimeUpdate() {
  const audio = document.getElementById('fairytaleAudio');
  if (!audio) return;

  const t = audio.currentTime;
  const dur = audio.duration || 385.5;

  const curTimeEl = document.getElementById('taleCurrentTime');
  const totalTimeEl = document.getElementById('taleTotalTime');
  const barEl = document.getElementById('taleProgressBar');
  const thumbEl = document.getElementById('taleProgressThumb');

  if (curTimeEl) curTimeEl.textContent = formatTaleTime(t);
  if (totalTimeEl && audio.duration) totalTimeEl.textContent = formatTaleTime(audio.duration);

  const pct = Math.max(0, Math.min(100, (t / dur) * 100));
  if (barEl) barEl.style.width = `${pct}%`;
  if (thumbEl) thumbEl.style.left = `${pct}%`;

  let activeIdx = 0;
  for (let i = AIBOLIT_SCENES.length - 1; i >= 0; i--) {
    if (t >= AIBOLIT_SCENES[i].startTime) {
      activeIdx = i;
      break;
    }
  }
  updateFairytaleScene(activeIdx);
}

function initFairytaleEvents() {
  const btnFairytales = document.getElementById('btnFairytales');
  if (btnFairytales) {
    btnFairytales.addEventListener('click', openFairytale);
  }

  const backFromTaleBtn = document.getElementById('backFromTaleBtn');
  if (backFromTaleBtn) {
    backFromTaleBtn.addEventListener('click', closeFairytale);
  }

  const talePlayPauseBtn = document.getElementById('talePlayPauseBtn');
  if (talePlayPauseBtn) {
    talePlayPauseBtn.addEventListener('click', toggleFairytalePlay);
  }

  const talePrevSceneBtn = document.getElementById('talePrevSceneBtn');
  if (talePrevSceneBtn) {
    talePrevSceneBtn.addEventListener('click', prevFairytaleScene);
  }

  const taleNextSceneBtn = document.getElementById('taleNextSceneBtn');
  if (taleNextSceneBtn) {
    taleNextSceneBtn.addEventListener('click', nextFairytaleScene);
  }

  const taleProgressTrack = document.getElementById('taleProgressTrack');
  if (taleProgressTrack) {
    taleProgressTrack.addEventListener('click', seekFairytale);
  }

  const fairytaleAudio = document.getElementById('fairytaleAudio');
  if (fairytaleAudio) {
    fairytaleAudio.addEventListener('timeupdate', onFairytaleTimeUpdate);
    fairytaleAudio.addEventListener('ended', () => {
      updateTalePlayIcon(false);
    });
  }
}

function initEvents() {
  initFairytaleEvents();
  prevBtn.addEventListener('click', () => {
    tapticFeedback('light');
    prevAnimal();
  });

  nextBtn.addEventListener('click', () => {
    tapticFeedback('light');
    nextAnimal();
  });

  mainCard.addEventListener('click', (e) => {
    tapticFeedback('medium');
    const animal = getCurrentAnimal();
    spawnEmojiBurst(e.clientX, e.clientY, animal ? animal.emoji : '🐾');
    playAnimalAudio();
  });

  window.addEventListener('keydown', (e) => {
    if (document.activeElement === searchInput) return;

    if (e.key === 'ArrowLeft') {
      prevAnimal();
    } else if (e.key === 'ArrowRight') {
      nextAnimal();
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      const animal = getCurrentAnimal();
      spawnEmojiBurst(0, 0, animal ? animal.emoji : '🐾');
      playAnimalAudio();
    }
  });

  initTouchEvents();
  initSearch();
  initDonateModal();

  // Кнопка музыки в меню
  const musicToggleBtn = document.getElementById('musicToggleBtn');
  if (musicToggleBtn) {
    musicToggleBtn.addEventListener('click', toggleMusicMute);
  }

  // Запуск фоновой музыки при первом взаимодействии пользователя с меню
  const startMusicOnFirstTouch = () => {
    const menuEl = document.getElementById('menu-screen') || document.getElementById('startScreen');
    if (menuEl && !menuEl.classList.contains('hidden')) {
      playMenuBGM(true);
    }
    document.removeEventListener('click', startMusicOnFirstTouch);
    document.removeEventListener('touchstart', startMusicOnFirstTouch);
  };
  document.addEventListener('click', startMusicOnFirstTouch, { once: true });
  document.addEventListener('touchstart', startMusicOnFirstTouch, { once: true });

  // Полноэкранный режим
  document.querySelectorAll('.fullscreen-btn, #fullscreenBtn, #gameFullscreenBtn').forEach(btn => {
    btn.addEventListener('click', toggleFullscreen);
  });
  document.addEventListener('fullscreenchange', updateFullscreenIcons);
  document.addEventListener('webkitfullscreenchange', updateFullscreenIcons);

  // Кнопка "Учим звуки • Детский режим"
  if (btnBabyMode) {
    btnBabyMode.addEventListener('click', (e) => {
      playSoftPopSFX(620);
      tapticFeedback('medium');
      spawnEmojiBurst(e.clientX, e.clientY, '👶');
      state.mode = 'baby';
      updateModeToggleUI();
      openCategory('all');
      startAutoPlay();
    });
  }

  // Переключатель режима 👶 Малыш / 🎓 Природа
  if (modeToggleBtn) {
    modeToggleBtn.addEventListener('click', () => {
      playSoftPopSFX(480);
      tapticFeedback('light');
      state.mode = state.mode === 'baby' ? 'nature' : 'baby';
      updateModeToggleUI();
      renderCard('none');
    });
  }

  // Пагинация миров на мобильных (точки)
  document.querySelectorAll('.w-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      playSoftPopSFX(420);
      const page = parseInt(dot.dataset.page, 10);
      setWorldsPage(page);
    });
  });

  // Запуск автосмены страниц миров на телефоне
  setWorldsPage(0);
  startWorldsAutoRotate();
  window.addEventListener('resize', () => setWorldsPage(currentWorldsPage));

  if (allAnimalsHeroBtn) {
    allAnimalsHeroBtn.addEventListener('click', (e) => {
      playSoftPopSFX(600);
      tapticFeedback('medium');
      spawnEmojiBurst(e.clientX, e.clientY, '🚀');
      openCategory('all');
      startAutoPlay();
    });
  }

  // Кнопка остановки автопросмотра на карточке
  const autoPlayControlBtn = document.getElementById('autoPlayControlBtn');
  if (autoPlayControlBtn) {
    autoPlayControlBtn.addEventListener('click', () => {
      playSoftPopSFX(450);
      tapticFeedback('light');
      stopAutoPlay();
    });
  }

  if (backToMenuBtn) {
    backToMenuBtn.addEventListener('click', () => {
      openStartMenu();
    });
  }

  if (startDonateBtn) {
    startDonateBtn.addEventListener('click', () => {
      playSoftPopSFX(480);
      openDonateModal();
    });
  }

  // Кнопка «Сказать спасибо зверятам»
  if (btnThanks) {
    btnThanks.addEventListener('click', (e) => {
      tapticFeedback('medium');
      playJoyfulThanksSFX();
      const rect = btnThanks.getBoundingClientRect();
      spawnEmojiBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, '💖');
      if (thanksModal) {
        thanksModal.classList.remove('hidden');
      }
    });
  }

  // Кнопка «Подарить голоса» внутри модального окна благодарности
  if (thanksDonateBtn) {
    thanksDonateBtn.addEventListener('click', (e) => {
      tapticFeedback('medium');
      playSoftPopSFX(580);
      spawnEmojiBurst(e.clientX, e.clientY, '💎');
      if (thanksModal) thanksModal.classList.add('hidden');
      openDonateModal();
    });
  }

  // Закрытие модального окна благодарности
  if (closeThanksModalBtn) {
    closeThanksModalBtn.addEventListener('click', () => {
      playSoftPopSFX(420);
      if (thanksModal) thanksModal.classList.add('hidden');
    });
  }

  if (thanksActionBtn) {
    thanksActionBtn.addEventListener('click', () => {
      playSoftPopSFX(520);
      if (thanksModal) thanksModal.classList.add('hidden');
    });
  }

  if (thanksModal) {
    thanksModal.addEventListener('click', (e) => {
      if (e.target === thanksModal) {
        playSoftPopSFX(420);
        thanksModal.classList.add('hidden');
      }
    });
  }
}

// Запуск при загрузке документа
document.addEventListener('DOMContentLoaded', () => {
  initVKApp();
  buildWorldsGrid();
  buildMainCategories();
  buildSubCategories();
  initEvents();
  renderCard();

  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
  }
});
