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
      <main className="flex-grow pt-16"> {/* Added pt-16 here */}
        {children}
      </main>
      <MadeWithDyad /> {/* MadeWithDyad dipindahkan ke Layout */}
    </div>
  );
};

export default Layout;