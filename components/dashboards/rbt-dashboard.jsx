"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Users, FileText, Clock, MapPin } from "lucide-react"
import MetricCard from "@/components/ui/metric-card"
import { Button } from "@/components/ui/button"

export default function RBTDashboard() {
  const metrics = [
    {
      title: "Today's Sessions",
      value: "6",
      change: "2 completed",
      changeType: "positive",
      icon: Calendar,
      color: "bg-teal-500",
    },
    {
      title: "Assigned Clients",
      value: "8",
      change: "Active cases",
      changeType: "neutral",
      icon: Users,
      color: "bg-blue-500",
    },
    {
      title: "Pending Notes",
      value: "3",
      change: "Due today",
      changeType: "warning",
      icon: FileText,
      color: "bg-amber-500",
    },
  ]

  const todaySchedule = [
    {
      client: "Alex Rodriguez",
      time: "9:00 AM - 10:30 AM",
      location: "Home Visit",
      status: "completed",
      address: "123 Oak Street",
    },
    {
      client: "Sophia Kim",
      time: "11:00 AM - 12:30 PM",
      location: "Clinic",
      status: "in-progress",
      address: "ABA Center - Room 3",
    },
    {
      client: "Emma Wilson",
      time: "2:00 PM - 3:30 PM",
      location: "School",
      status: "upcoming",
      address: "Lincoln Elementary",
    },
    {
      client: "Michael Chen",
      time: "4:00 PM - 5:30 PM",
      location: "Home Visit",
      status: "upcoming",
      address: "456 Pine Avenue",
    },
  ]

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800"
      case "in-progress":
        return "bg-blue-100 text-blue-800"
      case "upcoming":
        return "bg-slate-100 text-slate-800"
      default:
        return "bg-slate-100 text-slate-800"
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case "completed":
        return "Completed"
      case "in-progress":
        return "In Progress"
      case "upcoming":
        return "Upcoming"
      default:
        return "Scheduled"
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-slate-800">RBT Dashboard</h2>
        <p className="text-slate-600 mt-1">Your daily schedule and client assignments</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {metrics.map((metric, index) => (
          <MetricCard key={index} {...metric} />
        ))}
      </div>

      {/* Today's Schedule */}
      <Card className="shadow-lg border-0">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-slate-800 flex items-center">
              <Clock className="h-5 w-5 mr-2 text-teal-600" />
              Today's Schedule
            </CardTitle>
            <div className="text-sm text-slate-500">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {todaySchedule.map((session, index) => (
              <div key={index} className="border border-slate-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="bg-teal-100 p-3 rounded-xl">
                      <Users className="h-5 w-5 text-teal-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{session.client}</p>
                      <p className="text-sm text-slate-600 flex items-center mt-1">
                        <Clock className="h-4 w-4 mr-1" />
                        {session.time}
                      </p>
                      <p className="text-xs text-slate-500 flex items-center mt-1">
                        <MapPin className="h-3 w-3 mr-1" />
                        {session.location} • {session.address}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(session.status)}`}>
                      {getStatusText(session.status)}
                    </span>
                    {session.status !== "completed" && (
                      <Button size="sm" className="bg-teal-600 hover:bg-teal-700">
                        {session.status === "in-progress" ? "Continue" : "Start Session"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-slate-800">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full justify-start bg-teal-600 hover:bg-teal-700">
              <FileText className="h-4 w-4 mr-2" />
              Complete Session Note
            </Button>
            <Button variant="outline" className="w-full justify-start border-slate-300 bg-transparent">
              <Calendar className="h-4 w-4 mr-2" />
              View Weekly Schedule
            </Button>
            <Button variant="outline" className="w-full justify-start border-slate-300 bg-transparent">
              <Users className="h-4 w-4 mr-2" />
              Client Progress Reports
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-slate-800">Recent Updates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-sm font-medium text-blue-800">Treatment Plan Updated</p>
              <p className="text-xs text-blue-600 mt-1">Alex Rodriguez - New goals added by BCBA</p>
            </div>
            <div className="bg-green-50 rounded-xl p-4">
              <p className="text-sm font-medium text-green-800">Session Approved</p>
              <p className="text-xs text-green-600 mt-1">Emma Wilson session note approved</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
