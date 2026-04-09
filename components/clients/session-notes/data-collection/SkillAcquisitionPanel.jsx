"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Table as TableIcon } from "lucide-react";
import toast from "react-hot-toast";

export default function SkillAcquisitionPanel({
  client,
  clientDomains,
  clientPrograms,
  clientTargets,
  sessionNotes,
  setSessionNotes,
}) {
  const [selectedSkillAreaId, setSelectedSkillAreaId] = useState("all");
  const [showSkillArchived, setShowSkillArchived] = useState(false);
  const [selectedProgramForTargets, setSelectedProgramForTargets] = useState(null);

  const programs = useMemo(() => {
    return (clientPrograms || [])
      .map((p) => ({
        id: p.id,
        name: p.name || p.NAME || "Unnamed Program",
        domain_id: p.domain_id || p.domainId || p.domainID || p.domain_id,
        archived: Boolean(p.archived === 1 || p.archived === true),
        status: p.status || p.STATUS || "Active",
        raw: p,
      }))
      .filter((p) => (showSkillArchived ? p.archived : !p.archived))
      .filter((p) =>
        selectedSkillAreaId === "all" ? true : String(p.domain_id) === String(selectedSkillAreaId)
      );
  }, [clientPrograms, showSkillArchived, selectedSkillAreaId]);

  const targets = Array.isArray(clientTargets) ? clientTargets : [];
  const isMastered = (status) => String(status || "").toLowerCase().includes("mastered");
  const isClosed = (status) => String(status || "").toLowerCase().includes("closed");

  return (
    <>
      {/* Data Entry Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TableIcon className="h-5 w-5 text-green-600" />
            SKILL ACQUISITION (Data Entry)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-slate-600">
            Enter today’s summary/value per target (e.g., %, count, notes). This does not currently
            save to the backend yet.
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Program</TableHead>
                <TableHead>Target</TableHead>
                <TableHead className="w-56">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(sessionNotes.skillAcquisitionData || []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-slate-500">
                    No skill acquisition rows found.
                  </TableCell>
                </TableRow>
              ) : (
                (sessionNotes.skillAcquisitionData || []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.programName || "-"}</TableCell>
                    <TableCell>{row.targetName || "-"}</TableCell>
                    <TableCell>
                      <Input
                        value={row.value || ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setSessionNotes((prev) => ({
                            ...prev,
                            skillAcquisitionData: (prev.skillAcquisitionData || []).map((r) =>
                              r.id === row.id ? { ...r, value: v } : r
                            ),
                          }));
                        }}
                        placeholder="e.g. 80%, 12, prompt level..."
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Library-style Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TableIcon className="h-5 w-5 text-green-600" />
              SKILL ACQUISITION (Summary)
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowSkillArchived((v) => !v)}>
              {showSkillArchived ? "Show Active" : "Show Archived"}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {clientDomains?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedSkillAreaId("all");
                  setSelectedProgramForTargets(null);
                }}
                className={
                  selectedSkillAreaId === "all"
                    ? "bg-teal-600 text-white border-teal-600 hover:bg-teal-700 hover:text-white"
                    : "bg-white"
                }
              >
                All Skill Areas
              </Button>
              {clientDomains.map((d) => {
                const id = String(d.id);
                const label = d.name || d.NAME || "Skill Area";
                return (
                  <Button
                    key={id}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedSkillAreaId(id);
                      setSelectedProgramForTargets(null);
                    }}
                    className={
                      selectedSkillAreaId === id
                        ? "bg-teal-600 text-white border-teal-600 hover:bg-teal-700 hover:text-white"
                        : "bg-white"
                    }
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
          )}

          {programs.length === 0 ? (
            <div className="text-center text-slate-500 py-6">
              No programs found for this skill area.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Program Name</TableHead>
                  <TableHead className="text-center">Total Targets</TableHead>
                  <TableHead className="text-center">Open Targets</TableHead>
                  <TableHead className="text-center">Mastered Targets</TableHead>
                  <TableHead className="text-center">% Mastered</TableHead>
                  <TableHead className="hidden lg:table-cell text-center">Avg Calendar Days to Mastery</TableHead>
                  <TableHead className="hidden lg:table-cell text-center">Avg Teaching Days to Mastery</TableHead>
                  <TableHead className="hidden lg:table-cell text-center">Avg Trials to Mastery</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {programs.map((p) => {
                  const programTargets = targets.filter((t) => String(t.program_id) === String(p.id));
                  const totalTargets = programTargets.length;
                  const masteredTargets = programTargets.filter((t) => isMastered(t.status || t.STATUS)).length;
                  const openTargets = programTargets.filter(
                    (t) => !isMastered(t.status || t.STATUS) && !isClosed(t.status || t.STATUS)
                  ).length;
                  const pct = totalTargets ? Math.round((masteredTargets / totalTargets) * 100) : 0;
                  return (
                    <TableRow key={String(p.id)} className="hover:bg-slate-50">
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-center">{totalTargets}</TableCell>
                      <TableCell className="text-center">{openTargets}</TableCell>
                      <TableCell className="text-center">{masteredTargets}</TableCell>
                      <TableCell className="text-center">{pct}%</TableCell>
                      <TableCell className="hidden lg:table-cell text-center">N/A</TableCell>
                      <TableCell className="hidden lg:table-cell text-center">N/A</TableCell>
                      <TableCell className="hidden lg:table-cell text-center">N/A</TableCell>
                      <TableCell className="text-right">
                        <Button type="button" variant="outline" size="sm" onClick={() => setSelectedProgramForTargets(p)}>
                          Targets
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {selectedProgramForTargets && (
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <div className="text-slate-700">{selectedProgramForTargets.name} • Targets</div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="bg-teal-600 hover:bg-teal-700 text-white border-teal-600"
                      onClick={() => toast("Create New Target: use Clients → Data Collection → Targets")}
                    >
                      Create New Target
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setSelectedProgramForTargets(null)}>
                      Back
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Target</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Baseline</TableHead>
                      <TableHead>Date Opened</TableHead>
                      <TableHead>Date Mastered</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Open Order</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(clientTargets || [])
                      .filter((t) => String(t.program_id) === String(selectedProgramForTargets.id))
                      .map((t) => (
                        <TableRow key={String(t.id)} className="hover:bg-slate-50">
                          <TableCell className="text-slate-800">{t.name || t.NAME || "Unnamed Target"}</TableCell>
                          <TableCell>{t.status || t.STATUS || "N/A"}</TableCell>
                          <TableCell>{t.baseline ?? "N/A"}</TableCell>
                          <TableCell>{t.date_opened || "N/A"}</TableCell>
                          <TableCell>{t.date_mastered || "N/A"}</TableCell>
                          <TableCell>{t.activity_type || t.type || "N/A"}</TableCell>
                          <TableCell>{t.open_order || "N/A"}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </>
  );
}


