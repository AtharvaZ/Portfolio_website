// Theme Toggle
const initTheme = () => {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
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

/** Allow only http/https/relative URLs to prevent javascript: injection. */
function safeUrl(url) {
  if (!url) return "#";
  const u = String(url).trim();
  if (/^https?:\/\//i.test(u) || u.startsWith("/") || u.startsWith("#"))
    return u;
  return "#";
}

// Initialize theme before other scripts
initTheme();

const themeToggle = document.querySelector("#theme-toggle");
if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    const isDark = document.body.classList.contains("dark-mode");
    localStorage.setItem("theme", isDark ? "dark" : "light");
  });
}

// API Configuration
const API_URL = window.location.origin + "/api";

// Session Management
let sessionToken = sessionStorage.getItem("portfolio_admin_token") || null;

// Auth Logic
const loginForm = document.getElementById("login-form");
const loginScreen = document.getElementById("login-screen");
const dashboard = document.getElementById("admin-dashboard");
const loginError = document.getElementById("login-error");

async function login(username, password) {
  try {
    const response = await fetch(`${API_URL}/admin/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const data = await response
        .json()
        .catch(() => ({ detail: "Login failed" }));
      throw new Error(data.detail || "Invalid credentials");
    }

    const data = await response.json();
    if (data.success && data.token) {
      sessionToken = data.token;
      sessionStorage.setItem("portfolio_admin_token", sessionToken);
      return { success: true };
    }
    throw new Error("Invalid response from server");
  } catch (error) {
    console.error("Login error:", error);
    return {
      success: false,
      error: error.message || "Failed to connect to server",
    };
  }
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = document.getElementById("username").value.trim();
  const pass = document.getElementById("password").value;

  // Hide previous errors
  loginError.style.display = "none";

  // Validate inputs
  if (!user || !pass) {
    loginError.textContent = "Please enter both username and password";
    loginError.style.display = "block";
    return;
  }

  const result = await login(user, pass);
  if (result.success) {
    // Clear form and hide error
    loginForm.reset();
    loginError.style.display = "none";
    await showDashboard();
  } else {
    // Show error message
    loginError.textContent =
      result.error ||
      "Invalid credentials. Please check your username and password.";
    loginError.style.display = "block";
  }
});

// Clear error when user starts typing
document.getElementById("username").addEventListener("input", () => {
  if (loginError.style.display === "block") {
    loginError.style.display = "none";
  }
});

document.getElementById("password").addEventListener("input", () => {
  if (loginError.style.display === "block") {
    loginError.style.display = "none";
  }
});

async function verifySession() {
  if (!sessionToken) return false;
  try {
    const response = await fetch(`${API_URL}/admin/verify`, {
      headers: {
        "X-Session-Token": sessionToken,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function showDashboard() {
  const isValid = await verifySession();
  if (!isValid) {
    sessionToken = null;
    sessionStorage.removeItem("portfolio_admin_token");
    return;
  }
  loginScreen.style.display = "none";
  dashboard.style.display = "block";
  await loadStats();
  await renderAdminProjects();
  await loadResumeStatus();
  await loadPhotoStatus();
  await renderAdminExperience();
  await renderAdminHackathons();
  await renderAdminSkills();
}

// Check if already logged in
if (sessionToken) {
  showDashboard();
}

document.getElementById("logout-btn").addEventListener("click", async () => {
  if (sessionToken) {
    try {
      await fetch(`${API_URL}/admin/logout`, {
        method: "POST",
        headers: {
          "X-Session-Token": sessionToken,
        },
      });
    } catch (error) {
      console.error("Logout error:", error);
    }
  }
  sessionToken = null;
  sessionStorage.removeItem("portfolio_admin_token");
  location.reload();
});

async function loadStats() {
  try {
    const response = await fetch(`${API_URL}/admin/stats`, {
      headers: { "X-Session-Token": sessionToken },
    });
    const data = await response.json();
    if (data.success) {
      const el = document.getElementById("stat-visitors");
      if (el) el.textContent = data.visitor_count.toLocaleString();
    }
  } catch (e) {
    console.error("Error loading stats:", e);
  }
}

// CRUD Logic
const projectForm = document.getElementById("project-form");
const projectsListContainer = document.getElementById(
  "projects-list-container",
);
const submitBtn = document.getElementById("submit-project");
const cancelBtn = document.getElementById("cancel-edit");

async function getProjects() {
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
}

let dragSrcEl = null;

async function saveOrder() {
  const items = [
    ...projectsListContainer.querySelectorAll(".admin-project-item"),
  ];
  const ids = items.map((el) => parseInt(el.dataset.id));
  await fetch(`${API_URL}/admin/projects/reorder`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Session-Token": sessionToken,
    },
    body: JSON.stringify({ ids }),
  });
}

async function renderAdminProjects() {
  const projects = await getProjects();
  projectsListContainer.innerHTML = "";

  projects.forEach((project) => {
    const item = document.createElement("div");
    item.className = "admin-project-item";
    item.dataset.id = project.id;
    item.draggable = true;
    item.innerHTML = `
            <span class="drag-handle" title="Drag to reorder">⠿</span>
            <h4>${escapeHtml(project.title)}</h4>
            <p>${escapeHtml(project.desc.substring(0, 60))}...</p>
            <div class="admin-actions">
                <button class="action-btn edit-btn" onclick="editProject(${project.id})">Edit</button>
                <button class="action-btn delete-btn" onclick="deleteProject(${project.id})">Delete</button>
            </div>
        `;

    item.addEventListener("dragstart", (e) => {
      dragSrcEl = item;
      item.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });

    item.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (item !== dragSrcEl) item.classList.add("drag-over");
    });

    item.addEventListener("dragleave", () =>
      item.classList.remove("drag-over"),
    );

    item.addEventListener("drop", async (e) => {
      e.preventDefault();
      item.classList.remove("drag-over");
      if (!dragSrcEl || dragSrcEl === item) return;

      const allItems = [
        ...projectsListContainer.querySelectorAll(".admin-project-item"),
      ];
      const srcIdx = allItems.indexOf(dragSrcEl);
      const destIdx = allItems.indexOf(item);

      if (srcIdx < destIdx) {
        item.after(dragSrcEl);
      } else {
        item.before(dragSrcEl);
      }

      await saveOrder();
    });

    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
      document
        .querySelectorAll(".admin-project-item")
        .forEach((el) => el.classList.remove("drag-over"));
      dragSrcEl = null;
    });

    projectsListContainer.appendChild(item);
  });
}

// Project Image Upload
const imageUploadZone = document.getElementById("image-upload-zone");
const imageFileInput = document.getElementById("project-image-file");
const imagePreview = document.getElementById("image-preview");
const imagePlaceholder = document.getElementById("image-upload-placeholder");
const removeImageBtn = document.getElementById("remove-image-btn");
const imageHiddenInput = document.getElementById("project-image");

imageUploadZone.addEventListener("click", () => imageFileInput.click());

imageFileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    alert("Please select a valid image file.");
    return;
  }
  const reader = new FileReader();
  reader.onload = (ev) => {
    const base64 = ev.target.result;
    imageHiddenInput.value = base64;
    imagePreview.src = base64;
    imagePreview.style.display = "block";
    imagePlaceholder.style.display = "none";
    removeImageBtn.style.display = "inline-block";
  };
  reader.readAsDataURL(file);
});

removeImageBtn.addEventListener("click", () => {
  imageHiddenInput.value = "";
  imageFileInput.value = "";
  imagePreview.src = "";
  imagePreview.style.display = "none";
  imagePlaceholder.style.display = "flex";
  removeImageBtn.style.display = "none";
});

function setImagePreview(src) {
  if (src) {
    imageHiddenInput.value = src;
    imagePreview.src = src;
    imagePreview.style.display = "block";
    imagePlaceholder.style.display = "none";
    removeImageBtn.style.display = "inline-block";
  } else {
    imageHiddenInput.value = "";
    imagePreview.src = "";
    imagePreview.style.display = "none";
    imagePlaceholder.style.display = "flex";
    removeImageBtn.style.display = "none";
  }
}

// Company Logo Upload (for experience form)
const expLogoZone = document.getElementById("exp-logo-upload-zone");
const expLogoFile = document.getElementById("exp-logo-file");
const expLogoPreview = document.getElementById("exp-logo-preview");
const expLogoPlaceholder = document.getElementById("exp-logo-placeholder");
const removeExpLogoBtn = document.getElementById("remove-exp-logo-btn");
const expLogoHidden = document.getElementById("exp-logo");

expLogoZone.addEventListener("click", () => expLogoFile.click());

expLogoFile.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const b64 = ev.target.result;
    expLogoHidden.value = b64;
    expLogoPreview.src = b64;
    expLogoPreview.style.display = "block";
    expLogoPlaceholder.style.display = "none";
    removeExpLogoBtn.style.display = "inline-block";
  };
  reader.readAsDataURL(file);
});

removeExpLogoBtn.addEventListener("click", () => {
  expLogoHidden.value = "";
  expLogoFile.value = "";
  expLogoPreview.src = "";
  expLogoPreview.style.display = "none";
  expLogoPlaceholder.style.display = "flex";
  removeExpLogoBtn.style.display = "none";
});

function setExpLogoPreview(src) {
  if (src) {
    expLogoHidden.value = src;
    expLogoPreview.src = src;
    expLogoPreview.style.display = "block";
    expLogoPlaceholder.style.display = "none";
    removeExpLogoBtn.style.display = "inline-block";
  } else {
    expLogoHidden.value = "";
    expLogoPreview.src = "";
    expLogoPreview.style.display = "none";
    expLogoPlaceholder.style.display = "flex";
    removeExpLogoBtn.style.display = "none";
  }
}

projectForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("project-id").value;
  const title = document.getElementById("project-title").value;
  const desc = document.getElementById("project-desc").value;
  const tech = document
    .getElementById("project-tech")
    .value.split(",")
    .map((t) => t.trim());
  const github = document.getElementById("project-github").value;
  const demo = document.getElementById("project-demo").value;
  const image = document.getElementById("project-image").value.trim() || null;

  const projectData = {
    title,
    desc,
    tech,
    links: { github, demo },
    image,
  };

  try {
    if (id) {
      // Update
      const response = await fetch(`${API_URL}/projects/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": sessionToken,
        },
        body: JSON.stringify(projectData),
      });
      if (!response.ok) throw new Error("Update failed");
    } else {
      // Add
      const response = await fetch(`${API_URL}/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": sessionToken,
        },
        body: JSON.stringify(projectData),
      });
      if (!response.ok) throw new Error("Create failed");
    }
    await renderAdminProjects();
    projectForm.reset();
    resetFormState();
  } catch (error) {
    console.error("Error saving project:", error);
    alert("Failed to save project. Please try again.");
  }
});

window.editProject = async (id) => {
  const projects = await getProjects();
  const project = projects.find((p) => p.id == id);

  if (!project) {
    alert("Project not found");
    return;
  }

  document.getElementById("project-id").value = project.id;
  document.getElementById("project-title").value = project.title;
  document.getElementById("project-desc").value = project.desc;
  document.getElementById("project-tech").value = project.tech.join(", ");
  document.getElementById("project-github").value = project.links.github;
  document.getElementById("project-demo").value = project.links.demo;
  setImagePreview(project.image || null);

  submitBtn.textContent = "Update Project";
  cancelBtn.style.display = "inline-block";
};

window.deleteProject = async (id) => {
  if (!confirm("Are you sure you want to delete this project?")) return;

  try {
    const response = await fetch(`${API_URL}/projects/${id}`, {
      method: "DELETE",
      headers: {
        "X-Session-Token": sessionToken,
      },
    });
    if (response.ok) {
      await renderAdminProjects();
    } else {
      throw new Error("Delete failed");
    }
  } catch (error) {
    console.error("Error deleting project:", error);
    alert("Failed to delete project. Please try again.");
  }
};

cancelBtn.addEventListener("click", () => {
  projectForm.reset();
  resetFormState();
});

function resetFormState() {
  document.getElementById("project-id").value = "";
  imageFileInput.value = "";
  setImagePreview(null);
  submitBtn.textContent = "Add Project";
  cancelBtn.style.display = "none";
}

// Resume Upload Logic
const dropZone = document.getElementById("resume-drop-zone");
const resumeInput = document.getElementById("resume-upload");
const resumeStatus = document.getElementById("resume-status");

dropZone.addEventListener("click", () => resumeInput.click());

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", () =>
  dropZone.classList.remove("drag-over"),
);

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  handleResumeUpload(file);
});

resumeInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  handleResumeUpload(file);
});

async function handleResumeUpload(file) {
  if (!file || file.type !== "application/pdf") {
    resumeStatus.textContent = "Please upload a valid PDF file.";
    resumeStatus.className = "status-text error-text";
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64Resume = e.target.result;
    try {
      const response = await fetch(`${API_URL}/resume`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": sessionToken,
        },
        body: JSON.stringify({
          success: true,
          message: "Resume upload",
          data: base64Resume,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        resumeStatus.textContent = `Resume uploaded successfully: ${file.name}`;
        resumeStatus.className = "status-text status-success";
      } else {
        throw new Error("Upload failed");
      }
    } catch (error) {
      console.error("Error uploading resume:", error);
      resumeStatus.textContent = "Failed to upload resume. Please try again.";
      resumeStatus.className = "status-text error-text";
    }
  };
  reader.readAsDataURL(file);
}

async function loadResumeStatus() {
  try {
    const response = await fetch(`${API_URL}/resume`);
    const data = await response.json();
    if (data.success && data.data) {
      resumeStatus.textContent = "Custom resume is currently active.";
      resumeStatus.className = "status-text status-success";
    }
  } catch (error) {
    // Resume not uploaded yet, that's okay
  }
}

// Photo Upload Logic
const photoDropZone = document.getElementById("photo-drop-zone");
const photoInput = document.getElementById("photo-upload");
const photoStatus = document.getElementById("photo-status");
const photoPreviewAdmin = document.getElementById("photo-preview-admin");

photoDropZone.addEventListener("click", () => photoInput.click());

photoDropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  photoDropZone.classList.add("drag-over");
});

photoDropZone.addEventListener("dragleave", () =>
  photoDropZone.classList.remove("drag-over"),
);

photoDropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  photoDropZone.classList.remove("drag-over");
  handlePhotoUpload(e.dataTransfer.files[0]);
});

photoInput.addEventListener("change", (e) => {
  handlePhotoUpload(e.target.files[0]);
});

async function handlePhotoUpload(file) {
  if (!file || !file.type.startsWith("image/")) {
    photoStatus.textContent = "Please upload a valid image file.";
    photoStatus.className = "status-text error-text";
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64Photo = e.target.result;
    try {
      const response = await fetch(`${API_URL}/photo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": sessionToken,
        },
        body: JSON.stringify({ data: base64Photo }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        photoStatus.textContent = `Photo uploaded: ${file.name}`;
        photoStatus.className = "status-text status-success";
        photoPreviewAdmin.src = base64Photo;
        photoPreviewAdmin.style.display = "block";
      } else {
        throw new Error("Upload failed");
      }
    } catch (error) {
      console.error("Error uploading photo:", error);
      photoStatus.textContent = "Failed to upload photo. Please try again.";
      photoStatus.className = "status-text error-text";
    }
  };
  reader.readAsDataURL(file);
}

