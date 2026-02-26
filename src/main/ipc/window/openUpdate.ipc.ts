import { openUpdateWindow } from '../../services/update.service';

/**
 * IPC handler to open the update window.
 * Delegates to the centralized UpdateService to ensure singleton behavior.
 */
export default async function openUpdate() {
  await openUpdateWindow();
}
