# Інструкції: Зафіксований промпт генерації статей

## ⚠️ ВАЖЛИВО: Промпт зафіксований

Промпт генерації статей в `lib/articlePrompt.ts` **ЗАФІКСОВАНИЙ** і не повинен змінюватися, окрім параметру кількості слів.

## Що можна змінювати

✅ **Тільки параметр кількості слів** (`[[WORD_COUNT]]`)

## Що НЕ можна змінювати

❌ Всі інші частини промпту  
❌ Структуру промпту  
❌ Інструкції про форматування  
❌ Правила про джерела  
❌ Правила про anchor links  
❌ Правила про brand integration  

## Параметр Word Count

### Логіка роботи:

1. **За замовчуванням**: Якщо `wordCount` не вказано або порожнє → **1500 слів**
2. **Якщо вказано число**: Використовується вказане число
3. **Допустима розбіжність**: ±20 слів від цільового значення

### Приклади:

- `wordCount = ""` або `undefined` → стаття на **1500 слів** (±20)
- `wordCount = "1200"` → стаття на **1200 слів** (±20, тобто 1180-1220)
- `wordCount = "2000"` → стаття на **2000 слів** (±20, тобто 1980-2020)

### Де знаходиться в коді:

**Файл:** `lib/articlePrompt.ts`

**Рядок 65:**
```
- Write a full outreach article in [[LANGUAGE]]. The target word count is [[WORD_COUNT]] words (acceptable range: ±20 words from the target). Brand and platform names must always be capitalized correctly.
```

**Рядки 333-337:**
```typescript
// Calculate word count: use provided wordCount if valid, otherwise default to 1500
const wordCountValue = params.wordCount && params.wordCount.trim() && !isNaN(Number(params.wordCount.trim()))
  ? Number(params.wordCount.trim())
  : 1500; // Default word count
prompt = prompt.replaceAll("[[WORD_COUNT]]", wordCountValue.toString());
```

**Файл:** `app/api/articles/route.ts`

**Рядок 129:**
```typescript
wordCount: brief.wordCount, // Pass wordCount from Project Basics
```

## Як працює

1. Користувач вводить `wordCount` в полі "Word count" в Project Basics
2. Значення передається в `buildArticlePrompt()` через `brief.wordCount`
3. Якщо значення валідне (число) → використовується воно
4. Якщо значення порожнє або невалідне → використовується 1500 (за замовчуванням)
5. В промпті замінюється `[[WORD_COUNT]]` на конкретне число
6. Модель генерує статтю з урахуванням цієї кількості слів (±20)

## Перевірка

Після генерації статті можна перевірити кількість слів через функцію `getWordCount()` в `app/page.tsx`.

## Важливо для розробників

**НЕ ВНОСЬТЕ ЗМІНИ** в промпт без явного дозволу, окрім:
- Виправлення помилок
- Оновлення параметру `[[WORD_COUNT]]` (якщо потрібно змінити логіку за замовчуванням)

**Якщо потрібно змінити промпт:**
1. Обговоріть зміни з командою
2. Задокументуйте причину змін
3. Оновіть цей файл з описом змін




