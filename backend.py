from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Header, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse, Response
from pydantic import BaseModel, EmailStr
from typing import Optional, List
import os
import resend
import json
import base64
import html
import time
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
# add http://127.0.0.1:8000/ in allow_origins if running locally
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://www.azaveri.dev"],  # In production, replace with your actual domain
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
    logo       = Column(Text, nullable=True)   # base64 company logo

class HackathonModel(Base):
    __tablename__ = "hackathons"
    id           = Column(Integer, primary_key=True, index=True)
    name         = Column(String, nullable=False)
    placement    = Column(String, nullable=True)
    date         = Column(String, nullable=False)
    desc         = Column(Text, nullable=True)
    tech         = Column(Text, nullable=False)  # JSON list
    position     = Column(Integer, nullable=True)
    project_link = Column(Text, nullable=True)

class SkillModel(Base):
    __tablename__ = "skills"
    id       = Column(Integer, primary_key=True, index=True)
    name     = Column(String, nullable=False)
    category = Column(String, nullable=False)  # e.g., "Languages", "Frameworks & Libraries"
    icon     = Column(String, nullable=True)   # devicon class name or FA icon
    image    = Column(Text, nullable=True)     # base64 image data for custom icons
    position = Column(Integer, nullable=True)  # ordering within category

# Runtime migrations — add new nullable columns to existing tables
def _run_migrations():
    with engine.connect() as conn:
        for sql in [
            "ALTER TABLE work_experience ADD COLUMN logo TEXT",
            "ALTER TABLE hackathons ADD COLUMN placement TEXT",
            "ALTER TABLE hackathons ADD COLUMN project_link TEXT",
        ]:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass  # column already exists

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

def seed_default_skills():
    """
    Seed the skills table with default skills if it's empty.
    This is a one-time migration to populate initial skills.
    """
    try:
        db = SessionLocal()
        try:
            # Check if skills table is empty
            count = db.query(SkillModel).count()
            if count > 0:
                print(f"Skills migration: Table already has {count} skills. Skipping seed.")
                return
            
            print("Skills migration: Seeding default skills...")
            
            # Helper function to load image as base64
            def load_image_as_base64(filename):
                """Load an image file and return as base64 data URI"""
                try:
                    img_path = BASE_DIR / "assets" / filename
                    if img_path.exists():
                        with open(img_path, 'rb') as f:
                            img_data = base64.b64encode(f.read()).decode('utf-8')
                            # Detect image type from extension
                            ext = filename.split('.')[-1].lower()
                            mime_type = f"image/{ext}" if ext != 'svg' else "image/svg+xml"
                            return f"data:{mime_type};base64,{img_data}"
                except Exception as e:
                    print(f"Warning: Could not load image {filename}: {e}")
                return None
            
            # Default skills organized by category
            default_skills = {
                "Languages": [
                    {"name": "Python", "icon": "devicon-python-plain colored"},
                    {"name": "Java", "icon": "devicon-java-plain colored"},
                    {"name": "C++", "icon": "devicon-cplusplus-plain colored"},
                    {"name": "C#", "icon": "devicon-csharp-plain colored"},
                    {"name": "SQL", "icon": "devicon-azuresqldatabase-plain colored"},
                    {"name": "HTML/CSS", "icon": "devicon-html5-plain colored"},
                ],
                "Frameworks & Libraries": [
                    {"name": "FastAPI", "icon": "devicon-fastapi-plain colored"},
                    {"name": "Flask", "icon": "devicon-flask-original"},
                    {"name": "JavaFX", "icon": "devicon-java-plain colored"},
                    {"name": "sentence-transformers", "icon": "devicon-python-plain colored"},
                    {"name": "FAISS", "image": load_image_as_base64("faiss.png")},
                    {"name": "HuggingFace", "image": load_image_as_base64("huggingface.png")},
                    {"name": "Tkinter", "icon": "devicon-python-plain colored"},
                    {"name": "SQLAlchemy", "icon": "devicon-sqlalchemy-plain"},
                ],
                "Tools & Technologies": [
                    {"name": "Git", "icon": "devicon-git-plain colored"},
                    {"name": "Maven", "icon": "devicon-maven-plain colored"},
                    {"name": "SQLite", "icon": "devicon-sqlite-plain colored"},
                    {"name": "H2 Database", "image": load_image_as_base64("h2-database.png")},
                    {"name": "Claude API", "image": load_image_as_base64("claude.png")},
                    {"name": "Gemini API", "image": load_image_as_base64("gemini.png")},
                    {"name": "Ollama", "image": load_image_as_base64("ollama.png")},
                    {"name": "Piston API", "icon": "fa-solid fa-code"},
                    {"name": "Linux", "icon": "devicon-linux-plain"},
                    {"name": "JUnit", "icon": "devicon-junit-plain colored"},
                ],
            }
            
            # Insert skills with proper ordering
            for category, skills in default_skills.items():
                for position, skill_data in enumerate(skills):
                    new_skill = SkillModel(
                        name=skill_data["name"],
                        category=category,
                        icon=skill_data.get("icon"),
                        image=skill_data.get("image"),
                        position=position
                    )
                    db.add(new_skill)
            
            db.commit()
            total_added = sum(len(skills) for skills in default_skills.values())
            print(f"Skills migration: Successfully seeded {total_added} skills across {len(default_skills)} categories.")
            
        finally:
            db.close()
    except Exception as e:
        print(f"Skills migration error: {e}")

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

