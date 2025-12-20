from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse, Response
from pydantic import BaseModel, EmailStr
from typing import Optional, List
import os
import resend
import json
import base64
from pathlib import Path
from dotenv import load_dotenv
import secrets
import sqlite3

# Load environment variables
load_dotenv()

app = FastAPI(title="Portfolio API")

# Get the directory where this script is located
BASE_DIR = Path(__file__).parent

# CORS middleware to allow frontend to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your actual domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data storage
# Data storage
DB_PATH = os.getenv("DB_PATH", "portfolio.db")

# Database Helper Functions
def get_db_connection():
    """Create a database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row # Access columns by name
    return conn

def init_db():
    """Initialize DB if it doesn't exist"""
    if not os.path.exists(DB_PATH):
        # In a real app, you might want to run the migration script here
        # or simply create empty tables. For now, we assume migration 
        # has been run or will be run.
        pass

# Initialize DB on startup
init_db()

# Admin credentials (should be in .env in production)
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")

# Validate admin credentials are set
if not ADMIN_USERNAME or not ADMIN_PASSWORD:
    print("WARNING: ADMIN_USERNAME or ADMIN_PASSWORD not set in .env file!")
    print("Please set these values in your .env file for security.")

# Simple session management (in production, use proper JWT tokens)
active_sessions = set()

# Data Models
class ContactForm(BaseModel):
    name: str
    email: EmailStr
    message: str

class LoginRequest(BaseModel):
    username: str
    password: str

class Project(BaseModel):
    id: Optional[int] = None
    title: str
    desc: str
    tech: List[str]
    links: dict

class ResumeResponse(BaseModel):
    success: bool
    message: str
    data: Optional[str] = None

# Helper functions
def get_resume_from_db():
    """Load resume from DB"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM site_config WHERE key = 'resume_pdf'")
        row = cursor.fetchone()
        conn.close()
        return row['value'] if row else None
    except Exception as e:
        print(f"Error fetching resume: {e}")
        return None

def verify_session(session_token: str):
    """Verify admin session token"""
    if session_token in active_sessions:
        return True
    raise HTTPException(status_code=401, detail="Invalid or expired session")

# Email configuration from environment variables
RESEND_API_KEY = os.getenv("EMAIL_SECRET_KEY", "")
RECIPIENT_EMAIL = os.getenv("RECIPIENT_EMAIL", "")
RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev")  # Your verified domain email

# Initialize Resend
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

# ============================================
# API ROUTES (must come before catch-all routes)
# ============================================

# Admin Authentication
@app.post("/api/admin/login")
async def admin_login(credentials: LoginRequest):
    """Admin login endpoint"""
    # Check if credentials are configured
    if not ADMIN_USERNAME or not ADMIN_PASSWORD:
        raise HTTPException(
            status_code=500,
            detail="Admin credentials not configured. Please set ADMIN_USERNAME and ADMIN_PASSWORD in .env file."
        )
    
    # Validate credentials
    if credentials.username == ADMIN_USERNAME and credentials.password == ADMIN_PASSWORD:
        session_token = secrets.token_urlsafe(32)
        active_sessions.add(session_token)
        return {"success": True, "token": session_token}
    
    raise HTTPException(status_code=401, detail="Invalid username or password")

@app.post("/api/admin/logout")
async def admin_logout(session_token: str = Header(None, alias="X-Session-Token")):
    """Admin logout endpoint"""
    if session_token and session_token in active_sessions:
        active_sessions.remove(session_token)
    return {"success": True}

@app.get("/api/admin/verify")
async def verify_admin(session_token: str = Header(None, alias="X-Session-Token")):
    """Verify admin session"""
    if not session_token:
        raise HTTPException(status_code=401, detail="Session token required")
    verify_session(session_token)
    return {"success": True}

# Projects API
@app.get("/api/projects")
async def get_all_projects():
    """Get all projects"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM projects ORDER BY id DESC") # Newest first? Or ASC? usually ID order
        rows = cursor.fetchall()
        
        projects = []
        for row in rows:
            projects.append({
                "id": row["id"],
                "title": row["title"],
                "desc": row["desc"],
                "tech": json.loads(row["tech"]),
                "links": json.loads(row["links"])
            })
        conn.close()
        # Sort by ID asc if needed to match JSON behavior, checking previous file it was ordered 1..9
        projects.sort(key=lambda x: x['id']) 
        return {"success": True, "projects": projects}
    except Exception as e:
        print(f"Error getting projects: {e}")
        raise HTTPException(status_code=500, detail="Database error")

