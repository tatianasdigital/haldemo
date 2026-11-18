document.documentElement.classList.add('js');

/* ---------- Programs: карточки появляются по очереди ----------
   Старт — когда середина блока Programs доходит до низа экрана
   (т.е. пользователь долистал до середины секции).
   Порядок: Find Support → Build Resilience → Develop Essential Skills → Shape Future
   (по часовой стрелке). */
(function () {
  const section = document.querySelector('.programs');
  if (!section) return;

  section.querySelectorAll('.pcard').forEach((card) => {
    card.style.setProperty('--i', card.dataset.order || 0);
  });

  function check() {
    const r = section.getBoundingClientRect();
    const middle = r.top + r.height / 2;
    if (middle <= window.innerHeight) {
      section.classList.add('is-visible');
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    }
  }
  window.addEventListener('scroll', check, { passive: true });
  window.addEventListener('resize', check);
  check();
})();

/* ---------- Impact gallery: простая карусель из 3 фото ---------- */
(function () {
  const gallery = document.querySelector('.gallery');
  if (!gallery) return;

  const slots = [
    gallery.querySelector('.gallery__side--left img'),
    gallery.querySelector('.gallery__main > img'),
    gallery.querySelector('.gallery__side--right img'),
  ];
  let srcs = slots.map((img) => img.getAttribute('src'));

  function render() {
    gallery.classList.add('is-cover');
    slots.forEach((img) => (img.style.opacity = 0));
    setTimeout(() => {
      slots.forEach((img, i) => {
        img.src = srcs[i];
        img.style.opacity = 1;
      });
    }, 200);
  }
  const next = () => { srcs.push(srcs.shift()); render(); };
  const prev = () => { srcs.unshift(srcs.pop()); render(); };

  gallery.querySelector('.gallery__ctrl--next').addEventListener('click', next);
  gallery.querySelector('.gallery__ctrl--prev').addEventListener('click', prev);
  gallery.querySelector('.gallery__side--right').addEventListener('click', next);
  gallery.querySelector('.gallery__side--left').addEventListener('click', prev);
})();

/* ---------- Hero: тексты заголовка перелистываются снизу вверх ---------- */
(function () {
  const slides = document.querySelectorAll('.hero__slide');
  if (slides.length < 2) return;
  const INTERVAL = 3000; // мс — сколько показывается каждый текст
  const DURATION = 500;  // мс — длительность перелистывания (как в CSS)
  let current = 0;

  setInterval(() => {
    const prev = slides[current];
    current = (current + 1) % slides.length;
    const next = slides[current];

    // новый текст мгновенно ставим под «окно», затем запускаем движение вверх
    next.classList.add('no-anim');
    next.classList.remove('is-leaving', 'is-active');
    next.getBoundingClientRect(); // применяем стартовое положение
    next.classList.remove('no-anim');

    prev.classList.remove('is-active');
    prev.classList.add('is-leaving');
    next.classList.add('is-active');

    // ушедший текст возвращаем вниз мгновенно и невидимо, без обратного «пролёта»
    setTimeout(() => {
      prev.classList.add('no-anim');
      prev.classList.remove('is-leaving');
      prev.getBoundingClientRect();
      prev.classList.remove('no-anim');
    }, DURATION + 50);
  }, INTERVAL);
})();
