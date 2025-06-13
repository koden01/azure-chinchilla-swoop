import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import Input from "./pages/Input";
import History from "./pages/History";
import NotFound from "./pages/NotFound";
import Navbar from "./components/Navbar";
import { ExpeditionProvider } from "./context/ExpeditionContext"; // Import ExpeditionProvider

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner
        position="top-center"
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
            <ExpeditionProvider> {/* Bungkus rute dengan ExpeditionProvider */}
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/input" element={<Input />} />
                <Route path="/history" element={<History />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ExpeditionProvider>
          </main>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;