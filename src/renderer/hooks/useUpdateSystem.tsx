import React, { useEffect } from 'react';
import { notification, Progress, Modal, Typography } from 'antd';
import { CloudDownloadOutlined, CheckCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

export const useUpdateSystem = () => {
  const { t } = useTranslation();
  const [api, contextHolder] = notification.useNotification();
  const progressNotificationKey = 'update-download-progress';

  useEffect(() => {
    const unsubscribe = window.electron.update.onStatusChange((status: { channel: string; data?: any }) => {
      console.log('Update status change:', status);

      switch (status.channel) {
        case 'update-available':
          api.info({
            message: t('update.available.title', 'Update Available'),
            description: t('update.available.message', 'A new version is available. It is being downloaded in the background.'),
            placement: 'bottomRight',
            icon: <InfoCircleOutlined className="text-blue-500" />,
          });
          break;

        case 'download-progress':
          if (status.data) {
            const percent = Math.floor(status.data.percent);
            const bytesPerSecond = status.data.bytesPerSecond || 0;
            api.open({
              key: progressNotificationKey,
              message: t('update.downloading.title', 'Downloading Update...'),
              description: (
                <div className="mt-2">
                  <Progress percent={percent} size="small" status="active" />
                  <div className="mt-1 flex justify-between text-xs text-gray-500">
                    <span>{Math.floor(bytesPerSecond / 1024)} KB/s</span>
                    <span>{percent}%</span>
                  </div>
                </div>
              ),
              duration: 0,
              placement: 'bottomRight',
              icon: <CloudDownloadOutlined className="text-blue-500" />,
            });
          }
          break;

        case 'update-downloaded':
          api.destroy(progressNotificationKey);
          
          Modal.confirm({
            title: t('update.ready.title', 'Update Ready to Install'),
            icon: <CheckCircleOutlined className="text-green-500" />,
            width: 600,
            content: (
              <div className="mt-4">
                <div className="mb-4 text-gray-700 dark:text-gray-300">
                  {t('update.ready.message', 'Version {{version}} has been downloaded. Restart the application to apply the update.', { 
                    version: status.data?.version || 'unknown' 
                  })}
                </div>
                
                {status.data?.releaseNotes && (
                  <div className="mt-4">
                    <div className="mb-2 font-bold text-gray-700 dark:text-gray-300">
                      {t('update.releaseNotes', 'Release Notes:')}
                    </div>
                    <div className="prose prose-sm dark:prose-invert max-h-60 overflow-y-auto rounded-md bg-gray-50 p-4 dark:bg-gray-800">
                      <ReactMarkdown>
                        {typeof status.data.releaseNotes === 'string' 
                          ? status.data.releaseNotes 
                          : Array.isArray(status.data.releaseNotes) 
                            ? status.data.releaseNotes.map((n: any) => (typeof n === 'string' ? n : n.note || '')).join('\n\n')
                            : ''}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            ),
            okText: t('update.restartNow', 'Restart Now'),
            cancelText: t('update.later', 'Later'),
            onOk: () => {
              window.electron.update.install();
            },
          });
          break;

        case 'update-error':
          api.error({
            message: t('update.error.title', 'Update Error'),
            description: status.data?.message || t('update.error.message', 'An error occurred while updating.'),
            placement: 'bottomRight',
          });
          break;
      }
    });

    return () => unsubscribe();
  }, [api, t]);

  return { contextHolder };
};
