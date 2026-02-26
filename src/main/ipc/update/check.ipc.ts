import { checkForUpdates } from '../../services/update.service';

export default async function check() {
  return await checkForUpdates();
}
