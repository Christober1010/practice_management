"use client";

import { mahaverseFetch } from "@/lib/mahaverse-api";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, CalendarClock, Plus, Edit, Archive, ArchiveRestore } from "lucide-react";
import toast from "react-hot-toast";
import AddMaintenancePeriodModal from "./add-maintenance-period-modal";

export default function MaintenancePeriodsList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadPeriods = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        showArchived: showArchived.toString(),
        showInactive: "true",
      });
      const res = await mahaverseFetch(`/maintenance-periods.php?${params}`);
      const data = await res.json();
      if (data?.success) {
        setPeriods(Array.isArray(data.data) ? data.data : []);
      } else {
        toast.error(data?.message || "Failed to load maintenance periods");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load maintenance periods");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPeriods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  const displayed = useMemo(() => {
    return periods
      .filter((p) => {
        const q = searchTerm.trim().toLowerCase();
        const matchesSearch = !q || String(p.name || "").toLowerCase().includes(q);
        const isActive = !(p.active === 0 || p.active === "0");
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "Active" && isActive) ||
          (statusFilter === "Inactive" && !isActive);
        return matchesSearch && matchesStatus;
      })
      .sort(
        (a, b) =>
          Number(a.sort_order || 0) - Number(b.sort_order || 0) ||
          String(a.name || "").localeCompare(String(b.name || ""))
      );
  }, [periods, searchTerm, statusFilter]);

  const handleSave = async (payload) => {
    setSaving(true);
    try {
      const isEdit = !!payload.id;
      const res = await mahaverseFetch("/maintenance-periods.php", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data?.success) {
        throw new Error(data?.message || "Save failed");
      }
      toast.success(isEdit ? "Updated" : "Created");
      setIsModalOpen(false);
      setEditingPeriod(null);
      await loadPeriods();
    } catch (err) {
      toast.error(err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const toggleArchive = async (period) => {
    const archived = !(period.archived === 1 || period.archived === "1");
    try {
      const res = await mahaverseFetch("/maintenance-periods.php", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: period.id,
          name: period.name,
          sort_order: period.sort_order,
          active: !(period.active === 0 || period.active === "0"),
          archived,
        }),
      });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.message || "Update failed");
      toast.success(archived ? "Archived" : "Restored");
      await loadPeriods();
    } catch (err) {
      toast.error(err?.message || "Failed to update");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Maintenance Period</h2>
          <p className="text-sm text-slate-600 mt-1">
            Frequencies used for target maintenance levels
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingPeriod(null);
            setIsModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add period
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Search…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant={showArchived ? "default" : "outline"}
              onClick={() => setShowArchived((v) => !v)}
            >
              {showArchived ? "Hide archived" : "Show archived"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2">
              <CalendarClock className="h-5 w-5" />
              Maintenance periods
            </span>
            <Badge variant="secondary">{displayed.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading…</div>
          ) : displayed.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No maintenance periods found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Name</TableHead>
                  <TableHead>Sort</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayed.map((p) => {
                  const isActive = !(p.active === 0 || p.active === "0");
                  const isArchived = p.archived === 1 || p.archived === "1";
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.sort_order}</TableCell>
                      <TableCell>
                        <Badge variant={isActive ? "default" : "secondary"}>
                          {isArchived ? "Archived" : isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingPeriod(p);
                              setIsModalOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleArchive(p)}
                          >
                            {isArchived ? (
                              <ArchiveRestore className="h-4 w-4" />
                            ) : (
                              <Archive className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddMaintenancePeriodModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingPeriod(null);
        }}
        onSave={handleSave}
        loading={saving}
        editingPeriod={editingPeriod}
      />
    </div>
  );
}
