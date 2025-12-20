// API Configuration
const API_URL = window.location.origin + '/api';

// Session Management
let sessionToken = sessionStorage.getItem('portfolio_admin_token') || null;

// Auth Logic
const loginForm = document.getElementById('login-form');
const loginScreen = document.getElementById('login-screen');
const dashboard = document.getElementById('admin-dashboard');
const loginError = document.getElementById('login-error');

async function login(username, password) {
    try {
        const response = await fetch(`${API_URL}/admin/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        });
        
        if (!response.ok) {
            const data = await response.json().catch(() => ({ detail: 'Login failed' }));
            throw new Error(data.detail || 'Invalid credentials');
        }
        
        const data = await response.json();
        if (data.success && data.token) {
            sessionToken = data.token;
            sessionStorage.setItem('portfolio_admin_token', sessionToken);
            return { success: true };
        }
        throw new Error('Invalid response from server');
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, error: error.message || 'Failed to connect to server' };
    }
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value;

    // Hide previous errors
    loginError.style.display = 'none';
    
    // Validate inputs
    if (!user || !pass) {
        loginError.textContent = 'Please enter both username and password';
        loginError.style.display = 'block';
        return;
    }

    const result = await login(user, pass);
    if (result.success) {
        // Clear form and hide error
        loginForm.reset();
        loginError.style.display = 'none';
        await showDashboard();
    } else {
        // Show error message
        loginError.textContent = result.error || 'Invalid credentials. Please check your username and password.';
        loginError.style.display = 'block';
    }
});

// Clear error when user starts typing
document.getElementById('username').addEventListener('input', () => {
    if (loginError.style.display === 'block') {
        loginError.style.display = 'none';
    }
});

document.getElementById('password').addEventListener('input', () => {
    if (loginError.style.display === 'block') {
        loginError.style.display = 'none';
    }
});

async function verifySession() {
    if (!sessionToken) return false;
    try {
        const response = await fetch(`${API_URL}/admin/verify`, {
            headers: {
                'X-Session-Token': sessionToken
            }
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
        sessionStorage.removeItem('portfolio_admin_token');
        return;
    }
    loginScreen.style.display = 'none';
    dashboard.style.display = 'block';
    await renderAdminProjects();
    await loadResumeStatus();
}

// Check if already logged in
if (sessionToken) {
    showDashboard();
}

document.getElementById('logout-btn').addEventListener('click', async () => {
    if (sessionToken) {
        try {
            await fetch(`${API_URL}/admin/logout`, {
                method: 'POST',
                headers: {
                    'X-Session-Token': sessionToken
                }
            });
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
    sessionToken = null;
    sessionStorage.removeItem('portfolio_admin_token');
    location.reload();
});

// CRUD Logic
const projectForm = document.getElementById('project-form');
const projectsListContainer = document.getElementById('projects-list-container');
const submitBtn = document.getElementById('submit-project');
const cancelBtn = document.getElementById('cancel-edit');

async function getProjects() {
    try {
        const response = await fetch(`${API_URL}/projects`);
        const data = await response.json();
        if (data.success) {
            return data.projects;
        }
        return [];
    } catch (error) {
        console.error('Error fetching projects:', error);
        return [];
    }
}

async function renderAdminProjects() {
    const projects = await getProjects();
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

// Image upload handling
let projectImage = null;

const imageDropZone = document.getElementById('project-image-drop-zone');
const imageUpload = document.getElementById('project-image-upload');
const imagePreview = document.getElementById('image-preview');
const previewImg = document.getElementById('preview-img');
const removeImageBtn = document.getElementById('remove-image');

imageDropZone.addEventListener('click', () => imageUpload.click());

imageDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    imageDropZone.style.borderColor = 'var(--accent-primary)';
});

imageDropZone.addEventListener('dragleave', () => {
    imageDropZone.style.borderColor = '';
});

imageDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    imageDropZone.style.borderColor = '';
    const files = e.dataTransfer.files;
    if (files.length > 0) handleImageFile(files[0]);
});

imageUpload.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleImageFile(e.target.files[0]);
});

removeImageBtn.addEventListener('click', () => {
    projectImage = null;
    imagePreview.style.display = 'none';
    imageUpload.value = '';
});

function handleImageFile(file) {
    if (!file.type.startsWith('image/')) {
        alert('Please upload an image file');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        projectImage = e.target.result;
        previewImg.src = projectImage;
        imagePreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

projectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('project-id').value;
    const title = document.getElementById('project-title').value;
    const desc = document.getElementById('project-desc').value;
    const tech = document.getElementById('project-tech').value.split(',').map(t => t.trim());
    const github = document.getElementById('project-github').value;
    const demo = document.getElementById('project-demo').value;

    const projectData = {
        title,
        desc,
        tech,
        links: { github, demo },
        image: projectImage || null
    };

    try {
        if (id) {
            // Update
            const response = await fetch(`${API_URL}/projects/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Token': sessionToken
                },
                body: JSON.stringify(projectData)
            });
            if (!response.ok) throw new Error('Update failed');
        } else {
            // Add
            const response = await fetch(`${API_URL}/projects`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Token': sessionToken
                },
                body: JSON.stringify(projectData)
            });
            if (!response.ok) throw new Error('Create failed');
        }
        await renderAdminProjects();
        projectForm.reset();
        projectImage = null;
        imagePreview.style.display = 'none';
        resetFormState();
    } catch (error) {
        console.error('Error saving project:', error);
        alert('Failed to save project. Please try again.');
    }
});

