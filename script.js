/* =========================================================
   Atharva Zaveri — portfolio
   API contract (projects / experience / hackathons / skills /
   photo / resume / contact / visit) is unchanged, so the admin
   panel keeps working exactly as before.
   ========================================================= */

// ── Security helpers ──────────────────────────────
/** Escape HTML special characters to prevent XSS in innerHTML. */
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/** Allow only http/https/relative/# URLs to prevent javascript: injection. */
function safeUrl(url) {
  if (!url) return "#";
  const u = String(url).trim();
  if (/^https?:\/\//i.test(u) || u.startsWith("/") || u.startsWith("#"))
    return u;
  return "#";
}

/** Safe URL for img src — also allows data:image/ URIs (base64 uploads). */
function safeImgSrc(url) {
  if (!url) return "";
  const u = String(url).trim();
  if (/^https?:\/\//i.test(u) || u.startsWith("/") || /^data:image\//i.test(u))
    return u;
  return "";
}

// ── API base ──────────────────────────────────────
function apiBase() {
  return window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:8000/api"
    : window.location.origin + "/api";
}

function resumeUrl() {
  return `${apiBase()}/resume/AtharvaZ`;
}

// ── Theme ─────────────────────────────────────────
const initTheme = () => {
  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark-mode");
  }
  syncThemeToggle();
};

function syncThemeToggle() {
  const toggle = document.querySelector("#theme-toggle");
  if (!toggle) return;
  const isDark = document.body.classList.contains("dark-mode");
  const label = toggle.querySelector(".ink-toggle__label");
  if (label) label.textContent = isDark ? "Ink" : "Paper";
  toggle.setAttribute(
    "aria-label",
    isDark ? "Switch to light paper" : "Switch to dark paper",
  );
}

function toggleTheme() {
  document.body.classList.toggle("dark-mode");
  localStorage.setItem(
    "theme",
    document.body.classList.contains("dark-mode") ? "dark" : "light",
  );
  syncThemeToggle();
}

initTheme();

const themeToggle = document.querySelector("#theme-toggle");
if (themeToggle) {
  themeToggle.addEventListener("click", (e) => {
    e.preventDefault();
    toggleTheme();
  });
}

// ── Mobile menu ───────────────────────────────────
const menuToggle = document.querySelector(".menu-toggle");
const navLinksEl = document.querySelector(".nav-links");

if (menuToggle && navLinksEl) {
  const setMenu = (open) => {
    navLinksEl.classList.toggle("open", open);
    menuToggle.setAttribute("aria-expanded", String(open));
  };

  menuToggle.addEventListener("click", () =>
    setMenu(!navLinksEl.classList.contains("open")),
  );

  document
    .querySelectorAll(".nav-link")
    .forEach((link) => link.addEventListener("click", () => setMenu(false)));

  window.addEventListener("resize", () => {
    if (window.innerWidth > 780) setMenu(false);
  });

  document.addEventListener("click", (e) => {
    if (
      navLinksEl.classList.contains("open") &&
      !navLinksEl.contains(e.target) &&
      !menuToggle.contains(e.target)
    ) {
      setMenu(false);
    }
  });
}

// ── Quick actions palette (the signature) ──────────
// Everything in here is also reachable by mouse elsewhere on the
// page, so ignoring it costs a visitor nothing.
const palette = document.getElementById("palette");
const paletteInput = document.getElementById("palette-input");
const paletteList = document.getElementById("palette-list");
const paletteEmpty = document.getElementById("palette-empty");
const paletteOpenBtn = document.getElementById("palette-open");

const EMAIL = "atharvazaveri4@gmail.com";

const PALETTE_ACTIONS = [
  {
    label: "About",
    kind: "Section",
    icon: "fa-solid fa-user",
    go: "#about",
    key: "1",
  },
  {
    label: "Experience",
    kind: "Section",
    icon: "fa-solid fa-briefcase",
    go: "#experience",
    key: "2",
  },
  {
    label: "Projects",
    kind: "Section",
    icon: "fa-solid fa-folder-open",
    go: "#projects",
    key: "3",
  },
  {
    label: "Tech Stack",
    kind: "Section",
    icon: "fa-solid fa-layer-group",
    go: "#skills",
    key: "4",
  },
  {
    label: "Contact",
    kind: "Section",
    icon: "fa-solid fa-envelope",
    go: "#contact",
    key: "5",
  },
  {
    label: "Open GitHub",
    kind: "Link",
    icon: "fa-brands fa-github",
    href: "https://github.com/AtharvaZ",
  },
  {
    label: "Open LinkedIn",
    kind: "Link",
    icon: "fa-brands fa-linkedin-in",
    href: "https://www.linkedin.com/in/atharva-zaveri/",
  },
  {
    label: "Email me",
    kind: "Link",
    icon: "fa-solid fa-paper-plane",
    href: `mailto:${EMAIL}`,
  },
  { label: "View resume", kind: "File", icon: "fa-solid fa-file-lines", resume: true },
  {
    label: "Copy email address",
    kind: "Copy",
    icon: "fa-solid fa-copy",
    copy: EMAIL,
  },
  {
    label: "Toggle dark paper",
    kind: "View",
    icon: "fa-solid fa-circle-half-stroke",
    theme: true,
  },
];

let paletteMatches = [];
let paletteCursor = 0;

function renderPalette(query = "") {
  const q = query.trim().toLowerCase();
  paletteMatches = PALETTE_ACTIONS.filter(
    (a) =>
      !q ||
      a.label.toLowerCase().includes(q) ||
      a.kind.toLowerCase().includes(q),
  );
  paletteCursor = 0;

  paletteList.innerHTML = paletteMatches
    .map(
      (a, i) => `
        <li>
          <button type="button" class="palette__item" role="option"
                  data-index="${i}" aria-selected="${i === 0}">
            <i class="${a.icon}" aria-hidden="true"></i>
            <span>${escapeHtml(a.label)}</span>
            <span class="palette__kind">${escapeHtml(a.kind)}</span>
            ${a.key ? `<kbd class="palette__key">${a.key}</kbd>` : ""}
          </button>
        </li>`,
    )
    .join("");

  if (paletteEmpty) paletteEmpty.hidden = paletteMatches.length > 0;
}

function movePaletteCursor(delta) {
  if (!paletteMatches.length) return;
  paletteCursor =
    (paletteCursor + delta + paletteMatches.length) % paletteMatches.length;
  paletteList.querySelectorAll(".palette__item").forEach((el, i) => {
    const on = i === paletteCursor;
    el.setAttribute("aria-selected", String(on));
    if (on) el.scrollIntoView({ block: "nearest" });
  });
}

function runPaletteAction(action) {
  if (!action) return;
  closePalette();

  if (action.go) {
    document
      .querySelector(action.go)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  } else if (action.href) {
    if (action.href.startsWith("mailto:")) {
      window.location.href = action.href;
    } else {
      window.open(action.href, "_blank", "noopener");
    }
  } else if (action.resume) {
    window.open(resumeUrl(), "AtharvaZ_resume");
  } else if (action.copy) {
    navigator.clipboard?.writeText(action.copy).catch(() => {});
  } else if (action.theme) {
    toggleTheme();
  }
}

function openPalette() {
  if (!palette) return;
  palette.hidden = false;
  paletteInput.value = "";
  renderPalette();
  paletteInput.focus();
}

function closePalette() {
  if (palette) palette.hidden = true;
}

if (palette) {
  paletteInput.addEventListener("input", () =>
    renderPalette(paletteInput.value),
  );

  paletteInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      movePaletteCursor(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      movePaletteCursor(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      runPaletteAction(paletteMatches[paletteCursor]);
    } else if (e.key === "Escape") {
      closePalette();
    }
  });

  paletteList.addEventListener("click", (e) => {
    const btn = e.target.closest(".palette__item");
    if (btn) runPaletteAction(paletteMatches[Number(btn.dataset.index)]);
  });

  palette.addEventListener("click", (e) => {
    if (e.target.hasAttribute("data-palette-close")) closePalette();
  });
}

