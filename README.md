# FantomRP Forum — GitHub Pages

Загрузите содержимое этой папки в корень репозитория.

GitHub → Settings → Pages → Deploy from a branch → main → /(root).

## Аккаунты
Сейчас аккаунты работают на frontend через `localStorage`: регистрация, вход, выход и сохранение данных работают в браузере.

Важно: это не серверная база. Данные сохраняются только в конкретном браузере/устройстве. Для общей базы всех пользователей нужен Supabase/Firebase или собственный backend. Пароли в localStorage не подходят для реального публичного проекта.


## Supabase Realtime
This version is prepared for shared topics and realtime updates. Run `SUPABASE_SETUP.sql` once in the Supabase SQL Editor. The browser uses the project URL and publishable key embedded in `assets/js/auth.js`; do not put a service-role key in the site.
