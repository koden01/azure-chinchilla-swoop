import React from "react";
import Navbar from "./Navbar";
import { MadeWithDyad } from "./made-with-dyad";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow">
        {children}
      </main>
      <MadeWithDyad /> {/* MadeWithDyad dipindahkan ke Layout */}
    </div>
  );
};

export default Layout;