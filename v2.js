/* HAL v2 — бегущая строка тегов в карточках Support Services.
   При наведении на карточку теги бесконечно едут справа налево без остановок:
   за последним тегом сразу снова идёт первый. Курсор ушёл — строка плавно возвращается в начало. */
(function () {
  const SPEED = 50;   // скорость, px в секунду

  document.querySelectorAll('.scard').forEach((card) => {
    const box = card.querySelector('.scard__tags');
    const track = card.querySelector('.scard__track');
    if (!box || !track) return;

    // Дублируем теги один раз, чтобы лента была бесшовной
    const originals = Array.from(track.children);
    originals.forEach((li) => {
      const clone = li.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    });
    const firstClone = track.children[originals.length];

    let anim = null;

    card.addEventListener('mouseenter', () => {
      // расстояние, через которое лента повторяется: от первого тега до его копии
      const loop = firstClone.offsetLeft - originals[0].offsetLeft;
      if (anim) anim.cancel();
      track.style.transition = 'none';
      track.style.transform = 'translateX(0)';
      anim = track.animate(
        [{ transform: 'translateX(0)' }, { transform: `translateX(${-loop}px)` }],
        { duration: (loop / SPEED) * 1000, iterations: Infinity, easing: 'linear' }
      );
    });

    card.addEventListener('mouseleave', () => {
      if (!anim) return;
      const current = getComputedStyle(track).transform;
      anim.cancel(); anim = null;
      track.style.transition = 'none';
      track.style.transform = current;
      track.getBoundingClientRect();
      track.style.transition = 'transform .5s ease';
      track.style.transform = 'translateX(0)';
    });
  });
})();


/* HAL v2 — анимация заголовков [data-split] — как смена цитат в Impact Testimonial
   (по образцу instituteofhealth.com): строки по очереди выплывают снизу из глубины и размытия.
   1) Текст разбивается на слова (span.sw). Вложенные теги и <br> сохраняются.
   2) Каждому слову задаётся номер его строки (--li) — строки появляются друг за другом.
   3) Старт — когда верх заголовка доходит до 90% высоты экрана.
      Если прокрутить назад и заголовок уйдёт за нижний край экрана — сброс, при следующем показе проигрывается снова.
   Заголовок внутри Programs стартует вместе с кругом (когда секция получает .is-visible). */
(function () {
  const els = document.querySelectorAll('[data-split]');
  if (!els.length) return;

  function wrap(node) {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === 3) {
        const parts = child.textContent.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        parts.forEach((p) => {
          if (!p) return;
          if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
          const w = document.createElement('span');
          w.className = 'sw';
          w.textContent = p;
          frag.appendChild(w);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === 1 && child.tagName !== 'BR') {
        wrap(child);
      }
    });
  }

  // номер строки для каждого слова — по фактическому переносу текста
  function markLines(el) {
    let top = null, line = -1;
    el.querySelectorAll('.sw').forEach((w) => {
      const t = Math.round(w.offsetTop);
      if (top === null || Math.abs(t - top) > 4) { line++; top = t; }
      w.style.setProperty('--li', line);
    });
  }

  els.forEach((el) => { wrap(el); markLines(el); });
  window.addEventListener('resize', () => els.forEach(markLines));
  document.fonts && document.fonts.ready.then(() => els.forEach(markLines));

  const play = (el) => { el.classList.remove('no-anim'); el.classList.add('is-in'); };
  const reset = (el) => { el.classList.add('no-anim'); el.classList.remove('is-in'); };

  function check() {
    const vh = window.innerHeight;
    els.forEach((el) => {
      if (el.closest('.programs')) return;
      const top = el.getBoundingClientRect().top;
      if (top <= vh * 0.9) { if (!el.classList.contains('is-in')) play(el); }
      else if (top > vh) { if (el.classList.contains('is-in')) reset(el); }
    });
  }
  window.addEventListener('scroll', check, { passive: true });
  window.addEventListener('resize', check);
  check();

  // Заголовок Programs — синхронно с появлением круга
  els.forEach((el) => {
    const programs = el.closest('.programs');
    if (!programs) return;
    if (programs.classList.contains('is-visible')) { play(el); return; }
    const mo = new MutationObserver(() => {
      if (programs.classList.contains('is-visible')) { play(el); mo.disconnect(); }
    });
    mo.observe(programs, { attributes: true, attributeFilter: ['class'] });
  });
})();


/* HAL v2 — галерея в Impact (Figma 115:2212, листание по образцу airfieldlacaminera.com).
   Центральное фото 8 колонок × 670; соседние 760×441 на 1920 (ширина пропорциональна центральной),
   между фото — gutter сетки. При листании фото плавно меняют размер и сдвигаются.
   Листание: стрелки, клик по боковому фото, свайп/перетаскивание. По кругу. */
