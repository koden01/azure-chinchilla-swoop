import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Index from "@/pages/Index";
import DashboardPage from "@/pages/DashboardPage";
import HistoryPage from "@/pages/History";
import NotFound from "@/pages/NotFound";

const InputPage = React.lazy(() => import("@/pages/Input"));

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route 
            path="/input" 
            element={
              <React.Suspense fallback={<div>Loading...</div>}>
                <InputPage />
              </React.Suspense>
            } 
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;