# Challenger Clash — Six Eyes, Infinity, and Gambler update

## Updating your existing GitHub repository

1. Download `Challenger-Clash-Six-Eyes-CHANGED-FILES.zip`.
2. Extract it. Don't upload the ZIP itself.
3. In your existing GitHub repository, choose **Add file → Upload files**.
4. Upload the extracted contents, preserving folder paths. When Github asks, replace existing files.
5. Commit changes. If Railway is connected, check its Deployments tab for the new build.

### Replace these files

- `server.js`
- `casino-judas-rules.js`
- `public/index.html`
- `scripts/check.js`
- `test/gambler.test.js`
- `test/casino-judas.test.js`
- `README.md`
- `CHANGELOG.md`

### Optional new file

- `UPDATE-SIX-EYES.md` (this document)

**Do not delete** your existing `public` assets/audio folders, `gambler-rules.js`, `Dockerfile`, or your other characters' files. The current Dockerfile already copies the needed runtime modules.

## Testing locally

Node.js 20+ is required.

```bash
npm install
npm run check
npm test
npm start
```

Try two browsers/devices to validate the 5 CE / 15 CE prompt and the timing contest. The built-in Socket.IO integration suite requires the development dependencies installed.

## Notes

- An interrupted charge still needs a new Six Eyes activation to start a new I.V. attempt.
- Charging cost is deducted *after* start-of-turn energy regeneration.
- The 15 CE route has an opponent response window. Taking it head-on leaves the defender their normal current turn, then the Domain activates on the caster's next turn. A valid counter initiates the Domain Clash instead.
- Stronger attacks produce narrower Infinity parry windows.
- Poker's +2 applies at showdown, not when someone folds.
