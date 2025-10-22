"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BookOpen,
  Layers,
  Target,
  Zap,
  Plus,
  Search,
  Edit,
  Archive,
  ArchiveRestore,
  Eye,
  EyeOff,
  MoreVertical,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import {
  addProgramStructure,
  updateProgramStructure,
  toggleArchiveProgram,
  fetchPrograms,
} from "../../app/store/programSlice";
import ABAProgramModal from './ABAProgramModal'

function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function ProgramsView() {
  // UI-only state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState(null);
  const [expandedProgram, setExpandedProgram] = useState(null);

  // Redux
  const dispatch = useAppDispatch();
  const programsData = useAppSelector((state) => state.programs.items); // { modules, domains, programs, activities }
  const loading = useAppSelector((state) => state.programs.loading);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  // Compute counts
  const activeProgramCount = useMemo(
    () => programsData?.modules?.filter((m) => !m.archived).length || 0,
    [programsData]
  );
  const archivedProgramCount = useMemo(
    () => programsData?.modules?.filter((m) => m.archived).length || 0,
    [programsData]
  );

  // Filter modules based on search, status, and archive state
  const filteredModules = useMemo(() => {
    if (!programsData?.modules) return [];
    return programsData.modules.filter((module) => {
      const matchesSearch = [
        module.name,
        module.description,
        ...programsData.domains
          .filter((d) => d.moduleId === module.id)
          .flatMap((d) => [d.name, d.description]),
        ...programsData.programs
          .filter((p) =>
            programsData.domains.some(
              (d) => d.id === p.domainId && d.moduleId === module.id
            )
          )
          .flatMap((p) => [p.name, p.description]),
        ...programsData.activities
          .filter((a) =>
            programsData.programs.some((p) =>
              programsData.domains.some(
                (d) =>
                  d.id === p.domainId &&
                  d.moduleId === module.id &&
                  p.id === a.programId
              )
            )
          )
          .flatMap((a) => [
            a.name,
            a.goalDescription,
            a.instructions,
            a.activityType,
          ]),
      ].some(
        (value) =>
          value && value.toLowerCase().includes(searchTerm.toLowerCase())
      );
      const matchesStatus =
        statusFilter === "all" || module.status === statusFilter;
      const matchesArchived = module.archived === showArchived;
      return matchesSearch && matchesStatus && matchesArchived;
    });
  }, [programsData, searchTerm, statusFilter, showArchived]);

  // Handlers
  const handleAddProgram = async (programData) => {
    const newProgramData = {
      ...programData,
      modules: programData.modules.map((m) => ({
        ...m,
        id: generateUUID(),
        archived: false,
      })),
      domains: programData.domains.map((d) => ({
        ...d,
        id: generateUUID(),
        archived: false,
      })),
      programs: programData.programs.map((p) => ({
        ...p,
        id: generateUUID(),
        archived: false,
      })),
      activities: programData.activities.map((a) => ({
        ...a,
        id: generateUUID(),
        archived: false,
      })),
    };

    try {
      const res = await fetch(`${baseUrl}/programs.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProgramData),
      });
      const result = await res.json();
      if (result.success) {
        dispatch(addProgramStructure(newProgramData));
        setIsAddModalOpen(false);
        dispatch(fetchPrograms());
        toast.success("Program structure added successfully!");
      } else {
        toast.error(
          `Failed to add program: ${result.message || "Unknown error"}`
        );
      }
    } catch (err) {
      console.error("Error adding program:", err);
      toast.error("An error occurred while adding the program.");
    }
  };

  const handleEditProgram = async (programData) => {
    try {
      const res = await fetch(`${baseUrl}/programs.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(programData),
      });
      const result = await res.json();
      if (result.success) {
        dispatch(updateProgramStructure(programData));
        setEditingProgram(null);
        setIsAddModalOpen(false);
        dispatch(fetchPrograms());
        toast.success("Program structure updated successfully!");
      } else {
        toast.error(
          `Failed to update program: ${result.message || "Unknown error"}`
        );
      }
    } catch (err) {
      console.error("Error updating program:", err);
      toast.error("An error occurred while updating the program.");
    }
  };

  const handleArchiveModule = async (moduleId) => {
    const module = programsData.modules.find((m) => m.id === moduleId);
    if (!module) return;

    const updatedModule = {
      ...module,
      archived: !module.archived,
      status: !module.archived ? "Inactive" : "Active",
    };

    try {
      const res = await fetch(`${baseUrl}/programs.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId,
          archived: updatedModule.archived ? 1 : 0,
          status: updatedModule.status,
        }),
      });
      const result = await res.json();
      if (result.success) {
        dispatch(
          toggleArchiveProgram({
            moduleId,
            archived: updatedModule.archived,
            status: updatedModule.status,
          })
        );
        toast.success(
          updatedModule.archived ? "Module archived!" : "Module restored!"
        );
      } else {
        toast.error(
          `Failed to update module: ${result.message || "Unknown error"}`
        );
      }
    } catch (err) {
      console.error("Error archiving/restoring module:", err);
      toast.error("An error occurred while updating module status.");
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-800";
      case "Inactive":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const toggleExpanded = (moduleId) => {
    setExpandedProgram((prev) => (prev === moduleId ? null : moduleId));
  };

  useEffect(() => {
    dispatch(fetchPrograms());
  }, [dispatch]);

  return (
    <div className="space-y-8">
      <Toaster />
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row lg:justify-between sm:justify-center sm:items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">
            Program Management
          </h2>
          <p className="text-slate-600 mt-1">Manage ABA program structures</p>
        </div>
        <div className="flex flex-row flex-wrap gap-2 sm:items-center sm:space-x-3 sm:justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
            className="border-slate-300"
          >
            {showArchived ? (
              <>
                <ArchiveRestore className="h-4 w-4 mr-2" /> Show Active (
                {activeProgramCount})
              </>
            ) : (
              <>
                <Archive className="h-4 w-4 mr-2" /> Show Archived (
                {archivedProgramCount})
              </>
            )}
          </Button>
          <Button
            onClick={() => setIsAddModalOpen(true)}
            size="sm"
            className="bg-teal-600 hover:bg-teal-700 shadow-lg"
          >
            <Plus className="h-4 w-4 mr-2" /> Add Program Structure
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="shadow-lg border-0">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search all program fields..."
                className="pl-10 border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48 border-slate-200">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Program Table */}
      {loading ? (
        <div className="h-64 w-64 mx-auto">
          <p className="text-center animate-pulse text-gray-500">
            Fetching programs
          </p>
        </div>
      ) : (
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-slate-800 flex items-center">
              <BookOpen className="h-5 w-5 mr-2 text-teal-600" />
              {showArchived ? "Archived" : "Active"} Modules (
              {filteredModules.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 border-b">
                    <TableHead className="font-semibold text-slate-700">
                      Module
                    </TableHead>
                    <TableHead className="hidden sm:table-cell font-semibold text-slate-700">
                      Status
                    </TableHead>
                    <TableHead className="hidden sm:table-cell font-semibold text-slate-700">
                      Description
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700 lg:text-center text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredModules.map((module) => {
                    const isExpanded = expandedProgram === module.id;
                    return (
                      <Fragment key={module.id}>
                        {/* Main Row */}
                        <TableRow className="hover:bg-slate-50 transition-colors border-b">
                          <TableCell className="lg:px-4 sm:px-2 py-4">
                            <div className="flex items-center space-x-3">
                              <span className="hidden sm:inline-block">
                                <div className="bg-teal-100 p-2 rounded-lg flex-shrink-0">
                                  <BookOpen className="h-4 w-4 text-teal-600" />
                                </div>
                              </span>
                              <div>
                                <div className="font-semibold text-slate-800">
                                  {module.name}
                                </div>
                                {module.archived && (
                                  <Badge
                                    variant="outline"
                                    className="border-amber-300 text-amber-700 text-xs mt-1"
                                  >
                                    Archived
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell py-4">
                            <Badge className={getStatusColor(module.status)}>
                              {module.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell py-4">
                            <div className="text-sm text-slate-600">
                              {module.description || "N/A"}
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => toggleExpanded(module.id)}
                                className="border-slate-300"
                              >
                                {isExpanded ? (
                                  <span title="Hide">
                                    <EyeOff className="h-3 w-3 mr-1" />
                                  </span>
                                ) : (
                                  <span title="View">
                                    <Eye className="h-3 w-3 mr-1" />
                                  </span>
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingProgram({
                                    modules: [module],
                                    domains: programsData.domains.filter(
                                      (d) => d.moduleId === module.id
                                    ),
                                    programs: programsData.programs.filter(
                                      (p) =>
                                        programsData.domains.some(
                                          (d) =>
                                            d.id === p.domainId &&
                                            d.moduleId === module.id
                                        )
                                    ),
                                    activities: programsData.activities.filter(
                                      (a) =>
                                        programsData.programs.some((p) =>
                                          programsData.domains.some(
                                            (d) =>
                                              d.id === p.domainId &&
                                              d.moduleId === module.id &&
                                              p.id === a.programId
                                          )
                                        )
                                    ),
                                  });
                                  setIsAddModalOpen(true);
                                }}
                                className="border-slate-300"
                              >
                                <span title="Edit">
                                  <Edit className="h-4 w-4 mr-2" />
                                </span>
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    title="Options"
                                    variant="outline"
                                    size="sm"
                                    className="border-slate-300 bg-transparent"
                                  >
                                    <MoreVertical className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  className="w-48"
                                >
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleArchiveModule(module.id)
                                    }
                                    className={
                                      module.archived
                                        ? "text-green-600"
                                        : "text-amber-600"
                                    }
                                  >
                                    {module.archived ? (
                                      <>
                                        <ArchiveRestore className="h-4 w-4 mr-2" />{" "}
                                        Restore Module
                                      </>
                                    ) : (
                                      <>
                                        <Archive className="h-4 w-4 mr-2" />{" "}
                                        Archive Module
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Expanded Details Row */}
                        {isExpanded && (
                          <TableRow className="bg-slate-50">
                            <TableCell colSpan={4} className="px-6 py-6">
                              <div className="space-y-6">
                                {/* Module Details */}
                                <Card className="border-slate-200">
                                  <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                      <BookOpen className="h-4 w-4 text-teal-600" />{" "}
                                      Module Details
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-3 text-sm">
                                    <div>
                                      <p className="text-slate-500 mb-1">
                                        Name
                                      </p>
                                      <p className="font-medium">
                                        {module.name || "N/A"}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-slate-500 mb-1">
                                        Description
                                      </p>
                                      <p className="font-medium">
                                        {module.description || "N/A"}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-slate-500 mb-1">
                                        Status
                                      </p>
                                      <p className="font-medium">
                                        {module.status || "N/A"}
                                      </p>
                                    </div>
                                  </CardContent>
                                </Card>

                                {/* Domains */}
                                {programsData.domains.filter(
                                  (d) => d.moduleId === module.id
                                ).length > 0 && (
                                  <Card className="border-slate-200">
                                    <CardHeader className="pb-3">
                                      <CardTitle className="flex items-center gap-2 text-base">
                                        <Layers className="h-4 w-4 text-teal-600" />{" "}
                                        Domains
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="space-y-4">
                                        {programsData.domains
                                          .filter(
                                            (d) => d.moduleId === module.id
                                          )
                                          .map((domain, index) => (
                                            <div
                                              key={index}
                                              className="border rounded-lg p-4 bg-slate-50"
                                            >
                                              <div className="flex items-center justify-between mb-3">
                                                <h4 className="font-semibold">
                                                  Domain #{index + 1}:{" "}
                                                  {domain.name}
                                                </h4>
                                                <Badge
                                                  variant="outline"
                                                  className={getStatusColor(
                                                    domain.status
                                                  )}
                                                >
                                                  {domain.status}
                                                </Badge>
                                              </div>
                                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                                <div>
                                                  <p className="text-slate-500 mb-1">
                                                    Description
                                                  </p>
                                                  <p className="font-medium">
                                                    {domain.description ||
                                                      "N/A"}
                                                  </p>
                                                </div>
                                                <div>
                                                  <p className="text-slate-500 mb-1">
                                                    Status
                                                  </p>
                                                  <p className="font-medium">
                                                    {domain.status || "N/A"}
                                                  </p>
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                      </div>
                                    </CardContent>
                                  </Card>
                                )}

                                {/* Programs */}
                                {programsData.programs.filter((p) =>
                                  programsData.domains.some(
                                    (d) =>
                                      d.id === p.domainId &&
                                      d.moduleId === module.id
                                  )
                                ).length > 0 && (
                                  <Card className="border-slate-200">
                                    <CardHeader className="pb-3">
                                      <CardTitle className="flex items-center gap-2 text-base">
                                        <Target className="h-4 w-4 text-teal-600" />{" "}
                                        Programs
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="space-y-4">
                                        {programsData.programs
                                          .filter((p) =>
                                            programsData.domains.some(
                                              (d) =>
                                                d.id === p.domainId &&
                                                d.moduleId === module.id
                                            )
                                          )
                                          .map((program, index) => (
                                            <div
                                              key={index}
                                              className="border rounded-lg p-4 bg-slate-50"
                                            >
                                              <div className="flex items-center justify-between mb-3">
                                                <h4 className="font-semibold">
                                                  Program #{index + 1}:{" "}
                                                  {program.name}
                                                </h4>
                                                <Badge
                                                  variant="outline"
                                                  className={getStatusColor(
                                                    program.status
                                                  )}
                                                >
                                                  {program.status}
                                                </Badge>
                                              </div>
                                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                                <div>
                                                  <p className="text-slate-500 mb-1">
                                                    Description
                                                  </p>
                                                  <p className="font-medium">
                                                    {program.description ||
                                                      "N/A"}
                                                  </p>
                                                </div>
                                                <div>
                                                  <p className="text-slate-500 mb-1">
                                                    Status
                                                  </p>
                                                  <p className="font-medium">
                                                    {program.status || "N/A"}
                                                  </p>
                                                </div>
                                                <div>
                                                  <p className="text-slate-500 mb-1">
                                                    Domain
                                                  </p>
                                                  <p className="font-medium">
                                                    {programsData.domains.find(
                                                      (d) =>
                                                        d.id ===
                                                        program.domainId
                                                    )?.name || "N/A"}
                                                  </p>
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                      </div>
                                    </CardContent>
                                  </Card>
                                )}

                                {/* Activities */}
                                {programsData.activities.filter((a) =>
                                  programsData.programs.some((p) =>
                                    programsData.domains.some(
                                      (d) =>
                                        d.id === p.domainId &&
                                        d.moduleId === module.id &&
                                        p.id === a.programId
                                    )
                                  )
                                ).length > 0 && (
                                  <Card className="border-slate-200">
                                    <CardHeader className="pb-3">
                                      <CardTitle className="flex items-center gap-2 text-base">
                                        <Zap className="h-4 w-4 text-teal-600" />{" "}
                                        Activities
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="space-y-4">
                                        {programsData.activities
                                          .filter((a) =>
                                            programsData.programs.some((p) =>
                                              programsData.domains.some(
                                                (d) =>
                                                  d.id === p.domainId &&
                                                  d.moduleId === module.id &&
                                                  p.id === a.programId
                                              )
                                            )
                                          )
                                          .map((activity, index) => (
                                            <div
                                              key={index}
                                              className="border rounded-lg p-4 bg-slate-50"
                                            >
                                              <div className="flex items-center justify-between mb-3">
                                                <h4 className="font-semibold">
                                                  Activity #{index + 1}:{" "}
                                                  {activity.name}
                                                </h4>
                                                <Badge
                                                  variant="outline"
                                                  className={getStatusColor(
                                                    activity.status
                                                  )}
                                                >
                                                  {activity.status}
                                                </Badge>
                                              </div>
                                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                                                <div>
                                                  <p className="text-slate-500 mb-1">
                                                    Goal Description
                                                  </p>
                                                  <p className="font-medium">
                                                    {activity.goalDescription ||
                                                      "N/A"}
                                                  </p>
                                                </div>
                                                <div>
                                                  <p className="text-slate-500 mb-1">
                                                    Trials
                                                  </p>
                                                  <p className="font-medium">
                                                    {activity.trials || "N/A"}
                                                  </p>
                                                </div>
                                                <div>
                                                  <p className="text-slate-500 mb-1">
                                                    Activity Type
                                                  </p>
                                                  <p className="font-medium">
                                                    {activity.activityType ||
                                                      "N/A"}
                                                  </p>
                                                </div>
                                                <div>
                                                  <p className="text-slate-500 mb-1">
                                                    Instructions
                                                  </p>
                                                  <p className="font-medium">
                                                    {activity.instructions?.substring(
                                                      0,
                                                      100
                                                    ) || "N/A"}
                                                    {activity.instructions
                                                      ?.length > 100
                                                      ? "..."
                                                      : ""}
                                                  </p>
                                                </div>
                                                <div>
                                                  <p className="text-slate-500 mb-1">
                                                    Program
                                                  </p>
                                                  <p className="font-medium">
                                                    {programsData.programs.find(
                                                      (p) =>
                                                        p.id ===
                                                        activity.programId
                                                    )?.name || "N/A"}
                                                  </p>
                                                </div>
                                                <div>
                                                  <p className="text-slate-500 mb-1">
                                                    Status
                                                  </p>
                                                  <p className="font-medium">
                                                    {activity.status || "N/A"}
                                                  </p>
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                      </div>
                                    </CardContent>
                                  </Card>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
              {filteredModules.length === 0 && (
                <div className="text-center py-12">
                  <BookOpen className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-500">
                    {showArchived
                      ? "No archived modules found."
                      : "No modules match your search."}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Modal */}
      <ABAProgramModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingProgram(null);
        }}
        onSave={editingProgram ? handleEditProgram : handleAddProgram}
      />
    </div>
  );
}
