"use client";

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Index from './pages/Index';
import Input from './pages/Input';
import { Toaster } from './components/ui/toaster'; // Import Toaster

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/input" element={<Input />} />
      </Routes>
      <Toaster /> {/* Add Toaster here */}
    </Router>
  );
}

export default App;