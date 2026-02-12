import type { Configuration } from "webpack";
import path from "path"
import CopyWebpackPlugin from 'copy-webpack-plugin';

import { plugins } from "./webpack.plugins";
import { rules } from "./webpack.rules";

export const mainConfig: Configuration = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: "./src/main/main.ts",
  // Put your normal webpack config below here
  module: {
    rules,
  },
  plugins: [
    ...plugins,
    new CopyWebpackPlugin({
      patterns: [
        { 
          from: path.resolve(__dirname, 'src/renderer/assets/genLogo/icon.ico'),
          to: path.resolve(__dirname, '.webpack/main/icon.ico')
        },
        { 
          from: path.resolve(__dirname, 'src/renderer/assets/genLogo/icon.png'),
          to: path.resolve(__dirname, '.webpack/main/icon.png')
        },
      ],
    }),
  ],
  externals: {
    'better-sqlite3': 'commonjs better-sqlite3',
    typeorm: 'commonjs typeorm',
  },
  resolve: {
    extensions: [".js", ".ts", ".jsx", ".tsx", ".css", ".json"],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
};
