#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const args = new Set(process.argv.slice(2));
const watchMode = args.has('--watch');

const projectRoot = path.resolve(__dirname, '..');
const tsconfigPath = path.join(projectRoot, 'tsconfig.json');
const ipcRoot = path.join(projectRoot, 'src', 'main', 'ipc');
const manifestPath = path.join(projectRoot, 'src', 'shared', 'ipc-manifest.json');
const typesPath = path.join(projectRoot, 'src', 'types', 'generated-electron-api.d.ts');

const toPosix = filePath => filePath.split(path.sep).join('/');

const readTsConfig = configPath => {
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext([configFile.error], {
        getCanonicalFileName: f => f,
        getCurrentDirectory: ts.sys.getCurrentDirectory,
        getNewLine: () => ts.sys.newLine,
      })
    );
  }

  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath));
  if (parsed.errors.length) {
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(parsed.errors, {
        getCanonicalFileName: f => f,
        getCurrentDirectory: ts.sys.getCurrentDirectory,
        getNewLine: () => ts.sys.newLine,
      })
    );
  }

  return parsed;
};

const collectIpcFiles = dir => {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap(entry => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return collectIpcFiles(fullPath);
    }
    if (entry.isFile() && entry.name.endsWith('.ipc.ts')) {
      return [fullPath];
    }
    return [];
  });
};

const syncTypes = () => {
  const parsedConfig = readTsConfig(tsconfigPath);
  const ipcFiles = collectIpcFiles(ipcRoot);

  if (!ipcFiles.length) {
    console.warn('No IPC files found. Nothing to sync.');
    return;
  }

  const program = ts.createProgram({
    rootNames: Array.from(new Set([...parsedConfig.fileNames, ...ipcFiles])),
    options: parsedConfig.options,
  });
  const checker = program.getTypeChecker();

  const ensureSourceFile = filePath => {
    const source = program.getSourceFile(filePath);
    if (!source) {
      throw new Error(`Unable to find source file in program: ${filePath}`);
    }
    return source;
  };

  const getDefaultExportType = sourceFile => {
    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
    if (!moduleSymbol) return undefined;

    const exports = checker.getExportsOfModule(moduleSymbol);
    const defaultSymbol =
      exports.find(sym => sym.escapedName === ts.InternalSymbolName.Default) ||
      exports.find(sym => sym.escapedName === 'default');

    if (!defaultSymbol) return undefined;

    return checker.getTypeOfSymbolAtLocation(defaultSymbol, sourceFile);
  };

  const isEventType = (type, sourceFile) => {
    if (!type) return false;
    const flag = checker.getPropertyOfType(type, '_isEvent');
    if (!flag) return false;
    const location = flag.valueDeclaration || flag.declarations?.[0] || sourceFile;
    const flagType = checker.getTypeOfSymbolAtLocation(flag, location);
    const asString = checker.typeToString(flagType);
    return asString === 'true';
  };

  const manifest = {};
  const moduleMap = {};

  ipcFiles.forEach(filePath => {
    const relativeToIpcRoot = path.relative(ipcRoot, filePath);
    const parts = relativeToIpcRoot.split(path.sep);
    const moduleName = parts[0];
    const methodName = parts.slice(1).join('/').replace(/\.ipc\.ts$/, '');

    if (!moduleName || !methodName) {
      throw new Error(`Invalid IPC file path "${relativeToIpcRoot}". Expected <module>/<method>.ipc.ts`);
    }

    const channel = `${moduleName}:${methodName}`;
    const importPath = toPosix(path.join('..', 'main', 'ipc', relativeToIpcRoot.replace(/\.ts$/, '')));

    const sourceFile = ensureSourceFile(filePath);
    const type = getDefaultExportType(sourceFile);
    const event = isEventType(type, sourceFile);

    manifest[moduleName] = manifest[moduleName] ?? {};
    manifest[moduleName][methodName] = {
      channel,
      type: event ? 'event' : 'invoke',
    };

    moduleMap[moduleName] = moduleMap[moduleName] ?? [];
    moduleMap[moduleName].push({ methodName, importPath });
  });

  const sortKeys = obj =>
    Object.keys(obj)
      .sort()
      .reduce((acc, key) => {
        acc[key] = obj[key];
        return acc;
      }, {});

  const sortedManifest = Object.keys(manifest)
    .sort()
    .reduce((acc, moduleName) => {
      acc[moduleName] = sortKeys(manifest[moduleName]);
      return acc;
    }, {});

  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(sortedManifest, null, 2) + '\n');

  const typeLines = [];
  typeLines.push('// AUTO-GENERATED BY scripts/sync-ipc-types.js - DO NOT EDIT MANUALLY');
  typeLines.push('/* eslint-disable @typescript-eslint/ban-types */');
  typeLines.push('/* eslint-disable @typescript-eslint/no-explicit-any */');
  typeLines.push('');
  typeLines.push('type Awaitable<T> = T extends Promise<infer R> ? Promise<R> : Promise<T>;');
  typeLines.push('type ToRendererMethod<T> = T extends { _isEvent: true }');
  typeLines.push('  ? (listener: (payload: Parameters<T>[0]) => void) => () => void');
  typeLines.push('  : (...args: Parameters<T>) => Awaitable<ReturnType<T>>;');
  typeLines.push('');
  typeLines.push('type IpcModules = {');
  Object.keys(moduleMap)
    .sort()
    .forEach(moduleName => {
      typeLines.push(`  ${moduleName}: {`);
      moduleMap[moduleName]
        .sort((a, b) => a.methodName.localeCompare(b.methodName))
        .forEach(({ methodName, importPath }) => {
          typeLines.push(`    ${methodName}: typeof import('${importPath}').default;`);
        });
      typeLines.push('  };');
    });
  typeLines.push('};');
  typeLines.push('');
  typeLines.push('type RendererApi<T> = {');
  typeLines.push('  [M in keyof T]: {');
  typeLines.push('    [K in keyof T[M]]: ToRendererMethod<T[M][K]>;');
  typeLines.push('  };');
  typeLines.push('};');
  typeLines.push('');
  typeLines.push('export type GeneratedElectronApi = RendererApi<IpcModules>;');
  typeLines.push('');
  typeLines.push('declare global {');
  typeLines.push('  interface Window {');
  typeLines.push('    electron: GeneratedElectronApi;');
  typeLines.push('  }');
  typeLines.push('}');
  typeLines.push('');
  typeLines.push('export {};');
  typeLines.push('');

  fs.mkdirSync(path.dirname(typesPath), { recursive: true });
  fs.writeFileSync(typesPath, typeLines.join('\n'));

  console.log(`Synced IPC manifest (${ipcFiles.length} modules) and types.`);
};

const debounce = (fn, delay) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

if (watchMode) {
  console.log(`Watching ${ipcRoot} for IPC changes...`);
  const run = debounce(() => {
    try {
      syncTypes();
    } catch (error) {
      console.error(`IPC sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, 150);

  syncTypes();

  fs.watch(ipcRoot, { recursive: true }, (_event, filename) => {
    if (filename && filename.endsWith('.ipc.ts')) {
      console.log(`Detected change in ${filename}. Regenerating IPC types...`);
      run();
    }
  });
} else {
  try {
    syncTypes();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