# FastAPI Startup Event - Runs all database initialization automatically
@app.on_event("startup")
async def startup_event():
    """
    Initialize database on startup - works in both local and production environments.
    This ensures tables are created, migrations run, and default data is seeded.
    """
    print("=" * 60)
    print("Starting application initialization...")
    print("=" * 60)
    
    try:
        # Step 1: Create all tables if they don't exist
        print("Step 1: Creating database tables...")
        Base.metadata.create_all(bind=engine)
        print("✓ Database tables created/verified")
        
        # Step 2: Run column migrations for existing tables
        print("\nStep 2: Running database migrations...")
        _run_migrations()
        migrate_add_image_column()
        migrate_add_position_column()
        print("✓ Database migrations completed")
        
        # Step 3: Seed default skills if table is empty
        print("\nStep 3: Seeding default skills...")
        seed_default_skills()
        print("✓ Skills seeding completed")
        
        # Step 4: Attempt auto-migration from SQLite to PostgreSQL (production only)
        print("\nStep 4: Checking for auto-migration...")
        attempt_auto_migration()
        print("✓ Auto-migration check completed")
        
        print("\n" + "=" * 60)
        print("Application initialization complete!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Startup error: {e}")
        print("Application may not function correctly.")
        import traceback
        traceback.print_exc()

# Admin credentials (should be in .env in production)
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")

# Validate admin credentials are set
if not ADMIN_USERNAME or not ADMIN_PASSWORD:
    print("WARNING: ADMIN_USERNAME or ADMIN_PASSWORD not set in .env file!")
    print("Please set these values in your .env file for security.")

# Session management with expiry
# Maps token -> expiry timestamp (unix seconds)
active_sessions: dict = {}
SESSION_TIMEOUT_SECONDS = 8 * 60 * 60  # 8 hours

# Brute-force login protection
# Maps IP -> [timestamp_of_attempt, ...]
_login_attempts: dict = {}
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_WINDOW_SECONDS = 15 * 60  # 15 minutes


def _is_rate_limited(ip: str) -> bool:
    """Return True if the IP has exceeded login attempt limits."""
    now = time.time()
    attempts = _login_attempts.get(ip, [])
    # Drop attempts outside the window
    attempts = [t for t in attempts if now - t < LOCKOUT_WINDOW_SECONDS]
    _login_attempts[ip] = attempts
    return len(attempts) >= MAX_LOGIN_ATTEMPTS


def _record_attempt(ip: str):
    now = time.time()
    attempts = _login_attempts.get(ip, [])
    attempts = [t for t in attempts if now - t < LOCKOUT_WINDOW_SECONDS]
    attempts.append(now)
    _login_attempts[ip] = attempts


def _clear_attempts(ip: str):
    _login_attempts.pop(ip, None)

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
    logo: Optional[str] = None

class Hackathon(BaseModel):
    id: Optional[int] = None
    name: str
    placement: Optional[str] = None
    date: str
    desc: Optional[str] = None
    tech: List[str]
    project_link: Optional[str] = None

class Skill(BaseModel):
    id: Optional[int] = None
    name: str
    category: str
    icon: Optional[str] = None
    image: Optional[str] = None

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
    """Verify admin session token and check expiry."""
    expiry = active_sessions.get(session_token)
    if expiry and time.time() < expiry:
        return True
    # Remove expired token
    active_sessions.pop(session_token, None)
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
async def admin_login(credentials: LoginRequest, request: Request):
    """Admin login endpoint with brute-force protection and timing-safe comparison."""
    client_ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else "unknown")
    # Take only the first IP if comma-separated (proxy chain)
    client_ip = client_ip.split(",")[0].strip()

    # Check brute-force lockout
    if _is_rate_limited(client_ip):
        raise HTTPException(
            status_code=429,
            detail="Too many login attempts. Please wait 15 minutes before trying again."
        )

    # Check if credentials are configured
    if not ADMIN_USERNAME or not ADMIN_PASSWORD:
        raise HTTPException(
            status_code=500,
            detail="Server configuration error. Contact the administrator."
        )

    # Constant-time comparison to prevent timing attacks
    username_ok = secrets.compare_digest(
        credentials.username.encode(), ADMIN_USERNAME.encode()
    )
    password_ok = secrets.compare_digest(
        credentials.password.encode(), ADMIN_PASSWORD.encode()
    )

    if username_ok and password_ok:
        _clear_attempts(client_ip)
        session_token = secrets.token_urlsafe(32)
        active_sessions[session_token] = time.time() + SESSION_TIMEOUT_SECONDS
        return {"success": True, "token": session_token}

    _record_attempt(client_ip)
    raise HTTPException(status_code=401, detail="Invalid username or password")

