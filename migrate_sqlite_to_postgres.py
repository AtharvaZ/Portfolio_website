import sqlite3
import os
import psycopg2
from psycopg2.extras import DictCursor
import json
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
SQLITE_DB_PATH = Path("portfolio.db")
DATABASE_URL = os.getenv("DATABASE_URL")

def migrate():
    print("Starting migration from SQLite to PostgreSQL...")

    # 1. Validate Configuration
    if not SQLITE_DB_PATH.exists():
        print(f"Error: SQLite database not found at {SQLITE_DB_PATH}")
        return

    if not DATABASE_URL or not DATABASE_URL.startswith(("postgres://", "postgresql://")):
        print("Error: DATABASE_URL not set or not a PostgreSQL URL.")
        print("Please set DATABASE_URL in your .env file or environment.")
        return

    # Fix postgres:// schema if needed
    pg_url = DATABASE_URL.replace("postgres://", "postgresql://", 1)

    try:
        # 2. Connect to SQLite
        print(f"Connecting to SQLite: {SQLITE_DB_PATH}")
        sqlite_conn = sqlite3.connect(SQLITE_DB_PATH)
        sqlite_conn.row_factory = sqlite3.Row
        sqlite_cursor = sqlite_conn.cursor()

        # 3. Connect to PostgreSQL
        print("Connecting to PostgreSQL...")
        pg_conn = psycopg2.connect(pg_url)
        pg_cursor = pg_conn.cursor()

        # 4. Clear existing data in Postgres (Optional, but good for idempotency if tables exist)
        # Note: We assume tables are created by the backend app (SQLAlchemy) already.
        # If not, we might fail. The user instructions imply running migration to transfer data.
        # Usually, one would run the app once to create schema, then migrate data.
        print("Clearing target tables (site_config, projects)...")
        pg_cursor.execute("TRUNCATE TABLE site_config, projects RESTART IDENTITY;")

        # 5. Migrate Projects
        print("Migrating projects...")
        sqlite_cursor.execute("SELECT id, title, desc, tech, links FROM projects")
        projects = sqlite_cursor.fetchall()
        
        for p in projects:
            # We insert with specific ID to preserve relationships/URLs
            pg_cursor.execute(
                """
                INSERT INTO projects (id, title, "desc", tech, links) 
                VALUES (%s, %s, %s, %s, %s)
                """,
                (p['id'], p['title'], p['desc'], p['tech'], p['links'])
            )
        
        print(f"Migrated {len(projects)} projects.")

        # 6. Migrate Site Config (Resume etc)
        print("Migrating site configuration...")
        sqlite_cursor.execute("SELECT key, value FROM site_config")
        configs = sqlite_cursor.fetchall()

        for c in configs:
            pg_cursor.execute(
                """
                INSERT INTO site_config (key, value) 
                VALUES (%s, %s)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
                """,
                (c['key'], c['value'])
            )
            
        print(f"Migrated {len(configs)} config items.")

        # 7. Commit and Close
        pg_conn.commit()
        print("Migration committed successfully!")

    except Exception as e:
        print(f"Migration failed: {e}")
        if 'pg_conn' in locals() and pg_conn:
            pg_conn.rollback()
    finally:
        if 'sqlite_conn' in locals() and sqlite_conn:
            sqlite_conn.close()
        if 'pg_conn' in locals() and pg_conn:
            pg_conn.close()

if __name__ == "__main__":
    migrate()
