import { Route, Routes } from 'react-router-dom';
import { Home } from '../pages/Home/Home';
import React from 'react';
import { About } from '../pages/About/About';
import { FlowTranslate } from '../pages/FlowTranslate/FlowTranslate';

export const AppRoutes: React.FC = () => (
  <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/about" element={<About />} />
    <Route path="/flow-translate" element={<FlowTranslate />} />
  </Routes>
);