if (paletteOpenBtn) paletteOpenBtn.addEventListener("click", openPalette);

// ── Keyboard shortcuts ────────────────────────────
document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = (e.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || e.target.isContentEditable)
    return;

  const key = e.key.toLowerCase();

  if (key === "k" || key === "/") {
    e.preventDefault();
    openPalette();
    return;
  }
  if (key === "d") {
    toggleTheme();
    return;
  }
  if (key === "escape") {
    closePalette();
    return;
  }

  // 1-5 jump straight to a section, same as the palette's section rows.
  // The guard above already ignores this while a field is focused, so
  // typing "1" into the palette filters instead of navigating.
  const numbered = PALETTE_ACTIONS.find((a) => a.key === key && a.go);
  if (numbered) {
    e.preventDefault();
    document
      .querySelector(numbered.go)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

// ── Keys hint — shown once, then remembered as dismissed ──
const keysHint = document.getElementById("keys-hint");
const keysHintClose = document.getElementById("keys-hint-close");

if (keysHint && !localStorage.getItem("keys_hint_dismissed")) {
  setTimeout(() => {
    keysHint.hidden = false;
  }, 2600);
}

if (keysHintClose) {
  keysHintClose.addEventListener("click", () => {
    keysHint.hidden = true;
    localStorage.setItem("keys_hint_dismissed", "1");
  });
}

// ── Hero statement rotator ────────────────────────
// All three lines stay readable at all times; a single "I —" marker
// slides down to whichever one is active.
(() => {
  const list = document.getElementById("statements");
  const items = list ? [...list.querySelectorAll(".statement")] : [];
  const marker = document.getElementById("statements-marker");
  if (!items.length || !marker) return;

  let i = 0;

  // Measure against the list's own box. offsetTop would be relative to
  // the nearest positioned ancestor, which is far up the tree here.
  const placeMarker = () => {
    const top = list.getBoundingClientRect().top;
    const y = items[i].getBoundingClientRect().top - top;
    marker.style.setProperty("--marker-y", `${y}px`);
  };

  const activate = (next) => {
    items[i].classList.remove("is-active");
    i = next;
    items[i].classList.add("is-active");
    placeMarker();
  };

  // Wait for webfonts so the first measurement matches the rendered type
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(placeMarker);
  }
  placeMarker();
  window.addEventListener("resize", placeMarker);

  if (items.length < 2) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  setInterval(() => activate((i + 1) % items.length), 3000);
})();

