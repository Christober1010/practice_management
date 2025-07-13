"use client"

import { useState } from "react"
import Header from "./header"
import AdminDashboard from "@/components/dashboards/admin-dashboard"
import BCBADashboard from "@/components/dashboards/bcba-dashboard"
import RBTDashboard from "@/components/dashboards/rbt-dashboard"
import ParentDashboard from "@/components/dashboards/parent-dashboard"
import SchedulingView from "@/components/scheduling/scheduling-view"
import ClientsView from "@/components/clients/clients-view"
import SessionsView from "@/components/sessions/sessions-view"
import BillingView from "@/components/billing/billing-view"
import ParentPortal from "@/components/portal/parent-portal"
import { SidebarProvider } from "@/components/ui/sidebar" // Removed SidebarInset
import AppSidebar from "@/components/layout/app-sidebar"

export default function DashboardLayout({ userRole }) {
  const [currentView, setCurrentView] = useState("dashboard")

  const renderContent = () => {
    switch (currentView) {
      case "dashboard":
        switch (userRole) {
          case "admin":
            return <AdminDashboard />
          case "bcba":
            return <BCBADashboard />
          case "rbt":
            return <RBTDashboard />
          case "parent":
            return <ParentDashboard />
          default:
            return <AdminDashboard />
        }
      case "scheduling":
        return <SchedulingView />
      case "clients":
        return <ClientsView />
      case "sessions":
        return <SessionsView />
      case "billing":
        return <BillingView />
      case "portal":
        return <ParentPortal />
      default:
        return <AdminDashboard />
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar userRole={userRole} currentView={currentView} setCurrentView={setCurrentView} />
      <div className="flex-1">
        <Header userRole={userRole} />
        <main className="p-6">{renderContent()}</main>
      </div>
    </SidebarProvider>
  )
}
