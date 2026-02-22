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
from sqlalchemy import create_engine, Column, Integer, String, Text, select, text
from sqlalchemy.orm import sessionmaker, declarative_base, Session
import subprocess
from datetime import datetime

# Load environment variables from the .env file next to this script
load_dotenv(Path(__file__).parent / ".env")

app = FastAPI(title="Portfolio API")

# Get the directory where this script is located
BASE_DIR = Path(__file__).parent

# CORS middleware to allow frontend to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["www.azaveri.dev", "http://127.0.0.1:8000/"],  # In production, replace with your actual domain
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
    image = Column(String, nullable=True)
    position = Column(Integer, nullable=True)

class SiteConfigModel(Base):
    __tablename__ = "site_config"
    key = Column(String, primary_key=True, index=True)
    value = Column(Text, nullable=True)

class WorkExperienceModel(Base):
    __tablename__ = "work_experience"
    id         = Column(Integer, primary_key=True, index=True)
    role       = Column(String, nullable=False)
    company    = Column(String, nullable=False)
    date_range = Column(String, nullable=False)
    desc       = Column(Text, nullable=False)
    tech       = Column(Text, nullable=False)  # JSON list
    position   = Column(Integer, nullable=True)

class HackathonModel(Base):
    __tablename__ = "hackathons"
    id        = Column(Integer, primary_key=True, index=True)
    name      = Column(String, nullable=False)
    placement = Column(String, nullable=False)
    date      = Column(String, nullable=False)
    desc      = Column(Text, nullable=False)
    tech      = Column(Text, nullable=False)  # JSON list
    position  = Column(Integer, nullable=True)

# Initialize Tables
Base.metadata.create_all(bind=engine)

def migrate_add_image_column():
    """Add image column to projects table if it doesn't exist yet."""
    try:
        with engine.connect() as conn:
            if DATABASE_URL.startswith("sqlite"):
                conn.execute(text("ALTER TABLE projects ADD COLUMN image TEXT"))
            else:
                conn.execute(text("ALTER TABLE projects ADD COLUMN IF NOT EXISTS image TEXT"))
            conn.commit()
        print("Migration: added image column to projects table.")
    except Exception:
        pass  # Column already exists — safe to ignore

migrate_add_image_column()

def migrate_add_position_column():
    """Add position column to projects table and initialize from id order."""
    try:
        with engine.connect() as conn:
            if DATABASE_URL.startswith("sqlite"):
                conn.execute(text("ALTER TABLE projects ADD COLUMN position INTEGER"))
            else:
                conn.execute(text("ALTER TABLE projects ADD COLUMN IF NOT EXISTS position INTEGER"))
            conn.execute(text("UPDATE projects SET position = id WHERE position IS NULL"))
            conn.commit()
        print("Migration: added position column to projects table.")
    except Exception:
        pass  # Column already exists — safe to ignore

migrate_add_position_column()

def attempt_auto_migration():
    """
    Automatically migrate data from SQLite to Postgres on first run in production
    """
    # 1. Check if we are in production (PostgreSQL)
    if not DATABASE_URL or DATABASE_URL.startswith("sqlite"):
        return
        
    # 2. Check if we have source data locally (portfolio.db)
    # Note: On Render, you must commit portfolio.db to your repo for this to succeed
    if not os.path.exists(DB_PATH):
        print(f"Auto-migration: Source DB {DB_PATH} not found. Skipping.")
        return
        
    try:
        # 3. Check if destination database is empty
        db = SessionLocal()
        try:
            count = db.query(ProjectModel).count()
        finally:
            db.close()
        
        if count > 0:
            print(f"Auto-migration: Database already has {count} projects. Skipping.")
            return
            
        print("Auto-migration: Database empty. Starting migration from SQLite...")
        
        # 4. Run migration script
        migration_script = BASE_DIR / "migrate_sqlite_to_postgres.py"
        if not migration_script.exists():
            print(f"Auto-migration: Script {migration_script} not found!")
            return

        # Execute migration script
        # passing os.environ to ensure DATABASE_URL is available to the subprocess
        result = subprocess.run(
            ["python3", str(migration_script)],
            capture_output=True,
            text=True,
            env=os.environ.copy()
        )
        
        if result.returncode == 0:
            print("Auto-migration: SUCCESS")
            print("------------------------------------------")
            print(result.stdout)
            print("------------------------------------------")
        else:
            print("Auto-migration: FAILED")
            print("------------------------------------------")
            print(result.stderr)
            print("------------------------------------------")
            
    except Exception as e:
        print(f"Auto-migration error: {e}")