async function loadPhotoStatus() {
  try {
    const response = await fetch(`${API_URL}/photo`);
    const data = await response.json();
    if (data.success && data.data) {
      photoStatus.textContent = "Profile photo is currently active.";
      photoStatus.className = "status-text status-success";
      photoPreviewAdmin.src = data.data;
      photoPreviewAdmin.style.display = "block";
    }
  } catch (error) {
    // Photo not uploaded yet, that's okay
  }
}

// ─────────────────────────────────────────────────────
// WORK EXPERIENCE CRUD
// ─────────────────────────────────────────────────────
const expForm = document.getElementById("exp-form");
const expListContainer = document.getElementById("exp-list-container");
const submitExpBtn = document.getElementById("submit-exp");
const cancelExpBtn = document.getElementById("cancel-exp");
let dragSrcExp = null;

async function getAdminExperience() {
  try {
    const response = await fetch(`${API_URL}/experience`);
    const data = await response.json();
    return data.success ? data.items : [];
  } catch (e) {
    return [];
  }
}

async function saveExpOrder() {
  const items = [...expListContainer.querySelectorAll(".admin-project-item")];
  const ids = items.map((el) => parseInt(el.dataset.id));
  await fetch(`${API_URL}/admin/experience/reorder`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Session-Token": sessionToken,
    },
    body: JSON.stringify({ ids }),
  });
}

