# Troubleshooting Guide: Electron + TypeORM + better-sqlite3 Production Fix

## 1. The Problem (The "What")
When running an Electron app in production (packaged as an `.exe` or `.asar`), the application crashes with one of the following JavaScript errors:
*   `Error: Cannot find module 'typeorm'`
*   `Error: Cannot find module 'better-sqlite3'`
*   `Database initialization error: SQLite package has not been found installed.`
*   `Database initialization error: this.sqlite is not a function.`

## 2. Root Cause Analysis (The "Why")
This issue is caused by a three-way conflict between how Webpack, TypeORM, and Native Modules behave:

1.  **Webpack Bundling vs. TypeORM**: Webpack bundles all code into a single `index.js`. TypeORM, however, uses "Dynamic Requires" (e.g., `require("better-sqlite3")` based on a string) to load database drivers. Once bundled, TypeORM loses the context of where the external `node_modules` are located.
2.  **Native Module Constraints**: `better-sqlite3` contains compiled C++ binaries (`.node` files). These **cannot** be bundled into a JavaScript file and **cannot** be executed directly from inside a compressed `.asar` archive.
3.  **Missing Dependencies**: Electron Forge's Webpack plugin often assumes all code is in the bundle and omits the `node_modules` folder from the production package. If a module is marked as `external`, it simply disappears in production unless explicitly included.

---

## 3. The Solution (The "How")

### Step 1: Webpack Configuration
**File:** `webpack.main.config.ts`

**Logic:** We must bundle `typeorm` so its code is always available, but we must keep `better-sqlite3` as an **external** because it is a binary.

```typescript
export const mainConfig: Configuration = {
  // ...
  externals: {
    // Keep the native module external
    'better-sqlite3': 'commonjs better-sqlite3',
    // DO NOT put 'typeorm' here; let it be bundled
  },
  // ...
};
```

### Step 2: Electron Forge Configuration
**File:** `forge.config.ts`

**Logic:** We must tell the packager to:
1.  **Unpack** the binary files so the OS can execute them.
2.  **Include** only the necessary production `node_modules` while ignoring dev dependencies to keep the size small.

```typescript
const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      // Force unpacking the native module from ASAR for execution
      unpack: '**/node_modules/better-sqlite3/**/*',
    },
    ignore: [
      /^\/\.git/,
      /^\/src/,
      /^\/scripts/,
      // Ignore all node_modules EXCEPT the native driver and its helpers
      /^\/node_modules\/(?!better-sqlite3|bindings|file-uri-to-path)/,
    ],
  },
  // ...
};
```

### Step 3: Explicit Driver Injection
**File:** `src/main/database/data-source.ts` (or wherever you init TypeORM)

**Logic:** Since Webpack breaks TypeORM's "auto-discovery" of drivers, we must manually import the driver using `require` (to avoid ESM interop issues) and inject it directly into the connection options.

```typescript
// Use require to ensure we get the constructor, avoiding ESM issues with Webpack
const sqlite3 = require('better-sqlite3');

export const initDB = async (): Promise<void> => {
  db = new DataSource({
    type: 'better-sqlite3',
    // MANUALLY inject the driver object
    driver: sqlite3, 
    database: isDev ? 'dev.sqlite' : 'production.sqlite',
    entities: [/* ... */],
    synchronize: true,
  });
  
  await db.initialize();
};
```

---

## 4. Summary of Benefits
*   **Reliability**: By injecting the `driver`, TypeORM no longer "guesses" where the module is.
*   **Performance**: Only the essential binary files are left outside the bundle, keeping the app fast.
*   **Stability**: Using `asar.unpack` ensures Windows/macOS/Linux can always access the `.node` binary files, preventing "Module not found" errors in production.
*   **Efficiency**: The `ignore` regex keeps the final package size small by excluding thousands of unnecessary development files.
