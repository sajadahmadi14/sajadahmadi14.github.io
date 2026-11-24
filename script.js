(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  /* ---------- Animated network behind page headers ---------- */
  const network = (() => {
    const canvas = document.getElementById('network');
    if (!canvas || !canvas.getContext) return null;

    const ctx = canvas.getContext('2d');
    const hero = canvas.parentElement;
    const LINK = 150;          // max distance for a line between two nodes
    const MOUSE_LINK = 210;    // max distance for a line to the cursor
    const mouse = { x: -9999, y: -9999 };
    let w = 0, h = 0, nodes = [], rgb = '94, 234, 212', raf = null, visible = true;

    const readColor = () => {
      rgb = getComputedStyle(root).getPropertyValue('--node').trim() || rgb;
    };

    const seed = () => {
      const count = Math.min(110, Math.round((w * h) / 13000));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.6 + 0.7,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            ctx.strokeStyle = `rgba(${rgb}, ${(1 - Math.sqrt(d2) / LINK) * 0.32})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        const md = Math.hypot(a.x - mouse.x, a.y - mouse.y);
        if (md < MOUSE_LINK) {
          ctx.strokeStyle = `rgba(${rgb}, ${(1 - md / MOUSE_LINK) * 0.55})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
        ctx.fillStyle = `rgba(${rgb}, 0.85)`;
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const widthChanged = Math.abs(rect.width - w) > 1;
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (widthChanged || !nodes.length) seed();
      draw();
    };

    const step = () => {
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      }
      draw();
      raf = visible ? requestAnimationFrame(step) : null;
    };

    readColor();
    resize();

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 120);
    });

    hero.addEventListener('pointermove', (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      if (reduceMotion) draw();
    });
    hero.addEventListener('pointerleave', () => {
      mouse.x = mouse.y = -9999;
      if (reduceMotion) draw();
    });

    if (!reduceMotion) {
      // Only animate while the header is on screen
      new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !raf) raf = requestAnimationFrame(step);
      }).observe(hero);
    }

    return { refreshColor() { readColor(); draw(); } };
  })();

  /* ---------- Rocket journey: scroll moves the rocket from Earth to the Moon ---------- */
  (() => {
    const section = document.querySelector('.journey');
    if (!section) return;

    const path = section.querySelector('#flight-path');
    const trail = section.querySelector('#flight-trail');
    const rocket = section.querySelector('#rocket');
    const markerGroup = section.querySelector('#markers');
    const stars = section.querySelector('.stars');
    const items = [...section.querySelectorAll('.mission-log li')];
    const distEl = section.querySelector('[data-distance]');
    const pctEl = section.querySelector('[data-progress]');
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const MOON_KM = 384400;
    const FLIP_START = 0.84;   // rocket starts turning around for a tail-first landing
    const FLIP_END = 0.97;
    const LANDED = 0.985;

    const len = path.getTotalLength();
    trail.style.strokeDasharray = `${len}`;
    trail.style.strokeDashoffset = `${len}`;

    // Each mission-log item says where along the flight (0 to 1) it happens
    const stops = items.map((li) => clamp01(parseFloat(li.dataset.at) || 0));

    // Numbered markers on the path for the in-between milestones
    const markers = stops.map((at, i) => {
      if (i === 0 || i === stops.length - 1) return null;
      const p = path.getPointAtLength(at * len);
      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('class', 'marker');
      g.setAttribute('transform', `translate(${p.x} ${p.y})`);
      const c = document.createElementNS(SVG_NS, 'circle');
      c.setAttribute('r', '7');
      const t = document.createElementNS(SVG_NS, 'text');
      t.setAttribute('x', '-38');
      t.setAttribute('y', '5');
      t.textContent = String(i).padStart(2, '0');
      g.append(c, t);
      markerGroup.appendChild(g);
      return g;
    });

    const angleAt = (l) => {
      const a = path.getPointAtLength(Math.max(0, l - 0.5));
      const b = path.getPointAtLength(Math.min(len, l + 0.5));
      return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    };
    const smooth = (t) => t * t * (3 - 2 * t);

    // Star field (redrawn only when the width changes)
    let starWidth = 0;
    const drawStars = () => {
      if (!stars) return;
      const w = stars.offsetWidth;
      const h = stars.offsetHeight;
      if (Math.abs(w - starWidth) < 2 && stars.width) return;
      starWidth = w;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      stars.width = Math.round(w * dpr);
      stars.height = Math.round(h * dpr);
      const ctx = stars.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round((w * h) / 2400);
      for (let i = 0; i < count; i++) {
        const big = Math.random() < 0.07;
        ctx.globalAlpha = Math.random() * 0.6 + (big ? 0.4 : 0.2);
        ctx.fillStyle = Math.random() < 0.15 ? '#c7d2fe' : '#ffffff';
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h, big ? Math.random() * 1.1 + 1 : Math.random() * 0.8 + 0.25, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    let ticking = false;
    const update = () => {
      ticking = false;
      const total = section.offsetHeight - window.innerHeight;
      const p = clamp01(-section.getBoundingClientRect().top / Math.max(1, total));
      const l = p * len;
      const pt = path.getPointAtLength(l);

      // Point along the flight path, then flip to land tail-first (upright)
      let angle = angleAt(l);
      if (p > FLIP_START) {
        angle += (-90 - angle) * smooth(clamp01((p - FLIP_START) / (FLIP_END - FLIP_START)));
      }
      rocket.setAttribute('transform', `translate(${pt.x.toFixed(2)} ${pt.y.toFixed(2)}) rotate(${(angle + 90).toFixed(2)})`);
      trail.style.strokeDashoffset = `${len - l}`;

      const landed = p >= LANDED;
      section.classList.toggle('launched', p > 0.004);
      section.classList.toggle('flying', p > 0.004 && !landed);
      section.classList.toggle('landed', landed);

      let current = 0;
      stops.forEach((at, i) => { if (p >= at - 0.0005) current = i; });
      items.forEach((li, i) => {
        li.classList.toggle('done', i < current);
        li.classList.toggle('active', i === current);
      });
      markers.forEach((m, i) => m && m.classList.toggle('passed', p >= stops[i]));

      if (distEl) distEl.textContent = `${Math.round(MOON_KM * (landed ? 0 : 1 - p)).toLocaleString('en-US')} km`;
      if (pctEl) pctEl.textContent = landed ? 'Landed' : `${Math.round(p * 100)}%`;
      if (stars) stars.style.transform = `translate3d(0, ${(-p * 22).toFixed(2)}%, 0)`;
    };

    const requestUpdate = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };

    drawStars();
    update();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', () => { drawStars(); requestUpdate(); });
  })();

  /* ---------- Light / dark toggle ---------- */
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) { /* private mode */ }
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', next === 'light' ? '#f6f7f9' : '#07090d');
    network?.refreshColor();
  });

  /* ---------- Mobile menu ---------- */
  const nav = document.querySelector('.nav');
  const menuBtn = document.getElementById('menu-toggle');
  const setMenu = (open) => {
    nav.classList.toggle('open', open);
    menuBtn?.setAttribute('aria-expanded', String(open));
  };
  menuBtn?.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  /* ---------- Nav shadow once you scroll ---------- */
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 12);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Fade content in as it scrolls into view ---------- */
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('in'));
  }

  /* ---------- Spotlight that follows the cursor on cards ---------- */
  document.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - rect.left}px`);
      card.style.setProperty('--my', `${e.clientY - rect.top}px`);
    });
  });

  /* ---------- Publication filters ---------- */
  const filterButtons = document.querySelectorAll('.filter');
  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.filter;
      filterButtons.forEach((b) => {
        const on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      document.querySelectorAll('.pub').forEach((pub) => {
        pub.hidden = !(type === 'all' || pub.dataset.type === type);
      });
    });
  });

  /* ---------- Copy email button ---------- */
  const copyBtn = document.getElementById('copy-email');
  copyBtn?.addEventListener('click', async () => {
    const label = copyBtn.querySelector('span');
    try {
      await navigator.clipboard.writeText(copyBtn.dataset.email);
      label.textContent = 'Copied!';
    } catch (e) {
      label.textContent = copyBtn.dataset.email;
    }
    setTimeout(() => { label.textContent = 'Copy email'; }, 2000);
  });
})();
