# Barbara Valentine 💘 (Vanilla Static Site)

A premium, funny, romantic 3-page Valentine website:
- `index.html`: Big question + dodging “No” button + cute fake system error
- `yes.html`: Celebration + confetti (respects prefers-reduced-motion)
- `date.html`: Touch-friendly date choice cards + confirmation

## Tech
- **Only** vanilla HTML/CSS/JS
- No frameworks, no libraries
- Fully static, deployable on **Vercel**
- Works by opening `index.html` locally

## Files
- `index.html`
- `yes.html`
- `date.html`
- `styles.css`
- `script.js`
- `vercel.json`

## Run locally
Just open `index.html` in a browser.

## Deploy to Vercel
1. Push this folder to GitHub (or upload to Vercel).
2. In Vercel, choose a **Static** deployment (no build command).
3. Done.

## Notes
- UI sounds are generated via **Web Audio API** (no audio files).
- Sounds only activate after the first user interaction.
- Mute state is stored in `localStorage`.
- Keyboard accessible (Tab + Enter/Space).
