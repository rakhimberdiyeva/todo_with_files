# import httpx
# import os
# from fastapi import FastAPI, Request
#
# app = FastAPI()
#
# TELEGRAM_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
# TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")
#
#
# @app.post("/webhooks/sentry")
# async def sentry_webhook(request: Request):
#     """
#     Sentry вызывает этот эндпоинт когда происходит ошибка.
#     Мы форматируем данные и отправляем красивое сообщение в Telegram.
#     """
#     data = await request.json()
#
#     # Извлекаем нужные данные из Sentry payload
#     event = data.get("event", {})
#     issue_url = data.get("url", "")
#
#     error_title = event.get("title", "Unknown Error")
#     error_level = event.get("level", "error").upper()
#     culprit = event.get("culprit", "unknown location")
#     environment = event.get("environment", "production")
#     times_seen = data.get("times_seen", 1)
#
#     # Выбираем эмодзи по уровню ошибки
#     emoji = {
#         "ERROR": "🔴",
#         "WARNING": "🟡",
#         "INFO": "🔵",
#         "FATAL": "💀",
#     }.get(error_level, "⚠️")
#
#     # Форматируем сообщение
#     message = (
#         f"{emoji} *{error_level}: {error_title}*\n\n"
#         f"📍 *Где:* `{culprit}`\n"
#         f"🌍 *Окружение:* {environment}\n"
#         f"🔁 *Раз случилось:* {times_seen}\n\n"
#         f"🔗 [Открыть в Sentry]({issue_url})"
#     )
#
#     # Отправляем в Telegram
#     async with httpx.AsyncClient() as client:
#         await client.post(
#             f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
#             json={
#                 "chat_id": TELEGRAM_CHAT_ID,
#                 "text": message,
#                 "parse_mode": "Markdown",
#                 "disable_web_page_preview": True,
#             },
#         )
#
#     return {"status": "ok"}