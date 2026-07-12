"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import Header from "./header";
import { usePermissions } from "@/hooks/usePermissions";
import { VIEW_REQUIRED_PERMISSION, SUBMENU_VIEW_OR_MANAGE, PERM } from "@/lib/rbac-permission-keys";
import RoleAccessView from "@/components/admin/role-access-view";
import AdminDashboard from "@/components/dashboards/admin-dashboard";
import BCBADashboard from "@/components/dashboards/bcba-dashboard";
import RBTDashboard from "@/components/dashboards/rbt-dashboard";
import ParentDashboard from "@/components/dashboards/parent-dashboard";
import SchedulingView from "@/components/scheduling/scheduling-view";
import ClientsView from "@/components/clients/clients-view";
import SessionsView from "@/components/sessions/sessions-view";
import BillingView from "@/components/billing/billing-view";
import ClaimsView from "@/components/billing/claims-view";
import ParentPortal from "@/components/portal/parent-portal";
import StaffView from "@/components/staff/staff-view";
import UsersView from "@/components/users/users-view";
import ProgramsView from "@/components/master-data/ProgramsView";
import ModulesList from "@/components/master-data/modules-list";
import DomainsList from "@/components/master-data/domains-list";
import ProgramsList from "@/components/master-data/programs-list";
import TargetsList from "@/components/master-data/targets-list";
import PromptsList from "@/components/master-data/prompts-list";
import BehaviorCategoriesList from "@/components/master-data/behavior-categories-list";
import BehaviorsList from "@/components/master-data/behaviors-list";
import ManageDataView from "@/components/manage-data/manage-data-view";
import ProviderView from "@/components/manage-data/provider-view";
import ProviderServiceCodeView from "@/components/manage-data/provider-service-code-view";
import ServiceCodeView from "@/components/manage-data/service-code-view";
import DiagnosisView from "@/components/manage-data/diagnosis-view";
import FacilityTypesView from "@/components/manage-data/facility-types-view";
import TreatmentTypesSetup from "@/components/manage-data/treatment-types-setup";
import DocumentTypesSetup from "@/components/manage-data/document-types-setup";
import PayerPaymentsView from "@/components/manage-data/payer-payments-view";
import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "@/components/layout/app-sidebar";
import ReportsView from "../reports/reports-view";
import LocationsView from "../locations/locations-view";

export default function DashboardLayout({ userRole, onLogout }) {
  const [currentView, setCurrentView] = useState("dashboard");
  const { can, canAny } = usePermissions(userRole);

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
    if (currentView === "roleAccess") {
      if (userRole.role !== "admin" || !can(PERM.USERS_WRITE)) {
        return (
          <div className="max-w-lg mx-auto py-16 text-center text-slate-600">
            <p>Role access is only available to administrators.</p>
          </div>
        );
      }
      return <RoleAccessView />;
    }

    const required = VIEW_REQUIRED_PERMISSION[currentView];
    const requiredAny = SUBMENU_VIEW_OR_MANAGE[currentView];
    const denied =
      (requiredAny && !canAny(requiredAny)) ||
      (!requiredAny && required && !can(required));
    if (denied) {
      return (
        <div className="max-w-lg mx-auto py-16 text-center space-y-4">
          <p className="text-lg text-slate-700">You don&apos;t have access to this area.</p>
          <Button
            type="button"
            onClick={() => {
              setCurrentView("dashboard");
              localStorage.setItem("currentView", "dashboard");
            }}
          >
            Go to dashboard
          </Button>
        </div>
      );
    }

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
          case "biller":
            return <BillingView />;
          default:
            return <AdminDashboard />;
        }
      case "scheduling":
        return <SchedulingView userRole={userRole} />;
      case "clients":
        return <ClientsView userRole={userRole} />;
      case "sessions":
        return <SessionsView />;
      case "staff":
        return <StaffView userRole={userRole} />;
      case "billing":
        return <BillingView />;
      case "claims":
        return <ClaimsView />;
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
      case "behaviorCategories":
        return <BehaviorCategoriesList />;
      case "behaviors":
        return <BehaviorsList />;
      case "reports":
      case "reportsSessionImport":
        return <ReportsView initialTab="sessionImport" />;
      case "reportsInsuranceUtilization":
        return <ReportsView initialTab="insuranceUtilization" />;
      case "locations":
        return <LocationsView />;
      case "manageData":
        return <ManageDataView />;
      case "provider":
        return <ProviderView />;
      case "providerServiceCode":
        return <ProviderServiceCodeView />;
      case "serviceCode":
        return <ServiceCodeView />;
      case "diagnosis":
        return <DiagnosisView />;
      case "facilityTypes":
        return <FacilityTypesView />;
      case "treatmentTypes":
        return <TreatmentTypesSetup />;
      case "documentTypes":
        return <DocumentTypesSetup />;
      case "payerPayments":
        return <PayerPaymentsView />;
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
