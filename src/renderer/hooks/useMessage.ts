import { useContext } from 'react';
import { MessageContext } from '../layout/MainLayout';
import { MessageInstance } from 'antd/es/message/interface';

/**
 * Custom hook to access the antd message API.
 * @returns {MessageInstance} The message API instance.
 */
export const useMessage = (): MessageInstance => {
  const messageApi = useContext(MessageContext);
  if (!messageApi) {
    throw new Error('MessageContext is not provided. Please ensure that useMessage is used within a MessageProvider.');
  }

  return messageApi;
};