async function renderAdminExperience() {
  const items = await getAdminExperience();
  expListContainer.innerHTML = "";
  items.forEach((item) => {
    const el = document.createElement("div");
    el.className = "admin-project-item";
    el.dataset.id = item.id;
    el.draggable = true;
    el.innerHTML = `
      <span class="drag-handle" title="Drag to reorder">⠿</span>
      ${item.logo ? `<img src="${safeImgSrc(item.logo)}" alt="${escapeHtml(item.company)} logo" style="height:32px;max-width:80px;object-fit:contain;margin-bottom:0.4rem;display:block;">` : ""}
      <h4>${escapeHtml(item.role)}</h4>
      <p>${escapeHtml(item.company)} · ${escapeHtml(item.date_range)}</p>
      <div class="admin-actions">
        <button class="action-btn edit-btn" onclick="editExperience(${item.id})">Edit</button>
        <button class="action-btn delete-btn" onclick="deleteExperience(${item.id})">Delete</button>
      </div>`;

    el.addEventListener("dragstart", (e) => {
      dragSrcExp = el;
      el.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    el.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (el !== dragSrcExp) el.classList.add("drag-over");
    });
    el.addEventListener("dragleave", () => el.classList.remove("drag-over"));
    el.addEventListener("drop", async (e) => {
      e.preventDefault();
      el.classList.remove("drag-over");
      if (!dragSrcExp || dragSrcExp === el) return;
      const all = [...expListContainer.querySelectorAll(".admin-project-item")];
      all.indexOf(dragSrcExp) < all.indexOf(el)
        ? el.after(dragSrcExp)
        : el.before(dragSrcExp);
      await saveExpOrder();
    });
    el.addEventListener("dragend", () => {
      el.classList.remove("dragging");
      expListContainer
        .querySelectorAll(".admin-project-item")
        .forEach((e) => e.classList.remove("drag-over"));
      dragSrcExp = null;
    });

    expListContainer.appendChild(el);
  });
}

expForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("exp-id").value;
  const data = {
    role: document.getElementById("exp-role").value,
    company: document.getElementById("exp-company").value,
    date_range: document.getElementById("exp-date-range").value,
    desc: document.getElementById("exp-desc").value,
    tech: document
      .getElementById("exp-tech")
      .value.split(",")
      .map((t) => t.trim()),
    logo: document.getElementById("exp-logo").value || null,
  };
  try {
    const url = id ? `${API_URL}/experience/${id}` : `${API_URL}/experience`;
    const method = id ? "PUT" : "POST";
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Session-Token": sessionToken,
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Save failed");
    await renderAdminExperience();
    expForm.reset();
    setExpLogoPreview(null);
    resetExpForm();
  } catch (err) {
    console.error(err);
    alert("Failed to save experience entry.");
  }
});

window.editExperience = async (id) => {
  const items = await getAdminExperience();
  const item = items.find((i) => i.id == id);
  if (!item) return;
  document.getElementById("exp-id").value = item.id;
  document.getElementById("exp-role").value = item.role;
  document.getElementById("exp-company").value = item.company;
  document.getElementById("exp-date-range").value = item.date_range;
  document.getElementById("exp-desc").value = item.desc;
  document.getElementById("exp-tech").value = item.tech.join(", ");
  setExpLogoPreview(item.logo || null);
  submitExpBtn.textContent = "Update Experience";
  cancelExpBtn.style.display = "inline-block";
};

