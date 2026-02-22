// Theme Toggle
const initTheme = () => {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
  }
};

// Initialize theme before other scripts
initTheme();

// Global reference for particle array for theme updates
let globalParticlesArray = null;

const themeToggle = document.querySelector("#theme-toggle");
if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    const isDark = document.body.classList.contains("dark-mode");
    localStorage.setItem("theme", isDark ? "dark" : "light");

    // Update particle colors when theme changes
    if (globalParticlesArray) {
      globalParticlesArray.forEach((particle) => particle.updateColor());
    }
  });
}

// Mobile Menu Toggle
const menuToggle = document.querySelector(".menu-toggle");
const navLinks = document.querySelector(".nav-links");

if (menuToggle) {
  menuToggle.addEventListener("click", () => {
    navLinks.style.display =
      navLinks.style.display === "flex" ? "none" : "flex";
    if (navLinks.style.display === "flex") {
      navLinks.style.flexDirection = "column";
      navLinks.style.position = "absolute";
      navLinks.style.top = "80px";
      navLinks.style.left = "0";
      navLinks.style.width = "100%";
      // Dynamic background based on theme
      const isDark = document.body.classList.contains("dark-mode");
      navLinks.style.background = isDark
        ? "rgba(30, 41, 59, 0.98)"
        : "rgba(255, 255, 255, 0.98)";
      navLinks.style.padding = "2rem";
      navLinks.style.borderBottom = isDark
        ? "1px solid rgba(255,255,255,0.1)"
        : "1px solid rgba(0,0,0,0.1)";
      navLinks.style.boxShadow = "0 10px 15px -3px rgba(0, 0, 0, 0.1)";
    }
  });

  // Close menu when a link is clicked
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 768) {
        navLinks.style.display = "none";
      }
    });
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
          entry.target.style.opacity = "1";
          entry.target.style.transform = "translateY(0)";
          entry.target.style.transition =
            "opacity 0.8s ease-out, transform 0.8s ease-out";
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 },
  );

  // Observe all existing scroll-reveal elements
  document.querySelectorAll(".scroll-reveal").forEach((el) => {
    if (el.style.opacity === "") {
      el.style.opacity = "0";
      el.style.transform = "translateY(50px)";
    }
    revealObserver.observe(el);
  });

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
                        ? `<img src="${project.image}" alt="${project.title}" loading="lazy" />`
                        : `<div class="project-card-image-placeholder"></div>`
                    }
                </div>
                <div class="project-info">
                    <h3>${project.title}</h3>
                    <p>${project.desc}</p>
                    <div class="tech-stack">
                        ${project.tech
                          .map((t) => `<span class="tech-tag">${t}</span>`)
                          .join("")}
                    </div>
                </div>
                <div class="project-links">
                    ${
                      hasGithub
                        ? `<a href="${project.links.github}" class="project-link" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-github"></i> Code</a>`
                        : ""
                    }
                    ${
                      hasDemo
                        ? `<a href="${project.links.demo}" class="project-link" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-arrow-up-right-from-square"></i> Live Demo</a>`
                        : ""
                    }
                </div>
            `;
    card.style.opacity = "0";
    card.style.transform = "translateY(50px)";
    container.appendChild(card);
    revealObserver.observe(card);
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
  const getExperience = async () => {
    try {
      const response = await fetch(`${API_URL}/experience`);
      const data = await response.json();
      return data.success ? data.items : [];
    } catch (e) {
      return [];
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
      el.style.opacity = "0";
      el.style.transform = "translateY(50px)";
      el.innerHTML = `
        <div class="timeline-dot"></div>
        <div class="timeline-card${item.logo ? " timeline-card--has-logo" : ""}">
          ${item.logo ? `<img src="${item.logo}" alt="${item.company} logo" class="timeline-company-logo">` : ""}
          <div class="timeline-card-content">
            <div class="timeline-header">
              <div>
                <h3 class="timeline-role">${item.role}</h3>
                <p class="timeline-company">${item.company}</p>
              </div>
              <span class="timeline-date">${item.date_range}</span>
            </div>
            <p class="timeline-desc">${item.desc}</p>
            <div class="timeline-tags">
              ${item.tech.map((t) => `<span class="tech-tag">${t}</span>`).join("")}
            </div>
          </div>
        </div>`;
      container.appendChild(el);
      revealObserver.observe(el);
    });
  };

  // ── Hackathons ────────────────────────────────────
  const getHackathons = async () => {
    try {
      const response = await fetch(`${API_URL}/hackathons`);
      const data = await response.json();
      return data.success ? data.items : [];
    } catch (e) {
      return [];
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
      el.style.opacity = "0";
      el.style.transform = "translateY(50px)";
      el.innerHTML = `
        <div class="hackathon-header">
          ${item.placement ? `<span class="hackathon-placement">${item.placement}</span>` : ""}
          <span class="hackathon-date">${item.date}</span>
        </div>
        <h3 class="hackathon-name">${item.name}</h3>
        <div class="timeline-tags">
          ${item.tech.map((t) => `<span class="tech-tag">${t}</span>`).join("")}
        </div>
        ${item.project_link ? `<a href="${item.project_link}" target="_blank" rel="noopener" class="hack-project-link">View Project ↗</a>` : ""}`;
      container.appendChild(el);
      revealObserver.observe(el);
    });
  };

  // ── Show/hide entire section + nav link ───────────
  const renderExperienceSection = async () => {
    await Promise.all([renderExperience(), renderHackathons()]);
    const workEmpty =
      document.getElementById("timeline-container").children.length === 0;
    const hackEmpty =
      document.getElementById("hackathon-container").children.length === 0;
    const section = document.getElementById("experience");
    const navLink = document.querySelector('a[href="#experience"]');
    const hide = workEmpty && hackEmpty;
    if (section) section.style.display = hide ? "none" : "";
    if (navLink) navLink.parentElement.style.display = hide ? "none" : "";
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

  // Skills Rendering - Organized by Categories
  const techStack = {
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

  const skillsContainer = document.getElementById("skills-wrapper");
  if (skillsContainer) {
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
        if (skill.img) {
          const enlargedClass = skill.enlarged ? "enlarged-icon" : "";
          const extraLargeClass = skill.extraLarge ? "extra-enlarged-icon" : "";
          iconContent = `<img src="${skill.img}" alt="${skill.name}" class="skill-icon-img ${enlargedClass} ${extraLargeClass}" />`;
        } else {
          iconContent = `<i class="${skill.icon}"></i>`;
        }

        skillEl.innerHTML = `
          ${iconContent}
          <span>${skill.name}</span>
        `;
        skillsGrid.appendChild(skillEl);
      });

      categorySection.appendChild(skillsGrid);
      skillsContainer.appendChild(categorySection);
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
