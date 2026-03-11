import { openGrammarlyAuthWindow } from '../../windows/windowFactory';

/**
 * IPC handler to open the Grammarly sign-in window in the persistent Grammarly session.
 * The login window shares the same `persist:grammarly` session as the extension,
 * so auth cookies written on login are immediately available to the extension service worker.
 */
export default async function openAuth(): Promise<void> {
  openGrammarlyAuthWindow();
}
