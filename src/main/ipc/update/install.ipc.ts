import { UpdateService } from '../../services/update.service';

export default async function install() {
  UpdateService.getInstance().quitAndInstall();
}
