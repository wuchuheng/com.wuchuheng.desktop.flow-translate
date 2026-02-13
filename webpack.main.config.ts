import type { Configuration } from "webpack";
import webpack from "webpack";
import path from "path"
import CopyWebpackPlugin from 'copy-webpack-plugin';

import { plugins } from "./webpack.plugins";
import { rules } from "./webpack.rules";

// TypeORM optional drivers to ignore
const optionalTypeOrmDrivers = [
  'mysql', 'mysql2', 'pg', 'pg-native', 'pg-query-stream', 'mssql', 'oracledb', 'sqlite3',
  'mongodb', 'redis', 'ioredis', '@google-cloud/spanner',
  'sql.js', 'typeorm-aurora-data-api-driver', 'react-native-sqlite-storage',
  '@sap/hana-client', 'hdb-pool',
];

export const mainConfig: Configuration = {
  entry: "./src/main/main.ts",
  module: {
    rules,
  },
  plugins: [
    ...plugins,
    new webpack.IgnorePlugin({
      resourceRegExp: new RegExp(`^(${optionalTypeOrmDrivers.join('|').replace(/\./g, '\\.')})$`),
      contextRegExp: /node_modules[\\/]typeorm/,
    }),
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
  },
  resolve: {
    extensions: [".js", ".ts", ".jsx", ".tsx", ".css", ".json"],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
};
