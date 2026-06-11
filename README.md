# Todo with Files

## Быстрый старт

### Вариант 1 — Локально (без Docker)

**Бэкенд:**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

**Фронтенд:**
```bash
cd frontend
npm install
npm run dev
```

- Бэкенд: http://localhost:8000
- Фронтенд: http://localhost:3000
- Swagger: http://localhost:8000/docs

### Вариант 2 — Docker Compose

```bash
docker-compose up --build
```

## Функциональность

- Создание / редактирование / удаление задач
- Отметка задач как выполненных
- Прикрепление файлов к задачам (загрузка, скачивание, удаление)
- Фильтрация: Все / Активные / Выполненные

docker compose run certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  -d malikarakh.uz \
  -d www.malikarakh.uz \
-d api.malikarakh.uz \
  --email malikarakh07@gmail.com \
  --agree-tos
