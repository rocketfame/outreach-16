# Швидке налаштування доступу до Figma API

## Крок 1: Отримати Figma Personal Access Token

1. Відкрийте [Figma Account Settings](https://www.figma.com/settings)
2. Перейдіть до розділу **"Personal Access Tokens"**
3. Натисніть **"Create a new personal access token"**
4. Дайте йому назву (наприклад, "Cursor MCP Integration")
5. **Скопіюйте токен** (він показується тільки один раз!)

## Крок 2: Додати токен до `.env.local`

Відкрийте файл `.env.local` і додайте рядок:

```bash
FIGMA_PERSONAL_ACCESS_TOKEN=ваш-токен-тут
```

**Приклад:**
```bash
OPENAI_API_KEY=sk-...
TAVILY_API_KEY=tvly-...
FIGMA_PERSONAL_ACCESS_TOKEN=figd_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Крок 3: Перезапустити Cursor

1. Закрийте Cursor повністю
2. Відкрийте Cursor знову
3. Перевірте, що MCP сервер працює (Command Palette → "MCP: List Available Tools")

## Крок 4: Використання

Після налаштування ви можете використовувати Figma посилання в чаті:

```
"Онови компонент NicheTag відповідно до дизайну: https://www.figma.com/design/xwukyQF0IRBUwiM6q7mZ1P/Untitled?node-id=2-594"
```

Або просто вказати node-id:
```
"Використай Figma frame node-id=2-594 для оновлення стилів кнопок"
```

## Перевірка роботи

Після перезапуску Cursor, в Command Palette (Cmd/Ctrl + Shift + P) знайдіть:
- "MCP: List Available Tools"
- Ви повинні побачити: `figma_get_file`, `figma_get_node`, `figma_list_files`

## Troubleshooting

**Помилка автентифікації:**
- Перевірте, що токен правильно додано до `.env.local`
- Переконайтеся, що токен не закінчився (перевірте в Figma Settings)

**MCP сервер не знайдено:**
- Перезапустіть Cursor
- Перевірте, що `npx` працює: `npx --version`

**Файл не знайдено:**
- Переконайтеся, що у вас є доступ до Figma файлу
- Перевірте правильність node-id або URL

