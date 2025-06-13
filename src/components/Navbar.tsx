import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, History, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils"; // Perbaikan di sini

const Navbar = () => {
  const location = useLocation();

  const navItems = [
    { name: "Input", path: "/", icon: Plus }, // Input is now home
    { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard }, // Dashboard is now /dashboard
    { name: "History", path: "/history", icon: History },
  ];

  return (
    <nav className="bg-gradient-to-r from-blue-600 to-purple-700 p-4 flex items-center justify-center shadow-lg">
      <div className="flex items-center space-x-4">
        {navItems.map((item) => (
          <Link
            key={item.name}
            to={item.path}
            className={cn(
              "flex items-center px-4 py-2 rounded-md text-white text-sm font-medium transition-colors duration-200",
              location.pathname === item.path
                ? "bg-white bg-opacity-20"
                : "hover:bg-white hover:bg-opacity-10"
            )}
          >
            <item.icon className="mr-2 h-4 w-4" />
            {item.name}
          </Link>
        ))}
      </div>
      {/* Search bar removed as per request */}
    </nav>
  );
};

export default Navbar;