window.deleteExperience = async (id) => {
  if (!confirm("Delete this experience entry?")) return;
  try {
    const response = await fetch(`${API_URL}/experience/${id}`, {
      method: "DELETE",
      headers: { "X-Session-Token": sessionToken },
    });
    if (response.ok) await renderAdminExperience();
    else throw new Error("Delete failed");
  } catch (err) {
    console.error(err);
    alert("Failed to delete experience entry.");
  }
};

cancelExpBtn.addEventListener("click", () => {
  expForm.reset();
  resetExpForm();
});

function resetExpForm() {
  document.getElementById("exp-id").value = "";
  setExpLogoPreview(null);
  submitExpBtn.textContent = "Add Experience";
  cancelExpBtn.style.display = "none";
}

// ─────────────────────────────────────────────────────
// HACKATHONS CRUD
// ─────────────────────────────────────────────────────
const hackForm = document.getElementById("hack-form");
const hackListContainer = document.getElementById("hack-list-container");
const submitHackBtn = document.getElementById("submit-hack");
const cancelHackBtn = document.getElementById("cancel-hack");
let dragSrcHack = null;

async function getAdminHackathons() {
  try {
    const response = await fetch(`${API_URL}/hackathons`);
    const data = await response.json();
    return data.success ? data.items : [];
  } catch (e) {
    return [];
  }
}

async function saveHackOrder() {
  const items = [...hackListContainer.querySelectorAll(".admin-project-item")];
  const ids = items.map((el) => parseInt(el.dataset.id));
  await fetch(`${API_URL}/admin/hackathons/reorder`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Session-Token": sessionToken,
    },
    body: JSON.stringify({ ids }),
  });
}

