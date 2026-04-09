"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Calendar, Activity, Target, BookOpen } from "lucide-react"
import MetricCard from "@/components/ui/metric-card"
import ActivityFeed from "@/components/ui/activity-feed"

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    activeClients: 0,
    activeStaff: 0,
    sessionsToday: 0,
    pendingSessions: 0,
    upcomingSessions: 0,
    totalTargets: 0,
    activities: []
  })

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ""

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        setLoading(true)
        const res = await fetch(`${baseUrl}/dashboard-stats.php`, {
          method: 'GET',
          mode: 'cors',
          cache: 'no-cache',
        })
        
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`)
        }
        
        const contentType = res.headers.get("content-type")
        if (!contentType || !contentType.includes("application/json")) {
          const text = await res.text()
          console.error("Non-JSON response:", text)
          throw new Error("Server returned non-JSON response")
        }
        
        const data = await res.json()
        
        if (data && data.success) {
          setStats({
            activeClients: data.data.activeClients || 0,
            activeStaff: data.data.activeStaff || 0,
            sessionsToday: data.data.sessionsToday || 0,
            pendingSessions: data.data.pendingSessions || 0,
            upcomingSessions: data.data.upcomingSessions || 0,
            totalTargets: data.data.totalTargets || 0,
            activities: data.data.activities || []
          })
        } else {
          console.error("API returned unsuccessful response:", data)
        }
      } catch (err) {
        console.error("Error fetching dashboard stats:", err)
        // Set default values on error
        setStats({
          activeClients: 0,
          activeStaff: 0,
          sessionsToday: 0,
          pendingSessions: 0,
          upcomingSessions: 0,
          totalTargets: 0,
          activities: []
        })
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardStats()
    // Refresh every 5 minutes
    const interval = setInterval(fetchDashboardStats, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [baseUrl])

  const metrics = [
    {
      title: "Active Clients",
      value: loading ? "..." : stats.activeClients.toString(),
      change: "Active",
      changeType: "neutral",
      icon: Users,
      color: "bg-teal-500",
    },
    {
      title: "Active Staff",
      value: loading ? "..." : stats.activeStaff.toString(),
      change: "Active",
      changeType: "neutral",
      icon: Users,
      color: "bg-blue-500",
    },
    {
      title: "Sessions Today",
      value: loading ? "..." : stats.sessionsToday.toString(),
      change: stats.pendingSessions > 0 ? `${stats.pendingSessions} pending` : "All completed",
      changeType: "neutral",
      icon: Calendar,
      color: "bg-indigo-500",
    },
    {
      title: "Total Targets",
      value: loading ? "..." : stats.totalTargets.toString(),
      change: "Client targets",
      changeType: "neutral",
      icon: Target,
      color: "bg-purple-500",
    },
  ]

  // Map API activities to component format
  const activities = stats.activities.map((activity) => {
    let icon = Activity
    let color = "bg-green-100 text-green-600"
    
    if (activity.type === "client") {
      icon = Users
      color = "bg-teal-100 text-teal-600"
    } else if (activity.type === "session") {
      icon = Activity
      color = "bg-green-100 text-green-600"
    } else if (activity.type === "billing") {
      icon = CreditCard
      color = "bg-emerald-100 text-emerald-600"
    }

    return {
      type: activity.type,
      title: activity.title,
      description: activity.description,
      icon: icon,
      color: color,
    }
  })

  // Fallback activities if none from API
  const displayActivities = activities.length > 0 ? activities : [
    {
      type: "info",
      title: "No recent activity",
      description: "Activity will appear here as it happens",
      icon: Activity,
      color: "bg-slate-100 text-slate-600",
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
            {loading ? (
              <div className="text-center py-8">
                <p className="text-slate-500">Loading activities...</p>
              </div>
            ) : (
              <ActivityFeed activities={displayActivities} />
            )}
          </CardContent>
        </Card>

        {/* Upcoming Sessions This Week */}
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-slate-800 flex items-center">
              <Calendar className="h-5 w-5 mr-2 text-indigo-600" />
              Upcoming Sessions This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold text-indigo-800">
                      {loading ? "..." : stats.upcomingSessions}
                    </p>
                    <p className="text-sm text-indigo-600 mt-1">Sessions scheduled</p>
                  </div>
                  <Calendar className="h-12 w-12 text-indigo-400" />
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-slate-800">Today's Sessions</p>
                <p className="text-xs text-slate-600 mt-1">
                  {loading ? "..." : `${stats.sessionsToday} total, ${stats.pendingSessions} pending`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
