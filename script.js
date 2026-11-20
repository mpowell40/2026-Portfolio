(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ---------- Starfield: 3 parallax depth layers, twinkle, shooting stars ---------- */
  const canvas = $("#space");
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, DPR = 1, stars = [], shooters = [];
  let mouseX = 0, mouseY = 0, parX = 0, parY = 0, scrollY = window.scrollY;

  const LAYERS = [
    { depth: 0.15, size: [0.3, 0.9], speed: 0.22, share: 0.6 },
    { depth: 0.4, size: [0.6, 1.3], speed: 0.36, share: 0.3 },
    { depth: 0.9, size: [1.0, 1.9], speed: 0.55, share: 0.1 },
  ];
  const TINTS = ["255,255,255", "255,255,255", "255,255,255", "200,235,255", "220,210,255"];

  function buildStars() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const total = Math.round(Math.min(1400, (W * H) / (W < 768 ? 1100 : 1300)));
    stars = [];
    LAYERS.forEach((L, li) => {
      const n = Math.round(total * L.share);
      for (let i = 0; i < n; i++) {
        // random drift direction with a minimum speed so every star visibly wanders
        const dir = Math.random() * Math.PI * 2;
        const spd = L.speed * (0.25 + Math.random() * 0.75) * 0.5;
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: L.size[0] + Math.random() * (L.size[1] - L.size[0]),
          vx: Math.cos(dir) * spd,
          vy: Math.sin(dir) * spd,
          a: 0.25 + Math.random() * 0.75,
          tw: Math.random() * Math.PI * 2,
          tws: 0.005 + Math.random() * 0.025,
          tint: TINTS[(Math.random() * TINTS.length) | 0],
          layer: li,
        });
      }
    });
  }

  function spawnShooter() {
    const fromLeft = Math.random() < 0.5;
    const angle = 0.35 + Math.random() * 0.3; // radians below horizontal
    const speed = 9 + Math.random() * 6;
    shooters.push({
      x: fromLeft ? Math.random() * W * 0.5 : W * 0.5 + Math.random() * W * 0.5,
      y: Math.random() * H * 0.4,
      vx: Math.cos(angle) * speed * (fromLeft ? 1 : -1),
      vy: Math.sin(angle) * speed,
      life: 0, max: 50 + Math.random() * 30,
    });
  }

  function wrap(v, max) { return ((v % max) + max) % max; }

  function frame() {
    ctx.clearRect(0, 0, W, H);
    parX += (mouseX - parX) * 0.05;
    parY += (mouseY - parY) * 0.05;

    for (const s of stars) {
      const L = LAYERS[s.layer];
      s.x += s.vx; s.y += s.vy; s.tw += s.tws;
      const x = wrap(s.x - parX * L.depth * 30, W);
      const y = wrap(s.y - parY * L.depth * 30 - scrollY * L.depth * 0.35, H);
      const alpha = s.a * (0.6 + 0.4 * Math.sin(s.tw));
      ctx.fillStyle = `rgba(${s.tint},${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
      if (s.layer === 2 && alpha > 0.7) {
        ctx.fillStyle = `rgba(${s.tint},${(alpha - 0.7) * 0.25})`;
        ctx.beginPath();
        ctx.arc(x, y, s.r * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (let i = shooters.length - 1; i >= 0; i--) {
      const sh = shooters[i];
      sh.x += sh.vx; sh.y += sh.vy; sh.life++;
      const t = sh.life / sh.max;
      const fade = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8;
      const tx = sh.x - sh.vx * 9, ty = sh.y - sh.vy * 9;
      const g = ctx.createLinearGradient(sh.x, sh.y, tx, ty);
      g.addColorStop(0, `rgba(255,255,255,${0.9 * fade})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = g; ctx.lineWidth = 1.4; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(tx, ty); ctx.stroke();
      if (sh.life >= sh.max) shooters.splice(i, 1);
    }

    if (!document.hidden && Math.random() < 0.004 && shooters.length < 2) spawnShooter();
    requestAnimationFrame(frame);
  }

  function staticFrame() {
    ctx.clearRect(0, 0, W, H);
    for (const s of stars) {
      ctx.fillStyle = `rgba(${s.tint},${s.a})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
  }

  buildStars();
  if (reduceMotion) staticFrame(); else requestAnimationFrame(frame);

  let resizeT;
  window.addEventListener("resize", () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => { buildStars(); if (reduceMotion) staticFrame(); }, 200);
  });

  window.addEventListener("mousemove", (e) => {
    mouseX = e.clientX / W - 0.5;
    mouseY = e.clientY / H - 0.5;
  }, { passive: true });

  /* ---------- Scroll: nav state, progress bar, star parallax ---------- */
  const nav = $("#nav");
  const progress = $(".scroll-progress");
  function onScroll() {
    scrollY = window.scrollY;
    nav.classList.toggle("scrolled", scrollY > 40);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Custom cursor ---------- */
  if (finePointer && !reduceMotion) {
    const dot = $(".cursor"), ring = $(".cursor-follower");
    let cx = -100, cy = -100, fx = -100, fy = -100;
    document.addEventListener("mousemove", (e) => {
      cx = e.clientX; cy = e.clientY;
      document.body.classList.add("has-cursor");
    }, { passive: true });
    document.addEventListener("mouseleave", () => document.body.classList.remove("has-cursor"));
    (function loop() {
      fx += (cx - fx) * 0.14; fy += (cy - fy) * 0.14;
      dot.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
      ring.style.transform = `translate(${fx}px, ${fy}px) translate(-50%, -50%)`;
      requestAnimationFrame(loop);
    })();
    document.addEventListener("mouseover", (e) => {
      if (e.target.closest("a, button")) ring.classList.add("grow");
    });
    document.addEventListener("mouseout", (e) => {
      if (e.target.closest("a, button")) ring.classList.remove("grow");
    });
  }

  /* ---------- Mobile menu ---------- */
  const toggle = $("#menu-toggle"), menu = $("#mobile-menu");
  function setMenu(open) {
    menu.classList.toggle("open", open);
    menu.setAttribute("aria-hidden", String(!open));
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.classList.toggle("menu-open", open);
  }
  toggle.addEventListener("click", () => setMenu(!menu.classList.contains("open")));
  $$("a", menu).forEach((a) => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

  /* ---------- Scroll reveals (staggered within groups) ---------- */
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      el.classList.add("in");
      revealObs.unobserve(el);
      // once revealed, drop the stagger delay so hover effects respond instantly
      const delay = parseFloat(getComputedStyle(el).getPropertyValue("--d")) || 0;
      setTimeout(() => el.classList.add("done"), 1100 + delay * 1000);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  $$(".grid-2, .grid-3, .stats, .timeline").forEach((group) => {
    $$(":scope > .reveal, :scope > * > .reveal", group).forEach((el, i) => el.style.setProperty("--d", `${i * 0.09}s`));
  });
  $$(".reveal").forEach((el) => revealObs.observe(el));

  /* ---------- Active section: side dots + nav links ---------- */
  const sections = $$("main section[id]");
  const dots = $$(".dots button");
  const links = $$(".nav__links a");
  const secObs = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const id = en.target.id;
      dots.forEach((d) => d.classList.toggle("active", d.dataset.target === id));
      links.forEach((l) => l.classList.toggle("active", l.getAttribute("href") === `#${id}`));
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  sections.forEach((s) => secObs.observe(s));
  dots.forEach((d) => d.addEventListener("click", () => $(`#${d.dataset.target}`).scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" })));

  /* ---------- Typed roles ---------- */
  const typed = $("#typed");
  const roles = ["Security Operations Analyst", "Detection Engineer", "AI Agent Security Researcher", "M.S. Cybersecurity @ Georgia Tech"];
  if (!reduceMotion) {
    let ri = 0, ci = roles[0].length, deleting = true;
    const tick = () => {
      const word = roles[ri];
      ci += deleting ? -1 : 1;
      typed.textContent = word.slice(0, ci);
      let wait = deleting ? 35 : 75;
      if (!deleting && ci === word.length) { deleting = true; wait = 2200; }
      else if (deleting && ci === 0) { deleting = false; ri = (ri + 1) % roles.length; wait = 400; }
      setTimeout(tick, wait);
    };
    setTimeout(tick, 2800);
  }

  /* ---------- Count-up stats ---------- */
  const countObs = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      countObs.unobserve(el);
      const target = parseFloat(el.dataset.count);
      const dec = parseInt(el.dataset.decimals || "0", 10);
      const suffix = el.dataset.suffix || "";
      const fmt = (v) => (dec ? v.toFixed(dec) : Math.round(v).toLocaleString("en-US")) + suffix;
      if (reduceMotion) { el.textContent = fmt(target); return; }
      const start = performance.now(), dur = 1800;
      const step = (now) => {
        const t = Math.min(1, (now - start) / dur);
        el.textContent = fmt(target * (1 - Math.pow(1 - t, 4)));
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, { threshold: 0.6 });
  $$("[data-count]").forEach((el) => countObs.observe(el));

  /* ---------- Honeypot terminal feed (illustrative sample lines) ---------- */
  const term = $("#term");
  const ips = () => `${(Math.random() * 200 + 20) | 0}.${(Math.random() * 255) | 0}.${(Math.random() * 255) | 0}.${(Math.random() * 255) | 0}`;
  const users = ["root", "admin", "ubuntu", "oracle", "test", "pi", "postgres"];
  const cmds = ["uname -a", "cat /proc/cpuinfo", "wget http://…/x.sh", "cd /tmp; chmod +x ./bot", "nproc", "ps aux | grep miner"];
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const lineGen = [
    () => `<span class="t-dim">cowrie</span> login.failed  <span class="t-ok">${ips()}</span>  user=${pick(users)}`,
    () => `<span class="t-dim">cowrie</span> login.failed  <span class="t-ok">${ips()}</span>  user=${pick(users)}`,
    () => `<span class="t-dim">cowrie</span> command.input <span class="t-ok">${ips()}</span>  "${pick(cmds)}"`,
    () => `<span class="t-hi">ALERT</span> rule 1001${(Math.random() * 90 + 10) | 0} brute-force  <span class="t-vi">T1078</span>`,
    () => `<span class="t-hi">ALERT</span> rule 1002${(Math.random() * 90 + 10) | 0} recon scan   <span class="t-vi">T1046</span>`,
    () => `<span class="t-dim">geoip</span> enriched src=${ips()} → ${pick(["CN", "RU", "US", "BR", "IN", "VN", "DE", "NL"])}`,
  ];
  if (term) {
    const lines = [];
    const push = () => {
      lines.push(pick(lineGen)());
      if (lines.length > 12) lines.shift();
      term.innerHTML = lines.join("\n");
    };
    for (let i = 0; i < 12; i++) push();
    if (!reduceMotion) {
      const termObs = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting && !term._iv) term._iv = setInterval(push, 700);
          else if (!en.isIntersecting && term._iv) { clearInterval(term._iv); term._iv = null; }
        });
      });
      termObs.observe(term);
    }
  }

  /* ---------- Card spotlight + subtle tilt ---------- */
  if (finePointer && !reduceMotion) {
    $$(".card").forEach((card) => {
      card.addEventListener("mousemove", (e) => {
        const r = card.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        card.style.setProperty("--mx", `${x}px`);
        card.style.setProperty("--my", `${y}px`);
        if (card.classList.contains("tilt") && card.classList.contains("in")) {
          const rx = ((y / r.height) - 0.5) * -4;
          const ry = ((x / r.width) - 0.5) * 4;
          card.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`;
        }
      });
      card.addEventListener("mouseleave", () => { if (card.classList.contains("tilt")) card.style.transform = ""; });
    });

    /* Magnetic buttons */
    $$(".magnetic").forEach((btn) => {
      btn.addEventListener("mousemove", (e) => {
        const r = btn.getBoundingClientRect();
        btn.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.18}px, ${(e.clientY - r.top - r.height / 2) * 0.25}px)`;
      });
      btn.addEventListener("mouseleave", () => { btn.style.transform = ""; });
    });
  }

  $("#year").textContent = new Date().getFullYear();
})();
