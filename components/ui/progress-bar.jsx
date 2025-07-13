"use client"

export default function ProgressBar({ progress, color, height = "h-3" }) {
  return (
    <div className={`w-full bg-slate-200 rounded-full ${height}`}>
      <div
        className={`${color} ${height} rounded-full transition-all duration-500 ease-out`}
        style={{ width: `${Math.min(progress, 100)}%` }}
      ></div>
    </div>
  )
}
