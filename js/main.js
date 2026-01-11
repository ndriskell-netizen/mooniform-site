(() => {
  const root = document.documentElement;

  /* =========================================================
     CONFIG
  ========================================================= */

  // Shows CSV (Google Sheets published as CSV)
  const SHOWS_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vSZlY9VQvWzOIfjnYQGtV5OE-I3xljjvpDFI59hKN8iF1u5BPgtfdF5THc6Wt0K4L0jgFXK4TUSqVZX/pub?gid=0&single=true&output=csv";

  // Calendar blackout checker
  const G_CALENDAR_ID =
    "4c024075375282e8ba364d46931032db5770ed1439d8474fd6de3a3fb1dcd50a@group.calendar.google.com";

  // IMPORTANT: Restrict in Google Cloud:
  // - Application restriction: HTTP referrers -> https://mooniform.rocks/*
  // - API restriction: Google Calendar API only
  const G_API_KEY = "AIzaSyDiX3TZXSmNuaecuunXHBOJ43SJKpgHjKE";

  // Mini-player: self-hosted playlist
  const TRACKS = [
    {
      title: "Mooniform — Mole Sauce (Web Exclusive)",
      src: "assets/audio/mooniform-mole_sauce.mp3",
    },
    // { title: "Mooniform — Dinosaur Tom", src: "assets/audio/mooniform-dinosaur-tom.mp3" },
    // { title: "Mooniform — Wave", src: "assets/audio/mooniform-wave.mp3" },
  ];

  /* =========================================================
     STARBURST
  ========================================================= */

  const glyphs = ["✦", "✧", "✹", "✷", "✸", "✺", "⋆", "✴︎"];

  function burstAt(x, y) {
    const count = 10;

    for (let i = 0; i < count; i++) {
      const s = document.createElement("div");
      s.className = "starburst";
      s.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];

      const angle = Math.random() * Math.PI * 2;
      const dist = 18 + Math.random() * 26;

      s.style.left = `${x}px`;
      s.style.top = `${y}px`;
      s.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
      s.style.setProperty("--dy", `${Math.sin(angle) * dist}px`);

      document.body.appendChild(s);
      setTimeout(() => s.remove(), 480);
    }
  }

  // Make it accessible to other modules
  window.mooniformBurstAt = burstAt;

  function setupStarbursts() {
    document.addEventListener("click", (e) => {
      const target = e.target.closest("a, button");
      if (!target) return;
      if (target.disabled) return;

      burstAt(e.clientX, e.clientY);
    });
  }

  /* =========================================================
     SITE TINT SWITCHER (green/red/blue)
  ========================================================= */

  const TINT_KEY = "mooniform_tint_rgb";

  function applyTint(rgbString) {
    if (!rgbString || typeof rgbString !== "string") return;
    root.style.setProperty("--tint-rgb", rgbString);
    localStorage.setItem(TINT_KEY, rgbString);
  }

  function setupTintSwitcher() {
    const savedTint = localStorage.getItem(TINT_KEY);
    if (savedTint) applyTint(savedTint);

    const tintButtons = document.querySelectorAll("[data-tint]");
    tintButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const rgb = btn.getAttribute("data-tint");
        applyTint(rgb);
      });
    });
  }

  /* =========================================================
     UPCOMING SHOWS (Google Sheets CSV)
  ========================================================= */

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];

      if (c === '"' && inQuotes && next === '"') {
        cur += '"';
        i++;
        continue;
      }
      if (c === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (c === "," && !inQuotes) {
        row.push(cur.trim());
        cur = "";
        continue;
      }
      if ((c === "\n" || c === "\r") && !inQuotes) {
        if (cur.length || row.length) row.push(cur.trim());
        cur = "";
        if (row.some((v) => v.length)) rows.push(row);
        row = [];
        continue;
      }
      cur += c;
    }

    if (cur.length || row.length) row.push(cur.trim());
    if (row.some((v) => v.length)) rows.push(row);

    return rows;
  }

  async function loadShowsFromSheet() {
    const el = document.getElementById("showsList");
    if (!el) return;

    el.innerHTML = `<li class="show-meta">loading…</li>`;

    try {
      const res = await fetch(SHOWS_CSV_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("Fetch failed");

      const csv = await res.text();
      const rows = parseCSV(csv);

      if (rows.length < 2) {
        el.innerHTML = `<li><div class="show-meta">no shows currently posted.</div></li>`;
        return;
      }

      const headers = rows[0].map((h) => h.toLowerCase());
      const idx = (name) => headers.indexOf(name);

      const iDate = idx("date");
      const iVenue = idx("venue");
      const iCity = idx("city");
      const iUrl = idx("url");

      const shows = rows
        .slice(1)
        .map((r) => ({
          date: iDate >= 0 ? r[iDate] || "" : "",
          venue: iVenue >= 0 ? r[iVenue] || "" : "",
          city: iCity >= 0 ? r[iCity] || "" : "",
          url: iUrl >= 0 ? r[iUrl] || "" : "",
        }))
        .filter((s) => s.date || s.venue || s.city);

      shows.sort((a, b) => {
        const ad = Date.parse(a.date + "T12:00:00");
        const bd = Date.parse(b.date + "T12:00:00");
        const aValid = !isNaN(ad);
        const bValid = !isNaN(bd);
        if (aValid && bValid) return ad - bd;
        if (aValid) return -1;
        if (bValid) return 1;
        return 0;
      });

      const fmt = new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      el.innerHTML = shows
        .map((s) => {
          const d = Date.parse(s.date + "T12:00:00");
          const pretty = !isNaN(d) ? fmt.format(new Date(d)) : s.date || "TBD";

          const venue = s.venue || "TBD";
          const city = s.city ? ` — ${s.city}` : "";

          const details =
            s.url && s.url.trim()
              ? `<a href="${s.url}" target="_blank" rel="noopener noreferrer">details</a>`
              : "";

          return `
            <li class="show">
              <div class="show-line">${pretty} — ${venue}${city}</div>
              <div class="show-meta">${details}</div>
            </li>
          `;
        })
        .join("");
    } catch (e) {
      el.innerHTML = `<li><div class="show-meta">shows feed unavailable.</div></li>`;
    }
  }

  /* =========================================================
     BOOKING FORM (Formspree) — NO REDIRECT
  ========================================================= */

  function setupBookingForm() {
    const form = document.getElementById("bookingForm");
    if (!form) return;

    const submitWrap =
      form.querySelector(".booking-submit") ||
      document.getElementById("bookingSubmit") ||
      form.querySelector('button[type="submit"]')?.parentElement;

    const submitBtn = form.querySelector('button[type="submit"]');
    if (!submitBtn) return;

    if (form.dataset.bound === "1") return;
    form.dataset.bound = "1";

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      submitBtn.disabled = true;
      submitBtn.textContent = "sending…";

      const oldErr = form.querySelector(".booking-error");
      if (oldErr) oldErr.remove();

      try {
        const formData = new FormData(form);

        const res = await fetch(form.action, {
          method: "POST",
          body: formData,
          headers: { Accept: "application/json" },
        });

        if (!res.ok) throw new Error("Form submit failed");

        const box = document.createElement("div");
        box.className = "booking-success";
        box.textContent = "Thanks, we've received your request!";

        if (submitWrap) submitWrap.replaceWith(box);
        else submitBtn.replaceWith(box);

        form.reset();
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = "send";

        const msg = document.createElement("span");
        msg.className = "booking-error";
        msg.textContent = "Hmm—something went wrong. Try again?";

        (submitWrap || submitBtn.parentElement || form).appendChild(msg);
      }
    });
  }

  /* =========================================================
     AVAILABILITY CHECKER (Google Calendar)
  ========================================================= */

  function setupAvailabilityUI() {
    const dateEl = document.getElementById("availDate");
    const btnEl = document.getElementById("availCheck");
    const outEl = document.getElementById("availResult");
    if (!dateEl || !btnEl || !outEl) return;

    const pad = (n) => String(n).padStart(2, "0");
    const today = new Date();
    const min = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(
      today.getDate()
    )}`;
    dateEl.min = min;

    const render = (html) => (outEl.innerHTML = html);

    async function check() {
      const val = dateEl.value;

      if (!val) {
        render(`<span class="ok">pick a date first.</span>`);
        return;
      }

      if (!G_API_KEY) {
        render(`<span class="no">availability checker isn’t configured yet.</span>`);
        return;
      }

      const startLocal = new Date(`${val}T00:00:00`);
      const endLocal = new Date(`${val}T00:00:00`);
      endLocal.setDate(endLocal.getDate() + 1);

      const timeMin = startLocal.toISOString();
      const timeMax = endLocal.toISOString();

      render(`<span class="ok">checking…</span>`);

      try {
        const url =
          `https://www.googleapis.com/calendar/v3/calendars/` +
          encodeURIComponent(G_CALENDAR_ID) +
          `/events?key=${encodeURIComponent(G_API_KEY)}` +
          `&timeMin=${encodeURIComponent(timeMin)}` +
          `&timeMax=${encodeURIComponent(timeMax)}` +
          `&timeZone=${encodeURIComponent("America/Chicago")}` +
          `&singleEvents=true&orderBy=startTime&maxResults=50`;

        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error("Calendar fetch failed");

        const data = await res.json();
        const items = Array.isArray(data.items) ? data.items : [];

        const blocking = items.filter(
          (ev) => ev.status !== "cancelled" && ev.transparency !== "transparent"
        );

        if (blocking.length === 0) {
          render(`<span class="ok">looks open on that date.</span>`);
        } else {
          render(`<span class="no">that date appears blacked out.</span>`);
        }
      } catch (err) {
        render(`<span class="no">couldn’t check availability right now.</span>`);
      }
    }

    btnEl.addEventListener("click", (e) => {
      burstAt(e.clientX, e.clientY);
      check();
    });

    dateEl.addEventListener("change", check);
  }

  /* =========================================================
     MINI PLAYER DOCK (desktop + mobile)
     Expects elements:
       #playerDock, #playerClose, #playerAudio
       #playerTrack (title text)
       #playerPrev, #playerPlay, #playerNext
       #playerMenu (hamburger/caret)
       #playerBar (scrub target)
       #playerTray, #playerTrackList (tray + list container)
     Progress uses CSS var --p on #playerDock (0..100).
  ========================================================= */

  function setupMiniPlayerDock() {
  const dock = document.getElementById("playerDock");
  if (!dock) return;

  const audio = document.getElementById("playerAudio");
  const titleEl = document.getElementById("playerTrack");

  const prevBtn = document.getElementById("playerPrev");
  const playBtn = document.getElementById("playerPlay");
  const nextBtn = document.getElementById("playerNext");

  const bar = document.getElementById("playerBar");

  // Desktop-only controls (CSS hides them on mobile)
  const closeBtn = document.getElementById("playerClose");
  const menuBtn = document.getElementById("playerMenu");
  const tray = document.getElementById("playerTray");
  const listEl = document.getElementById("playerTrackList");

  if (!audio || !titleEl || !prevBtn || !playBtn || !nextBtn || !bar) return;

  const DOCK_KEY = "mooniform_player_dock_hidden";
  const TRACK_KEY = "mooniform_player_track_index";

  const isMobile = () => window.matchMedia("(max-width: 768px)").matches;

  // Restore hidden state
  if (localStorage.getItem(DOCK_KEY) === "1") {
    dock.style.display = "none";
    return;
  }

  if (!Array.isArray(TRACKS) || TRACKS.length === 0) {
    titleEl.textContent = "no tracks configured.";
    prevBtn.disabled = true;
    playBtn.disabled = true;
    nextBtn.disabled = true;
    if (menuBtn) menuBtn.disabled = true;
    if (closeBtn) closeBtn.disabled = true;
    return;
  }

  // ---- state ----
  let idx = (() => {
    const saved = Number(localStorage.getItem(TRACK_KEY));
    if (Number.isFinite(saved) && saved >= 0 && saved < TRACKS.length) return saved;
    return Math.floor(Math.random() * TRACKS.length);
  })();

  // ---- progress helpers ----
  function setProgressPct(pct) {
    const clamped = Math.max(0, Math.min(100, pct));
    dock.style.setProperty("--p", clamped);
    bar.setAttribute("aria-valuenow", String(Math.round(clamped)));
  }

  function updateProgress() {
    const dur = audio.duration;
    if (!dur || !isFinite(dur) || dur <= 0) {
      setProgressPct(0);
      return;
    }
    setProgressPct((audio.currentTime / dur) * 100);
  }

  audio.addEventListener("loadedmetadata", updateProgress);
  audio.addEventListener("durationchange", updateProgress);
  audio.addEventListener("timeupdate", updateProgress);

  // ---- playing state / UI sync ----
  function setPlayingUI(isPlaying) {
    dock.classList.toggle("is-playing", !!isPlaying);
    playBtn.setAttribute("aria-pressed", isPlaying ? "true" : "false");
    playBtn.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
  }

  audio.addEventListener("play", () => setPlayingUI(true));
  audio.addEventListener("pause", () => setPlayingUI(false));

  // =========================================================
  // Marquee (matches your CSS: .player-track > .track-marquee)
  // - JS adds .is-marquee to #playerTrack when overset
  // - JS sets --marquee-dist (px) and --marquee-dur (time string, e.g. "10s")
  // =========================================================
  function ensureMarqueeSpan() {
    let span = titleEl.querySelector(".track-marquee");
    if (!span) {
      span = document.createElement("span");
      span.className = "track-marquee";
      // move any existing text into span
      const existing = titleEl.textContent || "";
      titleEl.textContent = "";
      span.textContent = existing;
      titleEl.appendChild(span);
    }
    return span;
  }

  function applyMarquee() {
    const span = ensureMarqueeSpan();

    // reset
    titleEl.classList.remove("is-marquee");
    titleEl.style.removeProperty("--marquee-dist");
    titleEl.style.removeProperty("--marquee-dur");

    // measure after layout settles
    requestAnimationFrame(() => {
      const overflow = span.scrollWidth - titleEl.clientWidth;
      if (overflow <= 8) return;

      // Distance should match how far we need to translate left (plus a little breathing room)
      const dist = overflow + 28; // aligns with your padding-right: 28px

      // Duration: tune for readability; longer titles scroll longer but capped
      const ms = Math.max(7000, Math.min(20000, dist * 28));
      const dur = `${Math.round(ms / 100) / 10}s`; // e.g. "9.6s"

      titleEl.style.setProperty("--marquee-dist", `${dist}px`);
      titleEl.style.setProperty("--marquee-dur", dur);
      titleEl.classList.add("is-marquee");
    });
  }

  // ---- desktop tray helpers (tray exists only on desktop) ----
  function escapeHTML(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function renderTrackList() {
    if (!listEl) return;

    // CSS expects `.track-item` inside `.player-tray-inner`
    listEl.innerHTML = TRACKS.map((t, i) => {
      const isCurrent = i === idx;
      const cls = `track-item${isCurrent ? " is-current" : ""}`;
      return `<button type="button" class="${cls}" data-track-index="${i}">
        <span>${escapeHTML(t.title)}</span>
      </button>`;
    }).join("");

    listEl.querySelectorAll("[data-track-index]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const i = Number(btn.getAttribute("data-track-index"));
        if (!Number.isFinite(i)) return;

        const shouldAutoplay = !audio.paused;
        load(i, { autoplay: shouldAutoplay });

        // Desktop: collapse after selection
        setTrayOpen(false);

        if (window.mooniformBurstAt) window.mooniformBurstAt(e.clientX, e.clientY);

        if (shouldAutoplay) {
          try { await audio.play(); } catch (_) {}
        }
      });
    });
  }

  function setTrayOpen(open) {
    // Mobile has no tray; keep this inert there
    if (isMobile()) {
      dock.classList.remove("is-tray-open");
      if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
      if (tray) tray.setAttribute("aria-hidden", "true");
      return;
    }

    const isOpen = !!open;
    dock.classList.toggle("is-tray-open", isOpen);

    if (menuBtn) menuBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    if (tray) tray.setAttribute("aria-hidden", isOpen ? "false" : "true");

    if (isOpen) {
      renderTrackList();
      const current = listEl?.querySelector(".track-item.is-current");
      current?.scrollIntoView({ block: "nearest" });
    }
  }

  // ---- load / navigation ----
  function load(i, { autoplay = false } = {}) {
    idx = (i + TRACKS.length) % TRACKS.length;
    localStorage.setItem(TRACK_KEY, String(idx));

    const t = TRACKS[idx];

    // Put title into the marquee span
    const span = ensureMarqueeSpan();
    span.textContent = t.title;

    audio.src = t.src;
    audio.load();
    setProgressPct(0);

    // Desktop list highlight update
    if (!isMobile()) renderTrackList();

    applyMarquee();

    if (autoplay) audio.play().catch(() => {});
  }

  function prev() { load(idx - 1, { autoplay: !audio.paused }); }
  function next() { load(idx + 1, { autoplay: !audio.paused }); }

  // Start paused (autoplay-safe)
  setPlayingUI(false);
  load(idx, { autoplay: false });

  audio.addEventListener("ended", () => {
    setProgressPct(0);
    next();
  });

  // ---- transport ----
  playBtn.addEventListener("click", async (e) => {
    if (window.mooniformBurstAt) window.mooniformBurstAt(e.clientX, e.clientY);

    if (audio.paused) {
      try { await audio.play(); } catch (_) {}
    } else {
      audio.pause();
    }
  });

  prevBtn.addEventListener("click", (e) => {
    if (window.mooniformBurstAt) window.mooniformBurstAt(e.clientX, e.clientY);
    prev();
  });

  nextBtn.addEventListener("click", (e) => {
    if (window.mooniformBurstAt) window.mooniformBurstAt(e.clientX, e.clientY);
    next();
  });

  // ---- tray wiring (desktop only; elements exist but are hidden on mobile) ----
  if (menuBtn && tray && listEl) {
    menuBtn.setAttribute("aria-expanded", "false");
    tray.setAttribute("aria-hidden", "true");

    menuBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (window.mooniformBurstAt) window.mooniformBurstAt(e.clientX, e.clientY);
      if (isMobile()) return;
      setTrayOpen(!dock.classList.contains("is-tray-open"));
    });

    // Close when clicking outside the dock (desktop only)
    document.addEventListener("mousedown", (e) => {
      if (isMobile()) return;
      if (!dock.classList.contains("is-tray-open")) return;
      if (dock.contains(e.target)) return;
      setTrayOpen(false);
    });

    // Esc closes
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!dock.classList.contains("is-tray-open")) return;
      setTrayOpen(false);
    });
  }

  // ---- ensure behavior is correct when crossing breakpoint ----
  const mq = window.matchMedia("(max-width: 768px)");
  const syncViewport = () => {
    // Always close tray on mode change
    setTrayOpen(false);

    // Keep marquee correct after resize
    applyMarquee();
  };
  mq.addEventListener?.("change", syncViewport);
  window.addEventListener("resize", () => applyMarquee(), { passive: true });

  // ---- scrubbing ----
  function seekFromClientX(clientX) {
    const dur = audio.duration;
    if (!dur || !isFinite(dur) || dur <= 0) return;

    const rect = bar.getBoundingClientRect();
    const x = clientX - rect.left;
    const t = Math.max(0, Math.min(1, x / rect.width));

    audio.currentTime = t * dur;
    updateProgress();
  }

  bar.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    seekFromClientX(e.clientX);
    if (window.mooniformBurstAt) window.mooniformBurstAt(e.clientX, e.clientY);
  });

  let scrubbing = false;

  function startScrub(clientX) {
    scrubbing = true;
    seekFromClientX(clientX);
  }
  function moveScrub(clientX) {
    if (!scrubbing) return;
    seekFromClientX(clientX);
  }
  function endScrub() { scrubbing = false; }

  bar.addEventListener("mousedown", (e) => {
    e.preventDefault();
    startScrub(e.clientX);
  });

  window.addEventListener("mousemove", (e) => moveScrub(e.clientX));
  window.addEventListener("mouseup", endScrub);

  bar.addEventListener(
    "touchstart",
    (e) => {
      if (!e.touches?.length) return;
      e.preventDefault();
      startScrub(e.touches[0].clientX);
    },
    { passive: false }
  );

  window.addEventListener(
    "touchmove",
    (e) => {
      if (!scrubbing || !e.touches?.length) return;
      e.preventDefault();
      moveScrub(e.touches[0].clientX);
    },
    { passive: false }
  );

  window.addEventListener("touchend", endScrub);

  // ---- close/dismiss dock (desktop only; hidden on mobile by CSS) ----
  if (closeBtn) {
    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (window.mooniformBurstAt) window.mooniformBurstAt(e.clientX, e.clientY);

      dock.style.display = "none";
      localStorage.setItem(DOCK_KEY, "1");

      try { audio.pause(); } catch (_) {}
    });
  }
}

function setupFooterCopyright() {
  const el = document.getElementById("copyright");
  if (!el) return;

  const year = new Date().getFullYear();
  el.textContent = `© ${year} Mooniform. All rights reserved.`;
}

  /* =========================================================
     INIT (once DOM exists)
  ========================================================= */

  function init() {
    setupStarbursts();
    setupTintSwitcher();
    loadShowsFromSheet();
    setupBookingForm();
    setupAvailabilityUI();
    setupMiniPlayerDock();
    setupFooterCopyright();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

const yearEl = document.getElementById("copyrightYear");
if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}