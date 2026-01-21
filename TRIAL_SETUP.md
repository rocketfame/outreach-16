# Trial System Setup

Система trial-доступу з обмеженнями для тестування додатку.

## Як це працює

1. **Trial-токени** - унікальні токени для тестувальників
2. **Майстер-токен** - ваш повний доступ без обмежень
3. **Обмеження для trial**:
   - Максимум **2 статті**
   - Максимум **2 ітерації** Topic Discovery Mode
4. **Лічильники** - автоматично відстежуються для кожного токену

## Налаштування на Vercel

### Крок 1: Додайте Environment Variables в Vercel

1. Відкрийте ваш проект на [Vercel Dashboard](https://vercel.com/dashboard)
2. Перейдіть в **Settings** → **Environment Variables**
3. Додайте наступні змінні:

#### Для Production (обов'язково):

**MASTER_TOKEN**
- Key: `MASTER_TOKEN`
- Value: `your-master-token-here` (створіть унікальний складний токен)
- Environment: `Production`, `Preview`, `Development` (або тільки Production)

**TRIAL_TOKENS**
- Key: `TRIAL_TOKENS`
- Value: `trial-token-1,trial-token-2,trial-token-3` (через кому, без пробілів)
- Environment: `Production`, `Preview`, `Development`

**BASIC_AUTH_USER** (опційно, для додаткового захисту)
- Key: `BASIC_AUTH_USER`
- Value: `your-username`
- Environment: `Production`

**BASIC_AUTH_PASS** (опційно, для додаткового захисту)
- Key: `BASIC_AUTH_PASS`
- Value: `your-password`
- Environment: `Production`

### Крок 2: Перезапустіть Deployment

Після додавання змінних:
1. Перейдіть в **Deployments**
2. Натисніть **⋮** (три крапки) на останньому deployment
3. Виберіть **Redeploy**
4. Або просто зробіть новий commit і push - Vercel автоматично перезапустить

### Крок 3: Локальне налаштування (для розробки)

Додайте в `.env.local`:

```bash
# Майстер-токен (ваш повний доступ без обмежень)
MASTER_TOKEN=your-master-token-here

# Trial-токени (через кому, без пробілів)
TRIAL_TOKENS=trial-token-1,trial-token-2,trial-token-3

# Basic Auth (якщо потрібен захист для майстера)
BASIC_AUTH_USER=your-username
BASIC_AUTH_PASS=your-password
```

### Крок 4: Створення Trial URL

Після налаштування в Vercel, створіть унікальні URL для кожного trial-токену:

**Формат URL:**
```
https://your-project.vercel.app/?trial=trial-token-1
https://your-project.vercel.app/?trial=trial-token-2
https://your-project.vercel.app/?trial=trial-token-3
```

**Приклад:**
Якщо ваш проект називається `outreach-16`:
```
https://outreach-16.vercel.app/?trial=trial-token-1
https://outreach-16.vercel.app/?trial=trial-token-2
```

### Крок 5: Як працює доступ

**Trial-користувач:**
- Відкриває URL з `?trial=token` (наприклад: `https://your-app.vercel.app/?trial=trial-token-1`)
- Може генерувати максимум **2 статті**
- Може запускати Topic Discovery максимум **2 рази**
- Не потребує Basic Auth (токен в URL достатньо)
- Після досягнення ліміту отримує помилку 403 з повідомленням

**Майстер-доступ (ваш):**
- Використовує `?trial=your-master-token` (наприклад: `https://your-app.vercel.app/?trial=your-master-token`)
- АБО використовує Basic Auth (якщо налаштовано)
- **Без обмежень** на статті та ітерації
- Повний доступ до всіх функцій

## Приклади використання на Vercel

### Для тестувальника:
```
https://your-project.vercel.app/?trial=trial-token-1
```

### Для вас (майстер):
```
https://your-project.vercel.app/?trial=your-master-token
```
або просто через Basic Auth (якщо налаштовано `BASIC_AUTH_USER` та `BASIC_AUTH_PASS`).

## Перевірка налаштування на Vercel

### Як перевірити, що все працює:

1. **Перевірте Environment Variables:**
   - Відкрийте Vercel Dashboard → Settings → Environment Variables
   - Переконайтеся, що `MASTER_TOKEN` та `TRIAL_TOKENS` додані
   - Переконайтеся, що вони доступні для `Production` environment

2. **Перевірте Trial URL:**
   - Відкрийте `https://your-project.vercel.app/?trial=trial-token-1`
   - Має відкритися додаток без Basic Auth запиту
   - Спробуйте згенерувати статтю - має працювати

3. **Перевірте Майстер-доступ:**
   - Відкрийте `https://your-project.vercel.app/?trial=your-master-token`
   - Має відкритися додаток
   - Спробуйте згенерувати більше 2 статей - має працювати без обмежень

4. **Перевірка обмежень:**
   - Використайте trial-токен
   - Згенеруйте 2 статті - має працювати
   - Спробуйте згенерувати 3-ю - має повернути помилку 403 з повідомленням про ліміт

## Генерація токенів

Можете використовувати будь-які унікальні рядки як токени. Рекомендовано:
- Використовувати криптографічно безпечні випадкові рядки
- Для майстера - довгий складний токен
- Для trial - коротші, але унікальні токени

Приклад генерації (Node.js):
```javascript
// Генерація випадкового токену
const token = require('crypto').randomBytes(32).toString('hex');
console.log(token);
```

## Лічильники на Vercel

⚠️ **Важливо:** Лічильники зберігаються в пам'яті під час роботи сервера. 

**На Vercel:**
- Після перезапуску deployment (redeploy) лічильники скидаються
- Після idle timeout (якщо немає запитів) лічильники можуть скинутися
- Кожен trial-користувач має свій окремий лічильник

**Для production з персистентністю** (якщо потрібно зберігати лічильники між перезапусками):
- Рекомендується використовувати **Vercel KV** (Redis)
- Або іншу базу даних (PostgreSQL, MongoDB)
- Модифікуйте `lib/trialLimits.ts` для збереження в KV/DB

**Поточна реалізація (in-memory):**
- Працює для короткострокових тестів
- Підходить для демо та trial-періодів
- Не підходить для довгострокового зберігання статистики

## Перевірка статусу

Лічильники можна перевірити через функцію `getUsageStats(token)` в `lib/trialLimits.ts`.

## Важливо

- Trial-токени працюють **тільки** якщо вони додані в `TRIAL_TOKENS`
- Майстер-токен працює **тільки** якщо він доданий в `MASTER_TOKEN`
- Якщо токен не валідний - повертається помилка 403
- Обмеження перевіряються **перед** генерацією контенту
