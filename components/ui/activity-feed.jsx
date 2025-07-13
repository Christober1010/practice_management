"use client"

export default function ActivityFeed({ activities }) {
  return (
    <div className="space-y-4">
      {activities.map((activity, index) => {
        const Icon = activity.icon
        return (
          <div key={index} className="flex items-center space-x-4">
            <div className={`p-3 rounded-xl ${activity.color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-800">{activity.title}</p>
              <p className="text-xs text-slate-500">{activity.description}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
