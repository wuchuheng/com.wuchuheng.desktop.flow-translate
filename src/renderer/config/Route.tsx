import { Route, Routes, Navigate } from 'react-router-dom';
import React from 'react';
import { FlowTranslate } from '../pages/FlowTranslate/FlowTranslate';
import { SettingsPage } from '../pages/Settings/SettingsPage';

export const AppRoutes: React.FC = () => (
  <Routes>
    <Route path="/" element={<Navigate to="/settings" replace />} />
    <Route path="/settings" element={<SettingsPage />} />
    <Route path="/flow-translate" element={<FlowTranslate />} />
  </Routes>
);
