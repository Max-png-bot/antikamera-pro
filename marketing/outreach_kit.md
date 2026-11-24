# Кит продвижения: где аудитория, что отвечать, что уже сделано

Дата: 23.11.2026. Продакшн: https://antikamera-pro.onrender.com

## Что уже сделано автоматически (без аккаунтов)

| Действие | Результат |
|---|---|
| IndexNow (Bing, Yandex, Naver, Seznam) | ✅ HTTP 202 — сайт принят в очередь индексации |
| Wayback Machine (архив.org) | ✅ вечная публичная копия лендинга: http://web.archive.org/web/20261123173237/https://antikamera-pro.onrender.com/landing/ |
| og-картинка 1200×630 (превью в Telegram/соцсетях) | ✅ og-image.png + теги в лендинге |
| sitemap.xml + robots.txt + файл-ключ IndexNow | ✅ готовы (см. «v2-пакет» ниже) |
| Исследование рынка (Reddit/Пикабу/блоги) | ✅ ниже — инсайты и цели |

Индексация в поисковиках появится через несколько дней (проверка: набрать
в Bing/Yandex `site:antikamera-pro.onrender.com`).

## Главный инсайт из исследования: рынок обожжён фейками

В ветках Reddit о детекторах камер топ-комментарии: **«There isn't one.
They're all scams»**, «apps don't work», «no software can detect cameras».
Люди платили за «детекторы», которые крутят магнитометр и пищат. Отсюда
позиционирование (уже отражено в лендинге, повторять везде):

1. **Это физика, а не магия**: блик объектива — тот самый «фонариковый»
   метод, который эти же ветки советуют руками; приложение просто
   автоматизирует его (мигающая вспышка + фильтр синхронности);
2. **Попробуй бесплатно**: базовые детекторы бесплатны навсегда — платят
   только за удобство (настройки, отчёты);
3. **Честные ограничения**: «спящая» камера не греется, матовая линза не
   блестит — мы это пишем прямо, конкуренты — нет.

Это три козыря против скепсиса. Не обещать 100% — обещать честный инструмент.

## Живые цели (найдены сегодня, вопросы активные)

### Reddit (EN) — ответы уже написаны ниже
- r/hiddencameras «What is the best app to use for finding hidden cameras??» — https://www.reddit.com/r/hiddencameras/comments/1hhfu4t/
- r/hiddencameras «Any apps worth using to locate cameras in a home?» — https://www.reddit.com/r/hiddencameras/comments/1gjc9ru/
- r/digitalnomad «Detecting hidden cameras in hotel, airbnb» — https://www.reddit.com/r/digitalnomad/comments/16t6pu0/
- r/hiddencameras «How can I find hidden cameras in my house?» (28.01.2026!) — https://www.reddit.com/r/hiddencameras/comments/1qpgpy0/
- r/newzealand «I need help to find a hidden camera detector» — https://www.reddit.com/r/newzealand/comments/1esjray/

### RU
- Пикабу: большой пост «Как найти скрытую камеру в съёмной квартире или отеле»
  (комментарии — живая аудитория) — https://pikabu.ru/story/kak_nayti_skryituyu_kameru_v_syomnoy_kvartire_ili_otele_12527857
- Поисковые запросы RU: «как найти скрытую камеру в квартире», «найти камеру
  в отеле телефоном» — под них уже настроен лендинг + сitemap.

## Готовый ответ для Reddit (EN) — копировать целиком

> Not an ad, disclosure first: I built this, so take it with appropriate salt.
>
> The flashlight trick people mention here IS the physically sound method — lenses retro-reflect. The problem is doing it by eye in a dim room: you miss glints. I automated it: the app blinks the phone's flash in a rhythm and only flags glints that blink **in sync with it** — random glossy surfaces (chrome, table gloss) don't sync, an objective does. Free, runs in the browser, nothing gets uploaded.
>
> It also has a second mode: if you own one of those $100 USB-C thermal cameras (InfiRay/Topdon/FLIR One), it analyzes your thermal video for small persistent warm spots while filtering out cooling coffee cups, radiators and people.
>
> Honest limits (because most "detector apps" are indeed garbage, I agree): a camera that's powered off doesn't glow thermally, a matte lens doesn't glint. No phone app is a guarantee — this just makes the two working methods practical.
>
> Free core, no account: https://antikamera-pro.onrender.com/ — happy to answer physics questions here.

Правила: 1 ветка = 1 комментарий; отвечать на вопросы в комментариях сутки-двое;
не вставлять ссылку повторно; ветку с низким скепсисом — не постить первой.

## Готовый ответ для Пикабу/чатов (RU) — копировать целиком

> Сразу честно: сделал этот инструмент сам, поэтому фильтруйте мой совет :)
>
> Тот самый лайфхак «посвети фонариком и ищи блик линзы» — работает, но глазами
> в полутёмной комнате легко пропустить. Я автоматизировал: приложение мигает
> вспышкой телефона в ритме и подсвечивает только те блики, что мигают В ТАКТ —
> хром и глянец не попадают в ритм, объектив попадает. Плюс второй режим: если
> есть дешёвый USB-C тепловизор (InfiRay/Topdon ~100$) — загрузи его видео,
> приложение найдёт маленькие устойчивые тёплые точки, отсеивая чашки, радиаторы
> и людей.
>
> Честные ограничения: выключенная камера не греется и не блестит — 100%
> гарантии не даст ни один телефон. Бесплатно, работает в браузере, ничего
> не отправляет с телефона: https://antikamera-pro.onrender.com/

## Где аккаунты обязательны — и почему бот-аккаунты делать НЕ буду

Reddit, Пикабу, Telegram-каналы, Avito, Product Hunt, рекламные сети — все
требуют регистрацию с подтверждением почты/телефона и капчу. Создавать
фейковые аккаунты и постить с них = спам: платформы банят такие аккаунты
за минуты, а жалобы на «рекламу с ботов» уходят хостеру — Render по
правилам отключает сервис за abuse, и весь бизнес падёт из-за пары ссылок.
Поэтому анонимно сделано всё, что делается легально (индексация, архив,
SEO-файлы, контент), а для постов нужно одно живое действие владельца
(10–15 минут, тексты готовы выше).

## v2-пакет для GitHub (усилит индексацию; опционально, 2 минуты)

В воркспейсе уже лежат новые файлы: `og-image.png`, `sitemap.xml`,
`robots.txt`, `80966fe2...txt` (ключ IndexNow) и обновлённый
`landing/index.html` с og-тегами. Чтобы включить: перетащить эти 5 файлов в
репозиторий `antikamera-pro` (как в первый раз) → Render обновит сайт сам →
сказать ассистенту «прогони IndexNow» — отправлю с ключом, эффект индексации
станет полным.

## Порядок действий владельца по убыванию отдачи

1. Reddit-комментарий в r/hiddencameras (готов, выше) — самая целевая аудитория;
2. v2-пакет в GitHub (2 минуты) — включает SEO-ассеты;
3. Пикабу + 2–3 Telegram-чата про аренду (тексты в posts.md);
4. Видео по video_scripts.md (главный канал массового охвата).
