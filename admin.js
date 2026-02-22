// Theme Toggle
const initTheme = () => {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
  }
};

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
  const items = [...projectsListContainer.querySelectorAll(".admin-project-item")];
  const ids = items.map((el) => parseInt(el.dataset.id));
  await fetch(`${API_URL}/admin/projects/reorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Session-Token": sessionToken },
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
            <h4>${project.title}</h4>
            <p>${project.desc.substring(0, 60)}...</p>
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

    item.addEventListener("dragleave", () => item.classList.remove("drag-over"));

    item.addEventListener("drop", async (e) => {
      e.preventDefault();
      item.classList.remove("drag-over");
      if (!dragSrcEl || dragSrcEl === item) return;

      const allItems = [...projectsListContainer.querySelectorAll(".admin-project-item")];
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
      document.querySelectorAll(".admin-project-item").forEach((el) =>
        el.classList.remove("drag-over"),
      );
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
    headers: { "Content-Type": "application/json", "X-Session-Token": sessionToken },
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
      <h4>${item.role}</h4>
      <p>${item.company} · ${item.date_range}</p>
      <div class="admin-actions">
        <button class="action-btn edit-btn" onclick="editExperience(${item.id})">Edit</button>
        <button class="action-btn delete-btn" onclick="deleteExperience(${item.id})">Delete</button>
      </div>`;

    el.addEventListener("dragstart", (e) => { dragSrcExp = el; el.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; });
    el.addEventListener("dragover", (e) => { e.preventDefault(); if (el !== dragSrcExp) el.classList.add("drag-over"); });
    el.addEventListener("dragleave", () => el.classList.remove("drag-over"));
    el.addEventListener("drop", async (e) => {
      e.preventDefault(); el.classList.remove("drag-over");
      if (!dragSrcExp || dragSrcExp === el) return;
      const all = [...expListContainer.querySelectorAll(".admin-project-item")];
      all.indexOf(dragSrcExp) < all.indexOf(el) ? el.after(dragSrcExp) : el.before(dragSrcExp);
      await saveExpOrder();
    });
    el.addEventListener("dragend", () => {
      el.classList.remove("dragging");
      expListContainer.querySelectorAll(".admin-project-item").forEach((e) => e.classList.remove("drag-over"));
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
    tech: document.getElementById("exp-tech").value.split(",").map((t) => t.trim()),
  };
  try {
    const url = id ? `${API_URL}/experience/${id}` : `${API_URL}/experience`;
    const method = id ? "PUT" : "POST";
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", "X-Session-Token": sessionToken },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Save failed");
    await renderAdminExperience();
    expForm.reset();
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

cancelExpBtn.addEventListener("click", () => { expForm.reset(); resetExpForm(); });

function resetExpForm() {
  document.getElementById("exp-id").value = "";
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
    headers: { "Content-Type": "application/json", "X-Session-Token": sessionToken },
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
      <h4>${item.name}</h4>
      <p>${item.placement} · ${item.date}</p>
      <div class="admin-actions">
        <button class="action-btn edit-btn" onclick="editHackathon(${item.id})">Edit</button>
        <button class="action-btn delete-btn" onclick="deleteHackathon(${item.id})">Delete</button>
      </div>`;

    el.addEventListener("dragstart", (e) => { dragSrcHack = el; el.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; });
    el.addEventListener("dragover", (e) => { e.preventDefault(); if (el !== dragSrcHack) el.classList.add("drag-over"); });
    el.addEventListener("dragleave", () => el.classList.remove("drag-over"));
    el.addEventListener("drop", async (e) => {
      e.preventDefault(); el.classList.remove("drag-over");
      if (!dragSrcHack || dragSrcHack === el) return;
      const all = [...hackListContainer.querySelectorAll(".admin-project-item")];
      all.indexOf(dragSrcHack) < all.indexOf(el) ? el.after(dragSrcHack) : el.before(dragSrcHack);
      await saveHackOrder();
    });
    el.addEventListener("dragend", () => {
      el.classList.remove("dragging");
      hackListContainer.querySelectorAll(".admin-project-item").forEach((e) => e.classList.remove("drag-over"));
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
    placement: document.getElementById("hack-placement").value,
    date: document.getElementById("hack-date").value,
    desc: document.getElementById("hack-desc").value,
    tech: document.getElementById("hack-tech").value.split(",").map((t) => t.trim()),
  };
  try {
    const url = id ? `${API_URL}/hackathons/${id}` : `${API_URL}/hackathons`;
    const method = id ? "PUT" : "POST";
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", "X-Session-Token": sessionToken },
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
  document.getElementById("hack-placement").value = item.placement;
  document.getElementById("hack-date").value = item.date;
  document.getElementById("hack-desc").value = item.desc;
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

cancelHackBtn.addEventListener("click", () => { hackForm.reset(); resetHackForm(); });

function resetHackForm() {
  document.getElementById("hack-id").value = "";
  submitHackBtn.textContent = "Add Hackathon";
  cancelHackBtn.style.display = "none";
}
