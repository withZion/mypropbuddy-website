/* MyPropBuddy landing page. No dependencies. */
(() => {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const money = (v) => "$" + Math.round(v).toLocaleString("en-US");

  /* ---------- Reveal on scroll, staggered within each group ---------- */
  const groups = new Map();
  document.querySelectorAll(".reveal").forEach((el) => {
    const i = groups.get(el.parentElement) || 0;
    groups.set(el.parentElement, i + 1);
    el.style.transitionDelay = `${Math.min(i, 8) * 60}ms`;
  });
  // Weight bars on the ten checks (the heaviest weight is 2.0)
  document.querySelectorAll(".checks li[data-w]").forEach((li) =>
    li.style.setProperty("--w", (parseFloat(li.dataset.w) / 2).toFixed(3)));
  const show = (el) => el.classList.add("in");
  const io = "IntersectionObserver" in window
    ? new IntersectionObserver((es) => es.forEach((e) => {
        if (e.isIntersecting) { show(e.target); io.unobserve(e.target); }
      }), { rootMargin: "0px 0px -8% 0px" })
    : null;
  document.querySelectorAll(".reveal").forEach((el) => (io ? io.observe(el) : show(el)));

  /* ---------- The 6% trap ---------- */
  const svg = document.querySelector(".chart");
  if (svg) {
    const START = 100000, LIMIT = 6000, FLOOR_A = START - LIMIT, PEAK = 100800;
    const X0 = 56, X1 = 620;
    const y = (v) => 30 + (101000 - v) * 0.033;
    // Story keyframes: open, run to +$800, back to breakeven, drift lower, a rough week
    const keys = [
      { x: 70, v: 100000 }, { x: 200, v: PEAK }, { x: 330, v: 100000 },
      { x: 450, v: 99000 }, { x: 600, v: 94500 },
    ];
    // A dense, repeatable path between keyframes with a little texture, never above the peak
    const pts = [];
    for (let k = 0; k < keys.length - 1; k++) {
      const a = keys[k], b = keys[k + 1];
      for (let j = 0; j < 24; j++) {
        const f = j / 24;
        const wobble = Math.sin((k * 24 + j) * 1.7) * 90 * Math.sin(Math.PI * f);
        const v = Math.min(a.v + (b.v - a.v) * f + wobble, PEAK);
        pts.push({ x: a.x + (b.x - a.x) * f, v, s: k + f });
      }
    }
    pts.push({ ...keys[keys.length - 1], s: keys.length - 1 });

    const q = (sel) => document.querySelector(sel);
    const eq = svg.querySelector("[data-equity]");
    const floorA = svg.querySelector("[data-floor='a']");
    const floorB = svg.querySelector("[data-floor='b']");
    const now = svg.querySelector("[data-now]");
    const labA = svg.querySelector("[data-flabel='a']");
    const labB = svg.querySelector("[data-flabel='b']");
    const scrub = q("[data-scrub]"), playBtn = q("[data-play]"), caption = q("[data-caption]");
    const roomA = q("[data-room='a']"), roomB = q("[data-room='b']");
    const stateA = q("[data-state='a']"), stateB = q("[data-state='b']"), firmB = q("[data-firm='b']");

    floorA.setAttribute("y1", y(FLOOR_A)); floorA.setAttribute("y2", y(FLOOR_A));
    labA.setAttribute("x", 616); labA.setAttribute("y", y(FLOOR_A) + 18); labA.setAttribute("text-anchor", "end");
    labB.setAttribute("text-anchor", "end");

    const captions = [
      "You open a $100,000 evaluation. Both firms allow a 6% drawdown, so both floors start at $94,000.",
      "Your trade runs to +$800. Firm B's floor rises with it, to $94,800.",
      "You close the trade at breakeven. Firm A's floor is still $94,000. Firm B's stays at $94,800, so you now have $800 less room without having lost a cent.",
      "Over the next few days the account drifts lower.",
      "A rough week takes equity to $94,500. At Firm A you're still trading, with $500 to spare. At Firm B the account is over.",
    ];
    let lastCaption = -1;

    const render = (s) => {
      s = Math.max(0, Math.min(4, s));
      const upto = pts.filter((p) => p.s <= s);
      if (!upto.length) upto.push(pts[0]);
      const cur = upto[upto.length - 1];
      let peak = START, breached = false;
      const floorPts = [];
      upto.forEach((p) => {
        peak = Math.max(peak, p.v);
        floorPts.push(`${p.x.toFixed(1)},${y(peak - LIMIT).toFixed(1)}`);
        if (p.v < peak - LIMIT) breached = true;
      });
      eq.setAttribute("points", upto.map((p) => `${p.x.toFixed(1)},${y(p.v).toFixed(1)}`).join(" "));
      floorB.setAttribute("points", `${X0},${y(FLOOR_A).toFixed(1)} ${floorPts.join(" ")} ${X1},${y(peak - LIMIT).toFixed(1)}`);
      now.setAttribute("cx", cur.x); now.setAttribute("cy", y(cur.v));
      labB.setAttribute("x", 616); labB.setAttribute("y", y(peak - LIMIT) - 8);

      roomA.textContent = money(Math.max(0, cur.v - FLOOR_A));
      roomB.textContent = breached ? "$0" : money(Math.max(0, cur.v - (peak - LIMIT)));
      stateA.textContent = "Still trading";
      stateB.textContent = breached ? "Account ended" : "Still trading";
      stateB.className = "firm-state " + (breached ? "out" : "ok");
      firmB.classList.toggle("dead", breached);
      svg.classList.toggle("breach", breached);

      const c = s >= 3.75 ? 4 : Math.min(3, Math.floor(s + 0.25));
      if (c !== lastCaption) { caption.textContent = captions[c]; lastCaption = c; }
    };

    let raf = 0, playing = false;
    const stop = () => { playing = false; cancelAnimationFrame(raf); playBtn.classList.remove("playing"); };
    const play = () => {
      if (playing) { stop(); return; }
      let s = parseFloat(scrub.value);
      if (s >= 3.99) s = 0;
      playing = true; playBtn.classList.add("playing");
      let last = performance.now();
      const tick = (t) => {
        if (!playing) return;
        const dt = Math.max(0, Math.min((t - last) / 1000, 0.1)); last = t;
        // Slow down at each story beat so the caption can be read
        const nearBeat = Math.abs(s - Math.round(s)) < 0.03 && s > 0.05;
        s = Math.min(4, s + dt * (nearBeat ? 0.05 : 0.4));
        scrub.value = s; render(s);
        if (s >= 4) { stop(); return; }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    scrub.addEventListener("input", () => { stop(); render(parseFloat(scrub.value)); });
    playBtn.addEventListener("click", play);
    render(0);

    // Play once, the first time the chart scrolls into view
    if (!reduced && "IntersectionObserver" in window) {
      const once = new IntersectionObserver(([e]) => {
        if (e.isIntersecting) { once.disconnect(); setTimeout(play, 600); }
      }, { threshold: 0.6 });
      once.observe(svg);
    } else {
      scrub.value = 4; render(4);
    }
  }

  /* ---------- Waitlist ---------- */
  const form = document.querySelector("[data-wait]");
  if (form) {
    const msg = form.querySelector("[data-msg]");
    const btn = form.querySelector("button[type=submit]");
    const say = (text, kind) => { msg.textContent = text; msg.className = "form-msg " + kind; };
    const params = new URLSearchParams(location.search);
    if (params.get("joined") === "1") say("You're on the list. We'll email you when MyPropBuddy opens.", "ok");
    if (params.get("joined") === "0") say("That email address doesn't look right. Try again.", "err");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = form.email.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        say("Enter a valid email address, like you@example.com.", "err");
        form.email.focus();
        return;
      }
      btn.disabled = true; say("Adding you…", "");
      try {
        const res = await fetch(form.action, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ email, trades: form.trades.value, website: form.website.value }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) { say("You're on the list. We'll email you when MyPropBuddy opens.", "ok"); form.reset(); }
        else say(data.error || "That didn't go through. Try again in a minute.", "err");
      } catch {
        say("No connection. Check your internet and try again.", "err");
      } finally {
        btn.disabled = false;
      }
    });
  }
})();
