(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  /* ---------- Starfield background on every page ----------
     You drift slowly through the stars; the mouse adds parallax.
     Click empty sky = shooting star. Press and hold = warp speed.
     On the home page this also animates the worlds orbiting the photo. */
  const space = (() => {
    const canvas = document.getElementById('space');
    if (!canvas || !canvas.getContext) return null;

    const ctx = canvas.getContext('2d');
    const orbit = document.getElementById('orbit-system');
    const bodies = orbit ? [...orbit.querySelectorAll('.body')] : [];
    const TAU = Math.PI * 2;
    const PHI = (-14 * Math.PI) / 180;            // tilt of the orbit plane
    const cosP = Math.cos(PHI), sinP = Math.sin(PHI);
    const TINTS = ['', '94, 234, 212', '165, 180, 252'];
    // Pressing on these does nothing special (so text stays selectable and links clickable)
    const NOT_SKY = 'a, button, input, textarea, select, label, p, h1, h2, h3, h4, li, dt, dd, time, pre, code, .card, .pub, .info-card, .contact-card, .filters, .nav, .journey';

    let w = 0, h = 0, fov = 1, stars = [], comets = [];
    let rgb = '255, 255, 255';
    let warp = 0, warpTarget = 0;
    let timeScale = 1, hoverOrbit = false, orbitTime = 0, orbitScale = 1;
    const cam = { x: 0, y: 0, tx: 0, ty: 0 };      // parallax camera offset
    const tilt = { x: 0, y: 0, tx: 0, ty: 0 };     // orbit-system tilt in degrees
    let last = performance.now();

    const readColor = () => { rgb = getComputedStyle(root).getPropertyValue('--star').trim() || rgb; };

    const newStar = (z = Math.random()) => ({
      x: (Math.random() * 2 - 1) * 1.2,
      y: (Math.random() * 2 - 1) * 1.2,
      z: Math.max(0.05, z),
      tw: Math.random() * TAU,
      tint: Math.random() < 0.1 ? 1 : Math.random() < 0.12 ? 2 : 0,
    });

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const widthChanged = Math.abs(canvas.clientWidth - w) > 1;
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      fov = Math.max(w, h) * 0.55;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (widthChanged || !stars.length) {
        const count = Math.min(750, Math.round((w * h) / 2200));
        stars = Array.from({ length: count }, () => newStar());
      }
      if (orbit) orbitScale = orbit.clientWidth / 600;
    };

    const project = (s) => {
      const k = fov / s.z;
      return [w / 2 + (s.x - cam.x) * k, h / 2 + (s.y - cam.y) * k];
    };

    const drawStars = (dt, t) => {
      const speed = 0.035 + warp * 1.5;   // depth units per second
      const streak = 1 + warp * 7;
      for (const s of stars) {
        const [px, py] = project(s);
        s.z -= speed * dt;
        if (s.z < 0.04) { Object.assign(s, newStar(1)); continue; }
        const [sx, sy] = project(s);
        if (sx < -40 || sx > w + 40 || sy < -40 || sy > h + 40) { Object.assign(s, newStar(1)); continue; }

        const depth = 1 - s.z;
        const size = 0.5 + depth * 2.1;
        const alpha = Math.min(1, 0.2 + depth * 1.1) * (0.78 + 0.22 * Math.sin(t * 0.0018 + s.tw));
        const color = `rgba(${s.tint ? TINTS[s.tint] : rgb}, ${alpha.toFixed(3)})`;

        if (warp > 0.04) {
          ctx.strokeStyle = color;
          ctx.lineWidth = size;
          ctx.beginPath();
          ctx.moveTo(sx - (sx - px) * streak, sy - (sy - py) * streak);
          ctx.lineTo(sx, sy);
          ctx.stroke();
        } else {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(sx, sy, size * 0.6, 0, TAU);
          ctx.fill();
        }
      }
    };

    const drawComets = (dt) => {
      comets = comets.filter((c) => (c.life += dt) < c.max);
      for (const c of comets) {
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        const fade = Math.sin((c.life / c.max) * Math.PI);
        const tx = c.x - c.vx * 0.16, ty = c.y - c.vy * 0.16;
        const g = ctx.createLinearGradient(tx, ty, c.x, c.y);
        g.addColorStop(0, `rgba(${rgb}, 0)`);
        g.addColorStop(1, `rgba(${rgb}, ${0.95 * fade})`);
        ctx.strokeStyle = g;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(c.x, c.y);
        ctx.stroke();
        ctx.fillStyle = `rgba(${TINTS[1]}, ${0.9 * fade})`;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 2.4, 0, TAU);
        ctx.fill();
      }
    };

    const placeBodies = () => {
      for (const b of bodies) {
        const th = TAU * (b._phase + orbitTime / b._period);
        const ex = b._a * Math.cos(th), ey = b._b * Math.sin(th);
        const x = (ex * cosP - ey * sinP) * orbitScale;
        const y = (ex * sinP + ey * cosP) * orbitScale;
        const front = Math.sin(th);                  // > 0 means in front of the planet
        const scale = 0.8 + 0.3 * ((front + 1) / 2);
        b.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${scale.toFixed(3)})`;
        b.style.zIndex = front > 0 ? '5' : '1';
        b.style.opacity = front > 0 ? '1' : (0.5 + 0.5 * (front + 1)).toFixed(3);
      }
    };

    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const ease = (rate) => 1 - Math.exp(-dt * rate);

      warp += (warpTarget - warp) * ease(warpTarget > warp ? 2.2 : 3.5);
      cam.x += (cam.tx - cam.x) * ease(3);
      cam.y += (cam.ty - cam.y) * ease(3);
      tilt.x += (tilt.tx - tilt.x) * ease(4);
      tilt.y += (tilt.ty - tilt.y) * ease(4);
      timeScale += ((hoverOrbit ? 0.15 : 1) * (1 + warp * 5) - timeScale) * ease(4);
      orbitTime += dt * timeScale;

      ctx.clearRect(0, 0, w, h);
      drawStars(dt, now);
      drawComets(dt);

      if (orbit) {
        orbit.style.transform = `perspective(1100px) rotateX(${tilt.x.toFixed(2)}deg) rotateY(${tilt.y.toFixed(2)}deg)`;
        placeBodies();
      }
      if (!reduceMotion) requestAnimationFrame(frame);
    };

    // Orbit rings: dashed full ellipse behind the planet, solid front half over it
    if (orbit) {
      const SVG_NS = 'http://www.w3.org/2000/svg';
      const back = document.getElementById('rings-back');
      const frontG = document.getElementById('rings-front');
      const deg = (PHI * 180) / Math.PI;
      for (const b of bodies) {
        b._a = parseFloat(b.dataset.a) || 200;
        b._b = parseFloat(b.dataset.b) || 60;
        b._period = parseFloat(b.dataset.period) || 15;
        b._phase = parseFloat(b.dataset.phase) || 0;
        const e = document.createElementNS(SVG_NS, 'ellipse');
        e.setAttribute('rx', b._a);
        e.setAttribute('ry', b._b);
        e.setAttribute('transform', `rotate(${deg})`);
        e.setAttribute('class', 'ring-back');
        back.appendChild(e);
        const p = document.createElementNS(SVG_NS, 'path');
        p.setAttribute('d', `M ${b._a} 0 A ${b._a} ${b._b} 0 0 1 ${-b._a} 0`);
        p.setAttribute('transform', `rotate(${deg})`);
        p.setAttribute('class', 'ring-front');
        frontG.appendChild(p);
      }
      orbit.addEventListener('pointerenter', () => { hoverOrbit = true; });
      orbit.addEventListener('pointerleave', () => { hoverOrbit = false; });
    }

    readColor();
    resize();

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { resize(); if (reduceMotion) frame(performance.now()); }, 120);
    });

    if (reduceMotion) {
      // Still picture: stars and orbits drawn once, no motion
      frame(performance.now());
      return { refreshColor() { readColor(); frame(performance.now()); } };
    }

    // Mouse: gentle parallax for the stars and a 3D tilt for the orbit system
    window.addEventListener('pointermove', (e) => {
      const mx = e.clientX / window.innerWidth - 0.5;
      const my = e.clientY / window.innerHeight - 0.5;
      cam.tx = mx * 0.12;
      cam.ty = my * 0.12;
      tilt.tx = -my * 14;
      tilt.ty = mx * 18;
    });
    root.addEventListener('pointerleave', () => { cam.tx = cam.ty = tilt.tx = tilt.ty = 0; });

    // Click empty sky = shooting star, press and hold = warp speed
    let pressAt = 0, holdTimer = null;
    const endPress = () => {
      pressAt = 0;
      clearTimeout(holdTimer);
      warpTarget = 0;
      root.classList.remove('warping');
    };
    document.addEventListener('pointerdown', (e) => {
      if (e.button > 0 || e.target.closest(NOT_SKY)) return;
      if (e.pointerType === 'mouse') e.preventDefault();   // no text selection while holding
      pressAt = performance.now();
      holdTimer = setTimeout(() => { warpTarget = 1; root.classList.add('warping'); }, 180);
    });
    document.addEventListener('pointerup', (e) => {
      if (!pressAt) return;
      const quick = performance.now() - pressAt < 180;
      endPress();
      if (quick) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        const angle = (12 + Math.random() * 22) * (Math.PI / 180);
        const v = 900 + Math.random() * 400;
        comets.push({ x: e.clientX, y: e.clientY, vx: Math.cos(angle) * v * dir, vy: Math.sin(angle) * v, life: 0, max: 0.9 });
      }
    });
    document.addEventListener('pointercancel', endPress);
    window.addEventListener('blur', endPress);

    requestAnimationFrame(frame);
    return { refreshColor: readColor };
  })();

  /* ---------- Astronaut: the gold visor lifts as you scroll, revealing the face ---------- */
  (() => {
    const astro = document.querySelector('.astronaut');
    const visor = document.getElementById('visor');
    if (!astro || !visor) return;

    const wrap = astro.closest('.orbit-wrap');
    const RAISE = 150;        // how far the visor slides up (in drawing units)
    const DISTANCE = 170;     // pixels of scrolling from closed to fully open

    let ticking = false;
    const update = () => {
      ticking = false;
      // Helmet centre measured from the top of the page (re-measured each time, so fonts and resizing can't throw it off)
      const r = astro.getBoundingClientRect();
      const helmetY = r.top + window.scrollY + r.height * 0.38;
      // Start opening from wherever the helmet first sits on screen (or once it scrolls into view)
      const start = Math.min(helmetY, window.innerHeight * 0.72);
      const p = clamp01((start - (helmetY - window.scrollY)) / DISTANCE);
      const eased = p * p * (3 - 2 * p);
      visor.setAttribute('transform', `translate(0 ${(-RAISE * eased).toFixed(1)})`);
      wrap?.classList.toggle('revealed', p > 0.97);
    };
    const requestUpdate = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    window.addEventListener('load', requestUpdate);
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
    space?.refreshColor();
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
