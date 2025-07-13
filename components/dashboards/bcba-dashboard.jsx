"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, FileText, Calendar, Clock, CheckCircle, AlertTriangle } from "lucide-react"
import MetricCard from "@/components/ui/metric-card"
import { Button } from "@/components/ui/button"

export default function BCBADashboard() {
  const metrics = [
    {
      title: "My Clients",
      value: "18",
      change: "Active cases",
      changeType: "neutral",
      icon: Users,
      color: "bg-teal-500",
    },
    {
      title: "Pending Approvals",
      value: "7",
      change: "Requires review",
      changeType: "warning",
      icon: FileText,
      color: "bg-amber-500",
    },
    {
      title: "Supervision Hours",
      value: "12.5",
      change: "This month",
      changeType: "positive",
      icon: Clock,
      color: "bg-blue-500",
    },
  ]

  const todaySessions = [
    {
      client: "Emma Wilson",
      time: "10:00 AM - 11:30 AM",
      status: "In Progress",
      statusColor: "bg-green-100 text-green-800",
    },
    {
      client: "Michael Chen",
      time: "2:00 PM - 3:30 PM",
      status: "Upcoming",
      statusColor: "bg-blue-100 text-blue-800",
    },
    {
      client: "Alex Rodriguez",
      time: "4:00 PM - 5:30 PM",
      status: "Scheduled",
      statusColor: "bg-slate-100 text-slate-800",
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-slate-800">BCBA Dashboard</h2>
        <p className="text-slate-600 mt-1">Clinical supervision and oversight</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {metrics.map((metric, index) => (
          <MetricCard key={index} {...metric} />
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Today's Sessions */}
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-slate-800 flex items-center">
              <Calendar className="h-5 w-5 mr-2 text-teal-600" />
              Today's Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {todaySessions.map((session, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div>
                    <p className="font-semibold text-slate-800">{session.client}</p>
                    <p className="text-sm text-slate-600">{session.time}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${session.statusColor}`}>
                    {session.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Supervision Tracker */}
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-slate-800 flex items-center">
              <Clock className="h-5 w-5 mr-2 text-blue-600" />
              Supervision Tracker
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-600">Monthly Goal Progress</span>
                <span className="font-medium text-slate-800">12.5 / 20 hours</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: "62%" }}
                ></div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-blue-800">Next Supervision</p>
                  <p className="text-sm text-blue-600">Tomorrow 3:00 PM</p>
                  <p className="text-xs text-blue-500">RBT: Jessica Martinez</p>
                </div>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                  View Details
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Approvals */}
      <Card className="shadow-lg border-0">
        <CardHeader className="pb-4">
          <CardTitle className="text-slate-800 flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2 text-amber-600" />
            Pending Session Approvals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { client: "Alex Rodriguez", rbt: "Sarah Johnson", date: "Jan 25, 2024", type: "Session Note" },
              { client: "Emma Wilson", rbt: "Jessica Martinez", date: "Jan 24, 2024", type: "Data Collection" },
              { client: "Michael Chen", rbt: "David Park", date: "Jan 24, 2024", type: "Session Note" },
            ].map((item, index) => (
              <div key={index} className="flex items-center justify-between p-4 border border-slate-200 rounded-xl">
                <div>
                  <p className="font-medium text-slate-800">
                    {item.client} - {item.type}
                  </p>
                  <p className="text-sm text-slate-600">
                    RBT: {item.rbt} • {item.date}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" className="border-slate-300 bg-transparent">
                    Review
                  </Button>
                  <Button size="sm" className="bg-teal-600 hover:bg-teal-700">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
