# SoftSkills Web — Веб-версия

Веб-платформа для диагностики и развития soft skills.  
Дипломный проект СПбГЭТУ «ЛЭТИ», 2026 — Притчин А.А.

---

## Стек

| Слой | Технологии |
|------|------------|
| Фронтенд | React 18, TypeScript, Vite, Recharts |
| Бэкенд | Node.js, Express, TypeScript |
| БД | PostgreSQL 16 + Prisma ORM |
| Авторизация | JWT (email + пароль) |
| Оплата | ЮMoney (quickpay) |
| Деплой | Docker + docker-compose / Railway / VPS |

---

## Быстрый старт (Docker)

### 1. Клонировать и настроить переменные

```bash
git clone <repo-url>
cd softskills-web
cp backend/.env.example .env
```

Отредактируй `.env` в корне:

```env
JWT_SECRET=your_super_secret_key_here
CLIENT_URL=http://localhost:5173

# ЮMoney (получить на yoomoney.ru/transfer/myservices/http-notification)
YOOMONEY_RECEIVER=ваш_номер_кошелька
YOOMONEY_SECRET=ваш_секрет
YOOMONEY_REDIRECT_URL=http://localhost:5173/payment/success

# Email администратора (через запятую для нескольких)
ADMIN_EMAILS=admin@example.com
```

### 2. Запустить

```bash
docker-compose up --build
```

- Фронтенд: http://localhost:5173
- Бэкенд API: http://localhost:3001
- База данных: localhost:5432

### 3. Заполнить базу данных

```bash
docker-compose exec backend sh -c "node -e \"require('./dist/seed')\" || npx ts-node src/seed.ts"
```

Или вручную через exec в контейнере.

---

## Разработка без Docker

### Бэкенд

```bash
cd backend
npm install
cp .env.example .env    # заполни DATABASE_URL и другие переменные
npx prisma migrate dev  # создать таблицы
npx ts-node src/seed.ts # заполнить данными
npm run dev             # запуск на :3001
```

### Фронтенд

```bash
cd frontend
npm install
npm run dev   # запуск на :5173 с прокси на :3001
```

---

## API-маршруты

### Авторизация
| Метод | URL | Описание |
|-------|-----|----------|
| POST | `/api/auth/register` | Регистрация `{email, password, name?}` |
| POST | `/api/auth/login` | Вход `{email, password}` |
| GET  | `/api/auth/me` | Текущий пользователь (JWT) |

### Тест
| Метод | URL | Описание |
|-------|-----|----------|
| GET  | `/api/test/questions` | Список 25 вопросов |
| POST | `/api/test/submit` | Отправить ответы `{answers: [{questionId, value}]}` |
| GET  | `/api/test/results` | Результаты по навыкам |

### Программа
| Метод | URL | Описание |
|-------|-----|----------|
| GET   | `/api/program` | Программа развития пользователя |
| PATCH | `/api/program/exercise/:id/complete` | Отметить упражнение |

### Оплата
| Метод | URL | Описание |
|-------|-----|----------|
| POST | `/api/payment/create` | Создать платёж → URL ЮMoney |
| POST | `/api/payment/webhook` | Вебхук от ЮMoney (SHA1) |
| GET  | `/api/payment/status/:label` | Проверить статус платежа |

### Админ (требует ADMIN_EMAILS)
| Метод | URL | Описание |
|-------|-----|----------|
| GET  | `/api/admin/stats` | Статистика пользователей |
| GET  | `/api/admin/users` | Список пользователей |
| POST | `/api/admin/exercises` | Добавить упражнение |
| POST | `/api/admin/questions` | Добавить вопрос |
| DELETE | `/api/admin/questions/:id` | Удалить вопрос |

---

## Деплой на Railway

1. Создать проект на [railway.app](https://railway.app)
2. Добавить PostgreSQL сервис
3. Добавить два сервиса: `backend` и `frontend` из GitHub
4. Прописать переменные из `.env.example`
5. `DATABASE_URL` Railway подставляет автоматически

---

## Деплой на VPS

```bash
# На сервере
git clone <repo>
cd softskills-web
nano .env   # заполнить переменные

docker-compose up -d --build

# Настроить nginx как reverse proxy для :5173
# Получить SSL через certbot
```

---

## Структура проекта

```
softskills-web/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma       # Схема БД (8 таблиц)
│   ├── src/
│   │   ├── index.ts            # Express-сервер
│   │   ├── lib/prisma.ts       # Singleton Prisma
│   │   ├── middleware/auth.ts  # JWT + Admin middleware
│   │   ├── routes/
│   │   │   ├── auth.ts         # Авторизация
│   │   │   ├── test.ts         # Тест и результаты
│   │   │   ├── program.ts      # Программа развития
│   │   │   ├── payment.ts      # ЮMoney интеграция
│   │   │   └── admin.ts        # Административный модуль
│   │   ├── services/
│   │   │   └── recommendation.ts  # Алгоритм подбора программы
│   │   └── seed.ts             # 25 вопросов + 20 упражнений
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/client.ts       # HTTP-клиент
│   │   ├── context/AuthContext.tsx
│   │   ├── types/index.ts      # TypeScript-типы
│   │   ├── components/Navbar.tsx
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx  # Главная (публичная)
│   │   │   ├── AuthPages.tsx    # Вход / Регистрация
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── TestPage.tsx     # Тест (25 вопросов)
│   │   │   ├── ResultsPage.tsx  # Результаты + радар
│   │   │   ├── ProgramPage.tsx  # Программа упражнений
│   │   │   └── PaymentPage.tsx  # Оплата + успех
│   │   └── styles/global.css   # Design-система
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
└── docker-compose.yml
```

---

## Алгоритм рекомендаций

Реализован в `backend/src/services/recommendation.ts`:

1. Сортирует 5 навыков по баллу по возрастанию
2. Берёт 3 навыка с наименьшим баллом (зоны роста)
3. Для каждого навыка выбирает 2 упражнения из БД:
   - Бесплатный тариф: только `is_free = true`, сложность по возрастанию
   - Платный тариф: все упражнения доступны
4. Итого: 6 упражнений в программе

Алгоритм верифицирован модульным тестом (Jest, тест-кейс из пояснительной записки).
