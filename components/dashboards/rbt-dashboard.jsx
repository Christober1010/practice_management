"use client";

import { useCallback, useEffect, useState } from "react";
import { mahaverseFetch } from "@/lib/mahaverse-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, FileText, Clock, MapPin } from "lucide-react";
import MetricCard from "@/components/ui/metric-card";

function emptyStats() {
  return {
    myClients: 0,
    sessionsToday: 0,
    completedToday: 0,
    pendingNotes: 0,
    todaySessions: [],
    activities: [],
    scope: "self",
  };
}

export default function RBTDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(emptyStats);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await mahaverseFetch("/dashboard-stats.php");
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Failed to load dashboard");
      const d = json.data || {};
      setStats({
        myClients: Number(d.myClients ?? d.activeClients ?? 0),
        sessionsToday: Number(d.sessionsToday ?? 0),
        completedToday: Number(d.completedToday ?? 0),
        pendingNotes: Number(d.pendingNotes ?? 0),
        todaySessions: Array.isArray(d.todaySessions) ? d.todaySessions : [],
        activities: Array.isArray(d.activities) ? d.activities : [],
        scope: d.scope || "self",
      });
    } catch (err) {
      console.error(err);
      setStats(emptyStats());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  const metrics = [
    {
      title: "Today's Sessions",
      value: loading ? "…" : String(stats.sessionsToday),
      change:
        stats.completedToday > 0
          ? `${stats.completedToday} rendered`
          : stats.sessionsToday === 0
            ? "None scheduled"
            : "On your calendar",
      changeType: "positive",
      icon: Calendar,
      color: "bg-teal-500",
    },
    {
      title: "Assigned Clients",
      value: loading ? "…" : String(stats.myClients),
      change: stats.scope === "all" ? "Active cases (org)" : "Assigned to you",
      changeType: "neutral",
      icon: Users,
      color: "bg-blue-500",
    },
    {
      title: "Pending Notes",
      value: loading ? "…" : String(stats.pendingNotes),
      change: stats.pendingNotes > 0 ? "Rendered, no note yet" : "All caught up",
      changeType: stats.pendingNotes > 0 ? "warning" : "positive",
      icon: FileText,
      color: "bg-amber-500",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-slate-800">RBT Dashboard</h2>
        <p className="text-slate-600 mt-1">
          Your daily schedule and client assignments
          {stats.scope === "self" ? " (scoped to you)" : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {metrics.map((metric, index) => (
          <MetricCard key={index} {...metric} />
        ))}
      </div>

      <Card className="shadow-lg border-0">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-slate-800 flex items-center">
              <Clock className="h-5 w-5 mr-2 text-teal-600" />
              Today&apos;s Schedule
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
          {loading ? (
            <p className="text-sm text-slate-500 animate-pulse">Loading…</p>
          ) : stats.todaySessions.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              No sessions on your schedule today.
            </p>
          ) : (
            <div className="space-y-4">
              {stats.todaySessions.map((session) => (
                <div
                  key={session.session_id || `${session.client}-${session.time}`}
                  className="border border-slate-200 rounded-xl p-5"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center space-x-4 min-w-0">
                      <div className="bg-teal-100 p-3 rounded-xl shrink-0">
                        <Users className="h-5 w-5 text-teal-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{session.client}</p>
                        <p className="text-sm text-slate-600 flex items-center mt-1">
                          <Clock className="h-4 w-4 mr-1 shrink-0" />
                          {session.time}
                        </p>
                        {(session.location || session.address) && (
                          <p className="text-xs text-slate-500 flex items-center mt-1">
                            <MapPin className="h-3 w-3 mr-1 shrink-0" />
                            {[session.location, session.address].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 ${
                        session.statusColor || "bg-slate-100 text-slate-800"
                      }`}
                    >
                      {session.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg border-0">
        <CardHeader className="pb-4">
          <CardTitle className="text-slate-800">Recent Updates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-slate-500 animate-pulse">Loading…</p>
          ) : stats.activities.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">No recent session activity.</p>
          ) : (
            stats.activities.slice(0, 5).map((activity, index) => (
              <div key={index} className="bg-slate-50 rounded-xl p-4">
                <p className="text-sm font-medium text-slate-800">{activity.title}</p>
                <p className="text-xs text-slate-600 mt-1">{activity.description}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
