import httpx
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator
from botocore.exceptions import ClientError
from typing import Optional
import boto3
import uuid
import os

from database import get_db, init_db, Todo, TodoFile

S3_ENDPOINT = os.getenv("S3_ENDPOINT", "http://localhost:9000")
S3_PUBLIC_ENDPOINT = os.getenv("S3_PUBLIC_ENDPOINT", "http://localhost:9000")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "minioadmin")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "minioadmin")
S3_BUCKET = os.getenv("S3_BUCKET", "todo-files")

SENTRY_DSN = os.getenv("SENTRY_DSN", None)
SENTRY_ENVIRONMENT = os.getenv("SENTRY_ENVIRONMENT", None)

sentry_sdk.init(
    dsn=SENTRY_DSN,
    environment=SENTRY_ENVIRONMENT,
    traces_sample_rate=1.0,
    profiles_sample_rate=0.1,
    integrations=[
        StarletteIntegration(),
        FastApiIntegration(),
    ]
)

s3 = boto3.client(
    "s3",
    endpoint_url=S3_ENDPOINT,
    aws_access_key_id=S3_ACCESS_KEY,
    aws_secret_access_key=S3_SECRET_KEY,
)

s3_public = boto3.client(
    "s3",
    endpoint_url=S3_PUBLIC_ENDPOINT,
    aws_access_key_id=S3_ACCESS_KEY,
    aws_secret_access_key=S3_SECRET_KEY,
)

app = FastAPI(title="Todo API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def ensure_bucket():
    try:
        s3.head_bucket(Bucket=S3_BUCKET)
    except ClientError:
        s3.create_bucket(Bucket=S3_BUCKET)


@app.on_event("startup")
def startup():
    init_db()
    ensure_bucket()


# --- Schemas ---

class TodoCreate(BaseModel):
    title: str
    description: Optional[str] = ""

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("title cannot be empty")
        return v.strip()


class TodoUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    completed: Optional[bool] = None


# --- Helpers ---

def todo_to_out(todo: Todo) -> dict:
    return {
        "id": todo.id,
        "title": todo.title,
        "description": todo.description or "",
        "completed": todo.completed,
        "created_at": todo.created_at.isoformat(),
        "files": [
            {
                "id": f.id,
                "original_name": f.original_name,
                "file_size": f.file_size,
                "uploaded_at": f.uploaded_at.isoformat(),
            }
            for f in todo.files
        ],
    }


# --- Todo endpoints ---

@app.get("/todos")
def list_todos(db: Session = Depends(get_db)):
    todos = db.query(Todo).order_by(Todo.created_at.desc()).all()
    return [todo_to_out(t) for t in todos]


@app.get("/todos/{todo_id}")
def get_todo(todo_id: int, db: Session = Depends(get_db)):
    todo = db.query(Todo).filter(Todo.id == todo_id).first()
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    return todo_to_out(todo)


@app.post("/todos", status_code=201)
def create_todo(body: TodoCreate, db: Session = Depends(get_db)):
    todo = Todo(title=body.title, description=body.description)
    if todo.title == "test-alert":
        raise AttributeError
    db.add(todo)
    db.commit()
    db.refresh(todo)
    return todo_to_out(todo)


@app.patch("/todos/{todo_id}")
def update_todo(todo_id: int, body: TodoUpdate, db: Session = Depends(get_db)):
    todo = db.query(Todo).filter(Todo.id == todo_id).first()
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    if body.title is not None:
        todo.title = body.title
    if body.description is not None:
        todo.description = body.description
    if body.completed is not None:
        todo.completed = body.completed
    db.commit()
    db.refresh(todo)
    return todo_to_out(todo)


@app.delete("/todos/{todo_id}", status_code=204)
def delete_todo(todo_id: int, db: Session = Depends(get_db)):
    todo = db.query(Todo).filter(Todo.id == todo_id).first()
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    for f in todo.files:
        try:
            s3.delete_object(Bucket=S3_BUCKET, Key=f.filename)
        except ClientError:
            pass
    db.delete(todo)
    db.commit()


# --- File endpoints ---

@app.post("/todos/{todo_id}/files", status_code=201)
async def upload_file(todo_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    todo = db.query(Todo).filter(Todo.id == todo_id).first()
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")

    ext = os.path.splitext(file.filename)[1]
    object_key = f"{uuid.uuid4().hex}{ext}"

    s3.upload_fileobj(file.file, S3_BUCKET, object_key)
    size = s3.head_object(Bucket=S3_BUCKET, Key=object_key)["ContentLength"]

    todo_file = TodoFile(
        todo_id=todo_id,
        filename=object_key,
        original_name=file.filename,
        file_size=size,
    )
    db.add(todo_file)
    db.commit()
    db.refresh(todo_file)

    return {
        "id": todo_file.id,
        "original_name": todo_file.original_name,
        "file_size": todo_file.file_size,
        "uploaded_at": todo_file.uploaded_at.isoformat(),
    }


@app.get("/files/{file_id}/download")
def download_file(file_id: int, db: Session = Depends(get_db)):
    todo_file = db.query(TodoFile).filter(TodoFile.id == file_id).first()
    if not todo_file:
        raise HTTPException(status_code=404, detail="File not found")
    url = s3_public.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": S3_BUCKET,
            "Key": todo_file.filename,
            "ResponseContentDisposition": f'attachment; filename="{todo_file.original_name}"',
        },
        ExpiresIn=3600,
    )
    return RedirectResponse(url)


