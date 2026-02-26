import { getBootProgress } from '../../services/bootload.service';

const getBootloadProgressing = async () => {
  return getBootProgress();
};

export default getBootloadProgressing;