(function () {
  const gal = document.querySelector('[data-igal]');
  if (!gal) return;
  const slides = Array.from(gal.querySelectorAll('.igal__slide'));
  const ctrls = gal.querySelector('.igal__ctrls');
  const n = slides.length;
  const SIDE_W = 760 / 1112;   // ширина бокового фото относительно центрального
  const SIDE_H = 441;          // высота бокового фото
  let active = +(gal.dataset.start || 0);
  const last = new Array(n).fill(null);

  const rel = (i) => { let p = (i - active + n) % n; if (p > n / 2) p -= n; return p; };

  function render(first) {
    const W = ctrls.offsetWidth;                 // ширина центрального фото (8 колонок)
    const H = gal.offsetHeight;
    const GAP = parseFloat(getComputedStyle(gal).getPropertyValue('--gut')) || 24;
    const sw = W * SIDE_W;
    const step1 = W / 2 + GAP + sw / 2;          // от центра до центра соседнего
    const stepN = sw + GAP;                      // дальше — между боковыми
    slides.forEach((s, i) => {
      const p = rel(i);
      const a = Math.abs(p);
      const x = a === 0 ? 0 : Math.sign(p) * (step1 + (a - 1) * stepN);
      const jump = !first && last[i] !== null && Math.abs(p - last[i]) > 1;
      if (jump || first) s.classList.add('no-anim');
      s.style.width = (a === 0 ? W : sw) + 'px';
      s.style.height = (a === 0 ? H : SIDE_H) + 'px';
      s.style.transform = `translate(calc(-50% + ${x}px), -50%)`;
      s.style.zIndex = 10 - a;
      s.classList.toggle('is-center', p === 0);
      last[i] = p;
      if (jump || first) { s.getBoundingClientRect(); s.classList.remove('no-anim'); }
    });
  }
  const go = (d) => { active = (active + d + n) % n; render(false); };

  gal.querySelector('.ctrl--prev').addEventListener('click', () => go(-1));
  gal.querySelector('.ctrl--next').addEventListener('click', () => go(1));
  slides.forEach((s, i) => s.addEventListener('click', () => { if (dragged) return; const p = rel(i); if (p) go(Math.sign(p)); }));

  // свайп / перетаскивание
  let x0 = null, dragged = false;
  gal.addEventListener('pointerdown', (e) => { if (e.target.closest('.ctrl')) return; x0 = e.clientX; dragged = false; });
  window.addEventListener('pointerup', (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) { dragged = true; go(dx < 0 ? 1 : -1); setTimeout(() => (dragged = false), 50); }
  });

  window.addEventListener('resize', () => render(true));
  render(true);
})();

/* HAL v2 — горизонтальные слайдеры (Voices, Partners): стрелки листают на одну карточку.
   Если все карточки помещаются — стрелки неактивны. */
(function () {
  document.querySelectorAll('[data-slider]').forEach((sl) => {
    const track = sl.querySelector('.slider__track');
    const prev = sl.querySelector('.ctrl--prev');
    const next = sl.querySelector('.ctrl--next');
    const step = () => {
      const card = track.firstElementChild;
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      return card ? card.getBoundingClientRect().width + gap : 300;
    };
    const update = () => {
      const max = track.scrollWidth - track.clientWidth;
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= max - 2;
    };
    prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
    next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  });
})();

/* HAL v2 — Impact Testimonial: переключение отзывов по именам.
   Переход построчно (как на instituteofhealth.com): строки текущей цитаты уходят вверх с размытием,
   строки новой по очереди выплывают снизу из размытия. */
(function () {
  const quote = document.querySelector('.tst__quote');
  const pills = Array.from(document.querySelectorAll('.tst__pill'));
  if (!quote || !pills.length) return;
  const LEAVE = 750;
  let busy = false;

  // разбить текст на строки так, как он ляжет в блоке
  function toLines(text) {
    quote.innerHTML = text.split(' ').map((w) => `<span>${w}</span>`).join(' ');
    const lines = [];
    let top = null;
    quote.querySelectorAll('span').forEach((s) => {
      if (s.offsetTop !== top) { lines.push([]); top = s.offsetTop; }
      lines[lines.length - 1].push(s.textContent);
    });
    quote.innerHTML = lines.map((l, n) => `<span class="line" style="--i:${n}">${l.join(' ')}</span>`).join('');
  }

  toLines(quote.textContent.trim());
  // при изменении размера окна — заново разложить текст активной цитаты (берём исходный текст, а не из строк, иначе слова на стыке строк слипаются)
  window.addEventListener('resize', () => { if (!busy) toLines((pills.find((x) => x.classList.contains('is-active')) || pills[0]).dataset.quote); });

  pills.forEach((p) => p.addEventListener('click', () => {
    if (busy || p.classList.contains('is-active')) return;
    busy = true;
    pills.forEach((x) => { x.classList.toggle('is-active', x === p); x.setAttribute('aria-selected', x === p); });
    quote.classList.add('is-leave');
    setTimeout(() => {
      quote.classList.remove('is-leave');
      quote.classList.add('is-pre');
      toLines(p.dataset.quote);
      quote.getBoundingClientRect();
      requestAnimationFrame(() => { quote.classList.remove('is-pre'); setTimeout(() => (busy = false), 300); });
    }, LEAVE);
  }));
})();