# Run auto-migration check on startup
attempt_auto_migration()

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
    image: Optional[str] = None

class WorkExperience(BaseModel):
    id: Optional[int] = None
    role: str
    company: str
    date_range: str
    desc: str
    tech: List[str]

class Hackathon(BaseModel):
    id: Optional[int] = None
    name: str
    placement: str
    date: str
    desc: str
    tech: List[str]

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
#health check
@app.api_route("/api/health", methods=["GET", "HEAD"])
async def health_check():
    """Health check endpoint for monitoring services (supports GET and HEAD)"""
    return {
        "status": "healthy",
        "service": "Portfolio API",
        "timestamp": datetime.now().isoformat()
    }

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

# TEMPORARY: Fix sequence endpoint
@app.post("/api/admin/fix-sequence")
async def fix_sequence(session_token: str = Header(None, alias="X-Session-Token"), db: Session = Depends(get_db)):
    """
    TEMPORARY: Fix PostgreSQL sequence out of sync error.
    Run this once after migration if you get duplicate key errors.
    """
    if not session_token:
        raise HTTPException(status_code=401, detail="Session token required")
    verify_session(session_token)
    
    # Check if we are on Postgres
    if "sqlite" in str(engine.url):
        return {"success": False, "message": "This operation is only required for PostgreSQL (SQLite handles autocrement automatically)."}

    try:
        # 1. Get current max ID for reporting
        result = db.execute(text("SELECT MAX(id) FROM projects"))
        current_max = result.scalar() or 0

        # 2. Reset sequence
        # Using user requested query: MAX(id) + 1
        # This bumps the sequence past the current max to ensure no collisions
        query = text("SELECT setval('projects_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM projects))")
        seq_result = db.execute(query)
        new_val = seq_result.scalar()
        
        db.commit()
        
        return {
            "success": True, 
            "current_max_id": current_max,
            "new_sequence_value": new_val,
            "message": f"Sequence reset. Max ID was {current_max}. New sequence value is {new_val}."
        }
        
    except Exception as e:
        print(f"Error resetting sequence: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to reset sequence: {str(e)}")

# Projects API
@app.post("/api/admin/projects/reorder")
async def reorder_projects(data: dict, session_token: str = Header(None, alias="X-Session-Token"), db: Session = Depends(get_db)):
    """Update project display order (admin only)"""
    if not session_token:
        raise HTTPException(status_code=401, detail="Session token required")
    verify_session(session_token)
    ids = data.get("ids", [])
    for index, project_id in enumerate(ids):
        db.query(ProjectModel).filter(ProjectModel.id == project_id).update({"position": index})
    db.commit()
    return {"success": True}

