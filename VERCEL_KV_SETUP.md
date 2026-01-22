# Vercel KV Setup для Trial Usage

## Швидкий чеклист

- [ ] 1. Відкрити Vercel Dashboard → ваш проект → **Storage**
- [ ] 2. Натиснути **Create Database** або **Browse Storage**
- [ ] 3. У модальному вікні знайти секцію **"Marketplace Database Providers"**
- [ ] 4. Виберіть **Upstash** (або **Redis**)
- [ ] 5. Створити нову базу даних (ввести назву, вибрати регіон)
- [ ] 6. Підключити базу до проекту
- [ ] 7. Скопіювати `KV_REST_API_URL` та `KV_REST_API_TOKEN` з деталей бази
- [ ] 8. Перейти до **Settings** → **Environment Variables**
- [ ] 9. Додати обидві змінні (`KV_REST_API_URL` та `KV_REST_API_TOKEN`)
- [ ] 10. Перезапустити deployment (Redeploy)
- [ ] 11. Протестувати: згенерувати статтю → перезавантажити → перевірити, що лічильники збереглися

## Проблема

Раніше trial usage зберігався в in-memory Map, який не зберігався між перезавантаженнями сервера. Це означало, що при перезавантаженні сторінки або сервера всі лічильники обнулялися.

## Рішення

Тепер використовується Vercel KV (Redis) для персистентного зберігання trial usage. Якщо KV не налаштований, система автоматично використовує in-memory fallback.

## Налаштування

### Крок 1: Створіть Vercel KV Database

**Важливо:** KV тепер доступний через Marketplace, а не через "Create New"!

