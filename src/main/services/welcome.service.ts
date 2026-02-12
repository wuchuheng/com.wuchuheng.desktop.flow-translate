import { Welcome } from '../database/entities/welcome.entity';
import * as welcomeRepository from '../database/repositories/welcome.repository';

export const getWelcome = async (): Promise<Welcome> => await welcomeRepository.getWelcomeMessage();
