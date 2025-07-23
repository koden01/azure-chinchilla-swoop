import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';

const InputPage = React.lazy(() => import('@/pages/Input').then(module => module.default));
const DashboardPage = React.lazy(() => import('@/pages/DashboardPage').then(module => module.default));
const History = React.lazy(() => import('@/pages/History').then(module => module.default));

function App() {
  return (
    <Layout>
      <React.Suspense fallback={<div>Loading...</div>}>
        <Routes>
          <Route path="/" element={<InputPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </React.Suspense>
    </Layout>
  );
}

export default App;