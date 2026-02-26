import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import parseChangelog from 'changelog-parser';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// ===========================================
// Configuration
// ===========================================

// SSH configuration from environment
const SSH_ALIAS = process.env.RELEASE_SSH_ALIAS || 'tc';
const REMOTE_ROOT = process.env.RELEASE_REMOTE_ROOT || '/var/www/updates';

// Files to upload for release
const RELEASE_FILE_PATTERNS = ['.exe', '.dmg', '.AppImage', '.snap', '.deb', '.rpm', '.blockmap', 'latest.yml', 'latest-mac.yml', 'latest-linux.yml'];

// ===========================================
// Types
// ===========================================

interface ChangelogVersion {
  version: string | null;
  title: string;
  date: string | null;
  body: string;
  parsed: Record<string, string[]>;
}

interface ChangelogResult {
  title: string;
  description: string;
  versions: ChangelogVersion[];
}

// ===========================================
// Functions
// ===========================================

/**
 * Parse CHANGELOG.md and extract release notes for a specific version
 */
async function extractReleaseNotes(version: string): Promise<string> {
  const changelogPath = path.resolve(__dirname, '../CHANGELOG.md');

  if (!fs.existsSync(changelogPath)) {
    console.warn('⚠️ CHANGELOG.md not found, using default release notes');
    return `### Version ${version}\n- Bug fixes and performance improvements.`;
  }

  try {
    const result = (await parseChangelog({
      filePath: changelogPath,
      removeMarkdown: false,
    })) as ChangelogResult;

    const versionEntry = result.versions.find(
      v => v.version === version || v.version === `v${version}`
    );

    if (!versionEntry || !versionEntry.body) {
      console.warn(`⚠️ Version ${version} not found in CHANGELOG.md`);
      return `### Version ${version}\n- Bug fixes and performance improvements.`;
    }

    console.log(`📄 Extracted release notes for version ${version}`);
    return versionEntry.body.trim();
  } catch (error) {
    console.warn(`⚠️ Failed to parse CHANGELOG.md: ${error instanceof Error ? error.message : error}`);
    return `### Version ${version}\n- Bug fixes and performance improvements.`;
  }
}

function runCommand(cmd: string) {
  console.log(`🏃 ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit', shell: true });
  } catch {
    console.error(`❌ Command failed: ${cmd}`);
    process.exit(1);
  }
}

/**
 * Process latest.yml with release notes
 */
async function processLatestYml(distDir: string, version: string): Promise<void> {
  const ymlFiles = fs.readdirSync(distDir).filter(f => f.endsWith('.yml'));

  for (const ymlFile of ymlFiles) {
    const ymlPath = path.join(distDir, ymlFile);
    let content = fs.readFileSync(ymlPath, 'utf-8');

    // Add forceUpdateRanges if not present
    if (!content.includes('forceUpdateRanges:')) {
      content += '\nforceUpdateRanges: []\n';
    }

    // Extract and add release notes
    const releaseNotes = await extractReleaseNotes(version);

    // Remove existing releaseNotes section
    content = content.replace(/releaseNotes:\s*\n(\s+.*\n?)*/g, '');
    content = content.replace(/releaseNotes:\s*[^\n]+\n/g, '');

    // Add new release notes
    const indentedNotes = releaseNotes.split('\n').map(line => `  ${line}`).join('\n');
    content += `releaseNotes: |\n${indentedNotes}\n`;

    fs.writeFileSync(ymlPath, content);
    console.log(`   📝 Updated ${ymlFile} with release notes`);
  }
}

/**
 * Upload files to remote server
 */
function uploadFiles(distDir: string, platform: string, arch: string): void {
  const remotePath = `${REMOTE_ROOT}/${platform}/${arch}`;

  // Ensure remote directory exists
  runCommand(`ssh ${SSH_ALIAS} "mkdir -p ${remotePath}"`);

  // Find files to upload
  const filesToUpload = fs.readdirSync(distDir).filter(f =>
    RELEASE_FILE_PATTERNS.some(pattern => f.endsWith(pattern) || f === pattern.replace('.', ''))
  );

  if (filesToUpload.length === 0) {
    console.error(`❌ No release files found in ${distDir}`);
    process.exit(1);
  }

  console.log(`📤 Uploading ${filesToUpload.length} file(s):`);
  for (const file of filesToUpload) {
    console.log(`   - ${file}`);
  }

  for (const file of filesToUpload) {
    const localFile = path.join(distDir, file);
    runCommand(`scp "${localFile}" ${SSH_ALIAS}:${remotePath}/`);
  }
}

// ===========================================
// Main
// ===========================================

async function main() {
  console.log('='.repeat(60));
  console.log('🚀 Release Update Script');
  console.log('='.repeat(60));

  // Validate SSH configuration
  if (!process.env.RELEASE_SSH_ALIAS) {
    console.warn('⚠️ RELEASE_SSH_ALIAS not set, using default: tc');
  }
  if (!process.env.RELEASE_REMOTE_ROOT) {
    console.warn('⚠️ RELEASE_REMOTE_ROOT not set');
  }

  // Read version from package.json
  const packageJsonPath = path.resolve(__dirname, '../package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const version = packageJson.version;
  const platform = process.platform;
  const arch = process.arch;

  console.log(`\n📦 Version: ${version}`);
  console.log(`🖥️  Platform: ${platform}/${arch}`);
  console.log(`🌐 Remote: ${SSH_ALIAS}:${REMOTE_ROOT}`);

  // Step 1: Build
  console.log('\n--- Step 1: Building Package ---');
  runCommand('npm run manage package');

  // Step 2: Find dist directory
  const distDir = path.resolve(__dirname, '../dist');

  if (!fs.existsSync(distDir)) {
    console.error(`❌ Dist directory not found: ${distDir}`);
    process.exit(1);
  }

  // Step 3: Process latest.yml with release notes
  console.log('\n--- Step 2: Processing latest.yml ---');
  await processLatestYml(distDir, version);

  // Step 4: Upload files
  console.log('\n--- Step 3: Uploading Files ---');
  uploadFiles(distDir, platform, arch);

  // Step 5: Prepare for local testing
  console.log('\n--- Step 4: Preparing for Local Testing ---');

  // Downgrade version for testing
  packageJson.version = '1.0.0';
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('✅ package.json version set to 1.0.0 for testing');

  // Update dev-app-update.yml using DEV_UPDATE_SERVER_URL
  const devUpdateUrl = process.env.DEV_UPDATE_SERVER_URL || 'https://static.tc.wuchuheng.com';
  const devAppUpdatePath = path.resolve(__dirname, '../dev-app-update.yml');
  fs.writeFileSync(devAppUpdatePath, `provider: generic
url: ${devUpdateUrl}
updaterCacheDirName: flow-translate-updater
`);
  console.log('✅ dev-app-update.yml updated');

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('✨ Release Complete!');
  console.log('='.repeat(60));
  console.log(`\n📋 Uploaded to ${SSH_ALIAS}:${REMOTE_ROOT}/${platform}/${arch}`);
  console.log(`\n👉 Test locally: npm start`);
  console.log(`👉 Revert version: git checkout package.json`);
}

main().catch(console.error);