window.editProject = async (id) => {
    const projects = await getProjects();
    const project = projects.find(p => p.id == id);

    if (!project) {
        alert('Project not found');
        return;
    }

    document.getElementById('project-id').value = project.id;
    document.getElementById('project-title').value = project.title;
    document.getElementById('project-desc').value = project.desc;
    document.getElementById('project-tech').value = project.tech.join(', ');
    document.getElementById('project-github').value = project.links.github;
    document.getElementById('project-demo').value = project.links.demo;

    // Load existing image if present
    if (project.image) {
        projectImage = project.image;
        previewImg.src = projectImage;
        imagePreview.style.display = 'block';
    } else {
        projectImage = null;
        imagePreview.style.display = 'none';
    }

    submitBtn.textContent = 'Update Project';
    cancelBtn.style.display = 'inline-block';
};

window.deleteProject = async (id) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    
    try {
        const response = await fetch(`${API_URL}/projects/${id}`, {
            method: 'DELETE',
            headers: {
                'X-Session-Token': sessionToken
            }
        });
        if (response.ok) {
            await renderAdminProjects();
        } else {
            throw new Error('Delete failed');
        }
    } catch (error) {
        console.error('Error deleting project:', error);
        alert('Failed to delete project. Please try again.');
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

async function handleResumeUpload(file) {
    if (!file || file.type !== 'application/pdf') {
        resumeStatus.textContent = 'Please upload a valid PDF file.';
        resumeStatus.className = 'status-text error-text';
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        const base64Resume = e.target.result;
        try {
            const response = await fetch(`${API_URL}/resume`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Token': sessionToken
                },
                body: JSON.stringify({
                    success: true,
                    message: 'Resume upload',
                    data: base64Resume
                })
            });
            const data = await response.json();
            if (response.ok && data.success) {
                resumeStatus.textContent = `Resume uploaded successfully: ${file.name}`;
                resumeStatus.className = 'status-text status-success';
            } else {
                throw new Error('Upload failed');
            }
        } catch (error) {
            console.error('Error uploading resume:', error);
            resumeStatus.textContent = 'Failed to upload resume. Please try again.';
            resumeStatus.className = 'status-text error-text';
        }
    };
    reader.readAsDataURL(file);
}

async function loadResumeStatus() {
    try {
        const response = await fetch(`${API_URL}/resume`);
        const data = await response.json();
        if (data.success && data.data) {
            resumeStatus.textContent = 'Custom resume is currently active.';
            resumeStatus.className = 'status-text status-success';
        }
    } catch (error) {
        // Resume not uploaded yet, that's okay
    }
}
