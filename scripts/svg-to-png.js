const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.on('ready', async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1024,
    height: 1024,
    transparent: true,
    frame: false,
    webPreferences: {
      offscreen: true,
    },
  });

  const svgPath = path.join(__dirname, '../src/renderer/assets/logo.svg');
  const pngPath = path.join(__dirname, '../src/renderer/assets/logo.png');

  // Load SVG within a zero-margin HTML wrapper to avoid default padding
  const svgContent = fs.readFileSync(svgPath, 'utf8');
  const htmlContent = `
    <html>
      <style>
        body { margin: 0; padding: 0; overflow: hidden; background: transparent; }
        svg { width: 1024px; height: 1024px; display: block; }
      </style>
      <body>
        ${svgContent}
      </body>
    </html>
  `;

  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
  
  // Wait a bit for rendering
  await new Promise(resolve => setTimeout(resolve, 500));

  const image = await win.webContents.capturePage();
  fs.writeFileSync(pngPath, image.toPNG());

  console.log('Successfully converted SVG to PNG at ' + pngPath);
  app.quit();
});
