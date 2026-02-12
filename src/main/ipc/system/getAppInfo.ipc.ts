import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface AppInfo {
  name: string;
  version: string;
  description: string;
  author: string;
  website: string;
}

const getAppInfo = async (): Promise<AppInfo> => {
  const packageJsonPath = path.join(app.getAppPath(), 'package.json');
  let description = '';
  let productName = '';
  let author = '';
  let website = '';

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    description = packageJson.description;
    productName = packageJson.productName;
    author = typeof packageJson.author === 'object' ? packageJson.author.name : packageJson.author;
    website = packageJson.homepage || (typeof packageJson.repository === 'object' ? packageJson.repository.url : packageJson.repository);
  } catch (error) {
    // Fallback if package.json is not accessible
    description = 'AI-powered translation tool';
  }

  return {
    name: productName || app.getName(),
    version: app.getVersion(),
    description: description,
    author: author || 'wuchuheng',
    website: website || 'https://github.com/wuchuheng/tansaction-popup',
  };
};

export default getAppInfo;
