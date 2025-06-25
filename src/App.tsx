import React from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useBackgroundSync } from "./hooks/useBackgroundSync";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import IndexPage from "./pages/Index";
import DashboardPage from "./pages/DashboardPage";
import HistoryPage from "./pages/History";
import NotFound from "./pages/NotFound";
import { ExpeditionProvider } from "./context/ExpeditionContext";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"; // Import React Query Devtools

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60, // Cache garbage collection time: 1 hour
      staleTime: 1000 * 60 * 60, // Data is considered fresh for 60 minutes
    },
  },
});

// Komponen pembantu untuk menginisialisasi useBackgroundSync
const BackgroundSyncInitializer = () => {
  useBackgroundSync();
  return null; // Komponen ini tidak merender apa-apa
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BackgroundSyncInitializer /> 
      <Sonner
        position="top-center"
        duration={3000}
        toastOptions={{}}
      />
      <Router>
        <ExpeditionProvider>
          <Layout>
            <Routes>
              <Route path="/" element={<IndexPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </ExpeditionProvider>
      </Router>
      <ReactQueryDevtools initialIsOpen={false} /> {/* Tambahkan React Query Devtools */}
    </QueryClientProvider>
  );
};

export default App;