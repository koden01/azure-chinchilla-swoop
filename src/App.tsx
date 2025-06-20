import React, { Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from '@tanstack/query-persist-client-core';
import { persister } from "@/lib/queryClientPersister";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ExpeditionProvider } from "./context/ExpeditionContext";
import Layout from "./components/Layout";
import { useBackgroundSync } from "./hooks/useBackgroundSync";

// Menggunakan React.lazy untuk memuat komponen secara dinamis
const DashboardPage = React.lazy(() => import("./pages/DashboardPage"));
const InputPage = React.lazy(() => import("./pages/Input"));
const HistoryPage = React.lazy(() => import("./pages/History"));
const NotFound = React.lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60, // Cache garbage collection time: 1 hour
      staleTime: 1000 * 60 * 5, // Data is considered fresh for 5 minutes (changed from 1 minute)
    },
  },
});

// Persist the query client to IndexedDB
persistQueryClient({
  queryClient,
  persister,
  maxAge: 1000 * 60 * 60 * 24, // Cache will be cleared after 24 hours if not accessed
  dehydrateOptions: {
    shouldDehydrateQuery: (query) =>
      query.queryHash.includes("historyData") || // Persist history data
      query.queryHash.includes("dashboard") || // Persist dashboard summaries
      query.queryHash.includes("karungSummary") || // Persist karung summary
      query.queryHash.includes("lastKarung") || // Persist last karung
      query.queryHash.includes("allExpedisiDataUnfiltered") || // Persist allExpedisiDataUnfiltered
      query.queryHash.includes("expedisiDataForSelectedDate") || // Persist expedisi data for selected date
      query.queryHash.includes("recentResiDataForValidation") || // Persist recentResiDataForValidation
      query.queryHash.includes("allFlagNoExpedisiData"), // NEW: Persist allFlagNoExpedisiData
  },
});

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      {/* useBackgroundSync dipindahkan ke sini */}
      <BackgroundSyncInitializer /> 
      <TooltipProvider>
        <Sonner
          position="top-center"
          duration={3000}
          toastOptions={{}}
        />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ExpeditionProvider>
            <Layout>
              <Suspense fallback={<div className="text-center p-8 text-gray-600">Memuat aplikasi...</div>}>
                <Routes>
                  <Route path="/" element={<InputPage />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/history" element={<HistoryPage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </Layout>
          </ExpeditionProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

// Komponen pembantu untuk menginisialisasi useBackgroundSync
const BackgroundSyncInitializer = () => {
  useBackgroundSync();
  return null; // Komponen ini tidak merender apa-apa
};

export default App;