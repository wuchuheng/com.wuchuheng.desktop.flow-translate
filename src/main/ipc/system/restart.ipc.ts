import { app } from 'electron';

const restart = () => {
  app.relaunch();
  app.quit();
};

export default restart;
