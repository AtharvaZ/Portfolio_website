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
from sqlalchemy import create_engine, Column, Integer, String, Text, select
from sqlalchemy.orm import sessionmaker, declarative_base, Session

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

# Database Configuration
DB_PATH = os.getenv("DB_PATH", "portfolio.db")
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

if not DATABASE_URL:
    # Fallback to SQLite
    DATABASE_URL = f"sqlite:///{DB_PATH}"

# SQLAlchemy Setup
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# SQLAlchemy Models
class ProjectModel(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    desc = Column(Text, nullable=False)
    tech = Column(Text, nullable=False)  # Stored as JSON string
    links = Column(Text, nullable=False) # Stored as JSON string

class SiteConfigModel(Base):
    __tablename__ = "site_config"
    key = Column(String, primary_key=True, index=True)
    value = Column(Text, nullable=True)

# Initialize Tables
Base.metadata.create_all(bind=engine)

# Admin credentials (should be in .env in production)
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")

# Validate admin credentials are set
if not ADMIN_USERNAME or not ADMIN_PASSWORD:
    print("WARNING: ADMIN_USERNAME or ADMIN_PASSWORD not set in .env file!")
    print("Please set these values in your .env file for security.")

# Simple session management (in production, use proper JWT tokens)
active_sessions = set()

# Pydantic Models for API
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
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_resume_from_db():
    """Load resume from DB (helper for non-dependency contexts if needed, though dependency is better)"""
    db = SessionLocal()
    try:
        config = db.query(SiteConfigModel).filter(SiteConfigModel.key == "resume_pdf").first()
        return config.value if config else None
    except Exception as e:
        print(f"Error fetching resume: {e}")
        return None
    finally:
        db.close()

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
async def get_all_projects(db: Session = Depends(get_db)):
    """Get all projects"""
    try:
        projects_orm = db.query(ProjectModel).order_by(ProjectModel.id.asc()).all()
        
        projects = []
        for p in projects_orm:
            projects.append({
                "id": p.id,
                "title": p.title,
                "desc": p.desc,
                "tech": json.loads(p.tech),
                "links": json.loads(p.links)
            })
        return {"success": True, "projects": projects}
    except Exception as e:
        print(f"Error getting projects: {e}")
        raise HTTPException(status_code=500, detail="Database error")

@app.post("/api/projects")
async def create_project(project: Project, session_token: str = Header(None, alias="X-Session-Token"), db: Session = Depends(get_db)):
    """Create a new project (admin only)"""
    if not session_token:
        raise HTTPException(status_code=401, detail="Session token required")
    verify_session(session_token)
    
    try:
        tech_str = json.dumps(project.tech)
        links_str = json.dumps(project.links)
        
        new_project = ProjectModel(
            title=project.title,
            desc=project.desc,
            tech=tech_str,
            links=links_str
        )
        db.add(new_project)
        db.commit()
        db.refresh(new_project)
        
        project_dict = project.model_dump()
        project_dict['id'] = new_project.id
        return {"success": True, "project": project_dict}
        
    except Exception as e:
        print(f"Error creating project: {e}")
        raise HTTPException(status_code=500, detail="Database insert failed")

@app.put("/api/projects/{project_id}")
async def update_project(project_id: int, project: Project, session_token: str = Header(None, alias="X-Session-Token"), db: Session = Depends(get_db)):
    """Update a project (admin only)"""
    if not session_token:
        raise HTTPException(status_code=401, detail="Session token required")
    verify_session(session_token)
    
    try:
        existing_project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not existing_project:
            raise HTTPException(status_code=404, detail="Project not found")
            
        existing_project.title = project.title
        existing_project.desc = project.desc
        existing_project.tech = json.dumps(project.tech)
        existing_project.links = json.dumps(project.links)
        
        db.commit()
        db.refresh(existing_project)
        
        project_dict = project.model_dump()
        project_dict['id'] = project_id
        return {"success": True, "project": project_dict}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating project: {e}")
        raise HTTPException(status_code=500, detail="Database update failed")

@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: int, session_token: str = Header(None, alias="X-Session-Token"), db: Session = Depends(get_db)):
    """Delete a project (admin only)"""
    if not session_token:
        raise HTTPException(status_code=401, detail="Session token required")
    verify_session(session_token)
    
    try:
        existing_project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not existing_project:
            raise HTTPException(status_code=404, detail="Project not found")
            
        db.delete(existing_project)
        db.commit()
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting project: {e}")
        raise HTTPException(status_code=500, detail="Database delete failed")

# Resume API
@app.get("/api/resume")
async def get_resume_data(db: Session = Depends(get_db)):
    """Get resume data"""
    try:
        config = db.query(SiteConfigModel).filter(SiteConfigModel.key == "resume_pdf").first()
        resume_data = config.value if config else None
        
        if resume_data:
            return {"success": True, "data": resume_data}
        return {"success": False, "message": "No resume uploaded"}
    except Exception as e:
        print(f"Error getting resume: {e}")
        return {"success": False, "message": "Error fetching resume"}

@app.post("/api/resume")
async def upload_resume(resume: ResumeResponse, session_token: str = Header(None, alias="X-Session-Token"), db: Session = Depends(get_db)):
    """Upload resume (admin only)"""
    if not session_token:
        raise HTTPException(status_code=401, detail="Session token required")
    verify_session(session_token)
    
    if not resume.data:
         raise HTTPException(status_code=400, detail="No resume data provided")
         
    try:
        config = db.query(SiteConfigModel).filter(SiteConfigModel.key == "resume_pdf").first()
        if config:
            config.value = resume.data
        else:
            new_config = SiteConfigModel(key="resume_pdf", value=resume.data)
            db.add(new_config)
            
        db.commit()
        return {"success": True, "message": "Resume uploaded successfully"}
    except Exception as e:
         print(f"Error saving resume: {e}")
         raise HTTPException(status_code=500, detail="Database error")

@app.get("/api/resume/AtharvaZ")
async def view_resume(db: Session = Depends(get_db)):
    """Serve resume PDF for viewing in browser"""
    try:
        config = db.query(SiteConfigModel).filter(SiteConfigModel.key == "resume_pdf").first()
        resume_data = config.value if config else None
    except Exception as e:
        print(f"Error fetching resume for view: {e}")
        resume_data = None
        
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

