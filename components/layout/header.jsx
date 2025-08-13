"use client";

import { Button } from "@/components/ui/button";
import { Bell, Search, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useState } from "react";

export default function Header({ userRole, onLogout }) {
  const getRoleDisplay = () => {
    switch (userRole.role) {
      case "admin":
        return { title: "Administrator", subtitle: "System Management" };
      case "bcba":
        return { title: "BCBA", subtitle: "Clinical Supervision" };
      case "rbt":
        return { title: "RBT", subtitle: "Therapy Services" };
      case "parent":
        return { title: "Parent Portal", subtitle: "Child Progress Tracking" };
      default:
        return { title: "User", subtitle: "Dashboard" };
    }
  };

  const roleInfo = getRoleDisplay();
  const [open, setOpen] = useState(false);

  const handleToggle = () => setOpen(!open);
  return (
    <header className="bg-white shadow-sm border-b border-slate-200 h-16 flex items-center justify-between px-6">
      <div className="flex items-center">
        {/* Mobile Sidebar Trigger - only visible on small screens */}
        <SidebarTrigger className="mr-4 lg:hidden" />
        <div>
          <h1 className="text-xl font-semibold text-slate-800">
            {roleInfo.title}
          </h1>
          <p className="text-sm text-slate-500">{roleInfo.subtitle}</p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search..."
            className="pl-10 w-64 border-slate-200 focus:border-teal-500 focus:ring-teal-500"
          />
        </div>

        {/* Notifications */}
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5 text-slate-600" />
          <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full"></span>
        </Button>

        {/* Profile */}
        <div className="relative">
          {/* Clickable area */}
          <div
            className="flex items-center space-x-3 cursor-pointer"
            onClick={handleToggle}
          >
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-slate-800">
                {userRole.first_name} {userRole.last_name}
              </p>
              <p className="text-xs text-slate-500">{roleInfo.title}</p>
            </div>
            <div className="h-10 w-10 bg-teal-600 rounded-full flex items-center justify-center shadow-md">
              <User className="h-5 w-5 text-white" />
            </div>
          </div>

          {/* Dropdown */}
          {open && (
            <div className="absolute right-0 mt-2 w-56 bg-white shadow-lg rounded-lg border p-4 z-50">
              <div className="mb-3">
                <p className="font-semibold text-slate-800">
                  {userRole.first_name} {userRole.last_name}
                </p>
                <p className="text-sm text-slate-500 mt-2">Email: {userRole.email}</p>
                <p className="text-sm text-slate-500 capitalize">
                  Role: {userRole.role}
                </p>
              </div>
              <button
                onClick={onLogout}
                className="w-full bg-red-500 hover:bg-red-600 text-white py-1.5 px-3 rounded text-sm"
              >
                Log Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
