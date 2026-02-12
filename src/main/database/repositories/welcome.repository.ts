import { getDataSource } from '../data-source';
import { Welcome } from '../entities/welcome.entity';

/**
 * Get the welcome message
 */
export const getWelcomeMessage = async (): Promise<Welcome> => {
  const welcomeRepository = getDataSource().getRepository(Welcome);
  const welcome = await welcomeRepository.find({
    take: 1,
  });
  return welcome[0];
};
