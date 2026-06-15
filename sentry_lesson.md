# Sentry — Отлов ошибок в продакшне

## Содержание

1. [Что такое Sentry и зачем он нужен](#1-что-такое-sentry-и-зачем-он-нужен)
2. [Как работает Sentry](#2-как-работает-sentry)
3. [Регистрация и создание проекта](#3-регистрация-и-создание-проекта)
4. [Подключение к FastAPI](#4-подключение-к-fastapi)
5. [Контекст ошибки — кто, где, что делал](#5-контекст-ошибки--кто-где-что-делал)
6. [Подключение к Celery](#6-подключение-к-celery)
7. [Уровни событий — не только ошибки](#7-уровни-событий--не-только-ошибки)
8. [Алерты в Telegram](#8-алерты-в-telegram)
9. [Фильтрация — что не нужно отправлять в Sentry](#9-фильтрация--что-не-нужно-отправлять-в-sentry)
10. [Итог и лучшие практики](#10-итог-и-лучшие-практики)

---

## 1. Что такое Sentry и зачем он нужен

Представь: твой сайт работает в продакшне. Пользователь нажал кнопку — получил ошибку. Он не будет писать тебе traceback — он просто уйдёт. Ты даже не узнаешь что что-то сломалось.

**Sentry** — это сервис который автоматически перехватывает все ошибки в твоём приложении и присылает их тебе с полным контекстом: что за ошибка, в какой строке кода, какой пользователь, какой запрос он делал, какие были данные.

### Без Sentry

```
Пользователь получил ошибку 500
        ↓
Ты не знаешь об этом
        ↓
Через неделю другой пользователь написал: "у вас что-то сломано"
        ↓
Ты смотришь логи... 10 000 строк... ищешь...
        ↓
Нашёл ошибку через 2 часа
```

### С Sentry

```
Пользователь получил ошибку 500
        ↓
Через 1 секунду тебе приходит уведомление в Telegram:
"🔴 ZeroDivisionError в calculate_price() line 42
 Пользователь: user@mail.com
 Запрос: POST /api/orders/
 Данные: {quantity: 0}
 Уже случилось: 3 раза"
        ↓
Ты открываешь Sentry, видишь полный traceback,
исправляешь за 10 минут
```

### Что Sentry показывает по каждой ошибке

- Полный traceback с подсветкой строки
- Какой пользователь столкнулся с ошибкой
- Какой HTTP запрос он делал (метод, URL, тело, заголовки)
- Переменные окружения в момент ошибки
- История браузера/запросов до ошибки
- Сколько раз эта ошибка уже случалась
- График — когда ошибка появилась и как часто

---

## 2. Как работает Sentry

```
FastAPI / Celery                    Sentry
      │                               │
      │  Произошла ошибка             │
      │                               │
      │  SDK перехватывает её         │
      │  собирает контекст:           │
      │  - traceback                  │
      │  - данные запроса             │
      │  - данные пользователя        │
      │                               │
      │  POST https://sentry.io/api/  │
      │ ─────────────────────────────→│
      │                               │  сохраняет
      │                               │  группирует похожие
      │                               │  отправляет алерт
      │                               │
                              Ты получаешь уведомление
                              и открываешь Sentry
```

**DSN (Data Source Name)** — это URL с ключом который ты получаешь в Sentry. SDK использует его чтобы знать куда отправлять ошибки. Выглядит так:

```
https://abc123@o123456.ingest.sentry.io/789012
```

---

## 3. Регистрация и создание проекта

### Шаг 1 — Регистрация

1. Заходи на **https://sentry.io**
2. Нажми **Get Started** → регистрируйся через GitHub или email
3. Выбери план **Free** — 5000 ошибок в месяц бесплатно, для учёбы хватит

### Шаг 2 — Создание проекта

```
После входа:
→ Projects → Create Project
→ Выбираешь платформу: Python → FastAPI
→ Название проекта: my-app-backend
→ Create Project
```

### Шаг 3 — Получение DSN

После создания проекта Sentry сразу показывает DSN. Также его можно найти:

```
Project Settings → Client Keys (DSN) → DSN
```

Копируй DSN — он понадобится в `.env`:

```env
SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/789012
SENTRY_ENVIRONMENT=production   # или development
```

---

## 4. Подключение к FastAPI

### Установка

```bash
pip install sentry-sdk[fastapi]
```

### app/main.py — минимальное подключение

```python
import sentry_sdk
from fastapi import FastAPI
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration
import os

# Инициализируем Sentry — это нужно сделать ДО создания FastAPI приложения
sentry_sdk.init(
    # DSN — адрес куда отправлять ошибки. Берём из переменной окружения.
    dsn=os.getenv("SENTRY_DSN"),

    # Окружение — помогает различать ошибки из продакшна и разработки
    environment=os.getenv("SENTRY_ENVIRONMENT", "development"),

    # traces_sample_rate — какой процент запросов отслеживать для трейсинга.
    # 1.0 = 100% запросов. В продакшне ставь 0.1 (10%) чтобы не превысить лимит.
    traces_sample_rate=1.0,

    # profiles_sample_rate — профилировщик производительности.
    # Показывает где тормозит код.
    profiles_sample_rate=0.1,

    # Интеграции — автоматически перехватывают ошибки из FastAPI
    integrations=[
        StarletteIntegration(),
        FastApiIntegration(),
    ],
)

app = FastAPI()


@app.get("/")
async def root():
    return {"message": "Hello"}


# Тестовый эндпоинт — намеренно вызываем ошибку чтобы проверить Sentry
@app.get("/test-sentry")
async def test_sentry():
    # Эта строка вызовет ZeroDivisionError
    # Sentry должен поймать её и отправить в дашборд
    result = 1 / 0
    return {"result": result}
```

### Проверяем что Sentry работает

```bash
# Запускаем приложение
uvicorn app.main:app --reload

# Вызываем тестовую ошибку
curl http://localhost:8000/test-sentry
# → {"detail": "Internal Server Error"}

# Заходим на sentry.io → Issues
# Должна появиться ошибка ZeroDivisionError
```

---

## 5. Контекст ошибки — кто, где, что делал

Просто знать что произошла ошибка — мало. Нужно знать **кто** столкнулся с ошибкой и **что именно делал**. Для этого добавляем контекст.

### Добавляем данные пользователя

```python
import sentry_sdk
from fastapi import FastAPI, Request, Depends
from fastapi.security import HTTPBearer

app = FastAPI()


async def get_current_user(request: Request):
    """Получаем текущего пользователя из токена"""
    # Упрощённо — в реальном проекте декодируешь JWT
    return {"id": 123, "email": "user@example.com", "role": "student"}


@app.get("/courses/{course_id}/lessons")
async def get_lessons(
    course_id: int,
    request: Request,
    user: dict = Depends(get_current_user),
):
    # Говорим Sentry кто делает этот запрос.
    # Если произойдёт ошибка — в Sentry будет видно какой пользователь пострадал.
    sentry_sdk.set_user({
        "id": user["id"],
        "email": user["email"],
        "role": user["role"],
    })

    # Добавляем дополнительный контекст — любые данные которые помогут при отладке
    sentry_sdk.set_context("request_info", {
        "course_id": course_id,
        "ip": request.headers.get("X-Real-IP", request.client.host),
    })

    # ... логика получения уроков ...
    lessons = get_lessons_from_db(course_id)  # допустим здесь ошибка
    return {"lessons": lessons}
```

### Middleware — автоматически добавляем пользователя ко всем запросам

Вместо того чтобы писать `sentry_sdk.set_user()` в каждом эндпоинте — делаем middleware:

```python
from fastapi import FastAPI, Request
import sentry_sdk

app = FastAPI()


@app.middleware("http")
async def sentry_user_middleware(request: Request, call_next):
    """
    Этот middleware запускается для каждого запроса.
    Он извлекает пользователя из токена и передаёт данные в Sentry.
    Теперь при любой ошибке Sentry будет знать какой пользователь пострадал.
    """
    # Пробуем получить токен из заголовка
    token = request.headers.get("Authorization", "").replace("Bearer ", "")

    if token:
        try:
            # В реальном проекте — декодируй JWT токен
            # user = decode_jwt(token)
            user = {"id": 1, "email": "user@example.com"}  # упрощённо

            sentry_sdk.set_user({
                "id": user["id"],
                "email": user["email"],
            })
        except Exception:
            pass  # Невалидный токен — просто пропускаем

    # Добавляем тег — по нему можно фильтровать ошибки в Sentry
    sentry_sdk.set_tag("endpoint", str(request.url.path))

    response = await call_next(request)
    return response
```

### Теги и breadcrumbs — хлебные крошки

```python
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
```

### Ручная отправка ошибки

```python
import sentry_sdk

# Отправить исключение вручную (не ждать пока оно всплывёт)
try:
    risky_operation()
except Exception as e:
    sentry_sdk.capture_exception(e)
    # Обрабатываем ошибку сами, но Sentry всё равно узнает

# Отправить текстовое сообщение (не исключение)
sentry_sdk.capture_message(
    "Пользователь пытается войти с заблокированного IP",
    level="warning",
)
```

---

## 6. Подключение к Celery

Ошибки в фоновых задачах особенно коварны — они не видны пользователю, но задача при этом не выполняется. Sentry перехватывает и их.

### app/celery_app.py

```python
import os
import sentry_sdk
from celery import Celery
from sentry_sdk.integrations.celery import CeleryIntegration

# Инициализируем Sentry с интеграцией для Celery
sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    environment=os.getenv("SENTRY_ENVIRONMENT", "development"),
    traces_sample_rate=0.1,
    integrations=[
        CeleryIntegration(
            # monitor_beat_tasks=True — отслеживать периодические задачи.
            # Если задача не запустилась вовремя — Sentry пришлёт алерт.
            monitor_beat_tasks=True,
        ),
    ],
)

celery_app = Celery(
    "demo",
    broker=os.getenv("RABBITMQ_URL"),
    backend=os.getenv("REDIS_URL"),
    include=["app.tasks"],
)
```

### app/tasks.py — ошибки в задачах

```python
import sentry_sdk
from app.celery_app import celery_app


@celery_app.task(bind=True, max_retries=3)
def send_email(self, to: str, subject: str, body: str):
    """
    Если в этой задаче произойдёт необработанная ошибка —
    Sentry автоматически её поймает благодаря CeleryIntegration.
    """
    try:
        # Добавляем контекст — кому отправляем письмо
        sentry_sdk.set_context("email", {
            "to": to,
            "subject": subject,
        })

        # Имитация отправки
        result = smtp_send(to, subject, body)
        return {"status": "sent"}

    except SMTPConnectionError as e:
        # Сетевая ошибка — делаем retry, не отправляем в Sentry
        # (это ожидаемая временная ошибка)
        raise self.retry(exc=e, countdown=60)

    except Exception as e:
        # Неожиданная ошибка — отправляем в Sentry и не делаем retry
        sentry_sdk.capture_exception(e)
        raise


@celery_app.task
def generate_monthly_report(month: int, year: int):
    """Периодическая задача — Sentry следит что она запускается вовремя"""

    # Добавляем контекст задачи
    sentry_sdk.set_context("report", {
        "month": month,
        "year": year,
    })

    # ... генерация отчёта ...
    return {"status": "done"}
```

### Мониторинг Beat задач (Cron Monitoring)

Sentry умеет следить что периодические задачи запускаются вовремя. Если задача должна была запуститься в 9:00 но не запустилась — Sentry пришлёт алерт.

```python
# app/celery_app.py
from celery.schedules import crontab

celery_app.conf.beat_schedule = {
    "daily-report-9am": {
        "task": "app.tasks.generate_monthly_report",
        "schedule": crontab(hour=9, minute=0),
        # Sentry Cron Monitor — отслеживаем что задача запускается
        "options": {
            "headers": {
                "sentry-monitor-slug": "daily-report",  # имя монитора в Sentry
            }
        },
    },
}
```

---

## 7. Уровни событий — не только ошибки

Sentry может получать не только ошибки но и предупреждения и информационные события.

```python
import sentry_sdk

# DEBUG — отладочная информация (обычно не отправляется в продакшне)
sentry_sdk.capture_message("Начинаем импорт данных", level="debug")

# INFO — информационное событие
sentry_sdk.capture_message(
    f"Новый пользователь зарегистрировался: user@mail.com",
    level="info",
)

# WARNING — что-то подозрительное, но не ошибка
sentry_sdk.capture_message(
    f"Пользователь {user_id} пытался войти 10 раз подряд",
    level="warning",
)

# ERROR — ошибка (обычно исключение)
try:
    result = dangerous_operation()
except Exception as e:
    sentry_sdk.capture_exception(e)  # level="error" по умолчанию

# FATAL — критическая ошибка, приложение не может продолжать работу
sentry_sdk.capture_message(
    "База данных недоступна, приложение останавливается",
    level="fatal",
)
```

### Группировка ошибок

Sentry автоматически группирует похожие ошибки. Например 1000 одинаковых `ZeroDivisionError` из одной строки — это одна issue, не 1000 разных.

```
Sentry Issues:
┌─────────────────────────────────────────────────────┐
│ 🔴 ZeroDivisionError          × 1247    2 часа назад │
│    calculate_price() line 42                         │
├─────────────────────────────────────────────────────┤
│ 🟡 KeyError: 'user_id'        × 3       1 день назад │
│    process_payment() line 89                         │
├─────────────────────────────────────────────────────┤
│ 🔴 ConnectionError            × 89      5 мин назад  │
│    send_email() line 23                              │
└─────────────────────────────────────────────────────┘
```

---

## 8. Алерты в Telegram

Sentry умеет отправлять уведомления в разные каналы. Для Telegram используем вебхук через бота.

### Шаг 1 — Создаём Telegram бота

```
1. Открываем @BotFather в Telegram
2. Пишем /newbot
3. Придумываем имя: MyApp Errors Bot
4. Придумываем username: myapp_errors_bot
5. Получаем токен: 1234567890:AAHdqTcvCHhvCHhvCHhvCHhvCHhvCHhvCH
```

### Шаг 2 — Получаем Chat ID

```
1. Добавляем бота в нужный чат или пишем ему лично
2. Открываем в браузере:
   https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
3. В ответе находим "chat":{"id": -1001234567890}
4. Это и есть наш Chat ID
```

### Шаг 3 — Настраиваем алерты в Sentry

```
Sentry → Alerts → Create Alert Rule

Тип: Issue Alert (алерт при новой ошибке)

Условия (WHEN):
→ A new issue is created       ← новая ошибка впервые
→ An issue occurs more than 10 times ← ошибка случилась 10+ раз

Фильтры (IF):
→ The issue's level is equal to: error  ← только ошибки уровня error и выше

Действие (THEN):
→ Send a notification via: Webhook
→ URL: https://api.telegram.org/bot<TOKEN>/sendMessage
```

### Шаг 4 — Свой скрипт для красивых уведомлений

Вебхук Sentry отправляет JSON. Напишем простой FastAPI эндпоинт который принимает его и форматирует сообщение для Telegram:

```python
# app/webhooks.py
import httpx
import os
from fastapi import FastAPI, Request

app = FastAPI()

TELEGRAM_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")


@app.post("/webhooks/sentry")
async def sentry_webhook(request: Request):
    """
    Sentry вызывает этот эндпоинт когда происходит ошибка.
    Мы форматируем данные и отправляем красивое сообщение в Telegram.
    """
    data = await request.json()

    # Извлекаем нужные данные из Sentry payload
    event = data.get("event", {})
    issue_url = data.get("url", "")

    error_title = event.get("title", "Unknown Error")
    error_level = event.get("level", "error").upper()
    culprit = event.get("culprit", "unknown location")
    environment = event.get("environment", "production")
    times_seen = data.get("times_seen", 1)

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
```

### Как выглядит сообщение в Telegram

```
🔴 ERROR: ZeroDivisionError

📍 Где: calculate_price() in app/services.py line 42
🌍 Окружение: production
🔁 Раз случилось: 47

🔗 Открыть в Sentry
```

---

## 9. Фильтрация — что не нужно отправлять в Sentry

Не все ошибки стоит отправлять в Sentry. Ошибки клиента (404, 422) — это нормально, их не нужно видеть как баги.

```python
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from fastapi import HTTPException


def before_send(event, hint):
    """
    Эта функция вызывается перед отправкой каждого события в Sentry.
    Если вернуть None — событие не отправляется.
    Если вернуть event — отправляется.
    """
    # Получаем исключение из hint (если есть)
    exc_info = hint.get("exc_info")
    if exc_info:
        exc_type, exc_value, tb = exc_info

        # Не отправляем HTTP ошибки клиента (4xx)
        if isinstance(exc_value, HTTPException):
            if exc_value.status_code < 500:
                # 400, 401, 403, 404, 422 — это ошибки клиента, не наши баги
                return None

    # Не отправляем если это тестовое окружение
    if event.get("environment") == "testing":
        return None

    return event  # всё остальное отправляем


sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    environment=os.getenv("SENTRY_ENVIRONMENT", "development"),
    traces_sample_rate=1.0,
    before_send=before_send,  # подключаем фильтр
    integrations=[
        StarletteIntegration(),
        FastApiIntegration(),
    ],

    # Игнорируем определённые типы ошибок глобально
    ignore_errors=[
        KeyboardInterrupt,   # Ctrl+C при разработке
    ],
)
```

### Фильтрация чувствительных данных

Sentry может случайно захватить пароли или токены из тела запроса. Очищаем это:

```python
def before_send(event, hint):
    # Очищаем чувствительные данные из тела запроса
    if "request" in event:
        request = event["request"]

        # Очищаем тело запроса
        if "data" in request:
            data = request["data"]
            # Заменяем пароль на ***
            if isinstance(data, dict):
                for field in ["password", "token", "secret", "card_number"]:
                    if field in data:
                        data[field] = "***"

        # Очищаем заголовки — убираем Authorization токен
        if "headers" in request:
            headers = request["headers"]
            if "Authorization" in headers:
                headers["Authorization"] = "Bearer ***"

    return event


sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    before_send=before_send,

    # Список полей которые Sentry автоматически скроет
    send_default_pii=False,  # не отправлять персональные данные автоматически
)
```

---

## 10. Итог и лучшие практики

### Финальный main.py — всё вместе

```python
import os
import sentry_sdk
from fastapi import FastAPI, Request, HTTPException
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration
from sentry_sdk.integrations.celery import CeleryIntegration


def before_send(event, hint):
    """Фильтруем что отправлять в Sentry"""
    exc_info = hint.get("exc_info")
    if exc_info:
        _, exc_value, _ = exc_info
        if isinstance(exc_value, HTTPException) and exc_value.status_code < 500:
            return None  # Не отправляем 4xx ошибки
    return event


sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    environment=os.getenv("SENTRY_ENVIRONMENT", "development"),
    traces_sample_rate=0.1,       # 10% запросов для трейсинга
    profiles_sample_rate=0.1,
    send_default_pii=False,       # не отправлять личные данные
    before_send=before_send,
    integrations=[
        StarletteIntegration(),
        FastApiIntegration(),
        CeleryIntegration(monitor_beat_tasks=True),
    ],
)

app = FastAPI()


@app.middleware("http")
async def sentry_context_middleware(request: Request, call_next):
    """Добавляем контекст пользователя к каждому запросу"""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if token:
        try:
            user = decode_jwt(token)  # твоя функция декодирования
            sentry_sdk.set_user({"id": user["id"], "email": user["email"]})
        except Exception:
            pass
    return await call_next(request)
```

### docker-compose.yml — переменные окружения

```yaml
services:
  api:
    build: .
    environment:
      SENTRY_DSN: ${SENTRY_DSN}
      SENTRY_ENVIRONMENT: production
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
      TELEGRAM_CHAT_ID: ${TELEGRAM_CHAT_ID}

  worker:
    build: .
    command: celery -A app.celery_app worker --loglevel=info
    environment:
      SENTRY_DSN: ${SENTRY_DSN}
      SENTRY_ENVIRONMENT: production
```

### Чеклист

```
☐ DSN в переменных окружения — никогда не хардкодить в коде
☐ send_default_pii=False — не отправлять персональные данные
☐ before_send — фильтруем 4xx ошибки (они не наши баги)
☐ Очищаем поля password, token, Authorization в before_send
☐ traces_sample_rate=0.1 в продакшне — не тратить лимит
☐ set_user() в middleware — контекст пользователя везде
☐ CeleryIntegration — ловим ошибки в фоновых задачах
☐ Алерты только на error и выше — не спамить warning'ами
☐ environment разделяет dev/staging/production ошибки
```

### Полезные ссылки

```
Sentry:         https://sentry.io
Документация:   https://docs.sentry.io/platforms/python/integrations/fastapi
Pricing:        https://sentry.io/pricing (5000 событий/мес бесплатно)
Self-hosted:    https://develop.sentry.dev/self-hosted (свой сервер)
```

---

> **Следующий шаг:** **CI/CD через GitHub Actions** — автодеплой на сервер при пуше в main. Sentry + CI/CD = полный цикл: написал код → тесты прошли → задеплоилось → если что-то сломалось в продакшне → Sentry сразу уведомил.
