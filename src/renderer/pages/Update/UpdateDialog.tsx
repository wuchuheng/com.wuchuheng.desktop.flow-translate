import React, { useState, useCallback } from 'react';
import { useUpdateSystem } from '../../hooks/useUpdateSystem';
import { Button, Typography, Space, Divider, Tag, message } from 'antd';
import { RocketOutlined, CalendarOutlined, HddOutlined, CheckCircleOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import dayjs from 'dayjs';
import { formatBytes, formatReleaseNotes } from '@/shared/update-types';

const { Title, Text } = Typography;

const DialogHeader: React.FC<{ version: string }> = ({ version }) => (
  <div className="no-drag mb-4 text-center">
    <Space direction="vertical" align="center">
      <div className="rounded-full bg-green-500/10 p-4">
        <RocketOutlined className="text-5xl text-green-500" />
      </div>
      <div>
        <Title level={3} style={{ margin: '8px 0 0 0' }}>
          Update Ready!
        </Title>
        <Tag color="blue" className="mt-2">
          Version {version}
        </Tag>
      </div>
    </Space>
  </div>
);

const VersionMeta: React.FC<{ size: number; date: string }> = ({ size, date }) => (
  <div className="no-drag mb-4 flex items-center justify-around rounded-lg bg-background-secondary p-3">
    <Space>
      <HddOutlined className="text-gray-400" />
      <Text type="secondary">{formatBytes(size)}</Text>
    </Space>
    <Divider type="vertical" />
    <Space>
      <CalendarOutlined className="text-gray-400" />
      <Text type="secondary">{dayjs(date).format('YYYY-MM-DD')}</Text>
    </Space>
  </div>
);

const ReleaseNotes: React.FC<{ notes: string }> = ({ notes }) => (
  <div className="no-drag mb-6 flex-1 overflow-y-auto rounded-lg border border-dashed border-gray-200 p-4 dark:border-gray-700">
    <div className="prose prose-sm dark:prose-invert">
      <div className="mb-2 font-bold">Release Notes:</div>
      <ReactMarkdown>{notes || 'No description provided.'}</ReactMarkdown>
    </div>
  </div>
);

export const UpdateDialog: React.FC = () => {
  const { info, status, error, installAndRestart } = useUpdateSystem();
  const [isRestarting, setIsRestarting] = useState(false);

  const handleRestart = useCallback(async () => {
    if (isRestarting) return;

    setIsRestarting(true);
    try {
      await installAndRestart();
    } catch {
      setIsRestarting(false);
      message.error('Failed to install update. Please try again.');
    }
  }, [isRestarting, installAndRestart]);

  // Only show when update is ready
  if (status !== 'ready' || !info) {
    return null;
  }

  return (
    <div className="drag flex h-screen flex-col overflow-hidden border border-gray-100 bg-background-primary p-6 dark:border-gray-800">
      <DialogHeader version={info.version} />

      <Divider style={{ margin: '16px 0' }} />

      <VersionMeta size={info.files?.[0]?.size || 0} date={info.releaseDate} />

      <ReleaseNotes notes={formatReleaseNotes(info.releaseNotes)} />

      {error && (
        <div className="no-drag mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="no-drag mt-auto">
        <Button
          type="primary"
          block
          size="large"
          icon={<CheckCircleOutlined />}
          loading={isRestarting}
          onClick={handleRestart}
          style={{ height: '50px', fontSize: '16px' }}
        >
          Restart and Install Now
        </Button>
        <div className="mt-3 text-center text-xs text-gray-400">The application will restart automatically.</div>
      </div>
    </div>
  );
};