@app.post("/api/projects")
async def create_project(project: Project, session_token: str = Header(None, alias="X-Session-Token")):
    """Create a new project (admin only)"""
    if not session_token:
        raise HTTPException(status_code=401, detail="Session token required")
    verify_session(session_token)
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        tech_str = json.dumps(project.tech)
        links_str = json.dumps(project.links)
        
        cursor.execute(
            "INSERT INTO projects (title, desc, tech, links) VALUES (?, ?, ?, ?)",
            (project.title, project.desc, tech_str, links_str)
        )
        new_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        project_dict = project.model_dump()
        project_dict['id'] = new_id
        return {"success": True, "project": project_dict}
        
    except Exception as e:
        print(f"Error creating project: {e}")
        raise HTTPException(status_code=500, detail="Database insert failed")

@app.put("/api/projects/{project_id}")
async def update_project(project_id: int, project: Project, session_token: str = Header(None, alias="X-Session-Token")):
    """Update a project (admin only)"""
    if not session_token:
        raise HTTPException(status_code=401, detail="Session token required")
    verify_session(session_token)
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check existence
        cursor.execute("SELECT id FROM projects WHERE id = ?", (project_id,))
        if not cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="Project not found")
            
        tech_str = json.dumps(project.tech)
        links_str = json.dumps(project.links)
        
        cursor.execute(
            "UPDATE projects SET title = ?, desc = ?, tech = ?, links = ? WHERE id = ?",
            (project.title, project.desc, tech_str, links_str, project_id)
        )
        conn.commit()
        conn.close()
        
        project_dict = project.model_dump()
        project_dict['id'] = project_id
        return {"success": True, "project": project_dict}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating project: {e}")
        raise HTTPException(status_code=500, detail="Database update failed")

@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: int, session_token: str = Header(None, alias="X-Session-Token")):
    """Delete a project (admin only)"""
    if not session_token:
        raise HTTPException(status_code=401, detail="Session token required")
    verify_session(session_token)
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        if cursor.rowcount == 0:
            conn.close()
            raise HTTPException(status_code=404, detail="Project not found")
            
        conn.commit()
        conn.close()
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting project: {e}")
        raise HTTPException(status_code=500, detail="Database delete failed")

# Resume API
@app.get("/api/resume")
async def get_resume_data():
    """Get resume data"""
    resume_data = get_resume_from_db()
    if resume_data:
        return {"success": True, "data": resume_data}
    return {"success": False, "message": "No resume uploaded"}

@app.post("/api/resume")
async def upload_resume(resume: ResumeResponse, session_token: str = Header(None, alias="X-Session-Token")):
    """Upload resume (admin only)"""
    if not session_token:
        raise HTTPException(status_code=401, detail="Session token required")
    verify_session(session_token)
    
    if not resume.data:
         raise HTTPException(status_code=400, detail="No resume data provided")
         
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT OR REPLACE INTO site_config (key, value) VALUES ('resume_pdf', ?)", 
            (resume.data,)
        )
        conn.commit()
        conn.close()
        return {"success": True, "message": "Resume uploaded successfully"}
    except Exception as e:
         print(f"Error saving resume: {e}")
         raise HTTPException(status_code=500, detail="Database error")

