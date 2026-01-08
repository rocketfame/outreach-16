# Інструкція для деплою Human Mode / SEO Mode в продакшн

## Налаштування Environment Variable для продакшну

Для того, щоб перемикач Human Mode / SEO Mode з'явився в продакшні, необхідно додати змінну середовища `NEXT_PUBLIC_HUMAN_MODE_EXPERIMENT=true` в налаштуваннях вашого хостингу.

### Для Vercel (рекомендовано для Next.js)

1. Відкрийте [Vercel Dashboard](https://vercel.com/dashboard)
2. Виберіть ваш проект `outreach-16`
3. Перейдіть в **Settings** → **Environment Variables**
4. Додайте нову змінну:
   - **Name**: `NEXT_PUBLIC_HUMAN_MODE_EXPERIMENT`
   - **Value**: `true`
   - **Environment**: оберіть всі (Production, Preview, Development) або тільки Production
5. Натисніть **Save**
6. **Важливо**: Після додавання змінної необхідно зробити **Redeploy** проекту:
   - Перейдіть в **Deployments**
   - Знайдіть останній deployment
   - Натисніть на три крапки (⋯) → **Redeploy**

### Для інших хостингів

#### Netlify
1. Відкрийте Netlify Dashboard
2. Виберіть ваш проект
3. Перейдіть в **Site settings** → **Environment variables**
4. Додайте:
   - **Key**: `NEXT_PUBLIC_HUMAN_MODE_EXPERIMENT`
   - **Value**: `true`
5. Зробіть **Redeploy**

#### Railway
1. Відкрийте Railway Dashboard
2. Виберіть ваш проект
3. Перейдіть в **Variables**
4. Додайте:
   - **Key**: `NEXT_PUBLIC_HUMAN_MODE_EXPERIMENT`
   - **Value**: `true`
5. Зробіть **Redeploy**

#### Self-hosted / Docker
Додайте змінну в ваш `.env` файл або docker-compose.yml:
```bash
NEXT_PUBLIC_HUMAN_MODE_EXPERIMENT=true
```

## Перевірка після деплою

Після того, як ви додали змінну та зробили redeploy:

1. Відкрийте продакшн версію сайту
2. Перевірте, що перемикач Writing Mode з'явився в секції **Project Basics**
3. Перемикач має бути після поля "Word count"
4. Мають бути дві кнопки:
   - **SEO Mode (recommended)**
   - **Human Mode (editorial)**

## Якщо перемикач не з'явився

1. **Перевірте змінну середовища:**
   - Переконайтеся, що змінна додана правильно: `NEXT_PUBLIC_HUMAN_MODE_EXPERIMENT=true`
   - Переконайтеся, що значення саме `true` (не `True`, `TRUE`, або `"true"`)

2. **Перевірте redeploy:**
   - Змінні середовища застосовуються тільки після нового build
   - Зробіть redeploy після додавання змінної

3. **Перевірте консоль браузера:**
   - Відкрийте DevTools (F12)
   - Перевірте, чи немає помилок
   - Можна додати тимчасово в код для дебагу:
     ```typescript
     console.log('HUMAN_MODE_EXPERIMENT:', process.env.NEXT_PUBLIC_HUMAN_MODE_EXPERIMENT);
     ```

4. **Очистіть кеш:**
   - Очистіть кеш браузера (Ctrl+Shift+Delete або Cmd+Shift+Delete)
   - Або відкрийте в режимі інкогніто

## Важливі примітки

- Змінні, які починаються з `NEXT_PUBLIC_`, доступні на клієнті (в браузері)
- Після зміни змінних середовища завжди потрібен новий build/deploy
- Змінна в `.env.local` працює тільки локально, для продакшну потрібно налаштувати в хостингу

## Вимкнення feature flag

Якщо потрібно вимкнути Human Mode в продакшні:
1. Змініть значення змінної на `false` або видаліть її
2. Зробіть redeploy
3. Перемикач зникне, система працюватиме тільки в SEO Mode
