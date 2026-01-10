(() => {
  const root = document.documentElement;

  /* ----------------------------
     Star burst logic
  ---------------------------- */
  const glyphs = ["✦", "✧", "✹", "✷", "✸", "✺", "⋆", "✴︎"];

  function burstAt(x, y) {
    const count = 10;

    for (let i = 0; i < count; i++) {
      const s = document.createElement("div");
      s.className = "starburst";
      s.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];

      const angle = Math.random() * Math.PI * 2;
      const dist = 18 + Math.random() * 26;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;

      s.style.left = `${x}px`;
      s.style.top = `${y}px`;
      s.style.setProperty("--dx", `${dx}px`);
      s.style.setProperty("--dy", `${dy}px`);

      document.body.appendChild(s);
      setTimeout(() => s.remove(), 480);
    }
  }

  /* ----------------------------
     Global click handler
     (links + buttons only)
  ---------------------------- */
  document.addEventListener("click", (e) => {
    const target = e.target.closest("a, button");
    if (!target) return;
    if (target.disabled) return;
    burstAt(e.clientX, e.clientY);
  });

  /* ----------------------------
     Site tint switcher (green/red/blue)
     - reads buttons with [data-tint="r,g,b"]
     - sets CSS variable: --tint-rgb
     - persists in localStorage
  ---------------------------- */
  const TINT_KEY = "mooniform_tint_rgb";

  function applyTint(rgbString) {
    // expects "r,g,b" (no spaces required)
    if (!rgbString || typeof rgbString !== "string") return;
    root.style.setProperty("--tint-rgb", rgbString);
    localStorage.setItem(TINT_KEY, rgbString);
  }

  // Apply saved tint on load
  const savedTint = localStorage.getItem(TINT_KEY);
  if (savedTint) applyTint(savedTint);

  // Wire tint dots
  const tintButtons = document.querySelectorAll("[data-tint]");
  tintButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const rgb = btn.getAttribute("data-tint");
      applyTint(rgb);
    });
  });

  /* ----------------------------
     Upcoming Shows (Google Sheets CSV)
  ---------------------------- */
  const SHOWS_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vSZlY9VQvWzOIfjnYQGtV5OE-I3xljjvpDFI59hKN8iF1u5BPgtfdF5THc6Wt0K4L0jgFXK4TUSqVZX/pub?gid=0&single=true&output=csv";

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
          date: iDate >= 0 ? (r[iDate] || "") : "",
          venue: iVenue >= 0 ? (r[iVenue] || "") : "",
          city: iCity >= 0 ? (r[iCity] || "") : "",
          url: iUrl >= 0 ? (r[iUrl] || "") : "",
        }))
        .filter((s) => s.date || s.venue || s.city);

      // Sort by parseable date; unknown dates last
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
          const pretty = !isNaN(d) ? fmt.format(new Date(d)) : (s.date || "TBD");

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

  loadShowsFromSheet();

  /* ----------------------------
     Booking form (Formspree) — no redirect
     Replaces submit button with success message box
  ---------------------------- */
  function setupBookingForm() {
    const form = document.getElementById("bookingForm");
    if (!form) return;

    const submitWrap =
      form.querySelector(".booking-submit") || form.querySelector("button")?.parentElement;

    const submitBtn = form.querySelector('button[type="submit"]');
    if (!submitBtn) return;

    // Make sure we don't double-bind if you hot reload
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

        // Success UI: swap button area for your message
        const box = document.createElement("div");
        box.className = "booking-success";
        box.textContent = "Thanks, we've received your request!";

        if (submitWrap) {
          submitWrap.replaceWith(box);
        } else {
          // fallback: replace button itself
          submitBtn.replaceWith(box);
        }

        // optional: clear inputs, keep it feeling clean
        form.reset();
      } catch (err) {
        // Restore button
        submitBtn.disabled = false;
        submitBtn.textContent = "send";

        // inline error (subtle)
        const msg = document.createElement("span");
        msg.className = "booking-error";
        msg.textContent = "Hmm—something went wrong. Try again?";

        (submitWrap || submitBtn.parentElement || form).appendChild(msg);
      }
    });
  }

  setupBookingForm();
})();