// ── Main ──────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  // Reveal observer — one-way, so content never fades back out
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
  );

  const observeReveal = (el, index = 0) => {
    el.classList.add("scroll-reveal");
    el.style.setProperty("--reveal-delay", `${(index % 6) * 70}ms`);
    revealObserver.observe(el);
  };

  document
    .querySelectorAll(".plate__head, .plate__body, .about__plate")
    .forEach((el, i) => observeReveal(el, i));

  // API Configuration
  const API_URL = apiBase();

  // Record visit — count once per cooldown per browser
  const VISIT_COOLDOWN_MS = 2 * 60 * 60 * 1000;
  const lastVisit = parseInt(
    localStorage.getItem("portfolio_last_visit") || "0",
    10,
  );
  if (Date.now() - lastVisit > VISIT_COOLDOWN_MS) {
    localStorage.setItem("portfolio_last_visit", Date.now().toString());
    fetch(`${API_URL}/visit`, { method: "POST" }).catch(() => {});
  }

  // Profile photo — falls back to the static file
  (async () => {
    try {
      const response = await fetch(`${API_URL}/photo`);
      const data = await response.json();
      if (data.success && data.data) {
        const img = document.getElementById("about-photo-img");
        if (img) img.src = data.data;
      }
    } catch (e) {
      /* keep static fallback */
    }
  })();

  // ── Projects ────────────────────────────────────
  const getProjects = async () => {
    try {
      const response = await fetch(`${API_URL}/projects`);
      const data = await response.json();
      return data.success ? data.projects : [];
    } catch (error) {
      console.error("Error fetching projects:", error);
      return [];
    }
  };

  let allProjects = [];
  let visibleProjectCount = 0;
  const PROJECTS_PAGE_SIZE = 3;

  const appendProjectCard = (project, container, index) => {
    const card = document.createElement("article");
    card.className = "project-card";

    const links = project.links || {};
    const hasGithub = links.github && links.github !== "#" && links.github !== "";
    const hasDemo = links.demo && links.demo !== "#" && links.demo !== "";
    const tech = Array.isArray(project.tech) ? project.tech : [];
    const num = String(index + 1).padStart(2, "0");

    const imageSrc = project.image ? safeImgSrc(project.image) : "";
    if (!imageSrc) card.classList.add("project-card--no-image");

    const linksBlock = `
      <div class="project-links">
        ${
          hasGithub
            ? `<a href="${safeUrl(links.github)}" class="project-link" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-github" aria-hidden="true"></i> Code</a>`
            : ""
        }
        ${
          hasDemo
            ? `<a href="${safeUrl(links.demo)}" class="project-link" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i> Live Demo</a>`
            : ""
        }
      </div>`;

    // With a screenshot the stack sits inline under the copy. Without one,
    // it moves into the right column as a spec list — so the three-column
    // rhythm holds either way instead of leaving a gap.
    const asideBlock = imageSrc
      ? `<div class="project-card-image">
           <img src="${imageSrc}" alt="Screenshot of ${escapeHtml(project.title)}" loading="lazy" />
         </div>`
      : `<div class="project-card__aside">
           <span class="project-card__aside-label">Built with</span>
           <ul class="project-stack-list">
             ${tech.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}
           </ul>
         </div>`;

    const inlineStack = imageSrc
      ? `<div class="tech-stack">
           ${tech.map((t) => `<span class="tech-tag">${escapeHtml(t)}</span>`).join("")}
         </div>`
      : "";

    card.innerHTML = `
      <div class="project-card__grid">
        <span class="project-card__index">${num}</span>
        <div class="project-info">
          <h3>${escapeHtml(project.title)}</h3>
          <p>${escapeHtml(project.desc)}</p>
          ${inlineStack}
          ${linksBlock}
        </div>
        ${asideBlock}
      </div>`;

    container.appendChild(card);
    observeReveal(card, index);
  };

  const renderProjects = async () => {
    const projectsContainer = document.querySelector(".projects-grid");
    if (!projectsContainer) return;

    projectsContainer.innerHTML = "";
    allProjects = await getProjects();
    visibleProjectCount = 0;

    allProjects
      .slice(0, PROJECTS_PAGE_SIZE)
      .forEach((p, i) => appendProjectCard(p, projectsContainer, i));
    visibleProjectCount = Math.min(PROJECTS_PAGE_SIZE, allProjects.length);

    const showMoreBtn = document.getElementById("projects-show-more");
    if (showMoreBtn) {
      showMoreBtn.style.display =
        allProjects.length > PROJECTS_PAGE_SIZE ? "inline-flex" : "none";
    }
  };

  await renderProjects();

  // ── Work experience ─────────────────────────────
  const getFallbackExperience = () => [
    {
      role: "Software Developer",
      company: "Personal Projects",
      date_range: "2024 - Present",
      desc: "Building full-stack AI-powered products with strong focus on UX and performance.",
      tech: ["Python", "FastAPI", "JavaScript"],
      logo: "",
    },
  ];

  const getExperience = async () => {
    try {
      const response = await fetch(`${API_URL}/experience`);
      const data = await response.json();
      if (data.success && Array.isArray(data.items) && data.items.length > 0) {
        return data.items;
      }
      return getFallbackExperience();
    } catch (e) {
      return getFallbackExperience();
    }
  };

  const formatExperienceDesc = (desc) => {
    const rawLines = String(desc || "")
      .split(/(?:\r?\n|\\n)/)
      .map((line) => line.trim())
      .filter(Boolean);

    const renderAsList =
      rawLines.length > 1 || rawLines.some((line) => /^[-*•]\s+/.test(line));

    const lines = rawLines.map((line) => line.replace(/^[-*•]\s*/, ""));

    if (renderAsList) {
      return `<ul class="timeline-desc-list">${lines
        .map((line) => `<li>${escapeHtml(line)}</li>`)
        .join("")}</ul>`;
    }

    return `<p class="timeline-desc">${escapeHtml(lines[0] || "")}</p>`;
  };

  const renderExperience = async () => {
    const items = await getExperience();
    const container = document.getElementById("timeline-container");
    const section = document.getElementById("experience-work-section");
    if (!container) return;

    container.innerHTML = "";
    if (items.length === 0) {
      if (section) section.style.display = "none";
      return;
    }
    if (section) section.style.display = "";

    items.forEach((item, i) => {
      const tech = Array.isArray(item.tech) ? item.tech : [];
      const el = document.createElement("div");
      el.className = "timeline-item";
      el.innerHTML = `
        <div class="ledger__row">
          <span class="ledger__date">${escapeHtml(item.date_range)}</span>
          <div>
            <h3 class="ledger__role">${escapeHtml(item.role)}</h3>
            <p class="ledger__company">
              ${item.logo ? `<img src="${safeImgSrc(item.logo)}" alt="" class="ledger__logo">` : ""}
              ${escapeHtml(item.company)}
            </p>
          </div>
          <div>
            ${formatExperienceDesc(item.desc)}
            <div class="timeline-tags">
              ${tech.map((t) => `<span class="tech-tag">${escapeHtml(t)}</span>`).join("")}
            </div>
          </div>
        </div>`;
      container.appendChild(el);
      observeReveal(el, i);
    });
  };

  // ── Hackathons ──────────────────────────────────
  const getFallbackHackathons = () => [
    {
      name: "Hackathon Project",
      placement: "Finalist",
      date: "2024",
      desc: "Built and shipped an AI-assisted productivity tool under time constraints.",
      tech: ["React", "Node.js", "OpenAI"],
      project_link: "#",
    },
  ];

  const getHackathons = async () => {
    try {
      const response = await fetch(`${API_URL}/hackathons`);
      const data = await response.json();
      if (data.success && Array.isArray(data.items) && data.items.length > 0) {
        return data.items;
      }
      return getFallbackHackathons();
    } catch (e) {
      return getFallbackHackathons();
    }
  };

  const renderHackathons = async () => {
    const items = await getHackathons();
    const container = document.getElementById("hackathon-container");
    const section = document.getElementById("experience-hackathon-section");
    if (!container) return;

    container.innerHTML = "";
    if (items.length === 0) {
      if (section) section.style.display = "none";
      return;
    }
    if (section) section.style.display = "";

    items.forEach((item, i) => {
      const tech = Array.isArray(item.tech) ? item.tech : [];
      const el = document.createElement("div");
      el.className = "hackathon-card";
      el.innerHTML = `
        <div class="hackathon-card__meta">
          <span class="hackathon-placement">${escapeHtml(item.placement || "")}</span>
          <span class="hackathon-date">${escapeHtml(item.date || "")}</span>
        </div>
        <h3 class="hackathon-name">${escapeHtml(item.name)}</h3>
        <div class="timeline-tags">
          ${tech.map((t) => `<span class="tech-tag">${escapeHtml(t)}</span>`).join("")}
        </div>
        ${
          item.project_link
            ? `<a href="${safeUrl(item.project_link)}" target="_blank" rel="noopener" class="hack-project-link">View Project ↗</a>`
            : ""
        }`;
      container.appendChild(el);
      observeReveal(el, i);
    });
  };

  const renderExperienceSection = async () => {
    await Promise.all([renderExperience(), renderHackathons()]);
    const section = document.getElementById("experience");
    const navLink = document.querySelector('a[href="#experience"]');
    if (section) section.style.display = "";
    if (navLink) navLink.parentElement.style.display = "";
  };

  await renderExperienceSection();

  // ── Projects show more / less ───────────────────
  const showMoreBtn = document.getElementById("projects-show-more");
  const showLessBtn = document.getElementById("projects-show-less");

  if (showMoreBtn) {
    showMoreBtn.addEventListener("click", () => {
      const projectsContainer = document.querySelector(".projects-grid");
      const nextBatch = allProjects.slice(
        visibleProjectCount,
        visibleProjectCount + PROJECTS_PAGE_SIZE,
      );
      nextBatch.forEach((p, i) =>
        appendProjectCard(p, projectsContainer, visibleProjectCount + i),
      );
      visibleProjectCount += nextBatch.length;
      if (visibleProjectCount >= allProjects.length) {
        showMoreBtn.style.display = "none";
      }
      if (showLessBtn) showLessBtn.style.display = "inline-flex";
    });
  }

  if (showLessBtn) {
    showLessBtn.addEventListener("click", () => {
      const projectsContainer = document.querySelector(".projects-grid");
      [...projectsContainer.querySelectorAll(".project-card")]
        .slice(PROJECTS_PAGE_SIZE)
        .forEach((card) => card.remove());
      visibleProjectCount = PROJECTS_PAGE_SIZE;
      showLessBtn.style.display = "none";
      if (showMoreBtn) showMoreBtn.style.display = "inline-flex";
    });
  }

  // ── Resume ──────────────────────────────────────
  document.querySelectorAll("#resume-btn").forEach((link) => {
    link.removeAttribute("href");
    link.setAttribute("role", "button");
    link.setAttribute("tabindex", "0");
    link.style.cursor = "pointer";
    const open = (e) => {
      e.preventDefault();
      window.open(resumeUrl(), "AtharvaZ_resume");
    };
    link.addEventListener("click", open);
    link.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") open(e);
    });
  });

  // ── Skills ──────────────────────────────────────
  function getFallbackSkills() {
    return {
      Languages: [
        { name: "Python", icon: "devicon-python-plain colored" },
        { name: "Java", icon: "devicon-java-plain colored" },
        { name: "C++", icon: "devicon-cplusplus-plain colored" },
        { name: "C#", icon: "devicon-csharp-plain colored" },
        { name: "SQL", icon: "devicon-azuresqldatabase-plain colored" },
        { name: "HTML/CSS", icon: "devicon-html5-plain colored" },
      ],
      "Frameworks & Libraries": [
        { name: "FastAPI", icon: "devicon-fastapi-plain colored" },
        { name: "Flask", icon: "devicon-flask-original" },
        { name: "JavaFX", icon: "devicon-java-plain colored" },
        { name: "sentence-transformers", icon: "devicon-python-plain colored" },
        { name: "FAISS", img: "assets/faiss.png", extraLarge: true },
        { name: "HuggingFace", img: "assets/huggingface.png", enlarged: true },
        { name: "Tkinter", icon: "devicon-python-plain colored" },
        { name: "SQLAlchemy", icon: "devicon-sqlalchemy-plain" },
      ],
      "Tools & Technologies": [
        { name: "Git", icon: "devicon-git-plain colored" },
        { name: "Maven", icon: "devicon-maven-plain colored" },
        { name: "SQLite", icon: "devicon-sqlite-plain colored" },
        { name: "H2 Database", img: "assets/h2-database.png" },
        { name: "Claude API", img: "assets/claude.png", extraLarge: true },
        { name: "Gemini API", img: "assets/gemini.png", enlarged: true },
        { name: "Ollama", img: "assets/ollama.png" },
        { name: "Piston API", icon: "fa-solid fa-code" },
        { name: "Linux", icon: "devicon-linux-plain" },
        { name: "JUnit", icon: "devicon-junit-plain colored" },
      ],
    };
  }

  async function loadSkills() {
    try {
      const response = await fetch(`${API_URL}/skills`);
      const data = await response.json();
      if (data.success && data.skills && Object.keys(data.skills).length > 0) {
        return data.skills;
      }
      return getFallbackSkills();
    } catch (error) {
      console.error("Error loading skills from API, using fallback:", error);
      return getFallbackSkills();
    }
  }

  const skillsContainer = document.getElementById("skills-wrapper");
  if (skillsContainer) {
    loadSkills().then((techStack) => {
      skillsContainer.innerHTML = "";

      Object.entries(techStack).forEach(([category, skills], catIndex) => {
        const categorySection = document.createElement("div");
        categorySection.className = "skills-category";

        const categoryTitle = document.createElement("h3");
        categoryTitle.className = "skills-category-title";
        categoryTitle.textContent = category;
        categorySection.appendChild(categoryTitle);

        const skillsGrid = document.createElement("div");
        skillsGrid.className = "skills-grid";

        skills.forEach((skill) => {
          const skillEl = document.createElement("div");
          skillEl.className = "skill-item";

          const src = skill.image || skill.img;
          let iconContent;
          if (src) {
            const sizeClass = skill.extraLarge
              ? "extra-enlarged-icon"
              : skill.enlarged
                ? "enlarged-icon"
                : "";
            iconContent = `<img src="${safeImgSrc(src)}" alt="" class="skill-icon-img ${sizeClass}" />`;
          } else if (skill.icon) {
            const safeIcon = String(skill.icon).replace(/[^\w\s-]/g, "");
            iconContent = `<i class="${safeIcon}" aria-hidden="true"></i>`;
          } else {
            iconContent = `<i class="fa-solid fa-code" aria-hidden="true"></i>`;
          }

          skillEl.innerHTML = `${iconContent}<span>${escapeHtml(skill.name)}</span>`;
          skillsGrid.appendChild(skillEl);
        });

        categorySection.appendChild(skillsGrid);
        skillsContainer.appendChild(categorySection);
        observeReveal(categorySection, catIndex);
      });
    });
  }

  // ── Contact form ────────────────────────────────
  const contactForm = document.querySelector(".contact-form");
  if (contactForm) {
    contactForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const formData = {
        name: contactForm.querySelector('input[type="text"]').value,
        email: contactForm.querySelector('input[type="email"]').value,
        message: contactForm.querySelector("textarea").value,
      };

      const submitButton = contactForm.querySelector(".form-btn");
      const originalHTML = submitButton.innerHTML;

      submitButton.disabled = true;
      submitButton.textContent = "Sending…";
      submitButton.style.opacity = "0.6";

      const restore = () => {
        setTimeout(() => {
          submitButton.innerHTML = originalHTML;
          submitButton.style.background = "";
          submitButton.style.borderColor = "";
          submitButton.disabled = false;
          submitButton.style.opacity = "1";
        }, 3000);
      };

      try {
        const response = await fetch(`${API_URL}/contact`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          submitButton.textContent = "Message sent";
          contactForm.reset();
          restore();
        } else {
          throw new Error(data.detail || "Failed to send message");
        }
      } catch (error) {
        console.error("Error:", error);
        submitButton.textContent = "Didn't send — try again";
        submitButton.style.background = "var(--red)";
        submitButton.style.borderColor = "var(--red)";
        restore();
      }
    });
  }

  // ── Scroll spy — nav + folio rail ───────────────
  const folioNum = document.getElementById("folio-num");
  const folioName = document.getElementById("folio-name");
  const navItems = document.querySelectorAll(".nav-link");

  const sectionSpy = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const id = entry.target.getAttribute("id");
        navItems.forEach((link) =>
          link.classList.toggle(
            "active",
            link.getAttribute("href") === `#${id}`,
          ),
        );

        if (folioNum && folioName) {
          folioNum.textContent = entry.target.dataset.folio || "00";
          folioName.textContent = entry.target.dataset.name || "Cover";
        }
      });
    },
    { rootMargin: "-25% 0px -70% 0px", threshold: 0 },
  );

  document.querySelectorAll("main section").forEach((s) => sectionSpy.observe(s));
});
