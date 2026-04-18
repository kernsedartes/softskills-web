# SoftSkills Web

Веб-приложение для диагностики и развития soft skills. Пользователь проходит тест из 25 вопросов, получает профиль компетенций в виде радарной диаграммы и персональную программу упражнений. Есть платный тариф с расширенным набором заданий.

Дипломный проект — СПбГЭТУ «ЛЭТИ», 2026, Притчин А.А.

---

## Что умеет приложение

- Регистрация и авторизация через JWT
- Тест из 25 вопросов по 5 навыкам: коммуникация, лидерство, самоорганизация, эмпатия, критическое мышление
- Радарная диаграмма результатов и детальный разбор по каждому навыку
- График динамики при повторном прохождении теста
- Персональная программа развития с упражнениями и заметками
- Страница рекомендаций — книги, статьи, видео, курсы по каждому навыку
- Загрузка файлов к материалам (PDF и др.)
- Профиль пользователя со сменой имени, email, пароля и аватара
- Мок-оплата для демонстрации платного тарифа
- Административная панель для управления материалами

---

## Стек

**Фронтенд** — React 18, TypeScript, Vite, React Router, Recharts

**Бэкенд** — Node.js, Express, TypeScript, Prisma ORM

**База данных** — PostgreSQL

**Авторизация** — JWT (httpOnly не используется, токен в localStorage — достаточно для учебного проекта)

---

## Запуск

Нужны Node.js 18+ и запущенный PostgreSQL.

### Бэкенд

```bash
cd backend
npm install
```

Создай файл `backend/.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/softskills"
JWT_SECRET="любая-длинная-строка"
PORT=3001
CLIENT_URL="http://localhost:5173"
ADMIN_EMAILS="твой@email.com"
```

```bash
npx prisma migrate dev
npm run db:seed   # заполняет вопросы, упражнения и материалы
npm run dev
```

### Фронтенд

```bash
cd frontend
npm install
```

Создай файл `frontend/.env`:

```env
VITE_ADMIN_EMAILS=твой@email.com
```

```bash
npm run dev
```

Открыть: http://localhost:5173

---

## Структура проекта

```
softskills-web/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.ts           # вопросы, упражнения, материалы
│   │   └── migrations/
│   ├── src/
│   │   ├── index.ts
│   │   ├── middleware/
│   │   │   └── auth.ts       # JWT + проверка админа по email
│   │   ├── routes/
│   │   │   ├── auth.ts       # регистрация, вход, профиль, аватар
│   │   │   ├── test.ts       # вопросы, сдача теста, результаты, история
│   │   │   ├── program.ts    # программа упражнений, статусы, заметки
│   │   │   ├── resources.ts  # материалы + загрузка файлов
│   │   │   ├── payment.ts    # мок-оплата
│   │   │   └── admin.ts      # статистика, управление вопросами
│   │   └── services/
│   │       └── recommendation.ts  # алгоритм подбора программы
│   └── uploads/
│       ├── avatars/
│       └── resources/
└── frontend/
    └── src/
        ├── api/client.ts
        ├── context/
        │   ├── AuthContext.tsx
        │   └── ToastContext.tsx
        ├── components/
        │   ├── Navbar.tsx
        │   └── Skeleton.tsx
        └── pages/
            ├── LandingPage.tsx
            ├── DashboardPage.tsx
            ├── TestPage.tsx
            ├── ResultsPage.tsx
            ├── ProgramPage.tsx
            ├── RecommendationsPage.tsx
            ├── MethodologyPage.tsx
            ├── ProfilePage.tsx
            ├── AdminPage.tsx
            ├── PaymentPage.tsx
            ├── MockPaymentPage.tsx
            └── NotFoundPage.tsx
```

---

## Алгоритм подбора программы

Реализован в `backend/src/services/recommendation.ts`. После сдачи теста:

1. Навыки сортируются по баллу от меньшего к большему
2. Берутся 3 навыка с наименьшим результатом
3. Для каждого из них из базы выбираются упражнения по сложности
4. На бесплатном тарифе — 2 упражнения на навык (6 всего), на платном — 3 (9 всего)
5. Программа пересоздаётся при каждой повторной сдаче теста

---

## Административная панель

Доступна по адресу `/admin` пользователям, чей email указан в `ADMIN_EMAILS`. Позволяет добавлять, редактировать и удалять учебные материалы, а также прикреплять к ним файлы для скачивания.
