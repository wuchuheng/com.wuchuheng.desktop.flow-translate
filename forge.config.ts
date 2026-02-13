import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';
import path from 'path';

const iconDir = path.join(__dirname, 'src/renderer/assets/genLogo');

const config: ForgeConfig = {
  packagerConfig: {
    icon: path.join(iconDir, 'icon'),
    asar: {
      // 关键点：强制将原生模块从 ASAR 中解包出来
      unpack: '**/node_modules/better-sqlite3/**/*',
    },
    // 确保打包时不忽略 node_modules 中的 better-sqlite3
    ignore: (file: string) => {
      if (!file) return false;
      // 不要忽略 better-sqlite3
      if (file.includes('node_modules/better-sqlite3')) return false;
      // 但 Webpack 插件默认会忽略所有 node_modules，所以我们需要在这里小心处理
      return false;
    }
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({ setupIcon: path.join(iconDir, 'icon.ico') }),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({ options: { icon: path.join(iconDir, 'icon.png') } }),
    new MakerDeb({ options: { icon: path.join(iconDir, 'icon.png') } }),
  ],

  plugins: [
    new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
      mainConfig,
      devContentSecurityPolicy: "default-src 'self' 'unsafe-inline' data:; script-src 'self' 'unsafe-eval' 'unsafe-inline' data:; connect-src * 'unsafe-inline';",
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: './src/renderer/renderer.html',
            js: './src/renderer/renderer.ts',
            name: 'main_window',
            preload: {
              js: './src/preload/preload.ts',
            },
          },
        ],
      },
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
