from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import qrcode
from io import BytesIO
import base64
import json
import hashlib

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

security = HTTPBearer()

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# ==================== MODELS ====================

class UserRole:
    UNIVERSITY_ADMIN = "university_admin"
    COLLEGE_ADMIN = "college_admin"
    DEPARTMENT_ADMIN = "department_admin"
    FACULTY = "faculty"
    STUDENT = "student"

class SessionType:
    MORNING = "morning"
    AFTERNOON = "afternoon"

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    role: str
    password_hash: str
    university_id: Optional[str] = None
    college_id: Optional[str] = None
    department_id: Optional[str] = None
    year: Optional[str] = None  # 1st, 2nd, 3rd, 4th
    section: Optional[str] = None  # A, B, C, etc.
    subject: Optional[str] = None  # For faculty
    is_active: bool = True
    face_embedding: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class University(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    address: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class College(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    university_id: str
    is_approved: bool = False
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Department(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    college_id: str
    years: List[str] = Field(default=["1st", "2nd", "3rd", "4th"])  # Available years
    sections: List[str] = Field(default=["A", "B", "C"])  # Available sections
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AttendanceSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    college_id: str
    department_id: str
    faculty_id: str
    subject: Optional[str] = None
    year: Optional[str] = None
    section: Optional[str] = None
    session_type: str  # morning or afternoon
    session_date: str
    start_time: datetime
    end_time: Optional[datetime] = None
    qr_code: Optional[str] = None
    qr_token: Optional[str] = None  # Token for verification
    is_active: bool = True
    location: Optional[dict] = None  # Geo-location
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AttendanceRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    student_id: str
    marked_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    method: str  # qr or face
    ip_address: Optional[str] = None
    location: Optional[dict] = None
    is_proxy: bool = False

# ==================== REQUEST/RESPONSE MODELS ====================

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str
    university_id: Optional[str] = None
    college_id: Optional[str] = None
    department_id: Optional[str] = None
    year: Optional[str] = None
    section: Optional[str] = None
    subject: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict

class CreateUniversityRequest(BaseModel):
    name: str
    address: str

class CreateCollegeRequest(BaseModel):
    name: str
    university_id: str

class CreateDepartmentRequest(BaseModel):
    name: str
    college_id: str
    years: Optional[List[str]] = None
    sections: Optional[List[str]] = None

class CreateSessionRequest(BaseModel):
    department_id: str
    session_type: str
    session_date: str
    subject: Optional[str] = None
    year: Optional[str] = None
    section: Optional[str] = None

class MarkAttendanceRequest(BaseModel):
    session_id: str
    method: str
    qr_token: Optional[str] = None
    location: Optional[dict] = None

class AssignFacultyRequest(BaseModel):
    faculty_id: str
    department_id: str
    subject: str

# ==================== HELPER FUNCTIONS ====================

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication")
        
        user_data = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user_data is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user_data
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication")

def generate_qr_code(data: str) -> tuple:
    """Generate QR code and return both image and token"""
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    img_str = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/png;base64,{img_str}", data

# ==================== AUTH ENDPOINTS ====================

@api_router.get("/")
async def root():
    return {"message": "Smart Attendance System API v2", "status": "running"}

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(request: RegisterRequest):
    # Check if user exists
    existing_user = await db.users.find_one({"email": request.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_dict = request.model_dump()
    user_dict["password_hash"] = hash_password(request.password)
    del user_dict["password"]
    
    user_obj = User(**user_dict)
    doc = user_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    
    await db.users.insert_one(doc)
    
    # Create token
    access_token = create_access_token(data={"sub": user_obj.id})
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user={
            "id": user_obj.id,
            "email": user_obj.email,
            "name": user_obj.name,
            "role": user_obj.role,
            "university_id": user_obj.university_id,
            "college_id": user_obj.college_id,
            "department_id": user_obj.department_id,
            "year": user_obj.year,
            "section": user_obj.section,
            "subject": user_obj.subject
        }
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    user_data = await db.users.find_one({"email": request.email}, {"_id": 0})
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(request.password, user_data["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user_data.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is suspended")
    
    access_token = create_access_token(data={"sub": user_data["id"]})
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user={
            "id": user_data["id"],
            "email": user_data["email"],
            "name": user_data["name"],
            "role": user_data["role"],
            "university_id": user_data.get("university_id"),
            "college_id": user_data.get("college_id"),
            "department_id": user_data.get("department_id"),
            "year": user_data.get("year"),
            "section": user_data.get("section"),
            "subject": user_data.get("subject")
        }
    )

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

# ==================== UNIVERSITY ADMIN ENDPOINTS ====================

@api_router.post("/universities")
async def create_university(request: CreateUniversityRequest, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.UNIVERSITY_ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    uni_obj = University(name=request.name, address=request.address)
    doc = uni_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    
    await db.universities.insert_one(doc)
    return uni_obj

@api_router.get("/universities")
async def get_universities(current_user: dict = Depends(get_current_user)):
    universities = await db.universities.find({}, {"_id": 0}).to_list(1000)
    return universities

@api_router.post("/colleges")
async def create_college(request: CreateCollegeRequest, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.UNIVERSITY_ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    college_obj = College(name=request.name, university_id=request.university_id, is_approved=True)
    doc = college_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    
    await db.colleges.insert_one(doc)
    return college_obj

@api_router.get("/colleges")
async def get_colleges(university_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if university_id:
        query["university_id"] = university_id
    elif current_user["role"] == UserRole.COLLEGE_ADMIN and current_user.get("college_id"):
        query["id"] = current_user["college_id"]
    
    colleges = await db.colleges.find(query, {"_id": 0}).to_list(1000)
    return colleges

@api_router.put("/colleges/{college_id}/suspend")
async def suspend_college(college_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.UNIVERSITY_ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.colleges.update_one({"id": college_id}, {"$set": {"is_active": False}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="College not found")
    return {"message": "College suspended successfully"}

@api_router.put("/colleges/{college_id}/activate")
async def activate_college(college_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.UNIVERSITY_ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.colleges.update_one({"id": college_id}, {"$set": {"is_active": True}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="College not found")
    return {"message": "College activated successfully"}

# ==================== COLLEGE ADMIN ENDPOINTS ====================

@api_router.post("/departments")
async def create_department(request: CreateDepartmentRequest, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in [UserRole.UNIVERSITY_ADMIN, UserRole.COLLEGE_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    dept_dict = request.model_dump()
    if not dept_dict.get("years"):
        dept_dict["years"] = ["1st", "2nd", "3rd", "4th"]
    if not dept_dict.get("sections"):
        dept_dict["sections"] = ["A", "B", "C"]
    
    dept_obj = Department(**dept_dict)
    doc = dept_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    
    await db.departments.insert_one(doc)
    return dept_obj

@api_router.get("/departments")
async def get_departments(college_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if college_id:
        query["college_id"] = college_id
    elif current_user["role"] == UserRole.COLLEGE_ADMIN and current_user.get("college_id"):
        query["college_id"] = current_user["college_id"]
    elif current_user["role"] == UserRole.DEPARTMENT_ADMIN and current_user.get("department_id"):
        query["id"] = current_user["department_id"]
    
    departments = await db.departments.find(query, {"_id": 0}).to_list(1000)
    return departments

# ==================== DEPARTMENT ADMIN ENDPOINTS ====================

@api_router.post("/faculty/assign")
async def assign_faculty(request: AssignFacultyRequest, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in [UserRole.DEPARTMENT_ADMIN, UserRole.COLLEGE_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.users.update_one(
        {"id": request.faculty_id, "role": UserRole.FACULTY},
        {"$set": {"department_id": request.department_id, "subject": request.subject}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Faculty not found")
    
    return {"message": "Faculty assigned successfully"}

@api_router.get("/users")
async def get_users(
    role: Optional[str] = None, 
    department_id: Optional[str] = None,
    year: Optional[str] = None,
    section: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if role:
        query["role"] = role
    if department_id:
        query["department_id"] = department_id
    if year:
        query["year"] = year
    if section:
        query["section"] = section
    
    if current_user["role"] == UserRole.COLLEGE_ADMIN and current_user.get("college_id"):
        query["college_id"] = current_user["college_id"]
    elif current_user["role"] == UserRole.DEPARTMENT_ADMIN and current_user.get("department_id"):
        query["department_id"] = current_user["department_id"]
    
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users

@api_router.put("/users/{user_id}/suspend")
async def suspend_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in [UserRole.UNIVERSITY_ADMIN, UserRole.COLLEGE_ADMIN, UserRole.DEPARTMENT_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.users.update_one({"id": user_id}, {"$set": {"is_active": False}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User suspended successfully"}

@api_router.put("/users/{user_id}/activate")
async def activate_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in [UserRole.UNIVERSITY_ADMIN, UserRole.COLLEGE_ADMIN, UserRole.DEPARTMENT_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.users.update_one({"id": user_id}, {"$set": {"is_active": True}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User activated successfully"}

# ==================== FACULTY/SESSION ENDPOINTS ====================

@api_router.post("/sessions")
async def create_session(request: CreateSessionRequest, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in [UserRole.COLLEGE_ADMIN, UserRole.DEPARTMENT_ADMIN, UserRole.FACULTY]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if session already exists
    existing_session = await db.sessions.find_one({
        "department_id": request.department_id,
        "session_type": request.session_type,
        "session_date": request.session_date,
        "year": request.year,
        "section": request.section,
        "is_active": True
    })
    
    if existing_session:
        raise HTTPException(status_code=400, detail="Active session already exists")
    
    # Generate QR code with session token
    session_id = str(uuid.uuid4())
    qr_token = hashlib.sha256(f"{session_id}{datetime.now(timezone.utc).isoformat()}".encode()).hexdigest()
    qr_data = json.dumps({"session_id": session_id, "token": qr_token})
    qr_code_img, _ = generate_qr_code(qr_data)
    
    session_obj = AttendanceSession(
        id=session_id,
        college_id=current_user.get("college_id"),
        department_id=request.department_id,
        faculty_id=current_user["id"],
        subject=request.subject,
        year=request.year,
        section=request.section,
        session_type=request.session_type,
        session_date=request.session_date,
        start_time=datetime.now(timezone.utc),
        qr_code=qr_code_img,
        qr_token=qr_token,
        is_active=True
    )
    
    doc = session_obj.model_dump()
    doc["start_time"] = doc["start_time"].isoformat()
    doc["created_at"] = doc["created_at"].isoformat()
    if doc.get("end_time"):
        doc["end_time"] = doc["end_time"].isoformat()
    
    await db.sessions.insert_one(doc)
    return session_obj

@api_router.get("/sessions")
async def get_sessions(
    department_id: Optional[str] = None,
    year: Optional[str] = None,
    section: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    
    if department_id:
        query["department_id"] = department_id
    if year:
        query["year"] = year
    if section:
        query["section"] = section
    
    if current_user["role"] == UserRole.FACULTY:
        query["faculty_id"] = current_user["id"]
    elif current_user["role"] == UserRole.DEPARTMENT_ADMIN:
        query["department_id"] = current_user.get("department_id")
    elif current_user["role"] == UserRole.COLLEGE_ADMIN:
        query["college_id"] = current_user.get("college_id")
    elif current_user["role"] == UserRole.STUDENT:
        query["year"] = current_user.get("year")
        query["section"] = current_user.get("section")
        query["department_id"] = current_user.get("department_id")
    
    sessions = await db.sessions.find(query, {"_id": 0}).sort("start_time", -1).to_list(1000)
    return sessions

@api_router.put("/sessions/{session_id}/end")
async def end_session(session_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in [UserRole.FACULTY, UserRole.DEPARTMENT_ADMIN, UserRole.COLLEGE_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.sessions.update_one(
        {"id": session_id},
        {"$set": {"is_active": False, "end_time": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {"message": "Session ended successfully"}

# ==================== ATTENDANCE ENDPOINTS ====================

@api_router.post("/attendance/mark")
async def mark_attendance(request: MarkAttendanceRequest, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Only students can mark attendance")
    
    # Check session exists and is active
    session = await db.sessions.find_one({"id": request.session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if not session.get("is_active", False):
        raise HTTPException(status_code=400, detail="Session has expired")
    
    # Verify student belongs to correct year/section
    if session.get("year") and session["year"] != current_user.get("year"):
        raise HTTPException(status_code=403, detail="You are not enrolled in this session's year")
    
    if session.get("section") and session["section"] != current_user.get("section"):
        raise HTTPException(status_code=403, detail="You are not enrolled in this session's section")
    
    # Check if already marked
    existing_record = await db.attendance_records.find_one({
        "session_id": request.session_id,
        "student_id": current_user["id"]
    })
    
    if existing_record:
        raise HTTPException(status_code=400, detail="Attendance already marked")
    
    # Validate QR token if method is qr
    if request.method == "qr" and request.qr_token:
        try:
            qr_data = json.loads(request.qr_token)
            if qr_data.get("session_id") != request.session_id:
                raise HTTPException(status_code=400, detail="Invalid QR code")
            # Verify token matches
            if qr_data.get("token") != session.get("qr_token"):
                raise HTTPException(status_code=400, detail="Invalid or expired QR token")
        except:
            raise HTTPException(status_code=400, detail="Invalid QR code format")
    
    # Create attendance record
    record_obj = AttendanceRecord(
        session_id=request.session_id,
        student_id=current_user["id"],
        method=request.method,
        location=request.location
    )
    
    doc = record_obj.model_dump()
    doc["marked_at"] = doc["marked_at"].isoformat()
    
    await db.attendance_records.insert_one(doc)
    return {"message": "Attendance marked successfully", "record": record_obj}

@api_router.get("/attendance/records")
async def get_attendance_records(
    session_id: Optional[str] = None,
    student_id: Optional[str] = None,
    department_id: Optional[str] = None,
    year: Optional[str] = None,
    section: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    # Build session query
    session_query = {}
    if department_id:
        session_query["department_id"] = department_id
    if year:
        session_query["year"] = year
    if section:
        session_query["section"] = section
    
    # Get relevant sessions
    if session_id:
        session_ids = [session_id]
    else:
        if current_user["role"] == UserRole.DEPARTMENT_ADMIN:
            session_query["department_id"] = current_user.get("department_id")
        elif current_user["role"] == UserRole.FACULTY:
            session_query["faculty_id"] = current_user["id"]
        
        sessions = await db.sessions.find(session_query, {"_id": 0}).to_list(1000)
        session_ids = [s["id"] for s in sessions]
    
    # Build attendance query
    query = {}
    if session_ids:
        query["session_id"] = {"$in": session_ids}
    
    if current_user["role"] == UserRole.STUDENT:
        query["student_id"] = current_user["id"]
    elif student_id:
        query["student_id"] = student_id
    
    records = await db.attendance_records.find(query, {"_id": 0}).to_list(10000)
    return records

@api_router.get("/attendance/analytics")
async def get_analytics(
    department_id: Optional[str] = None,
    year: Optional[str] = None,
    section: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if department_id:
        query["department_id"] = department_id
    if year:
        query["year"] = year
    if section:
        query["section"] = section
    
    if current_user["role"] == UserRole.DEPARTMENT_ADMIN:
        query["department_id"] = current_user.get("department_id")
    elif current_user["role"] == UserRole.COLLEGE_ADMIN:
        query["college_id"] = current_user.get("college_id")
    
    # Get sessions
    sessions = await db.sessions.find(query, {"_id": 0}).to_list(1000)
    session_ids = [s["id"] for s in sessions]
    
    # Get attendance records
    records = await db.attendance_records.find({"session_id": {"$in": session_ids}}, {"_id": 0}).to_list(10000)
    
    # Calculate stats
    total_sessions = len(sessions)
    total_attendance = len(records)
    
    # Group by student
    student_attendance = {}
    for record in records:
        student_id = record["student_id"]
        if student_id not in student_attendance:
            student_attendance[student_id] = 0
        student_attendance[student_id] += 1
    
    # Get students in department
    student_query = {"role": UserRole.STUDENT}
    if department_id:
        student_query["department_id"] = department_id
    if year:
        student_query["year"] = year
    if section:
        student_query["section"] = section
    
    students = await db.users.find(student_query, {"_id": 0}).to_list(1000)
    
    # Calculate low attendance students (<75%)
    low_attendance_students = []
    for student in students:
        attended = student_attendance.get(student["id"], 0)
        percentage = (attended / total_sessions * 100) if total_sessions > 0 else 0
        if percentage < 75:
            low_attendance_students.append({
                "student_id": student["id"],
                "name": student["name"],
                "attendance": attended,
                "percentage": round(percentage, 2)
            })
    
    # Mock AI insights
    insights = [
        {"type": "info", "message": f"Total sessions conducted: {total_sessions}"},
        {"type": "info", "message": f"Total attendance records: {total_attendance}"},
    ]
    
    if low_attendance_students:
        insights.append({
            "type": "warning",
            "message": f"{len(low_attendance_students)} students have attendance below 75%"
        })
    else:
        insights.append({
            "type": "success",
            "message": "All students have good attendance (>=75%)"
        })
    
    return {
        "total_sessions": total_sessions,
        "total_attendance": total_attendance,
        "average_attendance_per_session": total_attendance / total_sessions if total_sessions > 0 else 0,
        "total_students": len(students),
        "low_attendance_students": low_attendance_students,
        "insights": insights,
        "student_stats": student_attendance
    }

# ==================== FACE RECOGNITION ENDPOINTS ====================

@api_router.post("/face/enroll")
async def enroll_face(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    try:
        contents = await file.read()
        face_hash = hashlib.sha256(contents).hexdigest()
        
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": {"face_embedding": face_hash}}
        )
        
        return {"message": "Face enrolled successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Face enrollment failed: {str(e)}")

@api_router.post("/face/verify")
async def verify_face(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    try:
        user_data = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
        if not user_data.get("face_embedding"):
            raise HTTPException(status_code=400, detail="No face enrolled")
        
        contents = await file.read()
        face_hash = hashlib.sha256(contents).hexdigest()
        
        # Mock verification - in production use actual face recognition
        is_match = True
        
        return {"verified": is_match, "confidence": 0.95}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Face verification failed: {str(e)}")

# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
