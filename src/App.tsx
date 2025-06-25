import React from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useBackgroundSync } from "./hooks/useBackgroundSync";

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
      <div className="p-4 text-center">
        <h1 className="text-3xl font-bold mb-4">Aplikasi Uji Coba</h1>
        <p className="text-lg text-gray-600">
          Periksa konsol browser Anda untuk melihat log `BackgroundSync`.
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Jika log `Initializing sync` dan `Clearing sync interval` tidak lagi berulang dengan cepat,
          masalahnya ada pada komponen yang dihapus sementara (React Router, Context, Layout, atau Halaman).
        </p>
      </div>
    </QueryClientProvider>
  );
};

export default App;