@app.get("/api/resume/AtharvaZ")
async def view_resume():
    """Serve resume PDF for viewing in browser"""
    resume_data = get_resume_from_db()
    if not resume_data:
        return HTMLResponse(content="<h1>No resume uploaded</h1>", status_code=404)
    
    # Handle Data URI if present
    pdf_b64 = resume_data
    if "base64," in resume_data:
        pdf_b64 = resume_data.split("base64,")[1]
        
    try:
        # Decode base64 to bytes
        pdf_bytes = base64.b64decode(pdf_b64)
        
        # Return as PDF with inline disposition
        return Response(
            content=pdf_bytes, 
            media_type="application/pdf", 
            headers={"Content-Disposition": "inline; filename=AtharvaZ.pdf"}
        )
    except Exception as e:
        print(f"Error decoding PDF: {e}")
        return HTMLResponse(content="<h1>Error loading resume</h1>", status_code=500)

# Contact Form API
@app.post("/api/contact")
async def submit_contact_form(form: ContactForm):
    """
    Handle contact form submissions and send email notification using Resend
    """
    try:
        # Validate that email configuration is set
        if not RESEND_API_KEY or not RECIPIENT_EMAIL:
            raise HTTPException(
                status_code=500,
                detail="Email configuration is missing. Please set EMAIL_SECRET_KEY and RECIPIENT_EMAIL environment variables."
            )

        # Send email using Resend
        try:
            if not RESEND_API_KEY:
                raise HTTPException(
                    status_code=500,
                    detail="Resend API key not configured. Please set EMAIL_SECRET_KEY in .env"
                )
            
            params = {
                "from": f"Personal Website Contact <{RESEND_FROM_EMAIL}>",
                "to": [RECIPIENT_EMAIL],
                "subject": f"New Contact Form Submission from {form.name}",
                "html": f"""
                <h2>Contact Personal Website Submission</h2>
                <p>You've received a new message from your portfolio website:</p>

                <h3>Contact Information:</h3>
                <ul>
                    <li><strong>Name:</strong> {form.name}</li>
                    <li><strong>Email:</strong> {form.email}</li>
                </ul>

                <h3>Message:</h3>
                <p>{form.message.replace(chr(10), '<br>')}</p>

                <hr>
                <p style="color: #666; font-size: 12px;">This email was sent from your portfolio contact form.</p>
                """,
            }

            email_response = resend.Emails.send(params)

            return {
                "success": True,
                "message": "Your message has been sent successfully!"
            }
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to send email: {str(e)}"
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred: {str(e)}"
        )

# ============================================
# STATIC FILE SERVING (must come after API routes)
# ============================================

# Serve index.html at root
@app.get("/", response_class=HTMLResponse)
async def read_root():
    index_path = BASE_DIR / "index.html"
    if not index_path.exists():
        return HTMLResponse(content="<h1>Error</h1><p>index.html not found at: " + str(index_path) + "</p>", status_code=404)
    
    try:
        with open(index_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
        return HTMLResponse(content=html_content, media_type="text/html")
    except Exception as e:
        return HTMLResponse(content=f"<h1>Error</h1><p>Failed to read index.html: {str(e)}</p>", status_code=500)

# Serve admin.html
@app.get("/admin", response_class=HTMLResponse)
async def admin_page():
    admin_path = BASE_DIR / "admin.html"
    if admin_path.exists():
        return FileResponse(admin_path, media_type="text/html")
    raise HTTPException(status_code=404, detail="Admin page not found")

# Serve static files (CSS, JS, images) - catch-all route comes last
@app.get("/{filename:path}")
async def serve_static(filename: str):
    """Serve static files like CSS, JS, images"""
    file_path = BASE_DIR / filename
    # Security: only serve files from the base directory
    if not str(file_path).startswith(str(BASE_DIR)):
        raise HTTPException(status_code=403, detail="Access denied")
    if file_path.exists() and file_path.is_file():
        # Set proper content type based on file extension
        media_type = None
        if filename.endswith('.css'):
            media_type = 'text/css'
        elif filename.endswith('.js'):
            media_type = 'application/javascript'
        elif filename.endswith('.html'):
            media_type = 'text/html'
        elif filename.endswith('.png'):
            media_type = 'image/png'
        elif filename.endswith('.jpg') or filename.endswith('.jpeg'):
            media_type = 'image/jpeg'
        elif filename.endswith('.svg'):
            media_type = 'image/svg+xml'
        
        return FileResponse(file_path, media_type=media_type)
    raise HTTPException(status_code=404, detail="File not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

