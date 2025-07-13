"use client"

import { Button } from "@/components/ui/button"
import { Bell, Search, User } from "lucide-react"
import { Input } from "@/components/ui/input"
import { SidebarTrigger } from "@/components/ui/sidebar"

export default function Header({ userRole }) {
  const getRoleDisplay = () => {
    switch (userRole) {
      case "admin":
        return { title: "Administrator", subtitle: "System Management" }
      case "bcba":
        return { title: "BCBA", subtitle: "Clinical Supervision" }
      case "rbt":
        return { title: "RBT", subtitle: "Therapy Services" }
      case "parent":
        return { title: "Parent Portal", subtitle: "Child Progress Tracking" }
      default:
        return { title: "User", subtitle: "Dashboard" }
    }
  }

  const roleInfo = getRoleDisplay()

  return (
    <header className="bg-white shadow-sm border-b border-slate-200 h-16 flex items-center justify-between px-6">
      <div className="flex items-center">
        {/* Mobile Sidebar Trigger - only visible on small screens */}
        <SidebarTrigger className="mr-4 lg:hidden" />
        <div>
          <h1 className="text-xl font-semibold text-slate-800">{roleInfo.title}</h1>
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
        <div className="flex items-center space-x-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-slate-800">Dr. Sarah Johnson</p>
            <p className="text-xs text-slate-500">{roleInfo.title}</p>
          </div>
          <div className="h-10 w-10 bg-teal-600 rounded-full flex items-center justify-center shadow-md">
            <User className="h-5 w-5 text-white" />
          </div>
        </div>
      </div>
    </header>
  )
}
