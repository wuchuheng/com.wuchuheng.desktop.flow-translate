import { getUpdateState } from '../../services/update.service';

/**
 * Returns the current update information and progress for the renderer.
 * Useful for new windows that missed the initial events.
 */
export default async function getState() {
  return getUpdateState();
}
