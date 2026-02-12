import { ipcMain, WebContents } from 'electron';

export type EventHandler<T = unknown> = ((payload: T) => void) & {
  _isEvent: true;
  _setDispatcher?: (dispatch: (payload: T) => void) => void;
};

/**
 * Creates an event trigger that can broadcast to subscribed renderer processes.
 * The loader will detect `_isEvent` and wire up subscriptions automatically.
 */
export const createEvent = <T>(): EventHandler<T> => {
  let dispatch: ((payload: T) => void) | null = null;

  const trigger: EventHandler<T> = (payload: T) => {
    if (dispatch) {
      dispatch(payload);
    }
  };

  trigger._isEvent = true;
  trigger._setDispatcher = handler => {
    dispatch = handler;
  };

  return trigger;
};

const channelSubscriptions = new Map<string, Set<WebContents>>();

/**
 * Registers an event channel with subscribe/unsubscribe handling and
 * dispatch wiring for the provided event trigger.
 */
export const registerEvent = <T>(channel: string, eventFn: EventHandler<T>): void => {
  const subscribers = channelSubscriptions.get(channel) ?? new Set<WebContents>();
  channelSubscriptions.set(channel, subscribers);

  const subscribeChannel = `${channel}:subscribe`;
  const unsubscribeChannel = `${channel}:unsubscribe`;
  const broadcastChannel = `${channel}:event`;

  ipcMain.on(subscribeChannel, event => {
    const sender = event.sender;
    subscribers.add(sender);
    sender.once('destroyed', () => {
      subscribers.delete(sender);
    });
  });

  ipcMain.on(unsubscribeChannel, event => {
    subscribers.delete(event.sender);
  });

  const dispatcher = (payload: T) => {
    for (const wc of Array.from(subscribers)) {
      if (wc.isDestroyed()) {
        subscribers.delete(wc);
        continue;
      }
      wc.send(broadcastChannel, payload);
    }
  };

  eventFn._setDispatcher?.(dispatcher);
};