@app.delete("/files/{file_id}", status_code=204)
def delete_file(file_id: int, db: Session = Depends(get_db)):
    todo_file = db.query(TodoFile).filter(TodoFile.id == file_id).first()
    if not todo_file:
        raise HTTPException(status_code=404, detail="File not found")
    try:
        s3.delete_object(Bucket=S3_BUCKET, Key=todo_file.filename)
    except ClientError:
        pass
    db.delete(todo_file)
    db.commit()

@app.get("/test-sentry")
async def test_sentry():
    result = 1 / 0
    return {"result": result}

@app.get("/test-sentry-alerts")
async def test_sentry_alerts():
    result = 1 + "0"
    return {"result": result}

@app.get("/test_sentry_bot_alerts")
async def test_sentry_bot_alerts():
    raise IndexError


async def get_current_user(request: Request):
    return {"id": 123, "email": "user@example.com", "role": "student"}

@app.get("/courses/{course_id}/lessons")
async def get_lessons(
        course_id: int,
        request: Request,
        user: dict = Depends(get_current_user)
):
    sentry_sdk.set_user(
        {
            "id": user["id"],
            "email": user["email"],
            "role": user["role"],
        }
    )
    sentry_sdk.set_context(
        "request_info",
        {
            "course_id": course_id,
            "id": request.headers.get("X-Real-IP", request.client.host),

        }
    )
    raise ValueError


def get_user_balance(user_id: int):
    return 80000

class InsufficientFundsError(Exception):
    pass

def charge_payment(user_id, amount):
    raise InsufficientFundsError


@app.post("/payments/process")
async def process_payment(amount: float, user_id: int):
    # Теги — для фильтрации ошибок в Sentry
    sentry_sdk.set_tag("payment.currency", "USD")
    sentry_sdk.set_tag("payment.amount", str(amount))

    # Breadcrumbs (хлебные крошки) — история шагов до ошибки.
    # Если что-то пойдёт не так, в Sentry будет видно по каким шагам шёл код.
    sentry_sdk.add_breadcrumb(
        category="payment",
        message=f"Начинаем обработку платежа на ${amount}",
        level="info",
    )

    try:
        # Шаг 1
        sentry_sdk.add_breadcrumb(
            category="payment",
            message="Проверяем баланс пользователя",
            level="info",
        )
        balance = get_user_balance(user_id)

        # Шаг 2
        sentry_sdk.add_breadcrumb(
            category="payment",
            message=f"Баланс: ${balance}, списываем ${amount}",
            level="info",
        )
        result = charge_payment(user_id, amount)

        return {"status": "success", "transaction_id": result}

    except InsufficientFundsError as e:
        # Эту ошибку отправляем в Sentry вручную с дополнительным контекстом
        sentry_sdk.capture_exception(e)
        raise HTTPException(400, "Недостаточно средств")



TELEGRAM_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")


@app.post("/webhooks/sentry")
async def sentry_webhook(request: Request):
    """
    Sentry вызывает этот эндпоинт когда происходит ошибка.
    Мы форматируем данные и отправляем красивое сообщение в Telegram.
    """
    data = await request.json()
    print(data)

    # Извлекаем нужные данные из Sentry payload
    event = data.get("event", {})
    issue_url = data.get("url", "")

    error_title = event.get("title", "Unknown Error")
    error_level = event.get("level", "error").upper()
    culprit = event.get("culprit", "unknown location")
    environment = event.get("environment", "production")
    times_seen = data.get("times_seen", 1)
    print(error_title)
    # Выбираем эмодзи по уровню ошибки
    emoji = {
        "ERROR": "🔴",
        "WARNING": "🟡",
        "INFO": "🔵",
        "FATAL": "💀",
    }.get(error_level, "⚠️")

    # Форматируем сообщение
    message = (
        f"{emoji} *{error_level}: {error_title}*\n\n"
        f"📍 *Где:* `{culprit}`\n"
        f"🌍 *Окружение:* {environment}\n"
        f"🔁 *Раз случилось:* {times_seen}\n\n"
        f"🔗 [Открыть в Sentry]({issue_url})"
    )
    print(message)
    # Отправляем в Telegram
    async with httpx.AsyncClient() as client:
        await client.post(
            f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
            json={
                "chat_id": TELEGRAM_CHAT_ID,
                "text": message,
                "parse_mode": "Markdown",
                "disable_web_page_preview": True,
            },
        )

    return {"status": "ok"}