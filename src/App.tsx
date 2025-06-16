import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ExpeditionProvider } from "./context/ExpeditionContext";
import Layout from "./components/Layout";

// Menggunakan React.lazy untuk memuat komponen secara dinamis
const DashboardPage = React.lazy(() => import("./pages/DashboardPage"));
const InputPage = React.lazy(() => import("./pages/Input"));
const HistoryPage = React.lazy(() => import("./pages/History"));
const NotFound = React.lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner
          position="top-center"
          duration={1000}
          toastOptions={{
            success: {
              classNames: {
                toast: "bg-green-500 text-white",
              },
            },
            error: {
              classNames: {
                toast: "!bg-red-500 text-white", // Menggunakan !bg-red-500 untuk prioritas
              },
            },
          }}
        />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ExpeditionProvider>
            <Layout>
              <Suspense fallback={<div className="text-center p-8 text-gray-600">Memuat aplikasi...</div>}>
                <Routes>
                  <Route path="/" element={<InputPage />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/history" element={<HistoryPage />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
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

export default App;