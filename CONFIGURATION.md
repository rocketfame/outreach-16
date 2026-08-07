# Конфігурація провайдерів

## 📍 Одне місце для всіх налаштувань

Всі API ключі налаштовуються **тільки в одному місці**: файл `.env.local` в корені проекту.

Вся логіка валідації та отримання ключів знаходиться в `lib/config.ts` - це єдине джерело правди для всіх API ключів.

## Структура

```
.env.local                    ← ДОДАЙТЕ КЛЮЧІ ТУТ (тільки один раз!)
├── TEXT_API_BASE_URL=https://provider.example/v1
├── TEXT_API_KEY=...
├── TEXT_MODEL=...
├── OPENAI_API_KEY=sk-...     ← лише gpt-image-2
└── TAVILY_API_KEY=tvly-...

lib/textProvider.ts           ← Весь текст, із забороною OpenAI endpoint
lib/config.ts                 ← OpenAI images, Tavily, Undetectable
├── getOpenAIApiKey()         ← Валідація та отримання OpenAI ключа
├── getTavilyApiKey()         ← Валідація та отримання Tavily ключа
├── getOpenAIImageClient()    ← Тільки gpt-image-2
├── logApiKeyStatus()         ← Безпечне логування статусу ключів
└── validateContentProviders()← Перевірка text provider + Tavily

app/api/*/route.ts            ← Використовують lib/config.ts
lib/tavilyClient.ts           ← Використовує lib/config.ts
```

## Як це працює

1. **Додайте ключі один раз** в `.env.local`
2. **Всі файли** автоматично використовують `lib/config.ts`
3. **Валідація** відбувається централізовано
4. **Помилки** показують чіткі повідомлення з інструкціями

## Переваги

✅ **Немає дублювання** - ключі налаштовуються один раз  
✅ **Централізована валідація** - всі перевірки в одному місці  
✅ **Легше підтримувати** - зміни в одному файлі  
✅ **Чіткі помилки** - повідомлення вказують на `.env.local`  
✅ **Безпека** - ключі ніколи не логуються повністю

## Використання в коді

### До рефакторингу (старий спосіб):
```typescript
// ❌ Дублювання в кожному файлі
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error("Missing key");
}
if (!apiKey.startsWith("sk-")) {
  throw new Error("Invalid format");
}
const openai = new OpenAI({ apiKey });
```

### Після рефакторингу (новий спосіб):
```typescript
// ✅ Централізовано, без OpenAI text fallback
import { getTextGenerationClient, getTextProviderConfig } from "@/lib/textProvider";

const client = getTextGenerationClient();
const { model } = getTextProviderConfig();
```

## Файли, які використовують конфігурацію

- `app/api/generate-topics/route.ts` - генерація тем
- `app/api/articles/route.ts` - генерація статей
- `app/api/generate/route.ts` - генерація контенту
- `lib/tavilyClient.ts` - пошук через Tavily

Всі ці файли автоматично отримують валідовані ключі з `lib/config.ts`.

## Додавання нових API ключів

Якщо потрібно додати новий API ключ:

1. Додайте в `.env.local`:
   ```bash
   NEW_API_KEY=your-key-here
   ```

2. Додайте функцію в `lib/config.ts`:
   ```typescript
   export function getNewApiKey(): string {
     const apiKey = process.env.NEW_API_KEY;
     if (!apiKey) {
       throw new Error("Missing NEW_API_KEY in .env.local");
     }
     // Валідація...
     return apiKey;
   }
   ```

3. Використовуйте в коді:
   ```typescript
   import { getNewApiKey } from "@/lib/config";
   const key = getNewApiKey();
   ```

## Перевірка налаштувань

Запустіть скрипт перевірки:
```bash
node check-env.js
```

Або перевірте вручну:
```bash
cat .env.local
```











