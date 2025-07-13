"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Heart, Calendar, TrendingUp, CreditCard, Download, MessageCircle, Clock, FileText } from "lucide-react"
import ProgressBar from "@/components/ui/progress-bar"

export default function ParentPortal() {
  const progressAreas = [
    { name: "Verbal Communication", progress: 85, target: 90, color: "bg-emerald-600" },
    { name: "Social Interaction", progress: 72, target: 80, color: "bg-blue-600" },
    { name: "Daily Living Skills", progress: 68, target: 75, color: "bg-amber-600" },
    { name: "Academic Skills", progress: 78, target: 85, color: "bg-purple-600" },
  ]

  const sessionReports = [
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
  ]

  const upcomingSessions = [
    {
      type: "ABA Therapy Session",
      time: "Tomorrow 2:00 PM - 3:30 PM",
      therapist: "Sarah Johnson, RBT",
      location: "Home Visit",
      status: "Confirmed",
    },
    {
      type: "BCBA Supervision",
      time: "Friday 10:00 AM - 11:00 AM",
      therapist: "Dr. Emily Chen, BCBA",
      location: "Clinic",
      status: "Scheduled",
    },
    {
      type: "Parent Training",
      time: "Saturday 9:00 AM - 10:00 AM",
      therapist: "Dr. Emily Chen, BCBA",
      location: "Virtual",
      status: "Confirmed",
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-50 via-blue-50 to-purple-50 rounded-2xl p-6">
        <div className="flex items-center space-x-4">
          <div className="bg-teal-600 p-4 rounded-xl shadow-lg">
            <Heart className="h-8 w-8 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-slate-800">My Child's Progress</h2>
            <p className="text-slate-600 mt-1">Track therapy progress and communicate with the care team</p>
          </div>
        </div>
      </div>

      {/* Treatment Goals Progress */}
      <Card className="shadow-lg border-0">
        <CardHeader className="pb-4">
          <CardTitle className="text-slate-800 flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-emerald-600" />
            Treatment Goals Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {progressAreas.map((area, index) => (
              <div key={index} className="bg-slate-50 rounded-xl p-5">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-slate-800">{area.name}</h4>
                  <span className="text-sm text-slate-600">{area.progress}%</span>
                </div>
                <ProgressBar progress={area.progress} color={area.color} height="h-3" />
                <p className="text-xs text-slate-500 mt-2">Target: {area.target}% by March 2024</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
                <div key={index} className="border border-slate-200 rounded-xl p-4">
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
                    <span className="bg-teal-100 text-teal-800 px-3 py-1 rounded-full text-xs font-medium">
                      {session.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Billing Summary */}
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-slate-800 flex items-center">
              <CreditCard className="h-5 w-5 mr-2 text-emerald-600" />
              Billing & Payments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-green-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-green-800">Current Balance</span>
                <span className="text-2xl font-bold text-green-600">$0.00</span>
              </div>
              <p className="text-xs text-green-600">All invoices are up to date</p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Last Payment</span>
                <span className="font-medium text-slate-800">$1,200.00 - Jan 20, 2024</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Next Invoice</span>
                <span className="font-medium text-slate-800">Expected Feb 1, 2024</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Insurance Coverage</span>
                <span className="font-medium text-slate-800">80% covered</span>
              </div>
            </div>

            <div className="flex space-x-2">
              <Button className="flex-1 bg-teal-600 hover:bg-teal-700">
                <CreditCard className="h-4 w-4 mr-2" />
                Payment History
              </Button>
              <Button variant="outline" className="border-slate-300 bg-transparent">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Session Reports */}
      <Card className="shadow-lg border-0">
        <CardHeader className="pb-4">
          <CardTitle className="text-slate-800 flex items-center">
            <FileText className="h-5 w-5 mr-2 text-blue-600" />
            Recent Session Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {sessionReports.map((report, index) => (
              <div key={index} className="bg-slate-50 rounded-xl p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="font-semibold text-slate-800">{report.title}</p>
                    <p className="text-sm text-slate-600">
                      {report.date} • {report.duration}
                    </p>
                    <p className="text-xs text-slate-500">with {report.therapist}</p>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" className="border-slate-300 bg-transparent">
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                    <Button variant="outline" size="sm" className="border-slate-300 bg-transparent">
                      <MessageCircle className="h-4 w-4 mr-1" />
                      Discuss
                    </Button>
                  </div>
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
