"use client";

import {
  Heart,
  LayoutDashboard,
  Calendar,
  Users,
  FileText,
  CreditCard,
  Baby,
  Settings,
  LogOut,
  UserCheck,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarHeader,
} from "@/components/ui/sidebar";
import img from "public/favicon.ico";
import Image from "next/image";

import { useState, useEffect, useRef } from "react";

export default function AppSidebar({
  userRole,
  currentView,
  setCurrentView,
  onLogout,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      // Only run on mobile view (adjust breakpoint as needed)
      if (window.innerWidth > 768) return;

      const currentScrollY = window.scrollY;

      if (currentScrollY < lastScrollY.current) {
        // Scroll UP - show sidebar
        setCollapsed(false);
      } else if (currentScrollY > lastScrollY.current) {
        // Scroll DOWN - hide sidebar
        setCollapsed(true);
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const handleMenuSelect = (id) => {
    setCurrentView(id);
    setCollapsed(true); // Collapse sidebar after selection
  };

  const getMenuItems = () => {
    const baseItems = [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        color: "text-teal-600",
      },
      {
        id: "scheduling",
        label: "Scheduling",
        icon: Calendar,
        color: "text-blue-600",
      },
      {
        id: "clients",
        label: "Clients",
        icon: Users,
        color: "text-indigo-600",
      },
      {
        id: "sessions",
        label: "Sessions",
        icon: FileText,
        color: "text-purple-600",
      },
    ];

    if (userRole === "admin" || userRole === "bcba") {
      baseItems.push(
        {
          id: "staff",
          label: "Staff",
          icon: UserCheck,
          color: "text-orange-600",
        },
        {
          id: "billing",
          label: "Billing",
          icon: CreditCard,
          color: "text-emerald-600",
        }
      );
    }

    if (userRole === "parent") {
      return [
        {
          id: "dashboard",
          label: "Dashboard",
          icon: LayoutDashboard,
          color: "text-teal-600",
        },
        { id: "portal", label: "My Child", icon: Baby, color: "text-pink-600" },
        {
          id: "billing",
          label: "Billing",
          icon: CreditCard,
          color: "text-emerald-600",
        },
      ];
    }

    return baseItems;
  };

  const getRoleColor = () => {
    switch (userRole) {
      case "admin":
        return "bg-teal-600";
      case "bcba":
        return "bg-blue-600";
      case "rbt":
        return "bg-indigo-600";
      case "parent":
        return "bg-emerald-600";
      default:
        return "bg-teal-600";
    }
  };

  return (
    <Sidebar
      collapsible="icon"
      collapsed={collapsed}
      onCollapseChange={setCollapsed}
      className="shadow-xl border-r border-slate-200 bg-white"
    >
      {/* Logo Header */}
      <SidebarHeader className="bg-slate-50">
        <div className="flex items-center space-x-3">
          <div className={`${getRoleColor()} p-0.5 rounded-full shadow-md`}>
            <Image src={img} className="h-16 w-16 rounded-full" alt="logo" />
          </div>
          <span className="text-xl font-bold text-slate-800 group-data-[state=collapsed]/sidebar-wrapper:hidden">
            ABA Connect
          </span>
        </div>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {getMenuItems().map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;

              return (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    tooltip={item.label}
                  >
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        handleMenuSelect(item.id);
                      }}
                      className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                        isActive
                          ? "bg-teal-50 text-teal-700"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <Icon
                        className={`h-5 w-5 ${
                          isActive ? "text-teal-600" : item.color
                        }`}
                      />
                      <span className="group-data-[state=collapsed]/sidebar-wrapper:hidden">
                        {item.label}
                      </span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {/* Bottom Actions */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Settings">
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setCurrentView("settings");
                }}
                className="flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              >
                <Settings className="h-5 w-5" />
                <span className="group-data-[state=collapsed]/sidebar-wrapper:hidden">
                  Settings
                </span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Sign Out">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onLogout();
                }}
                className="flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              >
                <LogOut className="h-5 w-5" />
                <span className="group-data-[state=collapsed]/sidebar-wrapper:hidden">
                  Sign Out
                </span>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
