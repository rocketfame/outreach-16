# Технічне завдання: CreditsExhausted Widget

## Проблема
Віджет `CreditsExhausted` не відображається, навіть коли `isOpen={true}`. Компонент не викликається React'ом.

## Коли має з'являтися віджет

### Умови відображення:
1. **Після вичерпання trial лімітів**:
   - Коли користувач спробував згенерувати **3-тю topic discovery** (ліміт: 2)
   - Коли користувач спробував згенерувати **3-тю статтю** (ліміт: 2)
   - Коли користувач спробував згенерувати **2-ге зображення** (ліміт: 1)
   - Коли **всі кредити вичерпані** (topicDiscoveryRunsRemaining === 0 && articlesRemaining === 0 && imagesRemaining === 0)

2. **Миттєве відображення**:
   - Віджет має з'являтися **ОДРАЗУ** після вичерпання ліміту
   - **ДО** того, як генерація почнеться (перевірка в `checkTrialLimitsBeforeGeneration`)
   - **БЛОКУЄ** подальші дії користувача (overlay з високим z-index)

3. **Логіка в page.tsx**:
   ```typescript
   // При перевірці лімітів:
   if (limitExhausted) {
     setTrialStats({ topicSearches, articles, images });
     setIsCreditsExhaustedOpen(true);
     return { allowed: false }; // Блокуємо генерацію
   }
   ```

4. **Не показується**:
   - Якщо користувач не в trial mode
   - Якщо є доступні кредити
   - Якщо `isOpen={false}`

### Послідовність подій:
1. Користувач натискає "Generate" (topics/articles/image)
2. Викликається `checkTrialLimitsBeforeGeneration()`
3. Перевіряються поточні ліміти через API `/api/trial-usage`
4. Якщо ліміт вичерпано → `setIsCreditsExhaustedOpen(true)` + `setTrialStats(...)`
5. **Віджет з'являється миттєво** (React re-render)
6. Генерація **НЕ** починається (return { allowed: false })

## Новий підхід

### 1. Архітектура
- **Відмовитися від `createPortal`** - використовувати звичайний рендеринг, як у `UpgradeModal` та `LoadingOverlay`
- **Простий умовний рендеринг**: `if (!isOpen) return null;`
- **Фіксована позиція з високим z-index** (9999) для перекриття всього контенту
- **Backdrop (overlay)** для затемнення фону

### 2. Структура компонента
```
CreditsExhausted/
├── Overlay (backdrop) - rgba(0,0,0,0.5), fixed, full screen
└── Modal Container
    ├── Header (icon + title + description)
    ├── Stats Section (topic searches, articles, images)
    ├── Features Section (unlock features grid)
    ├── Pricing Section
    └── Footer (Upgrade button)
```

### 3. Логіка відображення
- **Умова**: `isOpen === true`
- **Рендеринг**: Безпосередньо в JSX, без Portal
- **Закриття**: 
  - Клік на backdrop
  - Кнопка Escape
  - Кнопка "Upgrade Now" (викликає `onUpgrade`)

### 4. Інтеграція в page.tsx
- Рендерити компонент **БЕЗ умов** - завжди в JSX
- Компонент сам вирішує, чи показувати себе через `if (!isOpen) return null;`
- Використовувати той самий паттерн, що й `UpgradeModal`

### 5. Стилізація
- Inline styles (як зараз)
- z-index: 9999
- position: fixed
- top: 0, left: 0, right: 0, bottom: 0

### 6. Переваги нового підходу
- ✅ Простіший код
- ✅ Менше точок відмови
- ✅ Такий самий паттерн, як у працюючих компонентів
- ✅ Легше дебажити
- ✅ Не залежить від Portal API

## План реалізації
1. Переписати `CreditsExhausted.tsx` з нуля, використовуючи простий підхід
2. Прибрати всі `createPortal` та складну логіку
3. Використати той самий паттерн, що й `UpgradeModal`
4. Перевірити рендеринг в `page.tsx`
5. Тестувати відображення

## Очікуваний результат
Віджет має з'являтися миттєво при `isOpen={true}`, перекриваючи весь контент з високим z-index.
