"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, Plus, ChevronLeft, ChevronRight } from "lucide-react"
import NewSessionFormModal from "./new-session-form-modal" // Import the new modal component

export default function SchedulingView() {
  const currentDate = new Date()
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]

  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false)
  const [todaySchedule, setTodaySchedule] = useState([
    {
      time: "9:00 AM",
      client: "Alex Rodriguez",
      therapist: "Sarah Johnson",
      type: "ABA Therapy",
      status: "confirmed",
    },
    {
      time: "11:00 AM",
      client: "Emma Wilson",
      therapist: "Jessica Martinez",
      type: "Social Skills",
      status: "in-progress",
    },
    {
      time: "2:00 PM",
      client: "Michael Chen",
      therapist: "David Park",
      type: "Communication",
      status: "upcoming",
    },
    {
      time: "4:00 PM",
      client: "Sophia Kim",
      therapist: "Lisa Wang",
      type: "BCBA Supervision",
      status: "upcoming",
    },
  ])

  const handleAddNewSession = (newSession) => {
    setTodaySchedule((prevSchedule) => [...prevSchedule, newSession])
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Scheduling</h2>
          <p className="text-slate-600 mt-1">Manage appointments and therapy sessions</p>
        </div>
        <Button onClick={() => setIsNewSessionModalOpen(true)} className="bg-teal-600 hover:bg-teal-700 shadow-lg">
          <Plus className="h-4 w-4 mr-2" />
          New Session
        </Button>
      </div>

      {/* Calendar Card */}
      <Card className="shadow-lg border-0">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-slate-800 flex items-center">
              <Calendar className="h-5 w-5 mr-2 text-teal-600" />
              Calendar View
            </CardTitle>
            <div className="flex items-center space-x-4">
              {/* View Toggle */}
              <div className="flex bg-slate-100 rounded-lg p-1">
                <Button variant="ghost" size="sm" className="text-slate-600">
                  Day
                </Button>
                <Button variant="ghost" size="sm" className="text-slate-600">
                  Week
                </Button>
                <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white">
                  Month
                </Button>
              </div>

              {/* Month Navigation */}
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-medium text-slate-800 min-w-[120px] text-center">
                  {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </span>
                <Button variant="outline" size="sm">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2 mb-4">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="text-center font-semibold text-slate-600 py-3 bg-slate-50 rounded-lg">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }, (_, i) => {
              const dayNumber = (i % 31) + 1
              const hasSession = i === 10 || i === 15 || i === 22

              return (
                <div
                  key={i}
                  className="aspect-square border border-slate-200 rounded-lg p-2 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="text-sm text-slate-600 font-medium">{dayNumber}</div>
                  {i === 10 && (
                    <div className="bg-teal-100 text-teal-800 text-xs p-1 rounded mt-1 truncate">Alex R. 9AM</div>
                  )}
                  {i === 15 && (
                    <div className="bg-blue-100 text-blue-800 text-xs p-1 rounded mt-1 truncate">Emma W. 2PM</div>
                  )}
                  {i === 22 && (
                    <div className="bg-purple-100 text-purple-800 text-xs p-1 rounded mt-1 truncate">
                      Michael C. 4PM
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Today's Schedule */}
      <Card className="shadow-lg border-0">
        <CardHeader className="pb-4">
          <CardTitle className="text-slate-800">Today's Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {todaySchedule.map((session, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:shadow-md transition-shadow"
              >
                <div className="flex items-center space-x-4">
                  <div className="bg-teal-100 p-3 rounded-xl">
                    <Calendar className="h-5 w-5 text-teal-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{session.client}</p>
                    <p className="text-sm text-slate-600">
                      {session.time} • {session.type}
                    </p>
                    <p className="text-xs text-slate-500">with {session.therapist}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      session.status === "confirmed"
                        ? "bg-green-100 text-green-800"
                        : session.status === "in-progress"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-slate-100 text-slate-800"
                    }`}
                  >
                    {session.status === "confirmed"
                      ? "Confirmed"
                      : session.status === "in-progress"
                        ? "In Progress"
                        : "Upcoming"}
                  </span>
                  <Button variant="outline" size="sm">
                    Edit
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* New Session Modal */}
      <NewSessionFormModal
        isOpen={isNewSessionModalOpen}
        onClose={() => setIsNewSessionModalOpen(false)}
        onSave={handleAddNewSession}
      />
    </div>
  )
}
