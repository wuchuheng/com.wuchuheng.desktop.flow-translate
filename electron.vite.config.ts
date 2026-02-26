import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { loadEnv } from 'vite';
// eslint-disable-next-line import/no-unresolved
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load .env file based on mode (development/production)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    main: {
      publicDir: 'resources',
      plugins: [externalizeDepsPlugin()],
      define: {
        'process.env.DEV_UPDATE_SERVER_URL': JSON.stringify(env.DEV_UPDATE_SERVER_URL || ''),
        'process.env.PROD_UPDATE_SERVER_URL': JSON.stringify(env.PROD_UPDATE_SERVER_URL || ''),
      },
      build: {
        rollupOptions: {
          input: {
            index: resolve(__dirname, 'src/main/main.ts'),
          },
          external: [
            /^@google-cloud\/spanner/,
            /^@sap\/hana-client/,
            /^hdb-pool/,
            /^mysql/,
            /^oracledb/,
            /^pg/,
            /^react-native-sqlite-storage/,
            /^redis/,
            /^ioredis/,
            /^sql\.js/,
            /^sqlite3/,
            /^better-sqlite3/,
            /^mongodb/,
            /^mssql/,
            /^typeorm-aurora-data-api-driver/,
            /^typeorm/
          ],
        },
      },
      resolve: {
        alias: {
          '@': resolve(__dirname, 'src'),
        },
      },
    },
    preload: {
      plugins: [externalizeDepsPlugin()],
      build: {
        rollupOptions: {
          input: {
            index: resolve(__dirname, 'src/preload/preload.ts'),
          },
        },
      },
      resolve: {
        alias: {
          '@': resolve(__dirname, 'src'),
        },
      },
    },
    renderer: {
      root: 'src/renderer',
      base: './', // Use relative paths for built assets
      build: {
        rollupOptions: {
          input: {
            index: resolve(__dirname, 'src/renderer/index.html'),
          },
        },
      },
      resolve: {
        alias: {
          '@': resolve(__dirname, 'src'),
        },
      },
      plugins: [react()],
    },
  };
});