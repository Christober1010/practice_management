"use client"

import { Button } from "@/components/ui/button"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, TrendingUp, CreditCard, Heart, Clock, FileText } from "lucide-react"
import MetricCard from "@/components/ui/metric-card"
import ProgressBar from "@/components/ui/progress-bar"

export default function ParentDashboard() {
  const metrics = [
    {
      title: "This Week's Sessions",
      value: "4",
      change: "2 completed",
      changeType: "positive",
      icon: Calendar,
      color: "bg-teal-500",
    },
    {
      title: "Goals Mastered",
      value: "12",
      change: "3 this month",
      changeType: "positive",
      icon: TrendingUp,
      color: "bg-emerald-500",
    },
    {
      title: "Outstanding Balance",
      value: "$0",
      change: "All paid",
      changeType: "positive",
      icon: CreditCard,
      color: "bg-green-500",
    },
  ]

  const upcomingSessions = [
    {
      type: "ABA Therapy Session",
      time: "Tomorrow 2:00 PM - 3:30 PM",
      therapist: "Sarah Johnson, RBT",
      location: "Home Visit",
    },
    {
      type: "BCBA Supervision",
      time: "Friday 10:00 AM - 11:00 AM",
      therapist: "Dr. Emily Chen, BCBA",
      location: "Clinic",
    },
  ]

  const progressAreas = [
    { name: "Communication Goals", progress: 85, color: "bg-emerald-600" },
    { name: "Social Skills", progress: 72, color: "bg-blue-600" },
    { name: "Daily Living Skills", progress: 68, color: "bg-amber-600" },
    { name: "Academic Skills", progress: 78, color: "bg-purple-600" },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-50 to-blue-50 rounded-2xl p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-teal-600 p-3 rounded-xl">
            <Heart className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-slate-800">Welcome Back!</h2>
            <p className="text-slate-600 mt-1">Track your child's progress and upcoming sessions</p>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {metrics.map((metric, index) => (
          <MetricCard key={index} {...metric} />
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upcoming Sessions */}
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-slate-800 flex items-center">
              <Calendar className="h-5 w-5 mr-2 text-teal-600" />
              Upcoming Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingSessions.map((session, index) => (
                <div key={index} className="bg-slate-50 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-slate-800">{session.type}</p>
                      <p className="text-sm text-slate-600 flex items-center mt-1">
                        <Clock className="h-4 w-4 mr-1" />
                        {session.time}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        with {session.therapist} • {session.location}
                      </p>
                    </div>
                    <div className="bg-teal-100 text-teal-800 px-3 py-1 rounded-full text-xs font-medium">
                      Confirmed
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Progress */}
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-slate-800 flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-emerald-600" />
              Progress Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {progressAreas.map((area, index) => (
                <div key={index}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium text-slate-700">{area.name}</span>
                    <span className="text-slate-600">{area.progress}%</span>
                  </div>
                  <ProgressBar progress={area.progress} color={area.color} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Reports */}
      <Card className="shadow-lg border-0">
        <CardHeader className="pb-4">
          <CardTitle className="text-slate-800 flex items-center">
            <FileText className="h-5 w-5 mr-2 text-blue-600" />
            Recent Session Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                title: "ABA Therapy Session",
                date: "Jan 25, 2024",
                duration: "90 minutes",
                therapist: "Sarah Johnson, RBT",
                summary:
                  "Great progress on communication goals. Alex showed increased verbal requests and improved social interaction during structured activities. Worked on daily living skills with 85% accuracy.",
              },
              {
                title: "BCBA Supervision Note",
                date: "Jan 22, 2024",
                duration: "60 minutes",
                therapist: "Dr. Emily Chen, BCBA",
                summary:
                  "Treatment plan review and goal adjustments. Recommend increasing social interaction targets and introducing new daily living skills. Parent training session scheduled for next week.",
              },
            ].map((report, index) => (
              <div key={index} className="bg-slate-50 rounded-xl p-5">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-semibold text-slate-800">{report.title}</p>
                    <p className="text-sm text-slate-600">
                      {report.date} • {report.duration}
                    </p>
                    <p className="text-xs text-slate-500">with {report.therapist}</p>
                  </div>
                  <Button variant="outline" size="sm" className="border-slate-300 bg-transparent">
                    Download
                  </Button>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">{report.summary}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
