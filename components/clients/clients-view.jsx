"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Users, Plus, Search, FileText, Calendar } from "lucide-react"

export default function ClientsView() {
  const clients = [
    {
      name: "Alex Rodriguez",
      age: 7,
      diagnosis: "Autism Spectrum Disorder",
      rbt: "Sarah Johnson",
      bcba: "Dr. Emily Chen",
      status: "Active",
      lastSession: "Jan 25, 2024",
    },
    {
      name: "Emma Wilson",
      age: 5,
      diagnosis: "Developmental Delay",
      rbt: "Jessica Martinez",
      bcba: "Dr. Michael Thompson",
      status: "Active",
      lastSession: "Jan 24, 2024",
    },
    {
      name: "Michael Chen",
      age: 9,
      diagnosis: "ADHD",
      rbt: "David Park",
      bcba: "Dr. Lisa Wang",
      status: "Active",
      lastSession: "Jan 23, 2024",
    },
    {
      name: "Sophia Kim",
      age: 6,
      diagnosis: "Speech Delay",
      rbt: "Maria Garcia",
      bcba: "Dr. Emily Chen",
      status: "Active",
      lastSession: "Jan 25, 2024",
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Client Management</h2>
          <p className="text-slate-600 mt-1">Manage client profiles and treatment plans</p>
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700 shadow-lg">
          <Plus className="h-4 w-4 mr-2" />
          Add Client
        </Button>
      </div>

      {/* Search and Filters */}
      <Card className="shadow-lg border-0">
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search clients by name, diagnosis, or therapist..."
                className="pl-10 border-slate-200 focus:border-teal-500 focus:ring-teal-500"
              />
            </div>
            <Button variant="outline" className="border-slate-300 bg-transparent">
              Filter
            </Button>
            <Button variant="outline" className="border-slate-300 bg-transparent">
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Client List */}
      <Card className="shadow-lg border-0">
        <CardHeader className="pb-4">
          <CardTitle className="text-slate-800 flex items-center">
            <Users className="h-5 w-5 mr-2 text-teal-600" />
            Active Clients ({clients.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {clients.map((client, index) => (
              <div key={index} className="border border-slate-200 rounded-xl p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="bg-teal-100 p-4 rounded-xl">
                      <Users className="h-6 w-6 text-teal-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800">{client.name}</h3>
                      <p className="text-sm text-slate-600">
                        Age: {client.age} • {client.diagnosis}
                      </p>
                      <div className="flex items-center space-x-4 mt-2">
                        <p className="text-xs text-slate-500">RBT: {client.rbt}</p>
                        <p className="text-xs text-slate-500">BCBA: {client.bcba}</p>
                        <p className="text-xs text-slate-500">Last Session: {client.lastSession}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-medium">
                      {client.status}
                    </span>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" className="border-slate-300 bg-transparent">
                        <FileText className="h-4 w-4 mr-1" />
                        Profile
                      </Button>
                      <Button variant="outline" size="sm" className="border-slate-300 bg-transparent">
                        <Calendar className="h-4 w-4 mr-1" />
                        Schedule
                      </Button>
                      <Button size="sm" className="bg-teal-600 hover:bg-teal-700">
                        Treatment Plan
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
