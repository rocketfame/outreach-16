# Humanization: Removing AI Indicators from Generated Text

## Проблема

LLMs (GPT-5.2, Claude, тощо) інжектують приховані Unicode символи та використовують специфічне форматування, яке робить текст легко ідентифікованим як AI-генерований:

- **Em-dash (—)** - найпоширеніший індикатор AI (GPT-5.2 використовує його надмірно)
- **Smart quotes (" ")** - типографічні лапки замість стандартних
- **Zero-width spaces** - невидимі символи, які можуть викликати проблеми
- **Інші приховані Unicode символи**

## Рішення

Реалізовано комплексний підхід до "х'юманізації" тексту, заснований на [Originality.ai's Invisible Text Detector](https://originality.ai/blog/invisible-text-detector-remover):

### 1. Централізована обробка тексту

Всі згенеровані статті автоматично проходять через функцію `cleanText()` з `lib/textPostProcessing.ts`, яка:

- Видаляє невидимі Unicode символи
- Замінює em-dash на кому з пробілом (більш природно)
- Нормалізує smart quotes до стандартних лапок
- Очищає zero-width spaces та інші приховані символи

### 2. Інструкції в промпті

Додано чіткі інструкції в `lib/articlePrompt.ts`, щоб модель не використовувала:

- Em-dash (—) - замість цього використовувати коми або звичайні дефіси
- Smart quotes - використовувати стандартні прямі лапки
- Приховані Unicode символи

### 3. Автоматичне очищення

Функції очищення застосовуються автоматично після генерації статті:

```typescript
// В app/api/articles/route.ts
let cleanedArticleBodyHtml = cleanText(parsedResponse.articleBodyHtml || content);
```

## Що видаляється/замінюється

### Видаляються (невидимі символи):
- Zero-width space (U+200B)
- Zero-width non-joiner (U+200C)
- Zero-width joiner (U+200D)
- Left-to-right mark (U+200E)
- Right-to-left mark (U+200F)
- Zero-width no-break space / BOM (U+FEFF)
- Mongolian variation selectors (U+180B-D)
- Variation selectors (U+FE00-FE0F)
- Word joiners (U+2060-U+2064)

### Замінюються (AI індикатори):
- **Em-dash (—)** → `, ` (кома з пробілом) - найважливіше!
- **En-dash (–)** → `-` (звичайний дефіс)
- **Smart double quotes (" ")** → `"` (стандартні лапки)
- **Smart single quotes (' ')** → `'` (стандартний апостроф)
- **Ellipsis (…)** → `...` (три крапки)

### Видаляються (Markdown синтаксис):
- **Markdown bold (`**text**`)** → `text` (видаляються зірочки)
- **Markdown italic (`*text*`)** → `text` (видаляються зірочки)
- **Markdown links (`[text](url)`)** → `text` (видаляється посилання)
- **Markdown headers (`# Header`)** → `Header` (видаляється #)

## Приклади

### Приклад 1: Em-dash

**До очищення:**
```
If you've ever uploaded a track—and watched it sink—you've met the algorithm.
```

**Після очищення:**
```
If you've ever uploaded a track, and watched it sink, you've met the algorithm.
```

### Приклад 2: Markdown синтаксис

**До очищення:**
```
**how does soundcloud algorithm work for artists**
```

**Після очищення:**
```
how does soundcloud algorithm work for artists
```

**Що це було:** Це не кавички, а Markdown синтаксис для жирного тексту (`**текст**`). Символи `**` - це зірочки (Unicode U+002A), які модель іноді використовує замість HTML тегів `<b>`, незважаючи на інструкції.

## Переваги

✅ **Менше AI індикаторів** - em-dash замінюється на кому  
✅ **Природніший текст** - стандартні символи замість типографічних  
✅ **Безпечніший** - видаляються потенційно небезпечні приховані символи  
✅ **Автоматично** - все працює без додаткових налаштувань  

## Тестування

Для перевірки виявлення прихованих символів:

```typescript
import { detectHiddenChars } from '@/lib/textPostProcessing';

const hidden = detectHiddenChars(text);
console.log('Виявлені приховані символи:', hidden);
```

## Важливо

Це **не обхід детекторів AI**, а нормалізація тексту для:
- Кращої читабельності
- Уникнення проблем з форматуванням
- Більш природного вигляду тексту
- Безпеки (видалення потенційно небезпечних символів)

Текст все ще може визначатися як AI-генерований іншими методами (стиль, структура, тощо), але приховані Unicode символи більше не будуть індикатором.

## Посилання

- [Originality.ai: Invisible Text Detector](https://originality.ai/blog/invisible-text-detector-remover)
- [Unicode Hidden Characters Table](https://originality.ai/blog/invisible-text-detector-remover#table)

