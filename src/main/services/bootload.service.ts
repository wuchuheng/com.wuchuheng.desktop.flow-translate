import bootloadingEvent from '../ipc/system/bootloading.ipc';
import { logger } from '../utils/logger';
import { BootloadingProgressing } from '@/types/electron';

type TaskItem = {
  title: string;
  load: () => Promise<void>;
};

const bootloadList: TaskItem[] = [];

let currentProcessing: BootloadingProgressing = {
  title: 'Init...',
  progress: 0,
};

export const registerBootTask = (item: TaskItem) => {
  bootloadList.push(item);
};

export const runBootTasks = async () => {
  const total = bootloadList.length;
  let current = 0;

  bootloadingEvent(currentProcessing);

  for (const item of bootloadList) {
    await item.load();
    current++;

    const progress = Math.floor((current / total) * 100);
    currentProcessing = { title: item.title, progress };
    bootloadingEvent(currentProcessing);

    logger.verbose(`Task loaded: ${item.title} (${progress}%)`);
  }
};

export const getBootProgress = () => currentProcessing;
