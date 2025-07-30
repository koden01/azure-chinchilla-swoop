"use client";

import React from "react";
import { Link } from "react-router-dom"; // Import Link for navigation

const Index: React.FC = () => {
  return (
    <div className="p-4 md:p-6 text-center min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <h1 className="text-3xl font-bold mb-4 text-gray-800">Selamat Datang di Aplikasi Anda!</h1>
      <p className="text-lg text-gray-600 mb-8">
        Silakan navigasi ke halaman Dashboard untuk melihat fitur utama aplikasi.
      </p>
      <div className="flex space-x-4">
        <Link to="/dashboard">
          <button className="px-6 py-3 bg-blue-600 text-white rounded-md shadow-md hover:bg-blue-700 transition-colors">
            Pergi ke Dashboard
          </button>
        </Link>
        <Link to="/input">
          <button className="px-6 py-3 bg-green-600 text-white rounded-md shadow-md hover:bg-green-700 transition-colors">
            Pergi ke Input Resi
          </button>
        </Link>
      </div>
    </div>
  );
};

export default Index;