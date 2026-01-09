# ТЗ: Topic Meta-Preview (Type + Evergreen + Competition)

## Task: show topic meta-preview (type + evergreen + competition) над кожним блоком теми

### 1. Джерело даних
• Беремо поля з `topics[i]` в результаті Topic Discovery:
  • `searchIntent`
  • (якщо є окреме поле типу: `articleType` / `topicType`)
  • `evergreenScore` (1–5)
  • `competitionLevel` (`low` | `medium` | `high`)

### 2. Новий верхній рядок у картці теми
• Над заголовком теми додати невеликий горизонтальний блок з трьох елементів:

#### 1. Type badge
• Джерело: `articleType` (якщо є) або мапа з `searchIntent`.
• Мапінг для `searchIntent`, якщо окремого типу нема:
  • `how_to` → "How-to guide"
  • `informational` → "Informational"
  • `problem_solving` → "Problem-solving"
  • `comparison` → "Comparison"
  • `strategic` → "Strategic insight"

#### 2. Evergreen badge
• Текст: "Evergreen"
• Поруч вивести 1–5 маркерів (кола/крапки) за `evergreenScore`.
• Приклад: 4/5 → 4 заповнених кружечки та 1 порожній.

#### 3. Competition badge
• Джерело: `competitionLevel`.
• Текст:
  • `low` → "Competition: Low"
  • `medium` → "Competition: Medium"
  • `high` → "Competition: High"
• Колір бейджа:
  • `low` → зелений
  • `medium` → жовтий / помаранчевий
  • `high` → червоний

### 3. Верстка
• Використати існуючі Badge / Tag компоненти.
• Зробити контейнер типу:

```jsx
<div className="topic-meta-row">
  <Badge variant="outline">{typeLabel}</Badge>
  <Badge variant="secondary">
    Evergreen
    <EvergreenDots score={evergreenScore} />
  </Badge>
  <Badge variant={competitionVariant}>{competitionLabel}</Badge>
</div>
```

• На мобільному дозволити перенесення в два ряди, але все лишається над заголовком теми.

### 4. Інше не чіпаємо
• Усе, що нижче (номер, заголовок, For: … Problem: …, кнопка розгортання), залишити як є.
• Не змінювати бекенд / формат JSON, працюємо тільки на фронті.

### Референс
Див. зображення з 5 картками тем, де метрики відображаються компактно над заголовком.
