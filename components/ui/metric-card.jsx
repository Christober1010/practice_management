"use client"

import { Card, CardContent } from "@/components/ui/card"

export default function MetricCard({ title, value, change, changeType, icon: Icon, color }) {
  const getChangeColor = () => {
    switch (changeType) {
      case "positive":
        return "text-emerald-600"
      case "negative":
        return "text-red-600"
      case "warning":
        return "text-amber-600"
      default:
        return "text-slate-500"
    }
  }

  const getChangeIcon = () => {
    switch (changeType) {
      case "positive":
        return "↗"
      case "negative":
        return "↘"
      case "warning":
        return "⚠"
      default:
        return ""
    }
  }

  return (
    <Card className="shadow-lg border-0 hover:shadow-xl transition-shadow duration-200">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-600 mb-1">{title}</p>
            <p className="text-3xl font-bold text-slate-800 mb-2">{value}</p>
            <p className={`text-sm font-medium ${getChangeColor()}`}>
              {getChangeIcon()} {change}
            </p>
          </div>
          <div className={`${color} p-4 rounded-xl shadow-md`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
