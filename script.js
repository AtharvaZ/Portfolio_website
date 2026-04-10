// Theme Toggle
const initTheme = () => {
  const savedTheme = localStorage.getItem("theme");
  // Default to dark mode if no preference is saved
  if (savedTheme !== "light") {
    document.body.classList.add("dark-mode");
  }
};

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

// Initialize theme before other scripts
initTheme();

// Global reference for particle array for theme updates
let globalParticlesArray = null;

const themeToggle = document.querySelector("#theme-toggle");
if (themeToggle) {
  let themeToggleLockUntil = 0;
  const performThemeToggle = () => {
    document.body.classList.toggle("dark-mode");
    const isDark = document.body.classList.contains("dark-mode");
    localStorage.setItem("theme", isDark ? "dark" : "light");

    // Update particle colors when theme changes
    if (globalParticlesArray) {
      globalParticlesArray.forEach((particle) => particle.updateColor());
    }
  };

  themeToggle.addEventListener("click", (e) => {
    e.preventDefault();
    const now = Date.now();
    if (now < themeToggleLockUntil) return;
    themeToggleLockUntil = now + 180;
    performThemeToggle();
  });
}

// Mobile Menu Toggle
const menuToggle = document.querySelector(".menu-toggle");
const navLinks = document.querySelector(".nav-links");

if (menuToggle) {
  menuToggle.addEventListener("click", () => {
    if (window.innerWidth <= 768) {
      navLinks.classList.toggle("open");
    }
  });

  // Close menu when a link is clicked
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 768) {
        navLinks.classList.remove("open");
      }
    });
  });

  // Close menu on resize up to desktop.
  window.addEventListener("resize", () => {
    if (window.innerWidth > 768) {
      navLinks.classList.remove("open");
    }
  });

  // Close menu when tapping outside.
  document.addEventListener("click", (e) => {
    if (
      window.innerWidth <= 768 &&
      navLinks.classList.contains("open") &&
      !navLinks.contains(e.target) &&
      !menuToggle.contains(e.target)
    ) {
      navLinks.classList.remove("open");
    }
  });
}

