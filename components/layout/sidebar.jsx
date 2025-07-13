"use client"

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
} from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Sidebar({ userRole, currentView, setCurrentView }) {
  const getMenuItems = () => {
    const baseItems = [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, color: "text-teal-600" },
      { id: "scheduling", label: "Scheduling", icon: Calendar, color: "text-blue-600" },
      { id: "clients", label: "Clients", icon: Users, color: "text-indigo-600" },
      { id: "sessions", label: "Sessions", icon: FileText, color: "text-purple-600" },
    ]

    if (userRole === "admin" || userRole === "bcba") {
      baseItems.push({ id: "billing", label: "Billing", icon: CreditCard, color: "text-emerald-600" })
    }

    if (userRole === "parent") {
      return [
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, color: "text-teal-600" },
        { id: "portal", label: "My Child", icon: Baby, color: "text-pink-600" },
        { id: "billing", label: "Billing", icon: CreditCard, color: "text-emerald-600" },
      ]
    }

    return baseItems
  }

  const getRoleColor = () => {
    switch (userRole) {
      case "admin":
        return "bg-teal-600"
      case "bcba":
        return "bg-blue-600"
      case "rbt":
        return "bg-indigo-600"
      case "parent":
        return "bg-emerald-600"
      default:
        return "bg-teal-600"
    }
  }

  return (
    <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl border-r border-slate-200 lg:block hidden">
      {/* Logo Header */}
      <div className="flex h-16 items-center px-6 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center space-x-3">
          <div className={`${getRoleColor()} p-2 rounded-xl shadow-md`}>
            <Heart className="h-6 w-6 text-white" />
          </div>
          <div>
            <span className="text-xl font-bold text-slate-800">ABA Connect</span>
            <p className="text-xs text-slate-500 font-medium">Practice Management</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="mt-6 px-4">
        <div className="space-y-2">
          {getMenuItems().map((item) => {
            const Icon = item.icon
            const isActive = currentView === item.id

            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                  isActive
                    ? "bg-teal-50 text-teal-700 border-r-4 border-teal-600 shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon className={`mr-3 h-5 w-5 ${isActive ? "text-teal-600" : item.color}`} />
                {item.label}
              </button>
            )
          })}
        </div>

        {/* Bottom Actions */}
        <div className="absolute bottom-6 left-4 right-4 space-y-2">
          <Button variant="ghost" className="w-full justify-start text-slate-600 hover:bg-slate-50">
            <Settings className="mr-3 h-5 w-5" />
            Settings
          </Button>
          <Button variant="ghost" className="w-full justify-start text-slate-600 hover:bg-slate-50">
            <LogOut className="mr-3 h-5 w-5" />
            Sign Out
          </Button>
        </div>
      </nav>
    </div>
  )
}
