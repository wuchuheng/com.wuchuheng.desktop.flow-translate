const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const outputDir = path.join(projectRoot, 'src/renderer/assets/genLogo');
const iconsDir = path.join(outputDir, 'icons');

function run() {
  console.log('Step 1: Converting SVG to PNG...');
  execSync('npx electron scripts/svg-to-png.js', { stdio: 'inherit' });

  console.log('Step 2: Generating icons...');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const inputPng = path.join(projectRoot, 'src/renderer/assets/logo.png');
  execSync(`npx electron-icon-maker --input="${inputPng}" --output="${outputDir}"`, { stdio: 'inherit' });

  console.log('Step 3: Moving and cleaning up icons...');
  
  const sources = {
    icns: path.join(iconsDir, 'mac/icon.icns'),
    png: path.join(iconsDir, 'png/1024x1024.png'),
    ico: path.join(iconsDir, 'win/icon.ico')
  };

  const destinations = {
    icns: path.join(outputDir, 'icon.icns'),
    png: path.join(outputDir, 'icon.png'),
    ico: path.join(outputDir, 'icon.ico')
  };

  for (const key in sources) {
    if (fs.existsSync(sources[key])) {
      fs.renameSync(sources[key], destinations[key]);
      console.log(`Moved ${key} to ${destinations[key]}`);
    } else {
      console.warn(`Warning: Source file not found: ${sources[key]}`);
    }
  }

  if (fs.existsSync(iconsDir)) {
    fs.rmSync(iconsDir, { recursive: true, force: true });
    console.log('Cleaned up temporary icons directory.');
  }

  console.log('Logo generation complete!');
}

try {
  run();
} catch (error) {
  console.error('Logo generation failed:', error);
  process.exit(1);
}