async function renderAdminHackathons() {
  const items = await getAdminHackathons();
  hackListContainer.innerHTML = "";
  items.forEach((item) => {
    const el = document.createElement("div");
    el.className = "admin-project-item";
    el.dataset.id = item.id;
    el.draggable = true;
    el.innerHTML = `
      <span class="drag-handle" title="Drag to reorder">⠿</span>
      <h4>${escapeHtml(item.name)}</h4>
      <p>${[item.placement, item.date].filter(Boolean).map(escapeHtml).join(" · ")}</p>
      <div class="admin-actions">
        <button class="action-btn edit-btn" onclick="editHackathon(${item.id})">Edit</button>
        <button class="action-btn delete-btn" onclick="deleteHackathon(${item.id})">Delete</button>
      </div>`;

    el.addEventListener("dragstart", (e) => {
      dragSrcHack = el;
      el.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    el.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (el !== dragSrcHack) el.classList.add("drag-over");
    });
    el.addEventListener("dragleave", () => el.classList.remove("drag-over"));
    el.addEventListener("drop", async (e) => {
      e.preventDefault();
      el.classList.remove("drag-over");
      if (!dragSrcHack || dragSrcHack === el) return;
      const all = [
        ...hackListContainer.querySelectorAll(".admin-project-item"),
      ];
      all.indexOf(dragSrcHack) < all.indexOf(el)
        ? el.after(dragSrcHack)
        : el.before(dragSrcHack);
      await saveHackOrder();
    });
    el.addEventListener("dragend", () => {
      el.classList.remove("dragging");
      hackListContainer
        .querySelectorAll(".admin-project-item")
        .forEach((e) => e.classList.remove("drag-over"));
      dragSrcHack = null;
    });

    hackListContainer.appendChild(el);
  });
}

hackForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("hack-id").value;
  const data = {
    name: document.getElementById("hack-name").value,
    placement: document.getElementById("hack-placement").value || null,
    date: document.getElementById("hack-date").value,
    desc: null,
    tech: document
      .getElementById("hack-tech")
      .value.split(",")
      .map((t) => t.trim()),
    project_link: document.getElementById("hack-project-link").value || null,
  };
  try {
    const url = id ? `${API_URL}/hackathons/${id}` : `${API_URL}/hackathons`;
    const method = id ? "PUT" : "POST";
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Session-Token": sessionToken,
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Save failed");
    await renderAdminHackathons();
    hackForm.reset();
    resetHackForm();
  } catch (err) {
    console.error(err);
    alert("Failed to save hackathon entry.");
  }
});

window.editHackathon = async (id) => {
  const items = await getAdminHackathons();
  const item = items.find((i) => i.id == id);
  if (!item) return;
  document.getElementById("hack-id").value = item.id;
  document.getElementById("hack-name").value = item.name;
  document.getElementById("hack-placement").value = item.placement || "";
  document.getElementById("hack-date").value = item.date;
  document.getElementById("hack-project-link").value = item.project_link || "";
  document.getElementById("hack-tech").value = item.tech.join(", ");
  submitHackBtn.textContent = "Update Hackathon";
  cancelHackBtn.style.display = "inline-block";
};

window.deleteHackathon = async (id) => {
  if (!confirm("Delete this hackathon?")) return;
  try {
    const response = await fetch(`${API_URL}/hackathons/${id}`, {
      method: "DELETE",
      headers: { "X-Session-Token": sessionToken },
    });
    if (response.ok) await renderAdminHackathons();
    else throw new Error("Delete failed");
  } catch (err) {
    console.error(err);
    alert("Failed to delete hackathon.");
  }
};

cancelHackBtn.addEventListener("click", () => {
  hackForm.reset();
  resetHackForm();
});

function resetHackForm() {
  document.getElementById("hack-id").value = "";
  submitHackBtn.textContent = "Add Hackathon";
  cancelHackBtn.style.display = "none";
}

// SKILLS CRUD
// ─────────────────────────────────────────────────────
const skillForm = document.getElementById("skill-form");
const skillListContainer = document.getElementById("skill-list-container");
const submitSkillBtn = document.getElementById("submit-skill");
const cancelSkillBtn = document.getElementById("cancel-skill");
const iconClassGroup = document.getElementById("icon-class-group");
const iconUploadGroup = document.getElementById("icon-upload-group");
const skillIconUploadZone = document.getElementById("skill-icon-upload-zone");
const skillIconFile = document.getElementById("skill-icon-file");
const skillIconPreview = document.getElementById("skill-icon-preview");
const skillIconPlaceholder = document.getElementById("skill-icon-placeholder");
const removeSkillIconBtn = document.getElementById("remove-skill-icon-btn");

// Handle icon type radio buttons
document.querySelectorAll('input[name="icon-type"]').forEach((radio) => {
  radio.addEventListener("change", (e) => {
    const iconType = e.target.value;
    if (iconType === "upload") {
      iconClassGroup.style.display = "none";
      iconUploadGroup.style.display = "block";
      document.getElementById("skill-icon").value = "";
      document.getElementById("skill-icon").removeAttribute("required");
    } else {
      iconClassGroup.style.display = "block";
      iconUploadGroup.style.display = "none";
      document.getElementById("skill-image").value = "";
      skillIconPreview.style.display = "none";
      skillIconPlaceholder.style.display = "block";
      removeSkillIconBtn.style.display = "none";
      if (iconType === "devicon") {
        document.getElementById("skill-icon").placeholder =
          "e.g., devicon-python-plain colored";
      } else if (iconType === "fontawesome") {
        document.getElementById("skill-icon").placeholder =
          "e.g., fa-solid fa-code";
      }
    }
  });
});

