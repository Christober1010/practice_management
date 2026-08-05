"use client";

import { useCallback, useEffect, useState } from "react";
import { mahaverseFetch } from "@/lib/mahaverse-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Heart, Clock, FileText, Users } from "lucide-react";
import MetricCard from "@/components/ui/metric-card";

function emptyStats() {
  return {
    myClients: 0,
    sessionsThisWeek: 0,
    completedThisWeek: 0,
    upcomingSessions: 0,
    todaySessions: [],
    pendingApprovals: [],
    activities: [],
    scope: "self",
  };
}

export default function ParentDashboard() {
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
        sessionsThisWeek: Number(d.sessionsThisWeek ?? 0),
        completedThisWeek: Number(d.completedThisWeek ?? 0),
        upcomingSessions: Number(d.upcomingSessions ?? 0),
        todaySessions: Array.isArray(d.todaySessions) ? d.todaySessions : [],
        pendingApprovals: Array.isArray(d.pendingApprovals) ? d.pendingApprovals : [],
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
      title: "This Week's Sessions",
      value: loading ? "…" : String(stats.sessionsThisWeek),
      change:
        stats.completedThisWeek > 0
          ? `${stats.completedThisWeek} completed`
          : stats.upcomingSessions > 0
            ? `${stats.upcomingSessions} still scheduled`
            : "None this week",
      changeType: "positive",
      icon: Calendar,
      color: "bg-teal-500",
    },
    {
      title: "My Children",
      value: loading ? "…" : String(stats.myClients),
      change: "Linked clients",
      changeType: "neutral",
      icon: Users,
      color: "bg-blue-500",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-teal-50 to-blue-50 rounded-2xl p-6">
        <div className="flex items-center space-x-3">
          <div className="bg-teal-600 p-3 rounded-xl">
            <Heart className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-slate-800">Welcome Back!</h2>
            <p className="text-slate-600 mt-1">
              Your child&apos;s schedule and recent sessions
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {metrics.map((metric, index) => (
          <MetricCard key={index} {...metric} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-slate-800 flex items-center">
              <Calendar className="h-5 w-5 mr-2 text-teal-600" />
              Today&apos;s Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-slate-500 animate-pulse">Loading…</p>
            ) : stats.todaySessions.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">
                No sessions scheduled today.
              </p>
            ) : (
              <div className="space-y-4">
                {stats.todaySessions.map((session) => (
                  <div
                    key={session.session_id || `${session.client}-${session.time}`}
                    className="bg-slate-50 rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{session.client}</p>
                        <p className="text-sm text-slate-600 flex items-center mt-1">
                          <Clock className="h-4 w-4 mr-1 shrink-0" />
                          {session.time}
                        </p>
                        {session.provider_name ? (
                          <p className="text-xs text-slate-500 mt-1">
                            with {session.provider_name}
                            {session.location ? ` · ${session.location}` : ""}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 ${
                          session.statusColor || "bg-teal-100 text-teal-800"
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
            <CardTitle className="text-slate-800 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-blue-600" />
              Recent Sessions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <p className="text-sm text-slate-500 animate-pulse">Loading…</p>
            ) : stats.activities.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">No recent session activity.</p>
            ) : (
              stats.activities.slice(0, 6).map((activity, index) => (
                <div key={index} className="bg-slate-50 rounded-xl p-4">
                  <p className="text-sm font-medium text-slate-800">{activity.title}</p>
                  <p className="text-xs text-slate-600 mt-1">{activity.description}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
