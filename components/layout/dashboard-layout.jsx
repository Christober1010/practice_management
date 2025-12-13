"use client";

import { useState, useEffect } from "react";
import Header from "./header";
import AdminDashboard from "@/components/dashboards/admin-dashboard";
import BCBADashboard from "@/components/dashboards/bcba-dashboard";
import RBTDashboard from "@/components/dashboards/rbt-dashboard";
import ParentDashboard from "@/components/dashboards/parent-dashboard";
import SchedulingView from "@/components/scheduling/scheduling-view";
import ClientsView from "@/components/clients/clients-view";
import SessionsView from "@/components/sessions/sessions-view";
import BillingView from "@/components/billing/billing-view";
import ParentPortal from "@/components/portal/parent-portal";
import StaffView from "@/components/staff/staff-view";
import UsersView from "@/components/users/users-view";
import ProgramsView from "@/components/master-data/ProgramsView";
import ModulesList from "@/components/master-data/modules-list";
import DomainsList from "@/components/master-data/domains-list";
import ProgramsList from "@/components/master-data/programs-list";
import PromptsList from "@/components/master-data/prompts-list";
import TargetsList from "@/components/master-data/targets-list";
import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "@/components/layout/app-sidebar";
import ExcelToTable from "../reports/ExcelToTable";

export default function DashboardLayout({ userRole, onLogout }) {
  const [currentView, setCurrentView] = useState("dashboard");

  // Listen for navigation events from other components
  useEffect(() => {
    const handleNavigate = (event) => {
      const view = event.detail?.view || localStorage.getItem("currentView");
      if (view) {
        setCurrentView(view);
      }
    };

    window.addEventListener("navigateToView", handleNavigate);
    
    // Also check localStorage on mount for pending navigation
    const savedView = localStorage.getItem("currentView");
    if (savedView) {
      setCurrentView(savedView);
    }

    return () => {
      window.removeEventListener("navigateToView", handleNavigate);
    };
  }, []);

  const renderContent = () => {
    switch (currentView) {
      case "dashboard":
        switch (userRole.role) {
          case "admin":
            return <AdminDashboard />;
          case "bcba":
            return <BCBADashboard />;
          case "rbt":
            return <RBTDashboard />;
          case "parent":
            return <ParentDashboard />;
          default:
            return <AdminDashboard />;
        }
      case "scheduling":
        return <SchedulingView />;
      case "clients":
        return <ClientsView />;
      case "sessions":
        return <SessionsView />;
      case "staff":
        return <StaffView />;
      case "billing":
        return <BillingView />;
      case "portal":
        return <ParentPortal />;
      case "users":
        return <UsersView />;
      case "masterData":
        return <ProgramsView />;
      case "modules":
        return <ModulesList />;
      case "domains":
        return <DomainsList />;
      case "programs":
        return <ProgramsList />;
      case "targets":
        return <TargetsList />;
      case "prompts":
        return <PromptsList />;
      case "reports":
        return <ExcelToTable />;
      default:
        return <AdminDashboard />;
    }
  };
  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar
        userRole={userRole}
        currentView={currentView}
        setCurrentView={setCurrentView}
        onLogout={onLogout}
      />
      <div className="w-full bg-gray-50 overflow-x-hidden">
        <Header userRole={userRole} onLogout={onLogout} />
        <main className="p-6 bg-white ">{renderContent()}</main>
      </div>
    </SidebarProvider>
  );
}
