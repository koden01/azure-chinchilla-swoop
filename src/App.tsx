import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import { ExpeditionProvider } from "./context/ExpeditionContext";

// Menggunakan React.lazy untuk memuat komponen secara dinamis
const DashboardPage = React.lazy(() => import("./pages/DashboardPage"));
const InputPage = React.lazy(() => import("./pages/Input"));
const HistoryPage = React.lazy(() => import("./pages/History"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const ResiDetailModal = React.lazy(() => import("./components/ResiDetailModal"));

const queryClient = new QueryClient();

const App = () => {
  return (
    <React.Fragment> {/* Menambahkan React.Fragment di sini */}
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner
            position="top-center"
            duration={500}
            toastOptions={{
              success: {
                classNames: {
                  toast: "bg-green-500 text-white",
                },
              },
              error: {
                classNames: {
                  toast: "bg-red-500 text-white",
                },
              },
            }}
          />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <div className="flex flex-col min-h-screen">
              <Navbar />
              <main className="flex-grow">
                <ExpeditionProvider>
                  <Suspense fallback={<div className="text-center p-8 text-gray-600">Memuat aplikasi...</div>}>
                    <Routes>
                      <Route path="/" element={<InputPage />} />
                      <Route path="/dashboard" element={<DashboardPage />} />
                      <Route path="/history" element={<HistoryPage />} />
                      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </ExpeditionProvider>
              </main>
            </div>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </React.Fragment> {/* Menambahkan penutup React.Fragment di sini */}
  );
};

export default App;