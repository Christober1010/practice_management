"use client";

import { useCallback, useEffect, useState } from "react";
import { mahaverseFetch } from "@/lib/mahaverse-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Calendar, Clock, AlertTriangle } from "lucide-react";
import MetricCard from "@/components/ui/metric-card";

function emptyStats() {
  return {
    myClients: 0,
    pendingNotes: 0,
    renderedHoursMonth: 0,
    supervisionGoalHours: 20,
    supervisionGoalPercent: 0,
    sessionsToday: 0,
    pendingSessions: 0,
    todaySessions: [],
    pendingApprovals: [],
    scope: "self",
  };
}

export default function BCBADashboard() {
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
        pendingNotes: Number(d.pendingNotes ?? 0),
        renderedHoursMonth: Number(d.renderedHoursMonth ?? 0),
        supervisionGoalHours: Number(d.supervisionGoalHours ?? 20),
        supervisionGoalPercent: Number(d.supervisionGoalPercent ?? 0),
        sessionsToday: Number(d.sessionsToday ?? 0),
        pendingSessions: Number(d.pendingSessions ?? 0),
        todaySessions: Array.isArray(d.todaySessions) ? d.todaySessions : [],
        pendingApprovals: Array.isArray(d.pendingApprovals) ? d.pendingApprovals : [],
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
      title: "My Clients",
      value: loading ? "…" : String(stats.myClients),
      change: stats.scope === "all" ? "Active cases (org)" : "Assigned to you",
      changeType: "neutral",
      icon: Users,
      color: "bg-teal-500",
    },
    {
      title: "Pending Notes",
      value: loading ? "…" : String(stats.pendingNotes),
      change: stats.pendingNotes > 0 ? "Rendered, no note yet" : "All caught up",
      changeType: stats.pendingNotes > 0 ? "warning" : "positive",
      icon: FileText,
      color: "bg-amber-500",
    },
    {
      title: "Rendered Hours",
      value: loading ? "…" : String(stats.renderedHoursMonth),
      change: "This month",
      changeType: "positive",
      icon: Clock,
      color: "bg-blue-500",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-slate-800">BCBA Dashboard</h2>
        <p className="text-slate-600 mt-1">
          Assigned clients; hours and today&apos;s sessions are yours as provider
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
              {!loading ? (
                <span className="ml-2 text-sm font-normal text-slate-500">
                  ({stats.sessionsToday})
                </span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-slate-500 animate-pulse">Loading…</p>
            ) : stats.todaySessions.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">
                No sessions scheduled for you today.
              </p>
            ) : (
              <div className="space-y-4">
                {stats.todaySessions.map((session) => (
                  <div
                    key={session.session_id || `${session.client}-${session.time}`}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-xl gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{session.client}</p>
                      <p className="text-sm text-slate-600">{session.time}</p>
                      {session.provider_name ? (
                        <p className="text-xs text-slate-500 mt-0.5">{session.provider_name}</p>
                      ) : null}
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 ${
                        session.statusColor || "bg-slate-100 text-slate-800"
                      }`}
                    >
                      {session.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-slate-800 flex items-center">
              <Clock className="h-5 w-5 mr-2 text-blue-600" />
              Monthly rendered hours
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-600">Progress vs {stats.supervisionGoalHours}h goal</span>
                <span className="font-medium text-slate-800">
                  {loading ? "…" : `${stats.renderedHoursMonth} / ${stats.supervisionGoalHours} hours`}
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${loading ? 0 : stats.supervisionGoalPercent}%` }}
                />
              </div>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
              {stats.pendingSessions > 0
                ? `${stats.pendingSessions} session${stats.pendingSessions === 1 ? "" : "s"} still scheduled today.`
                : "No remaining scheduled sessions for today."}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg border-0">
        <CardHeader className="pb-4">
          <CardTitle className="text-slate-800 flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2 text-amber-600" />
            Rendered sessions missing notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500 animate-pulse">Loading…</p>
          ) : stats.pendingApprovals.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              No recent rendered sessions without notes.
            </p>
          ) : (
            <div className="space-y-3">
              {stats.pendingApprovals.map((item) => (
                <div
                  key={item.session_id || `${item.client}-${item.date}`}
                  className="flex items-center justify-between p-4 border border-slate-200 rounded-xl gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">
                      {item.client} — {item.type || "Session Note"}
                    </p>
                    <p className="text-sm text-slate-600">
                      {item.provider_name ? `${item.provider_name} · ` : ""}
                      {item.date}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