// Skill icon upload handling
skillIconUploadZone.addEventListener("click", () => skillIconFile.click());
skillIconFile.addEventListener("change", handleSkillIconUpload);

function handleSkillIconUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const base64 = event.target.result;
    document.getElementById("skill-image").value = base64;
    skillIconPreview.src = base64;
    skillIconPreview.style.display = "block";
    skillIconPlaceholder.style.display = "none";
    removeSkillIconBtn.style.display = "inline-block";
  };
  reader.readAsDataURL(file);
}

removeSkillIconBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  skillIconFile.value = "";
  document.getElementById("skill-image").value = "";
  skillIconPreview.style.display = "none";
  skillIconPlaceholder.style.display = "block";
  removeSkillIconBtn.style.display = "none";
});

async function getAdminSkills() {
  try {
    const response = await fetch(`${API_URL}/skills`);
    const data = await response.json();
    return data.success ? data.skills : {};
  } catch (e) {
    console.error("Error fetching skills:", e);
    return {};
  }
}

async function renderAdminSkills() {
  const skillsByCategory = await getAdminSkills();
  skillListContainer.innerHTML = "";

  if (Object.keys(skillsByCategory).length === 0) {
    skillListContainer.innerHTML =
      "<p style='color: var(--text-muted); text-align: center; padding: 2rem;'>No skills added yet. Add your first skill above!</p>";
    return;
  }

  Object.entries(skillsByCategory).forEach(([category, skills]) => {
    const categorySection = document.createElement("div");
    categorySection.className = "skill-category-section";
    categorySection.style.cssText = "width: 100%; margin-bottom: 2rem;";

    const categoryTitle = document.createElement("h4");
    categoryTitle.textContent = category;
    categoryTitle.style.cssText =
      "margin-bottom: 1rem; color: var(--accent-primary); font-size: 1.1rem;";
    categorySection.appendChild(categoryTitle);

    const skillsGrid = document.createElement("div");
    skillsGrid.style.cssText =
      "display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem;";

    skills.forEach((skill) => {
      const skillCard = document.createElement("div");
      skillCard.className = "admin-project-item skill-item";
      skillCard.dataset.id = skill.id;
      skillCard.style.cssText =
        "padding: 1rem; display: flex; align-items: center; gap: 0.75rem;";

      let iconHTML = "";
      if (skill.image) {
        iconHTML = `<img src="${safeImgSrc(skill.image)}" alt="${escapeHtml(skill.name)}" style="width: 32px; height: 32px; object-fit: contain;" />`;
      } else if (skill.icon) {
        // icon is a CSS class name — only allow word chars, hyphens, spaces
        const safeIcon = String(skill.icon).replace(/[^\w\s-]/g, "");
        iconHTML = `<i class="${safeIcon}" style="font-size: 32px;"></i>`;
      } else {
        iconHTML = `<i class="fa-solid fa-code" style="font-size: 32px; color: var(--text-muted);"></i>`;
      }

      skillCard.dataset.category = category; // store via dataset, not inline onclick
      skillCard.innerHTML = `
        ${iconHTML}
        <div style="flex: 1; min-width: 0;">
          <strong style="display: block; word-break: break-word;">${escapeHtml(skill.name)}</strong>
        </div>
        <div class="admin-actions" style="opacity: 1; position: static; transform: none; display: flex; gap: 0.5rem;">
          <button class="action-btn edit-btn" data-id="${skill.id}" data-action="edit-skill" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">Edit</button>
          <button class="action-btn delete-btn" data-id="${skill.id}" data-action="delete-skill" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">✕</button>
        </div>
      `;
      // Attach skill card button listeners safely (avoids onclick with user data)
      skillCard
        .querySelector('[data-action="edit-skill"]')
        .addEventListener("click", () => editSkill(skill.id, category));
      skillCard
        .querySelector('[data-action="delete-skill"]')
        .addEventListener("click", () => deleteSkill(skill.id));

      skillsGrid.appendChild(skillCard);
    });

    categorySection.appendChild(skillsGrid);
    skillListContainer.appendChild(categorySection);
  });
}

skillForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("skill-id").value;
  const iconType = document.querySelector(
    'input[name="icon-type"]:checked',
  ).value;

  // Debug: Log raw field values
  console.log("Form submission debug:", {
    skillName: document.getElementById("skill-name").value,
    skillCategory: document.getElementById("skill-category").value,
    iconType: iconType,
    skillIconValue: document.getElementById("skill-icon").value,
    skillImageValue: document.getElementById("skill-image").value,
  });

  // Get and clean the icon value
  let iconValue = document.getElementById("skill-icon").value.trim();

  // Validate icon input - reject HTML tags
  if (iconValue && iconType !== "upload") {
    if (iconValue.includes("<") || iconValue.includes(">")) {
      alert(
        'Please enter only the CSS class name, not the full HTML tag.\n\nExample: devicon-python-plain colored\nNOT: <i class="devicon-python-plain colored"></i>',
      );
      return;
    }
  }

  const data = {
    name: document.getElementById("skill-name").value.trim(),
    category: document.getElementById("skill-category").value,
    icon: iconType !== "upload" ? iconValue || null : null,
    image:
      iconType === "upload"
        ? document.getElementById("skill-image").value || null
        : null,
  };

  // Validate name
  if (!data.name) {
    alert("Please enter a skill name.");
    return;
  }

  // Validate that either icon or image is provided
  if (!data.icon && !data.image) {
    if (iconType === "upload") {
      alert("Please upload an image for the skill icon.");
    } else {
      alert("Please enter an icon class (e.g., devicon-python-plain colored).");
    }
    return;
  }

  console.log("Submitting skill data:", data);

  try {
    const url = id ? `${API_URL}/skills/${id}` : `${API_URL}/skills`;
    const method = id ? "PUT" : "POST";
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Session-Token": sessionToken,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Server error:", errorData);
      throw new Error(errorData.detail || "Save failed");
    }

    await renderAdminSkills();
    skillForm.reset();
    resetSkillForm();
    alert(id ? "Skill updated successfully!" : "Skill added successfully!");
  } catch (err) {
    console.error("Error saving skill:", err);
    alert(`Failed to save skill: ${err.message}`);
  }
});

window.editSkill = async (id, category) => {
  const skillsByCategory = await getAdminSkills();
  const skills = skillsByCategory[category] || [];
  const skill = skills.find((s) => s.id === id);
  if (!skill) return;

  document.getElementById("skill-id").value = skill.id;
  document.getElementById("skill-name").value = skill.name;
  document.getElementById("skill-category").value = category;

  if (skill.image) {
    document.getElementById("icon-type-upload").checked = true;
    iconClassGroup.style.display = "none";
    iconUploadGroup.style.display = "block";
    document.getElementById("skill-image").value = skill.image;
    skillIconPreview.src = skill.image;
    skillIconPreview.style.display = "block";
    skillIconPlaceholder.style.display = "none";
    removeSkillIconBtn.style.display = "inline-block";
  } else if (skill.icon) {
    if (skill.icon.startsWith("devicon-")) {
      document.getElementById("icon-type-devicon").checked = true;
    } else {
      document.getElementById("icon-type-fontawesome").checked = true;
    }
    iconClassGroup.style.display = "block";
    iconUploadGroup.style.display = "none";
    document.getElementById("skill-icon").value = skill.icon;
  }

  submitSkillBtn.textContent = "Update Skill";
  cancelSkillBtn.style.display = "inline-block";
  skillForm.scrollIntoView({ behavior: "smooth", block: "nearest" });
};

window.deleteSkill = async (id) => {
  if (!confirm("Delete this skill?")) return;
  try {
    const response = await fetch(`${API_URL}/skills/${id}`, {
      method: "DELETE",
      headers: { "X-Session-Token": sessionToken },
    });
    if (response.ok) {
      await renderAdminSkills();
      alert("Skill deleted successfully!");
    } else {
      throw new Error("Delete failed");
    }
  } catch (err) {
    console.error(err);
    alert("Failed to delete skill.");
  }
};

cancelSkillBtn.addEventListener("click", () => {
  skillForm.reset();
  resetSkillForm();
});

function resetSkillForm() {
  document.getElementById("skill-id").value = "";
  document.getElementById("icon-type-devicon").checked = true;
  iconClassGroup.style.display = "block";
  iconUploadGroup.style.display = "none";
  skillIconPreview.style.display = "none";
  skillIconPlaceholder.style.display = "block";
  removeSkillIconBtn.style.display = "none";
  skillIconFile.value = "";
  document.getElementById("skill-image").value = "";
  document.getElementById("skill-icon").value = "";
  submitSkillBtn.textContent = "Add Skill";
  cancelSkillBtn.style.display = "none";
}
