import { UpdateService } from '../../services/update.service';

export default async function download() {
  UpdateService.getInstance().downloadUpdate();
}
