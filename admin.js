const ADMIN_CREDS = {
    username: 'admin',
    password: 'password123'
};

const defaultProjects = [
    {
        id: 1,
        title: "Project Title 01",
        desc: "A brief description of the project, including the problem solved and the key features implemented.",
        tech: ["React", "Node.js", "WebGL"],
        links: { github: "#", demo: "#" }
    },
    {
        id: 2,
        title: "Project Title 02",
        desc: "Description for the second project. Highlight unique challenges or specific technologies you mastered.",
        tech: ["Vue.js", "Three.js", "Firebase"],
        links: { github: "#", demo: "#" }
    },
    {
        id: 3,
        title: "Project Title 03",
        desc: "A creative coding experiment or a full-stack application. Demonstrates versatility and attention to detail.",
        tech: ["Vanilla JS", "GSAP", "CSS Grid"],
        links: { github: "#", demo: "#" }
    },
    {
        id: 4,
        title: "Project Title 04",
        desc: "Interactive dashboard or data visualization tool. Shows ability to handle complex data and UI states.",
        tech: ["D3.js", "TypeScript", "Next.js"],
        links: { github: "#", demo: "#" }
    }
];

// Auth Logic
const loginForm = document.getElementById('login-form');
const loginScreen = document.getElementById('login-screen');
const dashboard = document.getElementById('admin-dashboard');
const loginError = document.getElementById('login-error');

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;

    if (user === ADMIN_CREDS.username && pass === ADMIN_CREDS.password) {
        sessionStorage.setItem('portfolio_admin_auth', 'true');
        showDashboard();
    } else {
        loginError.style.display = 'block';
    }
});

function showDashboard() {
    loginScreen.style.display = 'none';
    dashboard.style.display = 'block';
    renderAdminProjects();
}

if (sessionStorage.getItem('portfolio_admin_auth') === 'true') {
    showDashboard();
}

document.getElementById('logout-btn').addEventListener('click', () => {
    sessionStorage.removeItem('portfolio_admin_auth');
    location.reload();
});

// CRUD Logic
const projectForm = document.getElementById('project-form');
const projectsListContainer = document.getElementById('projects-list-container');
const submitBtn = document.getElementById('submit-project');
const cancelBtn = document.getElementById('cancel-edit');

function getProjects() {
    const saved = localStorage.getItem('portfolio_projects');
    return saved ? JSON.parse(saved) : defaultProjects;
}

function saveProjects(projects) {
    localStorage.setItem('portfolio_projects', JSON.stringify(projects));
    renderAdminProjects();
}

function renderAdminProjects() {
    const projects = getProjects();
    projectsListContainer.innerHTML = '';

    projects.forEach(project => {
        const item = document.createElement('div');
        item.className = 'admin-project-item';
        item.innerHTML = `
            <h4>${project.title}</h4>
            <p>${project.desc.substring(0, 60)}...</p>
            <div class="admin-actions">
                <button class="action-btn edit-btn" onclick="editProject(${project.id})">Edit</button>
                <button class="action-btn delete-btn" onclick="deleteProject(${project.id})">Delete</button>
            </div>
        `;
        projectsListContainer.appendChild(item);
    });
}

projectForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('project-id').value;
    const title = document.getElementById('project-title').value;
    const desc = document.getElementById('project-desc').value;
    const tech = document.getElementById('project-tech').value.split(',').map(t => t.trim());
    const github = document.getElementById('project-github').value;
    const demo = document.getElementById('project-demo').value;

    const projects = getProjects();
    
    if (id) {
        // Update
        const index = projects.findIndex(p => p.id == id);
        projects[index] = { id: parseInt(id), title, desc, tech, links: { github, demo } };
    } else {
        // Add
        const newId = projects.length > 0 ? Math.max(...projects.map(p => p.id)) + 1 : 1;
        projects.push({ id: newId, title, desc, tech, links: { github, demo } });
    }

    saveProjects(projects);
    projectForm.reset();
    resetFormState();
});

window.editProject = (id) => {
    const projects = getProjects();
    const project = projects.find(p => p.id == id);
    
    document.getElementById('project-id').value = project.id;
    document.getElementById('project-title').value = project.title;
    document.getElementById('project-desc').value = project.desc;
    document.getElementById('project-tech').value = project.tech.join(', ');
    document.getElementById('project-github').value = project.links.github;
    document.getElementById('project-demo').value = project.links.demo;

    submitBtn.textContent = 'Update Project';
    cancelBtn.style.display = 'inline-block';
};

window.deleteProject = (id) => {
    if (confirm('Are you sure you want to delete this project?')) {
        const projects = getProjects();
        const filtered = projects.filter(p => p.id != id);
        saveProjects(filtered);
    }
};

cancelBtn.addEventListener('click', () => {
    projectForm.reset();
    resetFormState();
});

function resetFormState() {
    document.getElementById('project-id').value = '';
    submitBtn.textContent = 'Add Project';
    cancelBtn.style.display = 'none';
}

// Resume Upload Logic
const dropZone = document.getElementById('resume-drop-zone');
const resumeInput = document.getElementById('resume-upload');
const resumeStatus = document.getElementById('resume-status');

dropZone.addEventListener('click', () => resumeInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    handleResumeUpload(file);
});

resumeInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    handleResumeUpload(file);
});

function handleResumeUpload(file) {
    if (!file || file.type !== 'application/pdf') {
        resumeStatus.textContent = 'Please upload a valid PDF file.';
        resumeStatus.className = 'status-text error-text';
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const base64Resume = e.target.result;
        localStorage.setItem('portfolio_resume_data', base64Resume);
        resumeStatus.textContent = `Resume uploaded successfully: ${file.name}`;
        resumeStatus.className = 'status-text status-success';
    };
    reader.readAsDataURL(file);
}

// Check if resume exists
const existingResume = localStorage.getItem('portfolio_resume_data');
if (existingResume) {
    resumeStatus.textContent = 'Custom resume is currently active.';
    resumeStatus.className = 'status-text status-success';
}