1. **Відкрийте Vercel Dashboard**
   - Перейдіть до [https://vercel.com/dashboard](https://vercel.com/dashboard)
   - Увійдіть у свій акаунт

2. **Виберіть ваш проект**
   - Знайдіть проект `outreach-16` (або назву вашого проекту)
   - Натисніть на нього

3. **Перейдіть до вкладки Storage**
   - У верхньому меню натисніть **Storage**
   - Або перейдіть за посиланням: `https://vercel.com/[your-team]/[your-project]/storage`

4. **Відкрийте Browse Storage**
   - Натисніть кнопку **Create Database** або **Browse Storage**
   - Ви побачите модальне вікно "Browse Storage"

5. **Виберіть Marketplace Database Providers**
   - У модальному вікні переконайтеся, що ви на вкладці **"Select Existing"** або знайдіть секцію **"Marketplace Database Providers"**
   - **Важливо:** Зверніть увагу на повідомлення: "KV and Postgres are now available through the Marketplace"

6. **Виберіть Upstash або Redis**
   - Знайдіть **Upstash** (опис: "Serverless DB (Redis, Vector, Queue, Search)") або **Redis** (опис: "Serverless Redis")
   - Натисніть на картку з **Upstash** (рекомендовано, оскільки це найпростіший варіант для Vercel)
   - Або виберіть **Redis**

7. **Налаштуйте базу даних**
   - Якщо вибрали **Upstash**:
     - Вас перенаправить до налаштування Upstash
     - Створіть нову базу даних або підключіть існуючу
     - Виберіть регіон (рекомендовано: найближчий до ваших користувачів)
     - Введіть назву (наприклад: `trial-usage-kv`)
   - Якщо вибрали **Redis**:
     - Вас перенаправить до налаштування Redis
     - Створіть нову базу даних
     - Виберіть регіон та назву

8. **Підключіть до проекту**
   - Після створення бази, Vercel запропонує підключити її до вашого проекту
   - Переконайтеся, що вибрано правильний проект
   - Натисніть **Connect** або **Link Project**

9. **Очікуйте створення**
   - Vercel створить базу даних за кілька секунд
   - Після створення ви побачите інформацію про базу даних

### Крок 2: Отримайте Environment Variables

Після створення KV бази даних:

1. **Відкрийте вкладку з деталями бази даних**
   - Натисніть на створену базу даних
   - Або перейдіть до вкладки **.env.local** в налаштуваннях бази

2. **Скопіюйте змінні оточення**
   - Ви побачите три змінні:
     - `KV_REST_API_URL` - URL для REST API
     - `KV_REST_API_TOKEN` - Token для автентифікації (основний)
     - `KV_REST_API_READ_ONLY_TOKEN` - Read-only token (опціонально)
   - Скопіюйте значення `KV_REST_API_URL` та `KV_REST_API_TOKEN`

### Крок 3: Додайте Environment Variables до проекту

#### Варіант A: Через Vercel Dashboard (рекомендовано для production)

1. **Перейдіть до Settings проекту**
   - У вашому проекті натисніть **Settings**
   - Або перейдіть: `https://vercel.com/[your-team]/[your-project]/settings`

2. **Відкрийте Environment Variables**
   - У лівому меню натисніть **Environment Variables**
   - Або перейдіть: `https://vercel.com/[your-team]/[your-project]/settings/environment-variables`

3. **Додайте змінні**
   - Натисніть **Add New**
   - Додайте першу змінну:
     - **Key**: `KV_REST_API_URL`
     - **Value**: (вставте скопійоване значення)
     - **Environment**: виберіть `Production`, `Preview`, `Development` (або всі три)
     - Натисніть **Save**
   - Додайте другу змінну:
     - **Key**: `KV_REST_API_TOKEN`
     - **Value**: (вставте скопійоване значення)
     - **Environment**: виберіть `Production`, `Preview`, `Development` (або всі три)
     - Натисніть **Save**

#### Варіант B: Через .env.local (для локальної розробки)

1. **Створіть або відкрийте `.env.local`** в корені проекту
2. **Додайте змінні**:
   ```bash
   KV_REST_API_URL=ваш_url_з_vercel
   KV_REST_API_TOKEN=ваш_token_з_vercel
   ```
3. **Перезапустіть dev server**:
   ```bash
   npm run dev
   ```

### Крок 4: Перезапустіть Deployment

Після додавання змінних оточення:

1. **Через Vercel Dashboard**:
   - Перейдіть до вкладки **Deployments**
   - Знайдіть останній deployment
   - Натисніть на три крапки (⋯) → **Redeploy**
   - Або просто зробіть новий commit і push до GitHub

2. **Через Git** (якщо використовуєте автоматичний deploy):
   ```bash
   git commit --allow-empty -m "Trigger redeploy for KV setup"
   git push
   ```

### Крок 5: Перевірка

Після перезапуску deployment:

1. **Перевірте логи**:
   - У Vercel Dashboard → Deployments → останній deployment → Logs
   - Переконайтеся, що немає помилок пов'язаних з KV

2. **Протестуйте функціональність**:
   - Відкрийте trial link: `https://typereach.app/?trial=trial-09w33n-3143-bpckc2`
   - Згенеруйте статтю/топик/зображення
   - Перезавантажте сторінку (F5)
   - Переконайтеся, що лічильники збереглися

## Альтернатива: Автоматичне додавання змінних

Vercel може автоматично додати змінні оточення при створенні KV бази даних, якщо база пов'язана з проектом. Перевірте:

1. У налаштуваннях KV бази даних → **Settings** → **Linked Projects**
2. Переконайтеся, що ваш проект додано до списку
3. Якщо ні, натисніть **Link Project** та виберіть ваш проект

## Як це працює

1. **При наявності KV**: Дані зберігаються в Redis і персистують між перезавантаженнями
2. **Без KV**: Система використовує in-memory fallback (як раніше)

## Структура даних

Кожен trial token має ключ у форматі: `trial:usage:{token}`

Значення:
```typescript
{
  articlesGenerated: number;
  topicDiscoveryRuns: number;
  imagesGenerated: number;
  lastReset?: number; // timestamp
}
```

## Перевірка

Після налаштування, перевірте:

1. Згенеруйте статтю/топик/зображення з trial token
2. Перезавантажте сторінку
3. Лічильники мають зберегтися

## Перевірка налаштування

### Як перевірити, чи працює KV:

1. **Перевірте змінні оточення**:
   - Vercel Dashboard → Settings → Environment Variables
   - Переконайтеся, що `KV_REST_API_URL` та `KV_REST_API_TOKEN` присутні
   - Переконайтеся, що вони додані для правильних середовищ (Production/Preview/Development)

2. **Перевірте логи deployment**:
   - Vercel Dashboard → Deployments → останній deployment → Logs
   - Шукайте повідомлення типу: `[trialLimits] KV error` (якщо є помилки)
   - Якщо помилок немає, KV працює правильно

3. **Перевірте функціональність**:
   - Відкрийте trial link
   - Згенеруйте статтю/топик/зображення
   - Перезавантажте сторінку (F5 або Cmd+R)
   - Лічильники мають зберегтися

## Troubleshooting

### Проблема: Дані не зберігаються після перезавантаження

**Можливі причини та рішення:**

1. **KV не налаштований**:
   - Перевірте, чи створена KV база даних
   - Перевірте, чи додані змінні оточення
   - Перевірте логи на наявність помилок

2. **Змінні оточення не застосовані**:
   - Переконайтеся, що змінні додані для правильних середовищ
   - Перезапустіть deployment після додавання змінних
   - Для локальної розробки перезапустіть `npm run dev`

3. **KV база даних не активна**:
   - Перевірте статус бази даних у Vercel Dashboard → Storage
   - Переконайтеся, що база не видалена або не призупинена

4. **Помилки в логах**:
   - Перевірте логи deployment на наявність помилок KV
   - Якщо бачите `KV error, falling back to in-memory`, перевірте:
     - Чи правильно скопійовані `KV_REST_API_URL` та `KV_REST_API_TOKEN`
     - Чи не містять вони зайвих пробілів або символів
     - Чи активна KV база даних

### Проблема: "KV not available, using in-memory storage"

Це означає, що система використовує fallback на in-memory store. Перевірте:

1. Чи встановлені змінні оточення `KV_REST_API_URL` та `KV_REST_API_TOKEN`
2. Чи правильно вони скопійовані (без пробілів на початку/в кінці)
3. Чи перезапущений deployment після додавання змінних

### Проблема: Deployment не запускається

Якщо deployment падає з помилкою про KV:

1. Перевірте, чи встановлений `@vercel/kv` в `package.json`
2. Переконайтеся, що змінні оточення додані для правильного середовища
3. Перевірте логи build на наявність помилок TypeScript

## Додаткова інформація

### Структура ключів в KV

Кожен trial token зберігається з ключем: `trial:usage:{token}`

Наприклад, для token `trial-09w33n-3143-bpckc2`:
- Ключ: `trial:usage:trial-09w33n-3143-bpckc2`
- Значення: `{"articlesGenerated":1,"topicDiscoveryRuns":1,"imagesGenerated":0}`

### Перегляд даних в KV

Ви можете переглянути дані в KV через:
- Vercel Dashboard → Storage → ваша KV база → Data Browser
- Або через Vercel CLI: `vercel kv get trial:usage:{token}`
