import { UpdateService } from '../../services/update.service';

export default async function check() {
  return await UpdateService.getInstance().checkForUpdates();
}
