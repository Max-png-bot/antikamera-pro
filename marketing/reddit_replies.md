# Готовые ответы на комментарии Reddit (для утра, копировать как есть)

## «How is this different from the $5 scam detector apps?»
Fair question. Those apps mostly wave your phone's magnetometer and beep near any electronics — useless for optics. This one only uses physics that actually works for lenses: retro-reflection, the flashlight trick, but automated: the flash blinks in a rhythm and only glints that blink in sync are flagged (random gloss doesn't sync). And the core is free in the browser — you can verify it before paying anything.

## «Does it work on iPhone?»
Yes, as a web app: open in Safari → Share → Add to Home Screen — it installs and works offline. One honest limitation: iOS Safari doesn't let web apps control the flashlight, so glare mode uses continuous light there (turn on your flashlight). Android Chrome can blink it properly.

## «Why crypto payment?»
No payment processor would underwrite this niche quickly, and I wanted the checkout to be autonomous and auditable: the server literally verifies your USDT transfer in the public TRON blockchain and issues the license instantly. You can watch the transaction on tronscan. Also — the free tier doesn't require any payment at all.

## «Why USDT / TRC20 specifically?»
It's a dollar-pegged stablecoin (no volatility), and TRON transfers cost ~$1. If crypto isn't your thing — that's fine, the free detectors are the point.

## «Is this legal?»
Checking a room you're staying in for your own privacy is legal in most jurisdictions. It doesn't intercept signals or hack anything — it only analyzes images from your own phone's camera.

## «Thermal mode sounds like it needs extra hardware?»
Yes, honest: thermal analysis needs a thermal video source — a USB-C module (InfiRay, Topdon, FLIR One, from ~$100) or a phone with a built-in thermal camera. The glare mode works on any phone with a flash — that's the main detector.

## «Can it find a camera that's powered off?»
No — and I say so on the page. A powered-off camera doesn't glow thermally, and a matte/recessed lens may not glint. No phone app can promise that. This automates the two methods that do work (glint + heat) and cross-checking them in one spot is the strongest signal.

## «Ads? Data harvesting?»
None — everything runs on-device, it's a PWA that works offline, no account, no analytics. The repo (with the sales server) is open: you can read every line.

---
Отвечать коротко и дружелюбно; это заготовки — можно сокращать.


## Готовый ответ: «Does it work on iPhone?» (добавлено 24.11.2026)

> Yes — one honest caveat: Apple doesn't allow any web page (Safari or any other
> iOS browser) to control the phone's flash. That's an OS restriction, not the
> app being lazy. The workaround is built in: you switch on the flashlight from
> Control Center (swipe from the top-right corner), and the app automatically
> flips to continuous-light mode and catches glints from your manual flashlight.
> On Android the flash pulses by itself. Everything else (detection logic,
> logging, thermal mode, offline) is identical on iOS.
