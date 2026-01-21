# Maintenance Gate Setup

Тимчасова заглушка для головної сторінки з можливістю швидкого вимкнення.

## Як це працює

1. **Заглушка показується** на головній сторінці (`/`) для всіх користувачів
2. **Заглушка НЕ показується** для:
   - Майстер IP адрес (IPv4: `79.168.81.227`, IPv6: `2001:4860:7:225::fe`)
   - Trial URLs з `?trial=token`
   - Master URLs з `?trial=master-token`
3. **Контент за заглушкою** заблюрений
4. **Швидке вимкнення** через environment variable або localStorage

## Налаштування

### Увімкнути/вимкнути заглушку

**В Vercel Environment Variables:**
```
MAINTENANCE_ENABLED=true   # Заглушка увімкнена (за замовчуванням)
MAINTENANCE_ENABLED=false  # Заглушка вимкнена
```

**Швидке вимкнення через браузер (для тестування):**
1. Відкрийте консоль браузера (F12)
2. Виконайте:
```javascript
localStorage.setItem("maintenance_disabled", "true");
location.reload();
```

**Швидке вмикання назад:**
```javascript
localStorage.removeItem("maintenance_disabled");
location.reload();
```

## Майстер IP адреси

Заглушка автоматично обходить для:
- **IPv4**: `79.168.81.227`
- **IPv6**: `2001:4860:7:225::fe`

Якщо ваш IP в цьому списку - заглушка не показується.

## Trial/Master URLs

Заглушка **НЕ показується** для:
- `https://your-app.vercel.app/?trial=master-token` (майстер)
- `https://your-app.vercel.app/?trial=trial-token-1` (trial)

Ці URL працюють як завжди, без заглушки.

## Текст заглушки

Поточний текст:
- **Заголовок**: "Access Request Required"
- **Опис**: "This platform is currently in private beta. To request access and unlock the full functionality, please contact our support team."
- **Email**: `fotosyntezaou@gmail.com`
- **Додатковий текст**: "We'll review your request and provide access credentials as soon as possible."

## Вимкнення заглушки

### Швидке вимкнення (тимчасово):
1. В Vercel Dashboard → Environment Variables
2. Додайте/змініть: `MAINTENANCE_ENABLED=false`
3. Redeploy проект

### Або через код:
В `app/components/MaintenanceGate.tsx` можна тимчасово закоментувати компонент або змінити `isMaintenanceEnabled()` щоб завжди повертав `false`.

## Важливо

- Заглушка показується **тільки** на головній сторінці (`/`)
- API routes (`/api/*`) не блокуються
- Trial/Master URLs завжди обходять заглушку
- Майстер IP адреси автоматично обходять заглушку
