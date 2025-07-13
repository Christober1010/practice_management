"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, CreditCard, Calendar, TrendingUp, Activity, AlertCircle } from "lucide-react"
import MetricCard from "@/components/ui/metric-card"
import ActivityFeed from "@/components/ui/activity-feed"

export default function AdminDashboard() {
  const metrics = [
    {
      title: "Active Clients",
      value: "127",
      change: "+12%",
      changeType: "positive",
      icon: Users,
      color: "bg-teal-500",
    },
    {
      title: "Monthly Revenue",
      value: "$48,392",
      change: "+8%",
      changeType: "positive",
      icon: CreditCard,
      color: "bg-emerald-500",
    },
    {
      title: "Active Staff",
      value: "23",
      change: "2 new hires",
      changeType: "neutral",
      icon: Users,
      color: "bg-blue-500",
    },
    {
      title: "Sessions Today",
      value: "34",
      change: "6 pending",
      changeType: "neutral",
      icon: Calendar,
      color: "bg-indigo-500",
    },
  ]

  const activities = [
    {
      type: "client",
      title: "New client enrolled",
      description: "Sarah Johnson - 2 hours ago",
      icon: Users,
      color: "bg-teal-100 text-teal-600",
    },
    {
      type: "session",
      title: "Session note approved",
      description: "Alex Thompson - 4 hours ago",
      icon: Activity,
      color: "bg-green-100 text-green-600",
    },
    {
      type: "billing",
      title: "Invoice payment received",
      description: "$1,250 - 6 hours ago",
      icon: CreditCard,
      color: "bg-emerald-100 text-emerald-600",
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-slate-800">Admin Dashboard</h2>
        <p className="text-slate-600 mt-1">System overview and management</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, index) => (
          <MetricCard key={index} {...metric} />
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Activity */}
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-slate-800 flex items-center">
              <Activity className="h-5 w-5 mr-2 text-teal-600" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityFeed activities={activities} />
          </CardContent>
        </Card>

        {/* System Notices */}
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-slate-800 flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 text-amber-600" />
              System Notices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-amber-800">Scheduled Maintenance</p>
                <p className="text-xs text-amber-600 mt-1">System update planned for Sunday 2 AM EST</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-blue-800">New Feature Available</p>
                <p className="text-xs text-blue-600 mt-1">Enhanced data collection tools now live</p>
              </div>
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-teal-800">Training Reminder</p>
                <p className="text-xs text-teal-600 mt-1">Monthly HIPAA compliance training due</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Chart Placeholder */}
      <Card className="shadow-lg border-0">
        <CardHeader>
          <CardTitle className="text-slate-800 flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-teal-600" />
            Performance Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-slate-50 rounded-xl flex items-center justify-center">
            <p className="text-slate-500">Performance charts will be displayed here</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
