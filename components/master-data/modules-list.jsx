"use client";

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
import {
  BookOpen,
  Search,
  Archive,
  ArchiveRestore,
  MoreVertical,
  Plus,
  Edit,
  Trash2,
  Users,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import { fetchPrograms } from "@/app/store/programSlice";
import AddModuleModal from "./add-module-modal";
import DeleteConfirmModal from "./DeleteConfirmModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * ModulesList
 *
 * Dropdown change: instead of listing each client name, the dropdown presents:
 *  - "generic"  -> Generic modules only
 *  - "client"   -> Client modules only (all clients combined)
 *  - "all"      -> Generic + Client modules
 *
 * Behavior:
 *  - When viewMode is "client" or "all" we fetch client modules from get-all.php.
 *  - When viewMode is "generic" we only use the redux-provided generic modules.
 *
 * Note: Radix Select items MUST NOT use value="" — we use non-empty string values.
 */

export default function ModulesList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);

  // viewMode: "generic" | "client" | "all"
  const [viewMode, setViewMode] = useState("generic");

  // clientModulesData.modules will hold modules returned by API (client-specific source)
  const [clientModulesData, setClientModulesData] = useState({
    modules: [],
  });
  const [loadingClientData, setLoadingClientData] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [moduleToDelete, setModuleToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const dispatch = useAppDispatch();
  const programsData = useAppSelector((state) => state.programs.items);
  const loading = useAppSelector((state) => state.programs.loading);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  // Fetch client modules (all client modules combined) whenever viewMode requires it
  const fetchClientSpecificData = async () => {
    try {
      setLoadingClientData(true);
      const res = await fetch(`${baseUrl}/get-all.php`);
      const data = await res.json();

      if (data && data.success) {
        // Expect data.modules to be an array of modules with at least id, NAME/name, client_name, etc.
        setClientModulesData({
          modules: Array.isArray(data.modules) ? data.modules : [],
        });
      } else {
        setClientModulesData({ modules: [] });
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load client modules");
      setClientModulesData({ modules: [] });
    } finally {
      setLoadingClientData(false);
    }
  };

  useEffect(() => {
    // fetch generic programs once (redux)
    dispatch(fetchPrograms());
  }, [dispatch]);

  useEffect(() => {
    if (viewMode === "client" || viewMode === "all") {
      fetchClientSpecificData();
    } else {
      // clear client modules when not needed
      setClientModulesData({ modules: [] });
    }
    // we intentionally don't include fetchClientSpecificData in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  // Map generic modules from redux to a common module shape
  const genericModules = useMemo(() => {
    if (!programsData?.modules) return [];
    return programsData.modules.map((m) => ({
      id: `generic-${m.id}`,
      name: m.name || m.NAME || "Unnamed",
      description: m.description || "",
      status: m.status || m.STATUS || "Active",
      archived: m.archived === 1 || m.archived === true,
      type: "generic",
    }));
  }, [programsData]);

  // Map client modules from API to the same shape (no single-client filtering — it's all client modules)
  const clientModules = useMemo(() => {
    if (!clientModulesData.modules?.length) return [];
    return clientModulesData.modules.map((m) => ({
      id: `client-${m.id}`,
      name: m.NAME || m.name || "Unnamed",
      description: m.description || "",
      status: m.STATUS || m.status || "Active",
      archived: m.archived === 1 || m.archived === true,
      client_name: m.client_name || "",
      type: "client",
    }));
  }, [clientModulesData.modules]);

  // Determine displayed modules according to viewMode and filters
  const displayedModules = useMemo(() => {
    let baseModules = [];

    if (viewMode === "generic") {
      baseModules = genericModules;
    } else if (viewMode === "client") {
      baseModules = clientModules;
    } else if (viewMode === "all") {
      baseModules = [...genericModules, ...clientModules];
    }

    const filtered = baseModules
      .filter((module) => {
        const matchesSearch = [module.name, module.description].some((v) =>
          String(v || "").toLowerCase().includes(searchTerm.toLowerCase())
        );
        const matchesStatus =
          statusFilter === "all" || module.status === statusFilter;
        const matchesArchived = module.archived === showArchived;
        return matchesSearch && matchesStatus && matchesArchived;
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return filtered;
  }, [
    viewMode,
    genericModules,
    clientModules,
    searchTerm,
    statusFilter,
    showArchived,
  ]);

  const activeCount = genericModules.filter((m) => !m.archived).length;
  const archivedCount = genericModules.filter((m) => m.archived).length;

  const handleOpenEditModal = (module) => {
    setEditingModule(module);
    setIsAddModalOpen(true);
  };

  const handleArchiveModule = async (moduleId) => {
    // placeholder for archive logic (implement your API call)
    // after successful archive: refresh generic list
    dispatch(fetchPrograms());
  };

  return (
    <div className="space-y-8">
      <Toaster />

      <AddModuleModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingModule(null);
        }}
        onAdd={() => dispatch(fetchPrograms())}
        onEdit={() => dispatch(fetchPrograms())}
        loading={loading}
        editingModule={editingModule}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setModuleToDelete(null);
        }}
        onConfirm={() => dispatch(fetchPrograms())}
        moduleName={moduleToDelete?.name || ""}
        loading={deleting}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row lg:justify-between sm:items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Modules</h2>
          <p className="text-slate-600 mt-1">Manage module master data</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              setEditingModule(null);
              setIsAddModalOpen(true);
            }}
            className="bg-teal-600 hover:bg-teal-700 text-white"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" /> Add Module
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
            className="border-slate-300"
          >
            {showArchived ? (
              <>
                <ArchiveRestore className="h-4 w-4 mr-2" /> Show Active ({activeCount})
              </>
            ) : (
              <>
                <Archive className="h-4 w-4 mr-2" /> Show Archived ({archivedCount})
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Filters Row */}
      <Card className="shadow-lg border-0">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:space-x-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search modules..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* View Mode Dropdown - shows Generic / Client / All */}
            <Select value={viewMode} onValueChange={setViewMode}>
              <SelectTrigger className="w-full sm:w-64 border-slate-200">
                <SelectValue placeholder="Select view" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="generic">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-teal-600" />
                    Generic modules
                  </div>
                </SelectItem>
                <SelectItem value="client">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-purple-600" />
                    Client modules
                  </div>
                </SelectItem>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-1">
                      <div className="w-5 h-5 rounded-full bg-teal-500 border-2 border-white flex items-center justify-center">
                        <BookOpen className="h-3 w-3 text-white" />
                      </div>
                      <div className="w-5 h-5 rounded-full bg-purple-500 border-2 border-white flex items-center justify-center">
                        <Users className="h-3 w-3 text-white" />
                      </div>
                    </div>
                    All (Generic + Client)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48 border-slate-200">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Loading or Empty State */}
      {(loading || loadingClientData) ? (
        <div className="text-center py-20">
          <p className="text-gray-500 animate-pulse">Loading modules...</p>
        </div>
      ) : displayedModules.length === 0 ? (
        <Card className="shadow-lg border-0">
          <CardContent className="py-16 text-center text-slate-500">
            {viewMode === "client" && clientModules.length === 0
              ? "No client modules available."
              : "No modules found matching your filters."}
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {viewMode === "generic" && <BookOpen className="h-5 w-5 text-teal-600" />}
                {viewMode === "client" && <Users className="h-5 w-5 text-purple-600" />}
                {viewMode === "all" && (
                  <div className="flex -space-x-1">
                    <BookOpen className="h-5 w-5 text-teal-600" />
                    <Users className="h-5 w-5 text-purple-600" />
                  </div>
                )}
                {viewMode === "generic" && "Generic"}
                {viewMode === "client" && "Client"}
                {viewMode === "all" && "All"} Modules
              </div>
              <Badge variant="secondary">{displayedModules.length} module{displayedModules.length !== 1 ? "s" : ""}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-1">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Module Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Description</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedModules.map((module) => (
                    <TableRow key={module.id} className="hover:bg-slate-50">
                      <TableCell className="font-medium p-2">
                        {module.name}
                        {module.archived && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Archived
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="p-2">
                        <Badge
                          variant="outline"
                          className={
                            module.type === "generic"
                              ? "text-teal-700 border-teal-300"
                              : "text-purple-700 border-purple-300"
                          }
                        >
                          {module.type === "generic" ? "Generic" : (module.client_name || "Client")}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell p-2">
                        <Badge
                          className={
                            module.status === "Active"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }
                        >
                          {module.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-slate-600 p-2">
                        {module.description || "—"}
                      </TableCell>
                      <TableCell className="text-right p-2">
                        <div className="flex justify-end gap-2 p-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEditModal(module)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-300"
                            onClick={() => {
                              setModuleToDelete(module);
                              setIsDeleteModalOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleArchiveModule(module.id.replace(/^generic-/, ""))}
                                className={module.archived ? "text-green-600" : "text-amber-600"}
                              >
                                {module.archived ? "Restore" : "Archive"} Module
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
