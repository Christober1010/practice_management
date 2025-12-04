"use client";

import {
  LayoutDashboard,
  Calendar,
  Users,
  LogOut,
  UserCheck,
  UserCog,
  Database,
  ChevronRight,
  MessageSquare,
  ListChecks,
  Target,
  Layers,
  FolderKanban,
  SquareTerminal,
  Contact,
  UserPlus,
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
  const [showMasterDataMenu, setShowMasterDataMenu] = useState(false);
  const lastScrollY = useRef(0);
  const masterDataTimeoutRef = useRef(null);

  useEffect(() => {
    // On mount, restore last tab
    const savedView = localStorage.getItem("currentView");
    if (savedView) {
      setCurrentView(savedView);
    }
  }, [setCurrentView]);

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
    localStorage.setItem("currentView", id);
    const isMasterDataSubitem = masterDataSubItems.some(
      (item) => item.id === id
    );
    if (!isMasterDataSubitem) {
      setCollapsed(true);
    }
    setShowMasterDataMenu(false);
  };

  const handleMasterDataHover = (isEntering) => {
    if (masterDataTimeoutRef.current) {
      clearTimeout(masterDataTimeoutRef.current);
    }

    if (isEntering) {
      setCollapsed(false);
      setShowMasterDataMenu(true);
    } else {
      masterDataTimeoutRef.current = setTimeout(() => {
        setShowMasterDataMenu(false);
      }, 200);
    }
  };

  const masterDataSubItems = [
    {
      id: "modules",
      label: "Modules",
      icon: FolderKanban,
      color: "text-blue-600",
    },
    { id: "domains", label: "Domains", icon: Layers, color: "text-indigo-600" },
    {
      id: "programs",
      label: "Programs",
      icon: ListChecks,
      color: "text-teal-600",
    },
    {
      id: "targets",
      label: "Targets",
      icon: Target,
      color: "text-orange-600",
    },
    {
      id: "prompts",
      label: "Prompts",
      icon: SquareTerminal,
      color: "text-rose-600",
    },
  ];

  const getMenuItems = () => {
    const baseItems = [
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
    ];

    if (userRole.role === "admin" || userRole.role === "bcba") {
      baseItems.push({
        id: "staff",
        label: "Staff",
        icon: UserCheck,
        color: "text-orange-600",
      });
    }

    if (userRole.role === "parent") {
      return [
        {
          id: "dashboard",
          label: "Dashboard",
          icon: LayoutDashboard,
          color: "text-teal-600",
        },
      ];
    }
    if (userRole.role === "admin") {
      return [
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
          id: "staff",
          label: "Staff",
          icon: Contact,
          color: "text-orange-600",
        },
        {
          id: "users",
          label: "Users",
          icon: UserPlus,
          color: "text-orange-600",
        },
        {
          id: "masterData",
          label: "Master Data",
          icon: Database,
          color: "text-orange-600",
          hasSubmenu: true,
        },
        {
          id: "reports",
          label: "Reports",
          icon: UserPlus,
          color: "text-orange-600",
        },
      ];
    }

    return baseItems;
  };

  const getRoleColor = () => {
    switch (userRole.role) {
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
            <Image
              src={img || "/placeholder.svg"}
              className="h-16 w-16 rounded-full"
              alt="logo"
            />
          </div>
          <span className="text-xl font-bold text-slate-800 group-data-[state=collapsed]/sidebar-wrapper:hidden">
            Mahaverse
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

              if (item.hasSubmenu) {
                return (
                  <SidebarMenuItem key={item.id} className="relative">
                    <div
                      onMouseEnter={() => handleMasterDataHover(true)}
                      onMouseLeave={() => handleMasterDataHover(false)}
                    >
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
                          <div className="flex items-center space-x-3">
                            <Icon
                              className={`h-4 w-4 mr-2 ${
                                isActive ? "text-teal-600" : item.color
                              }`}
                            />
                            <span className="group-data-[state=collapsed]/sidebar-wrapper:hidden">
                              {item.label}
                            </span>
                          </div>
                          <ChevronRight className="h-4 w-4 group-data-[state=collapsed]/sidebar-wrapper:hidden" />
                        </a>
                      </SidebarMenuButton>

                      {/* Submenu */}
                      {showMasterDataMenu && (
                        <div className="absolute ml-2 pl-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-2 z-50">
                          {masterDataSubItems.map((subItem) => {
                            const SubIcon = subItem.icon;
                            return (
                              <button
                                key={subItem.id}
                                onClick={() => handleMenuSelect(subItem.id)}
                                className={`w-full flex items-center px-4 py-2 text-sm transition-colors ${
                                  currentView === subItem.id
                                    ? "bg-teal-50 text-teal-700"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                }`}
                              >
                                <SubIcon
                                  className={`h-4 w-4 mr-3 ${
                                    currentView === subItem.id
                                      ? "text-teal-600"
                                      : subItem.color
                                  }`}
                                />
                                {subItem.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </SidebarMenuItem>
                );
              }

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