// Hero Particles Animation - Now site-wide
const canvas = document.getElementById("site-particles");
if (canvas && !window.location.pathname.includes("admin")) {
  const ctx = canvas.getContext("2d", { alpha: true });

  // Handle high-DPI displays for crisp, round particles
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = document.documentElement.scrollHeight * dpr;
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = document.documentElement.scrollHeight + "px";
  ctx.scale(dpr, dpr);

  let particlesArray;

  class Particle {
    constructor(startAtRandomStage = false) {
      this.x = Math.random() * window.innerWidth;
      this.y = Math.random() * document.documentElement.scrollHeight;
      this.maxSize = Math.random() * 2.5 + 0.8;
      this.speedX = Math.random() * 0.2 - 0.1;
      this.speedY = Math.random() * 0.2 - 0.1;
      this.updateColor();

      if (startAtRandomStage) {
        this.size = Math.random() * this.maxSize;
        this.growing = this.size < this.maxSize * 0.5;
      } else {
        this.size = 0.1;
        this.growing = true;
      }
    }
    updateColor() {
      // Cache rgb components to avoid parsing every frame
      const isDark = document.body.classList.contains("dark-mode");
      if (isDark) {
        if (Math.random() > 0.5) {
          this.r = 16;
          this.g = 185;
          this.b = 129;
          this.a = 0.9;
        } else {
          this.r = 52;
          this.g = 211;
          this.b = 153;
          this.a = 0.85;
        }
      } else {
        if (Math.random() > 0.5) {
          this.r = 6;
          this.g = 78;
          this.b = 59;
          this.a = 0.85;
        } else {
          this.r = 5;
          this.g = 150;
          this.b = 105;
          this.a = 0.8;
        }
      }
    }
    update() {
      this.x += this.speedX;
      this.y += this.speedY;

      if (this.growing) {
        this.size += 0.015;
        if (this.size >= this.maxSize) this.growing = false;
      } else {
        this.size -= 0.005;
      }

      if (this.size <= 0.1) {
        this.x = Math.random() * window.innerWidth;
        this.y = Math.random() * document.documentElement.scrollHeight;
        this.maxSize = Math.random() * 2.5 + 0.8;
        this.size = 0.1;
        this.growing = true;
        this.updateColor();
      }
    }
    draw() {
      // Simple radial gradient, no shadowBlur (expensive)
      const gradient = ctx.createRadialGradient(
        this.x,
        this.y,
        0,
        this.x,
        this.y,
        this.size,
      );
      gradient.addColorStop(0, `rgba(${this.r},${this.g},${this.b},${this.a})`);
      gradient.addColorStop(1, `rgba(${this.r},${this.g},${this.b},0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function initParticles() {
    particlesArray = [];
    // Increase particle count for full page coverage
    for (let i = 0; i < 150; i++) {
      particlesArray.push(new Particle(true)); // stagger initial lifecycle stage
    }
    globalParticlesArray = particlesArray;
  }

  function animateParticles() {
    ctx.clearRect(
      0,
      0,
      window.innerWidth,
      document.documentElement.scrollHeight,
    );
    for (let i = 0; i < particlesArray.length; i++) {
      particlesArray[i].update();
      particlesArray[i].draw();
    }
    requestAnimationFrame(animateParticles);
  }

  initParticles();
  animateParticles();

  window.addEventListener("resize", () => {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = document.documentElement.scrollHeight * dpr;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = document.documentElement.scrollHeight + "px";
    ctx.scale(dpr, dpr);
    initParticles();
  });

  // Update canvas height on scroll/content change
  const resizeObserver = new ResizeObserver(() => {
    const newHeight = document.documentElement.scrollHeight;
    const dpr = window.devicePixelRatio || 1;
    const currentLogicalHeight = canvas.height / dpr;
    if (currentLogicalHeight !== newHeight) {
      canvas.height = newHeight * dpr;
      canvas.style.height = newHeight + "px";
      ctx.scale(dpr, dpr);
    }
  });
  resizeObserver.observe(document.body);
}

document.addEventListener("DOMContentLoaded", async () => {
  // Custom cursor for desktop pointers only
  const finePointerQuery =
    window.matchMedia && window.matchMedia("(pointer: fine)");
  const coarsePointerQuery =
    window.matchMedia && window.matchMedia("(pointer: coarse)");
  const supportsFinePointer = finePointerQuery && finePointerQuery.matches;
  let cursorDot = null;
  let cursorRing = null;
  const root = document.documentElement;

  const setEnhancedCursorMode = (enabled) => {
    root.classList.toggle("cursor-enhanced", enabled);
    document.body.classList.toggle("cursor-enhanced", enabled);
  };

  if (supportsFinePointer) {
    setEnhancedCursorMode(true);
    cursorDot = document.createElement("div");
    cursorRing = document.createElement("div");
    cursorDot.className = "cursor-dot";
    cursorRing.className = "cursor-ring";
    document.body.appendChild(cursorDot);
    document.body.appendChild(cursorRing);

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;

    document.addEventListener("mousemove", (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      cursorDot.style.left = `${mouseX}px`;
      cursorDot.style.top = `${mouseY}px`;
      cursorDot.style.opacity = "1";
      cursorRing.style.opacity = "1";
    });

    document.addEventListener("mouseleave", () => {
      cursorDot.style.opacity = "0";
      cursorRing.style.opacity = "0";
    });

    document.addEventListener("mouseenter", () => {
      cursorDot.style.opacity = "1";
      cursorRing.style.opacity = "1";
    });

    const interactiveSelector =
      "a, button, .btn-primary, .project-card, .skill-item, .hero-social-btn, input, textarea, .nav-link";
    document.addEventListener("mouseover", (e) => {
      if (e.target.closest(interactiveSelector)) {
        document.body.classList.add("cursor-hover");
      }
    });
    document.addEventListener("mouseout", (e) => {
      if (e.target.closest(interactiveSelector)) {
        document.body.classList.remove("cursor-hover");
      }
    });

    const animateCursor = () => {
      ringX = mouseX;
      ringY = mouseY;
      cursorRing.style.left = `${ringX}px`;
      cursorRing.style.top = `${ringY}px`;
      requestAnimationFrame(animateCursor);
    };
    animateCursor();

    const syncPointerMode = () => {
      const hasFine = finePointerQuery && finePointerQuery.matches;
      const hasCoarse = coarsePointerQuery && coarsePointerQuery.matches;
      const enableCustom = hasFine && !hasCoarse;
      setEnhancedCursorMode(enableCustom);
      if (cursorDot && cursorRing) {
        cursorDot.style.display = enableCustom ? "block" : "none";
        cursorRing.style.display = enableCustom ? "block" : "none";
      }
    };

    if (finePointerQuery && finePointerQuery.addEventListener) {
      finePointerQuery.addEventListener("change", syncPointerMode);
    }
    if (coarsePointerQuery && coarsePointerQuery.addEventListener) {
      coarsePointerQuery.addEventListener("change", syncPointerMode);
    }
    syncPointerMode();
  }

  // Hero mouse interactivity (spotlight + parallax)
  const hero = document.getElementById("hero");
  const heroOrbs = document.querySelectorAll(".hero-orb");
  const heroNeural = document.querySelector(".hero-neural");
  if (hero && supportsFinePointer) {
    hero.addEventListener("mousemove", (e) => {
      const rect = hero.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const relY = e.clientY - rect.top;
      const nx = relX / rect.width - 0.5;
      const ny = relY / rect.height - 0.5;

      hero.style.setProperty("--mouse-x", `${relX}px`);
      hero.style.setProperty("--mouse-y", `${relY}px`);

      heroOrbs.forEach((orb, i) => {
        const strength = (i + 1) * 12;
        orb.style.transform = `translate(${nx * strength}px, ${ny * strength}px)`;
      });

      if (heroNeural) {
        heroNeural.style.transform = `translate(${nx * -8}px, ${ny * -8}px)`;
      }
    });

    hero.addEventListener("mouseleave", () => {
      hero.style.setProperty("--mouse-x", "50%");
      hero.style.setProperty("--mouse-y", "45%");
      heroOrbs.forEach((orb) => {
        orb.style.transform = "translate(0, 0)";
      });
      if (heroNeural) heroNeural.style.transform = "translate(0, 0)";
    });
  }

  // Restore scroll position
  const savedScrollPosition = sessionStorage.getItem("scrollPosition");
  if (savedScrollPosition) {
    window.scrollTo(0, parseInt(savedScrollPosition));
    sessionStorage.removeItem("scrollPosition");
  }

  // Save scroll position before page unload
  window.addEventListener("beforeunload", () => {
    sessionStorage.setItem("scrollPosition", window.scrollY.toString());
  });

  // Hero Entrance Animations
  const heroElements = document.querySelectorAll("[data-animate]");
  heroElements.forEach((el, index) => {
    setTimeout(
      () => {
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
        el.style.transition = "opacity 0.8s ease, transform 0.8s ease";
      },
      300 + index * 200,
    );
  });

  // Typewriter Effect
  const typeWriterElement = document.getElementById("typewriter");
  if (typeWriterElement) {
    const phrases = [
      "Build Meaningful Programs.",
      "am a Problem Solver.",
      "Build Creative Solutions.",
    ];
    let phraseIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let typeSpeed = 100;

    function type() {
      const currentPhrase = phrases[phraseIndex];

      if (isDeleting) {
        typeWriterElement.textContent = currentPhrase.substring(
          0,
          charIndex - 1,
        );
        charIndex--;
        typeSpeed = 50;
      } else {
        typeWriterElement.textContent = currentPhrase.substring(
          0,
          charIndex + 1,
        );
        charIndex++;
        typeSpeed = 100;
      }

      if (!isDeleting && charIndex === currentPhrase.length) {
        isDeleting = true;
        typeSpeed = 2000;
      } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        typeSpeed = 500;
      }

      setTimeout(type, typeSpeed);
    }
    // Start after a delay
    setTimeout(type, 1500);
  }

  // Unified observer for all scroll-reveal elements
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.animationDelay =
            entry.target.style.getPropertyValue("--reveal-delay") || "0ms";
          entry.target.classList.add("in-view", "reveal");
        } else {
          entry.target.classList.remove("in-view", "reveal");
        }
      });
    },
    { threshold: 0.15 },
  );

  // Observe all existing scroll-reveal elements
  document.querySelectorAll(".scroll-reveal").forEach((el, index) => {
    el.style.setProperty("--reveal-delay", `${(index % 6) * 70}ms`);
    revealObserver.observe(el);
  });

  // Continuous scroll FX observer for fade/zoom in/out states
  const scrollFxObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("scroll-active");
          entry.target.classList.remove("scroll-passive");
        } else {
          entry.target.classList.remove("scroll-active");
          entry.target.classList.add("scroll-passive");
        }
      });
    },
    { threshold: [0.1, 0.25, 0.5] },
  );

  document
    .querySelectorAll(
      ".section-padding, .project-card, .timeline-item, .hackathon-card",
    )
    .forEach((el) => scrollFxObserver.observe(el));

  // Section visibility + subtle label parallax while scrolling
  const sectionVisibilityObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("section-visible");
        } else {
          entry.target.classList.remove("section-visible");
        }
      });
    },
    { threshold: 0.2 },
  );

  document
    .querySelectorAll(".section-padding")
    .forEach((section) => sectionVisibilityObserver.observe(section));

  const labelParallax = () => {
    document.querySelectorAll(".section-label").forEach((label) => {
      const rect = label.getBoundingClientRect();
      const progress = Math.max(
        -1,
        Math.min(1, (window.innerHeight * 0.5 - rect.top) / window.innerHeight),
      );
      label.style.setProperty("--label-shift", `${progress * -12}px`);
    });
  };

  let parallaxRaf = null;
  const onScrollParallax = () => {
    if (parallaxRaf) return;
    parallaxRaf = requestAnimationFrame(() => {
      labelParallax();
      parallaxRaf = null;
    });
  };

  window.addEventListener("scroll", onScrollParallax, { passive: true });
  labelParallax();

  // API Configuration
  const API_URL =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
      ? "http://127.0.0.1:8000/api"
      : window.location.origin + "/api";

  // Record visit — count once per 24 hours per browser
  const VISIT_COOLDOWN_MS = 2 * 60 * 60 * 1000;
  const lastVisit = parseInt(
    localStorage.getItem("portfolio_last_visit") || "0",
    10,
  );
  if (Date.now() - lastVisit > VISIT_COOLDOWN_MS) {
    localStorage.setItem("portfolio_last_visit", Date.now().toString());
    fetch(`${API_URL}/visit`, { method: "POST" }).catch(() => {});
  }

  // Load profile photo from API, fall back to static file if not uploaded
  (async () => {
    try {
      const response = await fetch(`${API_URL}/photo`);
      const data = await response.json();
      if (data.success && data.data) {
        const img = document.getElementById("about-photo-img");
        if (img) img.src = data.data;
      }
    } catch (e) {
      // Keep static fallback — no action needed
    }
  })();

  const getProjects = async () => {
    try {
      const response = await fetch(`${API_URL}/projects`);
      const data = await response.json();
      if (data.success) {
        return data.projects;
      }
      return [];
    } catch (error) {
      console.error("Error fetching projects:", error);
      return [];
    }
  };

  let allProjects = [];
  let visibleProjectCount = 0;
  const PROJECTS_PAGE_SIZE = 3;

  const appendProjectCard = (project, container) => {
    const card = document.createElement("div");
    card.className = "project-card scroll-reveal";

    const hasGithub =
      project.links.github &&
      project.links.github !== "#" &&
      project.links.github !== "";
    const hasDemo =
      project.links.demo &&
      project.links.demo !== "#" &&
      project.links.demo !== "";

    card.innerHTML = `
                <div class="project-card-image">
                    ${
                      project.image
                        ? `<img src="${safeImgSrc(project.image)}" alt="${escapeHtml(project.title)}" loading="lazy" />`
                        : `<div class="project-card-image-placeholder"></div>`
                    }
                </div>
                <div class="project-info">
                    <h3>${escapeHtml(project.title)}</h3>
                    <p>${escapeHtml(project.desc)}</p>
                    <div class="tech-stack">
                        ${project.tech
                          .map(
                            (t) =>
                              `<span class="tech-tag">${escapeHtml(t)}</span>`,
                          )
                          .join("")}
                    </div>
                </div>
                <div class="project-links">
                    ${
                      hasGithub
                        ? `<a href="${safeUrl(project.links.github)}" class="project-link" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-github"></i> Code</a>`
                        : ""
                    }
                    ${
                      hasDemo
                        ? `<a href="${safeUrl(project.links.demo)}" class="project-link" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-arrow-up-right-from-square"></i> Live Demo</a>`
                        : ""
                    }
                </div>
            `;
    card.style.setProperty(
      "--reveal-delay",
      `${(visibleProjectCount % 6) * 80}ms`,
    );
    container.appendChild(card);
    revealObserver.observe(card);
    scrollFxObserver.observe(card);
  };

  const renderProjects = async () => {
    const projectsContainer = document.querySelector(".projects-grid");
    if (!projectsContainer) {
      console.warn("Projects container not found");
      return;
    }

    projectsContainer.innerHTML = "";
    allProjects = await getProjects();
    visibleProjectCount = 0;

    // Render first batch
    allProjects
      .slice(0, PROJECTS_PAGE_SIZE)
      .forEach((p) => appendProjectCard(p, projectsContainer));
    visibleProjectCount = Math.min(PROJECTS_PAGE_SIZE, allProjects.length);

    // Show button only if there are more projects
    const showMoreBtn = document.getElementById("projects-show-more");
    if (showMoreBtn) {
      showMoreBtn.style.display =
        allProjects.length > PROJECTS_PAGE_SIZE ? "flex" : "none";
    }
  };

  await renderProjects();

  // ── Work Experience ───────────────────────────────
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

  const renderExperience = async () => {
    const items = await getExperience();
    const container = document.getElementById("timeline-container");
    const section = document.getElementById("experience-work-section");
    if (!container) return;
    container.innerHTML = "";
    if (items.length === 0) {
      section.style.display = "none";
      return;
    }
    section.style.display = "";
    items.forEach((item) => {
      const el = document.createElement("div");
      el.className = "timeline-item scroll-reveal";
      el.innerHTML = `
        <div class="timeline-dot"></div>
        <div class="timeline-card${item.logo ? " timeline-card--has-logo" : ""}">
          ${item.logo ? `<img src="${safeImgSrc(item.logo)}" alt="${escapeHtml(item.company)} logo" class="timeline-company-logo">` : ""}
          <div class="timeline-card-content">
            <div class="timeline-header">
              <div>
                <h3 class="timeline-role">${escapeHtml(item.role)}</h3>
                <p class="timeline-company">${escapeHtml(item.company)}</p>
              </div>
              <span class="timeline-date">${escapeHtml(item.date_range)}</span>
            </div>
            <p class="timeline-desc">${escapeHtml(item.desc)}</p>
            <div class="timeline-tags">
              ${item.tech.map((t) => `<span class="tech-tag">${escapeHtml(t)}</span>`).join("")}
            </div>
          </div>
        </div>`;
      container.appendChild(el);
      revealObserver.observe(el);
      scrollFxObserver.observe(el);
    });
  };

  // ── Hackathons ────────────────────────────────────
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
      section.style.display = "none";
      return;
    }
    section.style.display = "";
    items.forEach((item) => {
      const el = document.createElement("div");
      el.className = "hackathon-card scroll-reveal";
      el.innerHTML = `
        <div class="hackathon-header">
          ${item.placement ? `<span class="hackathon-placement">${escapeHtml(item.placement)}</span>` : ""}
          <span class="hackathon-date">${escapeHtml(item.date)}</span>
        </div>
        <h3 class="hackathon-name">${escapeHtml(item.name)}</h3>
        <div class="timeline-tags">
          ${item.tech.map((t) => `<span class="tech-tag">${escapeHtml(t)}</span>`).join("")}
        </div>
        ${item.project_link ? `<a href="${safeUrl(item.project_link)}" target="_blank" rel="noopener" class="hack-project-link">View Project ↗</a>` : ""}`;
      container.appendChild(el);
      revealObserver.observe(el);
      scrollFxObserver.observe(el);
    });
  };

  // ── Show/hide entire section + nav link ───────────
  const renderExperienceSection = async () => {
    await Promise.all([renderExperience(), renderHackathons()]);
    const section = document.getElementById("experience");
    const navLink = document.querySelector('a[href="#experience"]');
    if (section) section.style.display = "";
    if (navLink) navLink.parentElement.style.display = "";
  };

  await renderExperienceSection();

  // Show More / Show Less button handlers
  const showMoreBtn = document.getElementById("projects-show-more");
  const showLessBtn = document.getElementById("projects-show-less");

  if (showMoreBtn) {
    showMoreBtn.addEventListener("click", () => {
      const projectsContainer = document.querySelector(".projects-grid");
      const nextBatch = allProjects.slice(
        visibleProjectCount,
        visibleProjectCount + PROJECTS_PAGE_SIZE,
      );
      nextBatch.forEach((p) => appendProjectCard(p, projectsContainer));
      visibleProjectCount += nextBatch.length;
      if (visibleProjectCount >= allProjects.length) {
        showMoreBtn.style.display = "none";
      }
      if (showLessBtn) showLessBtn.style.display = "flex";
    });
  }

  if (showLessBtn) {
    showLessBtn.addEventListener("click", () => {
      const projectsContainer = document.querySelector(".projects-grid");
      const cards = [...projectsContainer.querySelectorAll(".project-card")];
      cards.slice(PROJECTS_PAGE_SIZE).forEach((card) => card.remove());
      visibleProjectCount = PROJECTS_PAGE_SIZE;
      showLessBtn.style.display = "none";
      if (showMoreBtn) showMoreBtn.style.display = "flex";
    });
  }

  // Project Card Click Toggle for Touch Devices
  // Uses event delegation to work with dynamically loaded projects
  document.addEventListener("click", (e) => {
    const clickedCard = e.target.closest(".project-card");

    // If clicking on a project link, let it navigate normally
    if (e.target.closest(".project-link")) {
      return;
    }

    // If clicked on a project card, toggle its active state
    if (clickedCard) {
      // Close all other cards
      document.querySelectorAll(".project-card").forEach((card) => {
        if (card !== clickedCard) {
          card.classList.remove("active");
        }
      });
      // Toggle the clicked card
      clickedCard.classList.toggle("active");
    } else {
      // Clicked outside - close all cards
      document.querySelectorAll(".project-card.active").forEach((card) => {
        card.classList.remove("active");
      });
    }
  });

  // Dynamic Resume Link Update
  const updateResumeLinks = () => {
    const resumeLinks = document.querySelectorAll("#resume-btn");
    resumeLinks.forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Open the backend endpoint that serves the PDF with inline disposition
        window.open(`${API_URL}/resume/AtharvaZ`, "AtharvaZ_resume");
      });

      // Update visual state
      link.removeAttribute("href");
      link.style.cursor = "pointer";
    });
  };
  updateResumeLinks();

  // Skills Rendering - Load from API (with fallback to hardcoded data)
  async function loadSkills() {
    try {
      const response = await fetch(`${API_URL}/skills`);
      const data = await response.json();

      if (data.success && data.skills && Object.keys(data.skills).length > 0) {
        return data.skills;
      }

      // Fallback to hardcoded skills if API returns empty or fails
      return getFallbackSkills();
    } catch (error) {
      console.error("Error loading skills from API, using fallback:", error);
      return getFallbackSkills();
    }
  }

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

  const skillsContainer = document.getElementById("skills-wrapper");
  if (skillsContainer) {
    // Load and render skills
    loadSkills().then((techStack) => {
      // Clear existing content
      skillsContainer.innerHTML = "";

      // Create category sections
      Object.entries(techStack).forEach(([category, skills]) => {
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

          let iconContent = "";
          if (skill.image) {
            // For custom uploaded images from the admin panel
            const enlargedClass = skill.enlarged ? "enlarged-icon" : "";
            const extraLargeClass = skill.extraLarge
              ? "extra-enlarged-icon"
              : "";
            iconContent = `<img src="${safeImgSrc(skill.image)}" alt="${escapeHtml(skill.name)}" class="skill-icon-img ${enlargedClass} ${extraLargeClass}" />`;
          } else if (skill.img) {
            // For fallback hardcoded images (assets folder)
            const enlargedClass = skill.enlarged ? "enlarged-icon" : "";
            const extraLargeClass = skill.extraLarge
              ? "extra-enlarged-icon"
              : "";
            iconContent = `<img src="${safeImgSrc(skill.img)}" alt="${escapeHtml(skill.name)}" class="skill-icon-img ${enlargedClass} ${extraLargeClass}" />`;
          } else if (skill.icon) {
            // For devicon or font-awesome icons — sanitise class to prevent injection
            const safeIcon = String(skill.icon).replace(/[^\w\s-]/g, "");
            iconContent = `<i class="${safeIcon}"></i>`;
          } else {
            // Fallback icon if none provided
            iconContent = `<i class="fa-solid fa-code"></i>`;
          }

          skillEl.innerHTML = `
            ${iconContent}
            <span>${escapeHtml(skill.name)}</span>
          `;
          skillsGrid.appendChild(skillEl);
        });

        categorySection.appendChild(skillsGrid);
        skillsContainer.appendChild(categorySection);
      });
    });
  }

  // Contact Form Submission
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
      const originalButtonText = submitButton.textContent;

      // Disable button and show loading state
      submitButton.disabled = true;
      submitButton.textContent = "Sending...";
      submitButton.style.opacity = "0.6";
      submitButton.style.cursor = "not-allowed";

      try {
        const response = await fetch(`${API_URL}/contact`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          // Success message
          submitButton.textContent = "Message Sent! ✓";
          submitButton.style.background = "#10b981"; // Green color
          submitButton.style.color = "#fff";

          // Reset form
          contactForm.reset();

          // Reset button after 3 seconds
          setTimeout(() => {
            submitButton.textContent = originalButtonText;
            submitButton.style.background = "";
            submitButton.style.color = "";
            submitButton.disabled = false;
            submitButton.style.opacity = "1";
            submitButton.style.cursor = "pointer";
          }, 3000);
        } else {
          throw new Error(data.detail || "Failed to send message");
        }
      } catch (error) {
        console.error("Error:", error);
        submitButton.textContent = "Error - Try Again";
        submitButton.style.background = "#ef4444"; // Red color
        submitButton.style.color = "#fff";

        // Reset button after 3 seconds
        setTimeout(() => {
          submitButton.textContent = originalButtonText;
          submitButton.style.background = "";
          submitButton.style.color = "";
          submitButton.disabled = false;
          submitButton.style.opacity = "1";
          submitButton.style.cursor = "pointer";
        }, 3000);
      }
    });
  }

  // Scroll Spy: Highlight nav link based on scroll position
  const spySections = document.querySelectorAll("section");
  const navItems = document.querySelectorAll(".nav-link");

  const spyOptions = {
    root: null,
    rootMargin: "-20% 0px -80% 0px", // Trigger when section is in the top part of the viewport
    threshold: 0,
  };

  const sectionSpy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        // Remove active class from all
        navItems.forEach((link) => link.classList.remove("active"));

        // Add to current
        const id = entry.target.getAttribute("id");
        const activeLink = document.querySelector(`.nav-link[href="#${id}"]`);
        if (activeLink) {
          activeLink.classList.add("active");
        }
      }
    });
  }, spyOptions);

  spySections.forEach((section) => {
    sectionSpy.observe(section);
  });
});