@app.post("/api/admin/logout")
async def admin_logout(session_token: str = Header(None, alias="X-Session-Token")):
    """Admin logout endpoint"""
    if session_token:
        active_sessions.pop(session_token, None)
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
    if not resume.data.startswith(ALLOWED_PDF_PREFIX):
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDF files are allowed.")
    if len(resume.data) > MAX_UPLOAD_B64_LEN:
        raise HTTPException(status_code=413, detail="Resume exceeds maximum allowed size of 5 MB")
         
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

# Max upload size: 5 MB as base64 (~6.7 MB encoded)
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_UPLOAD_B64_LEN = int(MAX_UPLOAD_BYTES * 1.37) + 100  # base64 overhead

ALLOWED_IMAGE_PREFIXES = (
    "data:image/jpeg",
    "data:image/jpg",
    "data:image/png",
    "data:image/gif",
    "data:image/webp",
    "data:image/svg+xml",
)
ALLOWED_PDF_PREFIX = "data:application/pdf"


def validate_image_upload(data: str, field_name: str = "image"):
    """Validate base64 image data URI: type and size."""
    if not data:
        raise HTTPException(status_code=400, detail=f"No {field_name} data provided")
    if not any(data.startswith(p) for p in ALLOWED_IMAGE_PREFIXES):
        raise HTTPException(status_code=400, detail=f"Invalid {field_name} type. Allowed: JPEG, PNG, GIF, WEBP, SVG")
    if len(data) > MAX_UPLOAD_B64_LEN:
        raise HTTPException(status_code=413, detail=f"{field_name} exceeds maximum allowed size of 5 MB")


@app.post("/api/photo")
async def upload_photo(data: dict, session_token: str = Header(None, alias="X-Session-Token"), db: Session = Depends(get_db)):
    """Upload profile photo (admin only)"""
    if not session_token:
        raise HTTPException(status_code=401, detail="Session token required")
    verify_session(session_token)

    photo_data = data.get("data")
    validate_image_upload(photo_data, "photo")

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
                    <li><strong>Name:</strong> {html.escape(form.name)}</li>
                    <li><strong>Email:</strong> {html.escape(str(form.email))}</li>
                </ul>

                <h3>Message:</h3>
                <p>{html.escape(form.message).replace(chr(10), '<br>')}</p>

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
             "desc": e.desc, "tech": json.loads(e.tech), "logo": e.logo} for e in items
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
            desc=exp.desc, tech=json.dumps(exp.tech), logo=exp.logo
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
        existing.logo = exp.logo
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
             "desc": h.desc, "tech": json.loads(h.tech), "project_link": h.project_link} for h in items
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
            desc=hack.desc, tech=json.dumps(hack.tech), project_link=hack.project_link
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
        existing.project_link = hack.project_link
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

# Skills API
@app.post("/api/admin/skills/reorder")
async def reorder_skills(data: dict, session_token: str = Header(None, alias="X-Session-Token"), db: Session = Depends(get_db)):
    """Update skill display order within a category (admin only)"""
    if not session_token:
        raise HTTPException(status_code=401, detail="Session token required")
    verify_session(session_token)
    ids = data.get("ids", [])
    for index, skill_id in enumerate(ids):
        db.query(SkillModel).filter(SkillModel.id == skill_id).update({"position": index})
    db.commit()
    return {"success": True}

@app.get("/api/skills")
async def get_all_skills(db: Session = Depends(get_db)):
    """Get all skills grouped by category"""
    try:
        skills_orm = db.query(SkillModel).order_by(
            SkillModel.category.asc(), SkillModel.position.asc().nullslast(), SkillModel.id.asc()
        ).all()
        
        # Group skills by category
        skills_by_category = {}
        for skill in skills_orm:
            if skill.category not in skills_by_category:
                skills_by_category[skill.category] = []
            skills_by_category[skill.category].append({
                "id": skill.id,
                "name": skill.name,
                "icon": skill.icon,
                "image": skill.image
            })
        
        return {"success": True, "skills": skills_by_category}
    except Exception as e:
        print(f"Error getting skills: {e}")
        raise HTTPException(status_code=500, detail="Database error")

