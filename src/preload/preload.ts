import { contextBridge, ipcRenderer } from 'electron';
import manifest from '../shared/ipc-manifest.json';

type IpcManifest = Record<
  string,
  Record<
    string,
    {
      channel: string;
      type: 'invoke' | 'event';
    }
  >
>;

const createRendererApi = (ipcManifest: IpcManifest) => {
  const api: Record<string, Record<string, (...args: unknown[]) => unknown>> = {};

  Object.entries(ipcManifest).forEach(([moduleName, methods]) => {
    api[moduleName] = {};

    Object.entries(methods).forEach(([methodName, meta]) => {
      if (meta.type === 'event') {
        api[moduleName][methodName] = (listener: (payload: unknown) => void) => {
          const eventChannel = `${meta.channel}:event`;
          const subscribeChannel = `${meta.channel}:subscribe`;
          const unsubscribeChannel = `${meta.channel}:unsubscribe`;

          const handler = (_event: unknown, payload: unknown) => listener(payload);
          ipcRenderer.on(eventChannel, handler);
          ipcRenderer.send(subscribeChannel);

          return () => {
            ipcRenderer.removeListener(eventChannel, handler);
            ipcRenderer.send(unsubscribeChannel);
          };
        };
        return;
      }

      api[moduleName][methodName] = (...args: unknown[]) => ipcRenderer.invoke(meta.channel, ...args);
    });
  });

  return api;
};

const electronApi = createRendererApi(manifest as IpcManifest);
contextBridge.exposeInMainWorld('electron', electronApi as Window['electron']);
