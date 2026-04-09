"use client";

import {
  LayoutDashboard,
  Calendar,
  Users,
  LogOut,
  UserCheck,
  Database,
  ChevronRight,
  ListChecks,
  Target,
  Layers,
  SquareTerminal,
  UserPlus,
  User,
  Link,
  Code,
  FileText,
  ChevronDown,
  MapPin,
  Building2,
  Heart,
  Shield,
} from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import {
  PERM,
  buildSubmenuPermissionMap,
} from "@/lib/rbac-permission-keys";
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
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import img from "public/favicon.ico";
import Image from "next/image";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function AppSidebar({
  userRole,
  currentView,
  setCurrentView,
  onLogout,
}) {
  const router = useRouter();
  const [showMasterDataMenu, setShowMasterDataMenu] = useState(false);
  const [showManageDataMenu, setShowManageDataMenu] = useState(false);
  const lastScrollY = useRef(0);
  const masterDataTimeoutRef = useRef(null);
  const manageDataTimeoutRef = useRef(null);
  const { isMobile, setOpenMobile, setOpen } = useSidebar();

  const masterDataSubItems = [
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

  const manageDataSubItems = [
    {
      id: "provider",
      label: "Manage Providers",
      icon: User,
      color: "text-blue-600",
    },
    {
      id: "providerServiceCode",
      label: "Provider Service Code",
      icon: Link,
      color: "text-indigo-600",
    },
    {
      id: "serviceCode",
      label: "Service Code",
      icon: Code,
      color: "text-teal-600",
    },
    {
      id: "diagnosis",
      label: "Diagnosis",
      icon: FileText,
      color: "text-orange-600",
    },
    {
      id: "locations",
      label: "Locations",
      icon: MapPin,
      color: "text-purple-600",
    },
    {
      id: "facilityTypes",
      label: "Facility Types",
      icon: Building2,
      color: "text-indigo-600",
    },
    {
      id: "treatmentTypes",
      label: "Treatment Types",
      icon: Heart,
      color: "text-pink-600",
    },
    {
      id: "documentTypes",
      label: "Document Types",
      icon: FileText,
      color: "text-cyan-600",
    },
  ];

  const { can } = usePermissions(userRole);

  const subPermMap = buildSubmenuPermissionMap();
  const masterDataSubItemsFiltered = masterDataSubItems.filter((s) =>
    can(subPermMap[s.id])
  );
  const manageDataSubItemsFiltered = manageDataSubItems.filter((s) =>
    can(subPermMap[s.id])
  );

  const menuItems = (() => {
    const out = [];
    const push = (item) => out.push(item);

    // Screen access (view.*) drives the sidebar so menu never appears without a routable screen.
    if (can(PERM.VIEW_DASHBOARD)) {
      push({
        id: "dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        color: "text-teal-600",
      });
    }
    if (can(PERM.VIEW_SCHEDULING)) {
      push({
        id: "scheduling",
        label: "Scheduling",
        icon: Calendar,
        color: "text-blue-600",
      });
    }
    if (can(PERM.VIEW_CLIENTS)) {
      push({
        id: "clients",
        label: "Clients",
        icon: Users,
        color: "text-indigo-600",
      });
    }
    if (can(PERM.VIEW_STAFF)) {
      push({
        id: "staff",
        label: "Staff",
        icon: UserCheck,
        color: "text-orange-600",
      });
    }
    if (can(PERM.VIEW_USERS)) {
      push({
        id: "users",
        label: "Users",
        icon: UserPlus,
        color: "text-orange-600",
      });
    }
    if (can(PERM.VIEW_MASTER_DATA) && masterDataSubItemsFiltered.length > 0) {
      push({
        id: "masterData",
        label: "Data Collection",
        icon: Database,
        color: "text-orange-600",
        hasSubmenu: true,
        subItems: masterDataSubItemsFiltered,
      });
    }
    if (can(PERM.VIEW_MANAGE_DATA) && manageDataSubItemsFiltered.length > 0) {
      push({
        id: "manageData",
        label: "Manage Data",
        icon: Database,
        color: "text-emerald-600",
        hasSubmenu: true,
        subItems: manageDataSubItemsFiltered,
      });
    }
    if (can(PERM.VIEW_REPORTS)) {
      push({
        id: "reports",
        label: "Reports",
        icon: UserPlus,
        color: "text-orange-600",
      });
    }
    if (can(PERM.VIEW_LAUNCHPAD)) {
      push({
        id: "launchpad",
        label: "Launchpad",
        icon: FileText,
        color: "text-emerald-600",
        href: "/launchpad/",
      });
    }
    if (can(PERM.VIEW_BILLING)) {
      push({
        id: "billing",
        label: "Billing",
        icon: FileText,
        color: "text-emerald-600",
      });
    }
    if (userRole.role === "admin" && can(PERM.USERS_WRITE)) {
      push({
        id: "roleAccess",
        label: "Role Access",
        icon: Shield,
        color: "text-teal-600",
      });
    }
    return out;
  })();

  // Determine current app based on pathname
  const [currentApp, setCurrentApp] = useState("mahaverse");
  
  useEffect(() => {
    const updateCurrentApp = () => {
      if (typeof window !== "undefined") {
        const path = window.location.pathname;
        setCurrentApp(path.startsWith("/launchpad") ? "launchpad" : "mahaverse");
      }
    };
    
    // Initial check
    updateCurrentApp();
    
    // Listen for pathname changes (for Next.js navigation)
    const handleRouteChange = () => {
      updateCurrentApp();
    };
    
    // Listen for popstate (back/forward navigation)
    window.addEventListener("popstate", handleRouteChange);
    
    // Also check periodically in case navigation happens outside Next.js router
    const interval = setInterval(updateCurrentApp, 100);
    
    return () => {
      window.removeEventListener("popstate", handleRouteChange);
      clearInterval(interval);
    };
  }, []);

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
        setOpen(true);
      } else if (currentScrollY > lastScrollY.current) {
        // Scroll DOWN - hide sidebar
        setOpen(false);
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
    setShowMasterDataMenu(false);
    setShowManageDataMenu(false);
    // Desktop: do not call setOpen(false) here — that collapses the rail to icon-only.
    // Mobile: close the sheet drawer only.
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleMasterDataHover = (isEntering) => {
    if (masterDataTimeoutRef.current) {
      clearTimeout(masterDataTimeoutRef.current);
    }

    if (isEntering) {
      setOpen(true);
      setShowMasterDataMenu(true);
    } else {
      masterDataTimeoutRef.current = setTimeout(() => {
        setShowMasterDataMenu(false);
      }, 200);
    }
  };

  const handleManageDataHover = (isEntering) => {
    if (manageDataTimeoutRef.current) {
      clearTimeout(manageDataTimeoutRef.current);
    }

    if (isEntering) {
      setOpen(true);
      setShowManageDataMenu(true);
    } else {
      manageDataTimeoutRef.current = setTimeout(() => {
        setShowManageDataMenu(false);
      }, 200);
    }
  };

  const toggleSubmenu = (menuId) => {
    // Mobile-friendly: tap to open/close submenus (hover doesn't exist on touch).
    if (menuId === "manageData") {
      setShowManageDataMenu((v) => !v);
      setShowMasterDataMenu(false);
      return;
    }
    if (menuId === "masterData") {
      setShowMasterDataMenu((v) => !v);
      setShowManageDataMenu(false);
      return;
    }
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
      case "biller":
        return "bg-purple-600";
      default:
        return "bg-teal-600";
    }
  };

  return (
    <Sidebar
      collapsible="icon"
      className="shadow-xl border-r border-slate-200 bg-white"
    >
      {/* Logo Header */}
      <SidebarHeader className="bg-slate-50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 w-full min-w-0 hover:bg-slate-100 rounded-lg p-2 transition-colors group-data-[state=collapsed]/sidebar-wrapper:justify-center group-data-[state=collapsed]/sidebar-wrapper:gap-0 group-data-[state=collapsed]/sidebar-wrapper:px-1">
              <Image
                src={img || "/placeholder.svg"}
                className="h-11 w-11 shrink-0 rounded-full object-cover transition-[width,height] duration-200 ease-linear group-data-[state=collapsed]/sidebar-wrapper:h-8 group-data-[state=collapsed]/sidebar-wrapper:w-8"
                alt="logo"
              />
              <div className="flex items-center justify-between flex-1 group-data-[state=collapsed]/sidebar-wrapper:hidden">
                <span className="text-xl font-bold text-slate-800">
                  {currentApp === "launchpad" ? "Maha Launchpad" : "Mahaverse"}
                </span>
                <ChevronDown className="h-4 w-4 text-slate-500" />
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem
              onClick={() => {
                if (currentApp !== "mahaverse") {
                  router.push("/");
                }
              }}
              className={`cursor-pointer ${
                currentApp === "mahaverse" ? "bg-teal-50 text-teal-700" : ""
              }`}
            >
              <LayoutDashboard className="mr-2 h-4 w-4" />
              <span>Mahaverse</span>
              {currentApp === "mahaverse" && (
                <span className="ml-auto text-xs">✓</span>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                if (currentApp !== "launchpad") {
                  router.push("/launchpad/form");
                }
              }}
              className={`cursor-pointer ${
                currentApp === "launchpad" ? "bg-teal-50 text-teal-700" : ""
              }`}
            >
              <FileText className="mr-2 h-4 w-4" />
              <span>Maha Launchpad</span>
              {currentApp === "launchpad" && (
                <span className="ml-auto text-xs">✓</span>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              const isManageDataSubitem = manageDataSubItemsFiltered.some(
                (subItem) => subItem.id === currentView
              );
              const isMasterDataSubitem = masterDataSubItemsFiltered.some(
                (subItem) => subItem.id === currentView
              );
              const isActiveParent = item.id === "manageData" && isManageDataSubitem;
              const isActiveMasterParent = item.id === "masterData" && isMasterDataSubitem;

              if (item.hasSubmenu) {
                const isManageData = item.id === "manageData";
                const subItems = item.subItems || [];
                const showSubmenu = isManageData ? showManageDataMenu : showMasterDataMenu;
                const handleHover = isManageData ? handleManageDataHover : handleMasterDataHover;

                return (
                  <SidebarMenuItem key={item.id} className="relative">
                    <div
                      onMouseEnter={() => (!isMobile ? handleHover(true) : undefined)}
                      onMouseLeave={() => (!isMobile ? handleHover(false) : undefined)}
                    >
                      <SidebarMenuButton
                        asChild
                        isActive={isActive || isActiveParent || isActiveMasterParent}
                        tooltip={item.label}
                      >
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            // Desktop: keep existing behavior (click selects parent + hover for submenu).
                            // Mobile: tap toggles submenu dropdown.
                            if (isMobile) {
                              toggleSubmenu(item.id);
                            } else {
                              handleMenuSelect(item.id);
                            }
                          }}
                          className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                            isActive || isActiveParent || isActiveMasterParent
                              ? "bg-teal-50 text-teal-700"
                              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <Icon
                              className={`h-4 w-4 mr-2 ${
                                isActive || isActiveParent || isActiveMasterParent ? "text-teal-600" : item.color
                              }`}
                            />
                            <span className="group-data-[state=collapsed]/sidebar-wrapper:hidden">
                              {item.label}
                            </span>
                          </div>
                          {isMobile ? (
                            <ChevronDown
                              className={`h-4 w-4 group-data-[state=collapsed]/sidebar-wrapper:hidden transition-transform ${
                                showSubmenu ? "rotate-180" : ""
                              }`}
                            />
                          ) : (
                            <ChevronRight className="h-4 w-4 group-data-[state=collapsed]/sidebar-wrapper:hidden" />
                          )}
                        </a>
                      </SidebarMenuButton>

                      {/* Submenu */}
                      {showSubmenu && (
                        isMobile ? (
                          // Mobile: inline dropdown (works in touch + sheet; avoids absolute/hover)
                          <div className="mt-1 ml-6 space-y-1 border-l border-slate-200 pl-3">
                            {subItems.map((subItem) => {
                              const SubIcon = subItem.icon;
                              return (
                                <button
                                  key={subItem.id}
                                  onClick={() => handleMenuSelect(subItem.id)}
                                  className={`w-full flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
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
                        ) : (
                          // Desktop: hover dropdown
                          <div className="absolute ml-2 pl-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-2 z-50">
                            {subItems.map((subItem) => {
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
                        )
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
                      href={item.href || "#"}
                      target={undefined}
                      rel={undefined}
                      onClick={(e) => {
                        if (item.href) return;
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