@app.post("/api/skills")
async def create_skill(skill: Skill, session_token: str = Header(None, alias="X-Session-Token"), db: Session = Depends(get_db)):
    """Create a new skill (admin only)"""
    if not session_token:
        raise HTTPException(status_code=401, detail="Session token required")
    verify_session(session_token)
    
    try:
        new_skill = SkillModel(
            name=skill.name,
            category=skill.category,
            icon=skill.icon,
            image=skill.image
        )
        db.add(new_skill)
        db.commit()
        db.refresh(new_skill)
        
        return {"success": True, "id": new_skill.id}
    except Exception as e:
        print(f"Error creating skill: {e}")
        raise HTTPException(status_code=500, detail="Database insert failed")

@app.put("/api/skills/{skill_id}")
async def update_skill(skill_id: int, skill: Skill, session_token: str = Header(None, alias="X-Session-Token"), db: Session = Depends(get_db)):
    """Update a skill (admin only)"""
    if not session_token:
        raise HTTPException(status_code=401, detail="Session token required")
    verify_session(session_token)
    
    try:
        existing = db.query(SkillModel).filter(SkillModel.id == skill_id).first()
        if not existing:
            raise HTTPException(status_code=404, detail="Skill not found")
        
        existing.name = skill.name
        existing.category = skill.category
        existing.icon = skill.icon
        existing.image = skill.image
        
        db.commit()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating skill: {e}")
        raise HTTPException(status_code=500, detail="Database update failed")

@app.delete("/api/skills/{skill_id}")
async def delete_skill(skill_id: int, session_token: str = Header(None, alias="X-Session-Token"), db: Session = Depends(get_db)):
    """Delete a skill (admin only)"""
    if not session_token:
        raise HTTPException(status_code=401, detail="Session token required")
    verify_session(session_token)
    
    try:
        existing = db.query(SkillModel).filter(SkillModel.id == skill_id).first()
        if not existing:
            raise HTTPException(status_code=404, detail="Skill not found")
        
        db.delete(existing)
        db.commit()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting skill: {e}")
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
        # Add cache control headers to prevent aggressive caching
        return HTMLResponse(
            content=html_content, 
            media_type="text/html",
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )
    except Exception as e:
        return HTMLResponse(content=f"<h1>Error</h1><p>Failed to read index.html: {str(e)}</p>", status_code=500)

# Serve admin.html
@app.get("/admin", response_class=HTMLResponse)
async def admin_page():
    admin_path = BASE_DIR / "admin.html"
    if admin_path.exists():
        with open(admin_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
        # Add cache control headers to prevent aggressive caching
        return HTMLResponse(
            content=html_content, 
            media_type="text/html",
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )
    raise HTTPException(status_code=404, detail="Admin page not found")

# Serve static files (CSS, JS, images) - catch-all route comes last
@app.get("/{filename:path}")
async def serve_static(filename: str):
    """Serve static files like CSS, JS, images with proper cache control"""
    file_path = BASE_DIR / filename
    # Security: resolve symlinks and "../" to prevent path traversal attacks
    try:
        resolved = file_path.resolve()
        base_resolved = BASE_DIR.resolve()
    except Exception:
        raise HTTPException(status_code=403, detail="Access denied")
    if not str(resolved).startswith(str(base_resolved)):
        raise HTTPException(status_code=403, detail="Access denied")
    # Use resolved path for all further operations
    file_path = resolved
    if file_path.exists() and file_path.is_file():
        # Set proper content type and cache control based on file extension
        media_type = None
        cache_control = "public, max-age=3600, must-revalidate"  # Default: 1 hour
        
        if filename.endswith('.css'):
            media_type = 'text/css'
            cache_control = "no-cache, must-revalidate"  # Always check for CSS updates
        elif filename.endswith('.js'):
            media_type = 'application/javascript'
            cache_control = "no-cache, must-revalidate"  # Always check for JS updates
        elif filename.endswith('.html'):
            media_type = 'text/html'
            cache_control = "no-cache, no-store, must-revalidate"  # Never cache HTML
        elif filename.endswith('.png'):
            media_type = 'image/png'
            cache_control = "public, max-age=86400"  # Images: 24 hours
        elif filename.endswith('.jpg') or filename.endswith('.jpeg'):
            media_type = 'image/jpeg'
            cache_control = "public, max-age=86400"  # Images: 24 hours
        elif filename.endswith('.svg'):
            media_type = 'image/svg+xml'
            cache_control = "public, max-age=86400"  # Images: 24 hours
        
        # Read file and return with cache control headers
        with open(file_path, 'rb') as f:
            content = f.read()
        
        # Build headers dictionary, excluding None values
        headers = {"Cache-Control": cache_control}
        if filename.endswith(('.html', '.css', '.js')):
            headers["Pragma"] = "no-cache"
            headers["Expires"] = "0"
        
        return Response(
            content=content,
            media_type=media_type,
            headers=headers
        )
    raise HTTPException(status_code=404, detail="File not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

