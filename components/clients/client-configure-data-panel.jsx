"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronDown,
  ChevronRight,
  Layers,
  ListChecks,
  Target,
  Plus,
} from "lucide-react";
import toast from "react-hot-toast";
import ClientDomainModal from "./add-client-domain";
import { ProgramsListModal } from "./add-client-program";
import { TargetsListModal } from "./add-client-target";

export default function ClientConfigureDataPanel({ clientId, clientName }) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
  const [subTab, setSubTab] = useState("skill");

  const [domainsOpen, setDomainsOpen] = useState(false);
  const [programsOpen, setProgramsOpen] = useState(false);
  const [targetsOpen, setTargetsOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [clientDomains, setClientDomains] = useState([]);
  const [clientModules, setClientModules] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [targets, setTargets] = useState([]);
  const [expandedDomainIds, setExpandedDomainIds] = useState(() => new Set());
  const [expandedProgramIds, setExpandedProgramIds] = useState(() => new Set());

  const loadClientPrograms = useCallback(async () => {
    if (!baseUrl || !clientId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${baseUrl}/client-modules.php?client_id=${encodeURIComponent(clientId)}`,
      );
      const result = await res.json();

      if (result.success && result.data) {
        const domains = result.data.domains || [];
        const modules = result.data.modules || [];
        const rawPrograms = result.data.programs || [];
        const rawTargets = result.data.activities || [];

        setClientDomains(
          domains.map((d) => ({
            id: d.id,
            name: d.NAME || d.name || "Unnamed Domain",
            description: d.description || "",
          })),
        );
        setClientModules(
          modules.map((m) => ({
            id: m.id,
            name: m.NAME || m.name || "Unnamed Module",
            description: m.description || "",
          })),
        );
        setPrograms(
          rawPrograms.map((p) => ({
            id: p.id,
            name: p.NAME || p.name || "Unnamed Program",
            description: p.description || "",
            domain_id: p.domain_id,
            status: p.status || "Active",
          })),
        );
        setTargets(
          rawTargets.map((t) => ({
            id: t.id,
            name: t.name || t.NAME || "Unnamed Target",
            description: t.description || "",
            program_id: t.program_id,
            activity_type: t.activity_type || "",
            status: t.status || "Active",
          })),
        );
      } else {
        toast.error(result.message || "Failed to load programs/targets");
        setClientDomains([]);
        setClientModules([]);
        setPrograms([]);
        setTargets([]);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load programs/targets");
    } finally {
      setLoading(false);
    }
  }, [baseUrl, clientId]);

  useEffect(() => {
    loadClientPrograms();
  }, [loadClientPrograms]);

  const handleAddProgram = async (payload) => {
    const res = await fetch(`${baseUrl}/client-programs.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.success) {
      const saved = data.program || payload.programs[0];
      setPrograms((prev) => [...prev, saved]);
      toast.success("Program added");
    } else {
      toast.error(data.message || "Failed to add program");
    }
  };

  const handleEditProgram = async (payload) => {
    const res = await fetch(`${baseUrl}/client-programs.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", ...payload }),
    });
    const data = await res.json();
    if (data.success) {
      const saved = data.program || payload.programs[0];
      setPrograms((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      toast.success("Program updated");
    } else {
      toast.error(data.message || "Failed to update program");
    }
  };

  const handleAddTarget = async (payload) => {
    const res = await fetch(`${baseUrl}/client-target.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.success) {
      const saved = data.target || (payload.targets ? payload.targets[0] : payload);
      setTargets((prev) => [...prev, saved]);
      toast.success("Target added");
      return true;
    }
    toast.error(data.message || "Failed to add target");
    return false;
  };

  const handleEditTarget = async (payload) => {
    const res = await fetch(`${baseUrl}/client-target.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", ...payload }),
    });
    const data = await res.json();
    if (data.success) {
      const saved = data.target || (payload.targets ? payload.targets[0] : payload);
      setTargets((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
      toast.success("Target updated");
      return true;
    }
    toast.error(data.message || "Failed to update target");
    return false;
  };

  const toggleDomain = (id) => {
    setExpandedDomainIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleProgram = (id) => {
    setExpandedProgramIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!clientId) {
    return (
      <Card className="border-amber-200 bg-amber-50/40">
        <CardContent className="py-8 text-center text-slate-600 text-sm">
          Save the client first, then open <strong>Edit Client</strong> to configure Skill Acquisition
          and Behavior Reduction data for this profile.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="skill">Skill Acquisition</TabsTrigger>
          <TabsTrigger value="behavior">Behavior Reduction</TabsTrigger>
        </TabsList>

        <TabsContent value="skill" className="space-y-4 mt-4">
          <p className="text-sm text-slate-600">
            Structure: <strong>Domain</strong> → <strong>Program</strong> → <strong>Target</strong>.
            Use the buttons to add or edit items; the outline below shows how they link together.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="bg-white"
              onClick={() => setDomainsOpen(true)}
            >
              <Layers className="h-4 w-4 mr-2 text-indigo-600" />
              Domains
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="bg-white"
              onClick={() => setProgramsOpen(true)}
            >
              <ListChecks className="h-4 w-4 mr-2 text-teal-600" />
              Programs
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="bg-white"
              onClick={() => setTargetsOpen(true)}
            >
              <Target className="h-4 w-4 mr-2 text-orange-600" />
              Targets
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => loadClientPrograms()}
              disabled={loading}
            >
              Refresh
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Hierarchy</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {loading ? (
                <p className="text-slate-500 py-6 text-center">Loading…</p>
              ) : clientDomains.length === 0 ? (
                <div className="text-center py-8 text-slate-500 space-y-2">
                  <p>No domains yet.</p>
                  <Button type="button" size="sm" onClick={() => setDomainsOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Add domain
                  </Button>
                </div>
              ) : (
                <ul className="space-y-1">
                  {clientDomains.map((domain) => {
                    const domainPrograms = programs.filter(
                      (p) => String(p.domain_id) === String(domain.id),
                    );
                    const expanded = expandedDomainIds.has(domain.id);
                    return (
                      <li key={domain.id} className="border rounded-lg bg-slate-50/80">
                        <button
                          type="button"
                          className="w-full flex items-center gap-2 px-3 py-2 text-left font-medium text-slate-800 hover:bg-slate-100 rounded-t-lg"
                          onClick={() => toggleDomain(domain.id)}
                        >
                          {expanded ? (
                            <ChevronDown className="h-4 w-4 shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0" />
                          )}
                          <Layers className="h-4 w-4 text-indigo-600 shrink-0" />
                          <span className="flex-1">{domain.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {domainPrograms.length} program(s)
                          </Badge>
                        </button>
                        {expanded && (
                          <div className="px-3 pb-3 pl-10 space-y-2 border-t border-slate-200 bg-white">
                            {domainPrograms.length === 0 ? (
                              <p className="text-xs text-slate-500 py-2">
                                No programs in this domain. Open <strong>Programs</strong> to add one
                                and assign this domain.
                              </p>
                            ) : (
                              domainPrograms.map((program) => {
                                const progTargets = targets.filter(
                                  (t) => String(t.program_id) === String(program.id),
                                );
                                const progExpanded = expandedProgramIds.has(program.id);
                                return (
                                  <div
                                    key={program.id}
                                    className="border border-slate-200 rounded-md bg-slate-50/50"
                                  >
                                    <button
                                      type="button"
                                      className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm"
                                      onClick={() => toggleProgram(program.id)}
                                    >
                                      {progExpanded ? (
                                        <ChevronDown className="h-3.5 w-3.5" />
                                      ) : (
                                        <ChevronRight className="h-3.5 w-3.5" />
                                      )}
                                      <ListChecks className="h-3.5 w-3.5 text-teal-600" />
                                      <span className="font-medium text-slate-800">{program.name}</span>
                                      <Badge variant="outline" className="text-[10px] ml-auto">
                                        {progTargets.length} target(s)
                                      </Badge>
                                    </button>
                                    {progExpanded && (
                                      <ul className="pl-8 pr-2 pb-2 space-y-1">
                                        {progTargets.length === 0 ? (
                                          <li className="text-xs text-slate-500">
                                            No targets. Use <strong>Targets</strong> to add one for this
                                            program.
                                          </li>
                                        ) : (
                                          progTargets.map((t) => (
                                            <li
                                              key={t.id}
                                              className="flex items-center gap-2 text-xs text-slate-700"
                                            >
                                              <Target className="h-3 w-3 text-orange-600" />
                                              {t.name}
                                            </li>
                                          ))
                                        )}
                                      </ul>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="behavior" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Behavior Reduction</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-600 space-y-2">
              <p>
                Behavior definitions for session data collection can be wired here in a follow-up once
                a dedicated client-level behavior API is available.
              </p>
              <p className="text-slate-500">
                For now, enter behavior counts during <strong>Session Notes</strong> using the
                Behavior Reduction panel for the active session.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ClientDomainModal
        isOpen={domainsOpen}
        onClose={() => {
          setDomainsOpen(false);
          loadClientPrograms();
        }}
        clientId={clientId}
        clientName={clientName}
      />
      <ProgramsListModal
        isOpen={programsOpen}
        onClose={() => setProgramsOpen(false)}
        clientId={clientId}
        clientName={clientName}
        programs={programs}
        domains={clientDomains}
        modules={clientModules}
        loading={loading}
        onReload={loadClientPrograms}
        onAddProgram={handleAddProgram}
        onEditProgram={handleEditProgram}
      />
      <TargetsListModal
        isOpen={targetsOpen}
        onClose={() => setTargetsOpen(false)}
        clientId={clientId}
        clientName={clientName}
        targets={targets}
        programs={programs}
        domains={clientDomains}
        modules={clientModules}
        loading={loading}
        onReload={loadClientPrograms}
        onAddTarget={handleAddTarget}
        onEditTarget={handleEditTarget}
      />
    </div>
  );
}
