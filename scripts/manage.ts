import { execSync, spawn, ChildProcess } from 'child_process';

const command = process.argv[2]; // 'dev', 'build', 'package', 'publish'

if (process.platform === 'win32') {
  try {
    execSync('chcp 65001', { stdio: 'ignore' });
  } catch {
    /* ignore error */
  }
}

const env = { ...process.env, NODE_ENV: command === 'dev' ? 'development' : 'production' };

function run(cmd: string): ChildProcess {
  return spawn(cmd, { shell: true, stdio: 'inherit', env });
}

async function execute() {
  switch (command) {
    case 'dev':
      execSync('npm run ipc:sync', { stdio: 'inherit', env });
      run('electron-vite dev -w');
      break;

    case 'build':
      console.log('🏗️  Building production assets...');
      execSync('npm run ipc:sync', { stdio: 'inherit', env });
      execSync('electron-vite build', { stdio: 'inherit', env });
      break;

    case 'package':
    case 'publish': {
      const isPublish = command === 'publish';
      const platform = process.platform;

      console.log(`📦 Packaging for ${platform}/${process.arch}...`);

      // Cleanup on Windows - kill any running instances
      if (platform === 'win32') {
        console.log('🛡️  Cleaning up running processes...');
        try {
          execSync('taskkill /IM "Flow Translate.exe" /F', { stdio: 'ignore' });
          execSync('taskkill /IM "electron.exe" /F', { stdio: 'ignore' });
        } catch {
          /* ignore error */
        }
      }

      // 1. Build
      execSync('npm run manage build', { stdio: 'inherit', env });

      // 2. Package using electron-builder defaults
      const builderFlag = platform === 'win32' ? '--win' : platform === 'darwin' ? '--mac' : '--linux';
      const publishFlag = isPublish ? '-p always' : '';

      const builderCmd = `npx electron-builder build ${builderFlag} ${publishFlag}`.trim();

      console.log(`🏃 Executing: ${builderCmd}`);
      try {
        execSync(builderCmd, { stdio: 'inherit', env });
        console.log(`\n✨ Success! Artifacts are in: dist/`);
      } catch {
        console.error('\n❌ Build failed. Tip: Close any running instances of the app.');
        process.exit(1);
      }
      break;
    }

    default:
      process.exit(1);
  }
}

execute();
