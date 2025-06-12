import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, History, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

const Navbar = () => {
  const location = useLocation();

  const navItems = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Input", path: "/input", icon: Plus },
    { name: "History", path: "/history", icon: History },
  ];

  return (
    <nav className="bg-gradient-to-r from-blue-600 to-purple-700 p-4 flex items-center justify-between shadow-lg">
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
      <div className="relative flex items-center w-64"> {/* Adjusted width here */}
        <Input
          type="text"
          placeholder="Search..."
          className="pl-10 pr-4 py-2 rounded-md bg-white bg-opacity-20 text-white placeholder-white placeholder-opacity-70 border-none focus:ring-2 focus:ring-white focus:ring-opacity-50 w-full"
        />
        <Search className="absolute left-3 h-4 w-4 text-white text-opacity-70" />
      </div>
    </nav>
  );
};

export default Navbar;