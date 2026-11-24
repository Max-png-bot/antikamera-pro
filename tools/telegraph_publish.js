#!/usr/bin/env node
/* Публикация статей на Telegraph (telegra.ph) — анонимная платформа
   без регистрации. Токен аккаунта сохранён в marketing/no_reg_posting.md */
'use strict';
const TOKEN = '9f01a18490b0c6f4fb3de6dcc8ed4451a0fbf9559cd16ed6d2c1aae6ba69';
const BASE = 'https://antikamera-pro.onrender.com';

const p = (...children) => ({ tag: 'p', children });
const h3 = (t) => ({ tag: 'h3', children: [t] });
const a = (href, text) => ({ tag: 'a', attrs: { href }, children: [text] });
const bq = (...children) => ({ tag: 'blockquote', children });

const PAGES = [
  {
    title: 'Как найти скрытую камеру в отеле или квартире (2026)',
    content: [
      p('Скрытые камеры в съёмном жилье и отелях — реальная проблема. Хорошая новость: вам не нужен «детектор» за 5000 ₽ (в основном это игрушки). Нужно 10 минут, телефон и этот порядок действий.'),
      h3('1. Мыслить как установщик'),
      p('Камера обязана видеть кровать или ванную и обязана питаться электричеством. Встаньте в центр комнаты и подумайте, откуда «видно» самое приватное — там и ищите.'),
      h3('2. Найти «лишние» предметы'),
      p('Дымовые датчики с лишним «глазком» и наклоном к кровати; зарядки и переходники, которых вы не приносили; будильники, колонки; зеркала (проверка пальцем: зазор 3–5 мм — обычное зеркало, «прилипание» — возможно, двустороннее); карнизы, вешалки, вентиляционные решётки, игрушки и рамки над кроватью; провода, которые никуда не ведут.'),
      h3('3. Метод фонарика — главный'),
      p('Выключите свет, закройте шторы. Ведите фонарик медленно вдоль подозрительных мест: линза камеры возвращает острый огонёк точно в глаза (как кошачьи глаза ночью) — это называется ретро-отражение. Глянец и хром дают размытое пятно. Так работает метод, который советуют эксперты по безопасности. Слабое место — человеческий глаз: в темноте легко пропустить блик. Поэтому есть автоматизация ↓'),
      h3('4. Автоматическая проверка: приложение в браузере'),
      p('Веб-приложение АнтиКамера PRO работает прямо в браузере телефона, без установки: вспышка мигает в ритме, а приложение отмечает только блики, мигающие строго в такт ей. Металл и глянец «не попадают в ритм», а линза — попадает. Подтверждённая находка обводится красной рамкой. Ядро бесплатно, всё считается на самом телефоне, без интернета и отправки данных.'),
      h3('5. Ночью — красные точки'),
      p('В полной темноте включите камеру телефона (фронтальная чувствительнее к ИК) и осмотритесь: инфракрасные подсветки ночного видения выглядят как тусклые красно-фиолетовые точки.'),
      h3('6. Wi-Fi и отключение питания'),
      p('Подключитесь к Wi-Fi комнаты и запустите сканер сети (Fing): незнакомые устройства с именами вроде IP-CAM — тревожный знак. Выдерните всё из розеток: «датчик», погасший вместе с питанием, — электроника. Если есть USB-C-тепловизор, приложение найдёт устойчивые тёплые точки — работающую электронику.'),
      h3('Если нашли камеру'),
      p('Не трогайте её. Снимите на фото и видео со всех ракурсов, выйдите из поля съёмки, вызовите администрацию — требуйте другую комнату и возврат денег. В съёмном жилье — полиция: тайная съёмка в приватных местах — уголовная статья в большинстве стран.'),
      bq('Честные ограничения: выключенная камера не «светит» и может не бликовать; матовая линза не отражает. Ни один телефон не даёт 100% гарантии — но связка «блик + тепло + осмотр» закрывает подавляющее большинство реальных случаев.'),
      p('Бесплатно проверить комнату: ', a(BASE + '/landing/', 'АнтиКамера PRO — работает в браузере телефона'), '.'),
      p('Полное руководство с иллюстрациями: ', a(BASE + '/blog/ru-oteli.html', 'Как найти скрытую камеру: руководство 2026'), '.'),
    ],
  },
  {
    title: 'How to Find a Hidden Camera in a Hotel Room (2026)',
    content: [
      p('Hidden cameras in rentals and hotel rooms are a documented problem. The good news: you do not need a $300 "detector" (most are junk). You need ten minutes, your phone, and this order of actions.'),
      h3('1. Think like the installer'),
      p('A camera must see the bed or the bathroom, and it needs power. Stand in the middle of the room and think: where would a camera "see" the most private spots? Check there first.'),
      h3('2. Find objects that do not belong'),
      p('Smoke detectors with an extra "eyeball" hole or a tilt toward the bed; chargers and adapters you did not bring; alarm clocks and speakers; mirrors (finger test: a 3–5 mm gap between fingertip and reflection is normal, "touching" may mean two-way); curtain rods, hooks, vents, stuffed toys and frames above the bed; wires that lead nowhere.'),
      h3('3. The flashlight method — the core one'),
      p('Lights off, curtains drawn. Sweep a flashlight slowly across suspicious spots: a camera lens returns a sharp point of light right back at your eyes (like cat eyes at night) — retro-reflection. Glossy plastic and chrome return a smeared glare. This is the method security experts recommend. Its weak spot is the human eye: in a dim room, glints are easy to miss. That is what automation is for ↓'),
      h3('4. Automated check: a browser app'),
      p('The AntiCamera PRO web app runs right in your phone browser, no install: the flash pulses in a rhythm, and the app flags only glints blinking strictly in sync with it. Metal and gloss do not "catch the rhythm" — a lens does. A confirmed find gets a red box. The core is free, everything runs on your phone, nothing gets uploaded.'),
      h3('5. At night — red dots'),
      p('In total darkness, open your phone camera (the front one sees IR better) and look around: infrared illuminators appear as faint red-violet dots.'),
      h3('6. Wi-Fi and the power test'),
      p('Join the room Wi-Fi and run a network scanner (Fing): unknown IP-CAM-style devices are a red flag. Unplug everything: a "sensor" that died with the power is electronics. With a USB-C thermal camera, the app finds small persistent warm spots — powered devices.'),
      h3('If you find one'),
      p('Do not touch it. Document it with photos and video from all angles, step out of its view, call the management — demand another room and a refund. In rentals: police. Covert recording in private areas is a crime in most jurisdictions.'),
      bq('Honest limits: a powered-off camera does not glow and may not glint; a matte lens does not retro-reflect. No phone gives a 100% guarantee — but the glint + heat + inspection combo covers the vast majority of real cases.'),
      p('Scan your room free: ', a(BASE + '/en/', 'AntiCamera PRO — runs in your phone browser'), '.'),
      p('Full illustrated guide: ', a(BASE + '/blog/en-guide.html', 'How to Find a Hidden Camera: 2026 Field Guide'), '.'),
    ],
  },
  {
    title: '酒店隐藏摄像头排查指南（2026）',
    content: [
      p('酒店、民宿、出租屋里的偷拍设备是真实存在的问题。好消息：你不需要几百块的「专业探测器」（大多数是玩具）。你需要的是十分钟、手机，和下面这套动作顺序。'),
      h3('1. 像安装者一样思考'),
      p('摄像头必须「看得见」床或浴室，也必须有电。站在房间中央想一想：从哪里「看」最私密的位置最清楚？就先查哪里。'),
      h3('2. 找出「不该在」的东西'),
      p('带多余「眼球」孔或朝床歪的烟雾报警器；不是你带来的充电器、转换插头；闹钟、音箱；镜子（手指测试：指尖和倒影之间有 3–5 mm 缝隙是普通镜子，「贴在一起」可能是双向镜）；窗帘杆、挂钩、通风格栅、毛绒玩具、床头相框；不通向任何地方的电线。'),
      h3('3. 手电筒法——核心方法'),
      p('关灯拉帘。用手电沿可疑位置慢慢扫：摄像头镜头会把一个锐利的光点反射回你眼睛（像夜里的猫眼）——这叫逆反射。光滑塑料和金属只会反出模糊一片。这是安全专家推荐的方法。它的弱点是人眼：昏暗房间里容易看漏。所以有了自动化 ↓'),
      h3('4. 自动化检查：浏览器里的应用'),
      p('AntiCamera PRO 网页应用直接在手机浏览器里运行，无需安装：闪光灯按节奏脉冲，应用只标记与闪光严格同步闪烁的亮点。金属和光泽「踩不上节奏」，镜头能。确认的发现会用红框标出。核心功能免费，全部在手机本地计算，不上传任何数据。'),
      h3('5. 夜间——红点'),
      p('全黑环境中打开手机相机（前置对红外更敏感）环视：红外补光灯呈暗红色/紫色小点。'),
      h3('6. Wi-Fi 与断电测试'),
      p('连接房间 Wi-Fi，用 Fing 等扫描器查看陌生设备（IP-CAM 类名字是危险信号）。拔掉所有电源：跟着断电「死掉」的传感器就是电子设备。若有 USB-C 热成像摄像头，应用能找出持续发热的小热点。'),
      h3('真的找到了怎么办'),
      p('不要触碰。先从各角度拍照录像取证，退出拍摄范围，叫管理层——要求换房退款。民宿类直接报警：在私密空间偷拍在大多数国家是刑事犯罪。'),
      bq('诚实说明：断电的摄像头不发热、可能不反光；磨砂镜头不逆反射。任何手机都不能 100% 保证——「反光+热点+目视」的组合覆盖现实中绝大多数情况。'),
      p('免费排查房间：', a(BASE + '/zh/', 'AntiCamera PRO——手机浏览器直接运行'), '。'),
      p('完整图文指南：', a(BASE + '/blog/zh-hotel.html', '酒店隐藏摄像头怎么找：完全指南'), '。'),
    ],
  },
];

(async () => {
  for (const page of PAGES) {
    try {
      const res = await fetch('https://api.telegra.ph/createPage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: TOKEN,
          title: page.title,
          author_name: 'AntiCamera PRO',
          author_url: BASE + '/en/',
          content: page.content,
          return_content: false,
        }),
      });
      const j = await res.json();
      if (j.ok) console.log('OK: ' + j.result.url + '  (' + page.title + ')');
      else console.log('ERR ' + page.title + ': ' + JSON.stringify(j).slice(0, 300));
    } catch (e) {
      console.log('FETCH ERR ' + page.title + ': ' + e.message);
    }
  }
})();
