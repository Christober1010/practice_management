"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CreditCard, Plus, Download, Eye, TrendingUp, AlertCircle } from "lucide-react"
import MetricCard from "@/components/ui/metric-card"

export default function BillingView() {
  const metrics = [
    {
      title: "Monthly Revenue",
      value: "$48,392",
      change: "+8%",
      changeType: "positive",
      icon: CreditCard,
      color: "bg-emerald-500",
    },
    {
      title: "Outstanding",
      value: "$12,450",
      change: "15 invoices",
      changeType: "warning",
      icon: AlertCircle,
      color: "bg-amber-500",
    },
    {
      title: "Pending Claims",
      value: "23",
      change: "In review",
      changeType: "neutral",
      icon: CreditCard,
      color: "bg-blue-500",
    },
    {
      title: "Collection Rate",
      value: "94%",
      change: "+2%",
      changeType: "positive",
      icon: TrendingUp,
      color: "bg-teal-500",
    },
  ]

  const invoices = [
    {
      id: "INV-2024-001",
      client: "Alex Rodriguez",
      sessions: 8,
      amount: "$1,200.00",
      status: "Paid",
      statusColor: "bg-green-100 text-green-800",
      date: "Jan 15, 2024",
    },
    {
      id: "INV-2024-002",
      client: "Emma Wilson",
      sessions: 6,
      amount: "$900.00",
      status: "Pending",
      statusColor: "bg-amber-100 text-amber-800",
      date: "Jan 20, 2024",
    },
    {
      id: "INV-2024-003",
      client: "Michael Chen",
      sessions: 10,
      amount: "$1,500.00",
      status: "Submitted",
      statusColor: "bg-blue-100 text-blue-800",
      date: "Jan 25, 2024",
    },
    {
      id: "INV-2024-004",
      client: "Sophia Kim",
      sessions: 7,
      amount: "$1,050.00",
      status: "Draft",
      statusColor: "bg-slate-100 text-slate-800",
      date: "Jan 28, 2024",
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Billing & RCM</h2>
          <p className="text-slate-600 mt-1">Manage invoices and revenue cycle</p>
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700 shadow-lg">
          <Plus className="h-4 w-4 mr-2" />
          Generate Invoice
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, index) => (
          <MetricCard key={index} {...metric} />
        ))}
      </div>

      {/* Invoices */}
      <Card className="shadow-lg border-0">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-slate-800 flex items-center">
              <CreditCard className="h-5 w-5 mr-2 text-teal-600" />
              Recent Invoices
            </CardTitle>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" className="border-slate-300 bg-transparent">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm" className="border-slate-300 bg-transparent">
                View All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {invoices.map((invoice, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-5 border border-slate-200 rounded-xl hover:shadow-md transition-shadow"
              >
                <div className="flex items-center space-x-4">
                  <div className="bg-teal-100 p-3 rounded-xl">
                    <CreditCard className="h-5 w-5 text-teal-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{invoice.id}</p>
                    <p className="text-sm text-slate-600">
                      {invoice.client} • {invoice.sessions} sessions
                    </p>
                    <p className="text-xs text-slate-500">Generated: {invoice.date}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="font-semibold text-slate-800">{invoice.amount}</p>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${invoice.statusColor}`}>
                      {invoice.status}
                    </span>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" className="border-slate-300 bg-transparent">
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    <Button variant="outline" size="sm" className="border-slate-300 bg-transparent">
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Revenue Chart Placeholder */}
      <Card className="shadow-lg border-0">
        <CardHeader>
          <CardTitle className="text-slate-800 flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-emerald-600" />
            Revenue Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-slate-50 rounded-xl flex items-center justify-center">
            <p className="text-slate-500">Revenue charts and analytics will be displayed here</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