@app.get("/api/projects")
async def get_all_projects(db: Session = Depends(get_db)):
    """Get all projects"""
    try:
        projects_orm = db.query(ProjectModel).order_by(
            ProjectModel.position.asc().nullslast(), ProjectModel.id.asc()
        ).all()
        
        projects = []
        for p in projects_orm:
            projects.append({
                "id": p.id,
                "title": p.title,
                "desc": p.desc,
                "tech": json.loads(p.tech),
                "links": json.loads(p.links),
                "image": p.image
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
            links=links_str,
            image=project.image
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
        existing_project.image = project.image
        
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

# Visitor Counter API
@app.post("/api/visit")
async def record_visit(db: Session = Depends(get_db)):
    """Increment visitor counter (called silently on each page load)"""
    try:
        config = db.query(SiteConfigModel).filter(SiteConfigModel.key == "visitor_count").first()
        if config:
            config.value = str(int(config.value or 0) + 1)
        else:
            db.add(SiteConfigModel(key="visitor_count", value="1"))
        db.commit()
        return {"success": True}
    except Exception as e:
        print(f"Error recording visit: {e}")
        return {"success": False}

@app.get("/api/admin/stats")
async def get_stats(session_token: str = Header(None, alias="X-Session-Token"), db: Session = Depends(get_db)):
    """Get site stats (admin only)"""
    if not session_token:
        raise HTTPException(status_code=401, detail="Session token required")
    verify_session(session_token)
    try:
        config = db.query(SiteConfigModel).filter(SiteConfigModel.key == "visitor_count").first()
        count = int(config.value) if config and config.value else 0
        return {"success": True, "visitor_count": count}
    except Exception as e:
        print(f"Error getting stats: {e}")
        raise HTTPException(status_code=500, detail="Database error")

# Profile Photo API
@app.get("/api/photo")
async def get_photo(db: Session = Depends(get_db)):
    """Get profile photo"""
    try:
        config = db.query(SiteConfigModel).filter(SiteConfigModel.key == "profile_photo").first()
        if config and config.value:
            return {"success": True, "data": config.value}
        return {"success": False, "message": "No photo uploaded"}
    except Exception as e:
        print(f"Error getting photo: {e}")
        return {"success": False, "message": "Error fetching photo"}

@app.post("/api/photo")
async def upload_photo(data: dict, session_token: str = Header(None, alias="X-Session-Token"), db: Session = Depends(get_db)):
    """Upload profile photo (admin only)"""
    if not session_token:
        raise HTTPException(status_code=401, detail="Session token required")
    verify_session(session_token)

    photo_data = data.get("data")
    if not photo_data:
        raise HTTPException(status_code=400, detail="No photo data provided")

    try:
        config = db.query(SiteConfigModel).filter(SiteConfigModel.key == "profile_photo").first()
        if config:
            config.value = photo_data
        else:
            new_config = SiteConfigModel(key="profile_photo", value=photo_data)
            db.add(new_config)
        db.commit()
        return {"success": True, "message": "Photo uploaded successfully"}
    except Exception as e:
        print(f"Error saving photo: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error")

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
                "from": RESEND_FROM_EMAIL,
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
            
            print(f"Attempting to send email to: {RECIPIENT_EMAIL}")
            email_response = resend.Emails.send(params)
            print(f"Resend API Response: {email_response}")

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

# Work Experience API
@app.post("/api/admin/experience/reorder")
async def reorder_experience(data: dict, session_token: str = Header(None, alias="X-Session-Token"), db: Session = Depends(get_db)):
    if not session_token:
        raise HTTPException(status_code=401, detail="Session token required")
    verify_session(session_token)
    ids = data.get("ids", [])
    for index, exp_id in enumerate(ids):
        db.query(WorkExperienceModel).filter(WorkExperienceModel.id == exp_id).update({"position": index})
    db.commit()
    return {"success": True}

@app.get("/api/experience")
async def get_all_experience(db: Session = Depends(get_db)):
    try:
        items = db.query(WorkExperienceModel).order_by(
            WorkExperienceModel.position.asc().nullslast(), WorkExperienceModel.id.asc()
        ).all()
        return {"success": True, "items": [
            {"id": e.id, "role": e.role, "company": e.company, "date_range": e.date_range,
             "desc": e.desc, "tech": json.loads(e.tech)} for e in items
        ]}
    except Exception as e:
        print(f"Error getting experience: {e}")
        raise HTTPException(status_code=500, detail="Database error")

@app.post("/api/experience")
async def create_experience(exp: WorkExperience, session_token: str = Header(None, alias="X-Session-Token"), db: Session = Depends(get_db)):
    if not session_token:
        raise HTTPException(status_code=401, detail="Session token required")
    verify_session(session_token)
    try:
        new_exp = WorkExperienceModel(
            role=exp.role, company=exp.company, date_range=exp.date_range,
            desc=exp.desc, tech=json.dumps(exp.tech)
        )
        db.add(new_exp)
        db.commit()
        db.refresh(new_exp)
        return {"success": True, "id": new_exp.id}
    except Exception as e:
        print(f"Error creating experience: {e}")
        raise HTTPException(status_code=500, detail="Database insert failed")

@app.put("/api/experience/{exp_id}")
async def update_experience(exp_id: int, exp: WorkExperience, session_token: str = Header(None, alias="X-Session-Token"), db: Session = Depends(get_db)):
    if not session_token:
        raise HTTPException(status_code=401, detail="Session token required")
    verify_session(session_token)
    try:
        existing = db.query(WorkExperienceModel).filter(WorkExperienceModel.id == exp_id).first()
        if not existing:
            raise HTTPException(status_code=404, detail="Experience not found")
        existing.role = exp.role
        existing.company = exp.company
        existing.date_range = exp.date_range
        existing.desc = exp.desc
        existing.tech = json.dumps(exp.tech)
        db.commit()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating experience: {e}")
        raise HTTPException(status_code=500, detail="Database update failed")

@app.delete("/api/experience/{exp_id}")
async def delete_experience(exp_id: int, session_token: str = Header(None, alias="X-Session-Token"), db: Session = Depends(get_db)):
    if not session_token:
        raise HTTPException(status_code=401, detail="Session token required")
    verify_session(session_token)
    try:
        existing = db.query(WorkExperienceModel).filter(WorkExperienceModel.id == exp_id).first()
        if not existing:
            raise HTTPException(status_code=404, detail="Experience not found")
        db.delete(existing)
        db.commit()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting experience: {e}")
        raise HTTPException(status_code=500, detail="Database delete failed")

# Hackathons API
@app.post("/api/admin/hackathons/reorder")
async def reorder_hackathons(data: dict, session_token: str = Header(None, alias="X-Session-Token"), db: Session = Depends(get_db)):
    if not session_token:
        raise HTTPException(status_code=401, detail="Session token required")
    verify_session(session_token)
    ids = data.get("ids", [])
    for index, hack_id in enumerate(ids):
        db.query(HackathonModel).filter(HackathonModel.id == hack_id).update({"position": index})
    db.commit()
    return {"success": True}

@app.get("/api/hackathons")
async def get_all_hackathons(db: Session = Depends(get_db)):
    try:
        items = db.query(HackathonModel).order_by(
            HackathonModel.position.asc().nullslast(), HackathonModel.id.asc()
        ).all()
        return {"success": True, "items": [
            {"id": h.id, "name": h.name, "placement": h.placement, "date": h.date,
             "desc": h.desc, "tech": json.loads(h.tech)} for h in items
        ]}
    except Exception as e:
        print(f"Error getting hackathons: {e}")
        raise HTTPException(status_code=500, detail="Database error")

@app.post("/api/hackathons")
async def create_hackathon(hack: Hackathon, session_token: str = Header(None, alias="X-Session-Token"), db: Session = Depends(get_db)):
    if not session_token:
        raise HTTPException(status_code=401, detail="Session token required")
    verify_session(session_token)
    try:
        new_hack = HackathonModel(
            name=hack.name, placement=hack.placement, date=hack.date,
            desc=hack.desc, tech=json.dumps(hack.tech)
        )
        db.add(new_hack)
        db.commit()
        db.refresh(new_hack)
        return {"success": True, "id": new_hack.id}
    except Exception as e:
        print(f"Error creating hackathon: {e}")
        raise HTTPException(status_code=500, detail="Database insert failed")

@app.put("/api/hackathons/{hack_id}")
async def update_hackathon(hack_id: int, hack: Hackathon, session_token: str = Header(None, alias="X-Session-Token"), db: Session = Depends(get_db)):
    if not session_token:
        raise HTTPException(status_code=401, detail="Session token required")
    verify_session(session_token)
    try:
        existing = db.query(HackathonModel).filter(HackathonModel.id == hack_id).first()
        if not existing:
            raise HTTPException(status_code=404, detail="Hackathon not found")
        existing.name = hack.name
        existing.placement = hack.placement
        existing.date = hack.date
        existing.desc = hack.desc
        existing.tech = json.dumps(hack.tech)
        db.commit()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating hackathon: {e}")
        raise HTTPException(status_code=500, detail="Database update failed")

@app.delete("/api/hackathons/{hack_id}")
async def delete_hackathon(hack_id: int, session_token: str = Header(None, alias="X-Session-Token"), db: Session = Depends(get_db)):
    if not session_token:
        raise HTTPException(status_code=401, detail="Session token required")
    verify_session(session_token)
    try:
        existing = db.query(HackathonModel).filter(HackathonModel.id == hack_id).first()
        if not existing:
            raise HTTPException(status_code=404, detail="Hackathon not found")
        db.delete(existing)
        db.commit()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting hackathon: {e}")
        raise HTTPException(status_code=500, detail="Database delete failed")

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

