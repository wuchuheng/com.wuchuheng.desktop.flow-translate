import { Route, Routes, Navigate } from 'react-router-dom';
import React from 'react';
import { FlowTranslate } from '../pages/FlowTranslate/FlowTranslate';
import { SettingsPage } from '../pages/Settings/SettingsPage';
import { UpdateDialog } from '../pages/Update/UpdateDialog';

export const AppRoutes: React.FC = () => (
  <Routes>
    <Route path="/" element={<Navigate to="/settings" replace />} />
    <Route path="/settings" element={<SettingsPage />} />
    <Route path="/flow-translate" element={<FlowTranslate />} />
    <Route path="/update-dialog" element={<UpdateDialog />} />
  </Routes>
);
