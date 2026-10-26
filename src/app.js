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
  audioAbortController: null
};

// Ссылки на воспроизведение
let activeAudio = null;
let activeTimeoutId = null;

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
      (animal.soundText && animal.soundText.toLowerCase().includes(query));

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
    utterance.pitch = pitch;
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
function playTrack(src, fallbackText, pitch, signal) {
  return new Promise(resolve => {
    if (signal && signal.aborted) return resolve();

    if (!src) {
      speakFallback(fallbackText, pitch, signal).then(resolve);
      return;
    }

    const audio = new Audio(src);
    activeAudio = audio;

    let resolved = false;
    const finish = () => {
      if (!resolved) {
        resolved = true;
        if (activeAudio === audio) activeAudio = null;
        resolve();
      }
    };

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

  try {
    // 1. Звук животного (например "Р-р-р!")
    await playTrack(animal.sound, animal.soundText, 1.25, signal);
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
  cardTaxonomy.textContent = getTaxonomyText(animal);

  cardImage.onerror = () => {
    // Векторный фоллбек, если PNG еще не сгенерирован
    const fallbackSvg = animal.image.replace(/\.png$/i, '.svg');
    if (cardImage.src !== fallbackSvg && !cardImage.src.endsWith(fallbackSvg)) {
      cardImage.src = fallbackSvg;
    }
  };
  cardImage.src = animal.image;
  cardImage.alt = animal.name;

  cardTitle.textContent = animal.name;
  cardSoundHint.textContent = `«${animal.soundText}» • Нажми, чтобы услышать 🐾`;
  factText.textContent = animal.funFact || 'Удивительное создание нашей планеты!';

  // Сброс ручных inline-трансформаций
  mainCard.style.transform = '';
  mainCard.style.opacity = '';
}

/**
 * Перелистывание вперед (зациклено)
 */
function nextAnimal() {
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
  const list = getFilteredAnimals();
  if (list.length <= 1) return;
  stopAllAudio();
  state.currentIndex = (state.currentIndex - 1 + list.length) % list.length;
  renderCard('prev');
}

/**
 * Построение кнопок главных категорий
 */
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
function initEvents() {
  prevBtn.addEventListener('click', () => {
    tapticFeedback('light');
    prevAnimal();
  });

  nextBtn.addEventListener('click', () => {
    tapticFeedback('light');
    nextAnimal();
  });

  mainCard.addEventListener('click', () => {
    tapticFeedback('medium');
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
      playAnimalAudio();
    }
  });

  initTouchEvents();
  initSearch();
  initDonateModal();
}

// Запуск при загрузке документа
document.addEventListener('DOMContentLoaded', () => {
  initVKApp();
  buildMainCategories();
  buildSubCategories();
  initEvents();
  renderCard();

  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
  }
});
