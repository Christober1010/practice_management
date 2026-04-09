"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Table as TableIcon } from "lucide-react";

export default function BehaviorReductionPanel({ sessionNotes, setSessionNotes }) {
  const behaviors = Array.isArray(sessionNotes.behaviorReductionData)
    ? sessionNotes.behaviorReductionData
    : [];

  const activeBehaviors = behaviors.filter((b) => !b.archived);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TableIcon className="h-5 w-5 text-red-600" />
            BEHAVIOR REDUCTION (Data Entry Only)
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              alert(
                "Behaviors are managed elsewhere.\n\nThis screen is for entering today's data only."
              )
            }
          >
            Manage Behaviors
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-slate-600">
          <Label className="text-slate-500 text-xs">Note</Label>
          <div>
            This section is limited to entering today’s data for existing behaviors. Adding/editing
            behavior definitions is disabled here.
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Behavior Name</TableHead>
              <TableHead className="hidden md:table-cell">Recording Type</TableHead>
              <TableHead className="hidden lg:table-cell">Category</TableHead>
              <TableHead className="text-center">Data Today</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeBehaviors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-slate-500">
                  No active behaviors found for data entry.
                </TableCell>
              </TableRow>
            ) : (
              activeBehaviors.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.behaviorName || "-"}</TableCell>
                  <TableCell className="hidden md:table-cell">{b.recordingType || "-"}</TableCell>
                  <TableCell className="hidden lg:table-cell">{b.behaviorCategory || "-"}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      <Input
                        type="number"
                        inputMode="numeric"
                        className="w-28 text-center"
                        value={Number(b.dataToday || 0)}
                        onChange={(e) => {
                          const nextVal = Number(e.target.value || 0);
                          setSessionNotes((prev) => ({
                            ...prev,
                            behaviorReductionData: (prev.behaviorReductionData || []).map((row) =>
                              row.id === b.id ? { ...row, dataToday: nextVal } : row
                            ),
                          }));
                        }}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}


