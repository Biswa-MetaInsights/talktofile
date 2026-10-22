# Poster QR codes

One SVG per landing page. Each one encodes `https://talktofile.ai/<slug>`, with error
correction level M, no quiet zone (the poster's white tile provides it), and `#303030` modules
on white. `build.mjs` inlines them, so a rebuild does not need a QR library.

To regenerate (for example, if a URL changes), run this from any folder that has `qrcode@1.5.4`
installed:

```js
const QR = require('qrcode'), fs = require('fs')
for (const s of ['students', 'research', 'business', 'legal'])
  QR.toString(`https://talktofile.ai/${s}`, { type: 'svg', errorCorrectionLevel: 'M', margin: 0,
    color: { dark: '#303030', light: '#ffffff' } }).then((svg) => fs.writeFileSync(`${s}.svg`, svg))
```
