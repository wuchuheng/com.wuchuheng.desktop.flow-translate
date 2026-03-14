#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const [, , mode, target] = process.argv;

if (!mode || !['func', 'event'].includes(mode)) {
  console.error('Usage: node scripts/ipc-gen.js <func|event> <module>/<name>');
  process.exit(1);
}

if (!target) {
  console.error('Please provide <module>/<name>, e.g., user/getProfile');
  process.exit(1);
}

const parts = target.split(/[\\/]/).filter(Boolean);
if (parts.length !== 2) {
  console.error('Target must be in the form <module>/<name>, e.g., user/getProfile');
  process.exit(1);
}

const [moduleName, rawName] = parts;
const safeName = rawName.replace(/[^a-zA-Z0-9_$]/g, '_');
const functionId = safeName || 'handler';

const projectRoot = path.resolve(__dirname, '..');
const ipcRoot = path.join(projectRoot, 'src', 'main', 'ipc');
const destDir = path.join(ipcRoot, moduleName);
const destPath = path.join(destDir, `${rawName}.ipc.ts`);

if (fs.existsSync(destPath)) {
  console.error(`IPC file already exists: ${path.relative(projectRoot, destPath)}`);
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });

const invokeTemplate = `const ${functionId} = async (_payload: unknown) => {
  // TODO: implement
  return null as any;
};

export default ${functionId};
`;

const eventTemplate = `import { createEvent } from '@/main/utils/ipc-helper';

const ${functionId} = createEvent<unknown>();

export default ${functionId};
`;

const template = mode === 'event' ? eventTemplate : invokeTemplate;
fs.writeFileSync(destPath, template);

console.log(`Created ${path.relative(projectRoot, destPath)}`);

// Refresh manifest and types
spawnSync('node', [path.join(__dirname, 'sync-ipc-types.js')], { stdio: 'inherit', shell: true });
