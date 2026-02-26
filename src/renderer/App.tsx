import React from 'react';
import * as ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { AppRoutes } from './config/Route';
import './styles/global.css';
import './i18n/i18n';
import { MainLayout } from './layout/MainLayout';

const root = ReactDOM.createRoot(document.getElementById('app') as HTMLElement);

root.render(
  <React.StrictMode>
    <HashRouter>
      <MainLayout>
        <AppRoutes />
      </MainLayout>
    </HashRouter>
  </React.StrictMode>
);
