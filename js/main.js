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

  // IMPORTANT: This must be restricted in Google Cloud:
  // - Application restriction: HTTP referrers -> https://mooniform.rocks/*
  // - API restriction: Google Calendar API only
  const G_API_KEY = "AIzaSyDiX3TZXSmNuaecuunXHBOJ43SJKpgHjKE";

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

  // Make it accessible to other modules (availability checker)
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
    // Apply saved tint on load (desktop only visually; CSS hides grain+tint on mobile)
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
        el.innerHTML = `<li><div class="show-meta">no shows posted yet.</div></li>`;
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

      // UI: disable while sending
      submitBtn.disabled = true;
      submitBtn.textContent = "sending…";

      // clear any previous error
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

        if (submitWrap) {
          submitWrap.replaceWith(box);
        } else {
          submitBtn.replaceWith(box);
        }

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
     Expects elements:
       #availDate, #availCheck, #availResult
  ========================================================= */

  function setupAvailabilityUI() {
    const dateEl = document.getElementById("availDate");
    const btnEl = document.getElementById("availCheck");
    const outEl = document.getElementById("availResult");

    // If you haven’t added the availability block to HTML yet,
    // this simply does nothing (no errors).
    if (!dateEl || !btnEl || !outEl) return;

    const pad = (n) => String(n).padStart(2, "0");
    const today = new Date();
    const min = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
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

  // DST-safe: interpret the selected date in the user's local time,
  // then query a full "local day" window.
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
    console.log("Avail debug", { val, timeMin, timeMax, items: data.items });
    const items = Array.isArray(data.items) ? data.items : [];

    // Only treat real blocking events as "booked"
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
      // keep the site’s click vibe consistent
      burstAt(e.clientX, e.clientY);
      check();
    });

    dateEl.addEventListener("change", check);
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();