/* HAL v2 — видео-фон Impact Testimonial.
   Плеер подгружается, когда секция подходит к экрану, и принудительно запускается (Vimeo Player API).
   Пока видео не пошло — виден кадр-заставка; само видео проявляется плавно, как только начинает играть. */
(function () {
  const frame = document.querySelector('.tst__video');
  if (!frame) return;
  const section = frame.closest('.tst');
  let player = null;

  function start() {
    if (!frame.src) frame.src = frame.dataset.src;
    if (!window.Vimeo || !window.Vimeo.Player) { frame.classList.add('is-playing'); return; }
    if (!player) {
      player = new Vimeo.Player(frame);
      player.on('play', () => frame.classList.add('is-playing'));
      player.on('timeupdate', () => frame.classList.add('is-playing'));
      player.ready().then(() => player.setVolume(0)).catch(() => {});
    }
    player.play().catch(() => {});
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) start();
      else if (player) player.pause().catch(() => {});
    });
  }, { rootMargin: '300px 0px' });
  io.observe(section);
})();


/* HAL v2 — форма доната: переключатели (частота, сумма) и своя сумма.
   Ввод своей суммы снимает выбор с готовых сумм; клик по готовой сумме очищает поле. */
(function () {
  const segs = document.querySelectorAll('[data-seg]');
  const custom = document.querySelector('[data-custom]');
  const amounts = document.querySelector('[data-amounts]');
  segs.forEach((seg) => {
    const btns = seg.querySelectorAll('.seg__btn');
    btns.forEach((b) => b.addEventListener('click', () => {
      btns.forEach((x) => { x.classList.toggle('is-active', x === b); x.setAttribute('aria-checked', x === b); });
      if (seg === amounts && custom) custom.value = '';
    }));
  });
  if (custom && amounts) {
    custom.addEventListener('input', () => {
      custom.value = custom.value.replace(/[^0-9.,]/g, '');
      if (custom.value) amounts.querySelectorAll('.seg__btn').forEach((x) => { x.classList.remove('is-active'); x.setAttribute('aria-checked', false); });
    });
  }
})();

/* HAL v2 — Programs: запуск анимации раньше, без паузы.
   В script.js старт — когда середина секции доходит до низа экрана (круг к этому моменту уже давно на экране).
   Здесь — как только верх секции поднимается до 65% высоты экрана, то есть сразу, как круг показался. */
(function () {
  const section = document.querySelector('.programs');
  if (!section) return;
  function check() {
    if (section.getBoundingClientRect().top <= window.innerHeight * 0.65) {
      section.classList.add('is-visible');
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    }
  }
  window.addEventListener('scroll', check, { passive: true });
  window.addEventListener('resize', check);
  check();
})();


/* HAL v2 — Programs: масштаб композиции под ширину экрана (холст 1920×1080, см. v2.css) */
(function () {
  const section = document.querySelector('.programs');
  if (!section) return;
  const fit = () => section.style.setProperty('--k', Math.min(1, document.documentElement.clientWidth / 1920));
  window.addEventListener('resize', fit);
  fit();
})();


/* HAL v2 — Join Our Family: белые плашки в трёх карточках одной высоты — по самой высокой.
   Кнопка внутри плашки всегда прижата к низу (flex, space-between в CSS). */
(function () {
  const boxes = Array.from(document.querySelectorAll('.join-card__box'));
  if (!boxes.length) return;
  function equalize() {
    boxes.forEach((b) => (b.style.height = ''));
    const max = Math.max(...boxes.map((b) => b.offsetHeight));
    boxes.forEach((b) => (b.style.height = max + 'px'));
  }
  window.addEventListener('resize', equalize);
  if (document.fonts) document.fonts.ready.then(equalize);
  equalize();
})();
