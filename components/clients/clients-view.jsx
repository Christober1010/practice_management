"use client";

import { mahaverseFetch } from "@/lib/mahaverse-api";

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
  Users,
  Plus,
  Search,
  Calendar,
  Edit,
  Archive,
  ArchiveRestore,
  Eye,
  EyeOff,
  FileText,
  Shield,
  Phone,
  MapPin,
  Heart,
  User,
  MoreVertical,
  File,
  Clock,
  SquareScissors,
  ListPlus,
  FolderKanban,
  Layers,
  ListChecks,
  Target,
  SquareTerminal,
  BookOpen,
  Download,
} from "lucide-react";
import AddClientModal from "./add-client-modal";
import SessionNotesModal from "./session-notes-modal";
import DocumentViewerModal from "./DocumentViewerModal";
import toast, { Toaster } from "react-hot-toast";

// Redux hooks and actions
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import {
  addClient as addClientAction,
  updateClient as updateClientAction,
  toggleArchive as toggleArchiveAction,
  fetchClients,
} from "../../app/store/clientSlice";
import { useSelector } from "react-redux";
import { DropdownMenuLabel } from "@radix-ui/react-dropdown-menu";
import ClientModulesModal from "./add-client-module";
import ClientDomainModal from "./add-client-domain";
import ClientProgramModal, { ProgramsListModal } from "./add-client-program";
import ClientTargetModal, { TargetsListModal } from "./add-client-target";
import { usePermissions } from "@/hooks/usePermissions";
import {
  allowsClientArchive,
  allowsClientCreate,
  allowsClientSessionNotes,
  allowsClientUpdate,
  allowsReadClientDetails,
  canOpenClientMasterDataNav,
} from "@/lib/clients-rbac-ui";

/** Stable ref for useMemo — row “master data” submenu items */
const MASTER_DATA_ROW_MENU_ITEMS = [
  { id: "domains", label: "Domains", icon: Layers, color: "text-indigo-600" },
  {
    id: "programs",
    label: "Programs",
    icon: ListChecks,
    color: "text-teal-600",
  },
  {
    id: "targets",
    label: "Targets",
    icon: Target,
    color: "text-orange-600",
  },
];

function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function generateClientUUID() {
  return Math.floor(Math.random() * 9999999999999999)
    .toString()
    .padStart(16, "0");
}

export default function ClientsView({ userRole }) {
  const { can, canAny } = usePermissions(userRole ?? {});
  const allowCreate = allowsClientCreate(canAny);
  const allowUpdate = allowsClientUpdate(canAny);
  const allowArchive = allowsClientArchive(canAny);
  const allowReadDetails = allowsReadClientDetails(canAny);
  const allowSessionNotes = allowsClientSessionNotes(canAny);
  const filteredMasterDataMenu = useMemo(
    () =>
      MASTER_DATA_ROW_MENU_ITEMS.filter((s) =>
        canOpenClientMasterDataNav(can, s.id),
      ),
    [can],
  );
  const showRowActionsMenu =
    allowSessionNotes ||
    allowUpdate ||
    allowArchive ||
    filteredMasterDataMenu.length > 0;

  // UI-only state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeInactiveFilter, setActiveInactiveFilter] = useState("all");
  const [modalInitialTab, setModalInitialTab] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [expandedClient, setExpandedClient] = useState(null);
  const [sessionNotesClient, setSessionNotesClient] = useState(null);
  const [isSessionNotesModalOpen, setIsSessionNotesModalOpen] = useState(false);
  const [viewingDocument, setViewingDocument] = useState(null);
  const [staffList, setStaffList] = useState([]); // Initialize as empty array

  // Redux
  const dispatch = useAppDispatch();
  // clients-view.jsx
  const clients = useSelector((state) => state.clients.items); // items = API response
  // const clients = clientsResponse?.clients ?? [] // safe fallback to []
  const loading = useAppSelector((s) => s.clients.loading);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  const activeClientCount = useMemo(
    () => clients.filter((c) => !c.archived).length,
    [clients],
  );
  const archivedClientCount = useMemo(
    () => clients.filter((c) => c.archived).length,
    [clients],
  );

  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      const matchesSearch = Object.values(client).some((value) =>
        typeof value === "string"
          ? value.toLowerCase().includes(searchTerm.toLowerCase())
          : typeof value === "number"
            ? String(value).includes(searchTerm)
            : false,
      );
      const matchesStatus =
        statusFilter === "all" || client.client_status === statusFilter;
      const isClientActive =
        client.is_active !== false &&
        client.is_active !== 0 &&
        client.is_active !== "0";
      const matchesActiveInactive =
        activeInactiveFilter === "all" ||
        (activeInactiveFilter === "active" && isClientActive) ||
        (activeInactiveFilter === "inactive" && !isClientActive);
      const matchesArchived = client.archived === showArchived;
      return (
        matchesSearch &&
        matchesStatus &&
        matchesActiveInactive &&
        matchesArchived
      );
    });
  }, [clients, searchTerm, statusFilter, activeInactiveFilter, showArchived]);

  const handleAddClient = async (clientData) => {
    if (!allowCreate) {
      toast.error("You do not have permission to create clients.");
      return;
    }
    const newClient = {
      ...clientData,
      id: generateUUID(),
      client_id: "",
      client_uuid: generateClientUUID(),
      archived: false,
    };
    newClient.client_id = newClient.id;

    try {
      // Upload any queued document files ONLY on Save (not on file select)
      const docs = Array.isArray(newClient.documents)
        ? newClient.documents
        : [];
      const docsUploaded = await Promise.all(
        docs.map(async (doc) => {
          const file = doc?.document_file;
          if (!file) return doc;

          const fd = new FormData();
          fd.append("file", file);
          fd.append("doc_uuid", doc.doc_uuid || "");
          fd.append("client_id", newClient.client_id);

          const upRes = await mahaverseFetch('/upload-client-document.php', {
            method: "POST",
            body: fd,
          });
          const upJson = await upRes.json().catch(() => ({}));
          if (!upRes.ok || !upJson?.success) {
            throw new Error(
              upJson?.message || "Failed to upload client document to Drive",
            );
          }

          return {
            ...doc,
            document_path: upJson.document_path || "",
            document_filename: upJson.document_filename || "",
            document_original_filename:
              doc.document_original_filename || upJson.filename || "",
            // Clear file object so JSON.stringify doesn't break
            document_file: null,
          };
        }),
      );

      const clientToSend = {
        ...newClient,
        documents: docsUploaded.map(({ document_file, ...rest }) => rest),
      };

      const res = await mahaverseFetch('/update-clients.php', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...clientToSend,
          archived: 0,
        }),
      });
      const result = await res.json();
      if (result.success) {
        // Optimistic: update Redux
        dispatch(addClientAction(clientToSend));
        setIsAddModalOpen(false);
        // Optional: re-sync from backend to ensure server truth
        fetchClients();
        toast.success("Client added successfully!");
      } else {
        toast.error(
          `Failed to add client: ${result.message || "Unknown error"}`,
        );
      }
    } catch (err) {
      console.error("Error adding client:", err);
      toast.error("An error occurred while adding the client.");
    }
  };

  const handleEditClient = async (clientData) => {
    if (!allowUpdate) {
      toast.error("You do not have permission to edit clients.");
      return;
    }
    try {
      // Upload any queued document files ONLY on Save (not on file select)
      const docs = Array.isArray(clientData.documents)
        ? clientData.documents
        : [];
      const docsUploaded = await Promise.all(
        docs.map(async (doc) => {
          const file = doc?.document_file;
          if (!file) return doc;

          const fd = new FormData();
          fd.append("file", file);
          fd.append("doc_uuid", doc.doc_uuid || "");
          fd.append("client_id", clientData.client_id || clientData.id || "");

          const upRes = await mahaverseFetch('/upload-client-document.php', {
            method: "POST",
            body: fd,
          });
          const upJson = await upRes.json().catch(() => ({}));
          if (!upRes.ok || !upJson?.success) {
            throw new Error(
              upJson?.message || "Failed to upload client document to Drive",
            );
          }

          return {
            ...doc,
            document_path: upJson.document_path || "",
            document_filename: upJson.document_filename || "",
            document_original_filename:
              doc.document_original_filename || upJson.filename || "",
            document_file: null,
          };
        }),
      );

      const clientToSend = {
        ...clientData,
        documents: docsUploaded.map(({ document_file, ...rest }) => rest),
      };

      const res = await mahaverseFetch('/update-clients.php', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...clientToSend,
          archived: clientToSend.archived ? 1 : 0,
        }),
      });
      const result = await res.json();
      if (result.success) {
        dispatch(updateClientAction(clientToSend));
        setEditingClient(clientToSend);
        dispatch(fetchClients());
        toast.success("Client updated successfully!");
      } else {
        toast.error(
          `Failed to update client: ${result.message || "Unknown error"}`,
        );
      }
    } catch (err) {
      console.error("Error updating client:", err);
      toast.error("An error occurred while updating the client.");
    }
  };

  const handleOpenEditModal = (client) => {
    if (!allowUpdate) {
      toast.error("You do not have permission to edit clients.");
      return;
    }
    setModalInitialTab(null);
    setEditingClient(client);
    setIsAddModalOpen(true);
  };

  const handleArchiveClient = async (clientId) => {
    if (!allowArchive) {
      toast.error("You do not have permission to archive or restore clients.");
      return;
    }
    const clientToUpdate = clients.find((c) => c.id === clientId);
    if (!clientToUpdate) return;

    const nextArchived = !clientToUpdate.archived;
    const updatedClient = {
      ...clientToUpdate,
      archived: nextArchived,
      is_active: nextArchived ? false : true,
    };

    try {
      const res = await mahaverseFetch('/update-clients.php', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...updatedClient,
          archived: updatedClient.archived ? 1 : 0,
          is_active: updatedClient.is_active ? 1 : 0,
        }),
      });
      const result = await res.json();
      if (res.ok && result.success) {
        dispatch(
          toggleArchiveAction({
            id: clientId,
            archived: updatedClient.archived,
            is_active: updatedClient.is_active,
          }),
        );
        toast.success(
          updatedClient.archived ? "Client archived!" : "Client restored!",
        );
      } else {
        toast.error(
          `Failed to update client: ${result.message || "Unknown error"}`,
        );
      }
    } catch (err) {
      console.error("Error archiving/restoring client:", err);
      toast.error("An error occurred while updating client status.");
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-800";
      case "New":
        return "bg-yellow-100 text-yellow-800";
      case "Inactive":
        return "bg-gray-100 text-gray-800";
      case "Benefits Verification":
        return "bg-blue-100 text-blue-800";
      case "Prior Authorization":
        return "bg-yellow-100 text-yellow-800";
      case "Client Assessment":
        return "bg-purple-100 text-purple-800";
      case "Pending Authorization":
        return "bg-orange-100 text-orange-800";
      case "Initial Authorization":
        return "bg-cyan-100 text-cyan-800";
      case "Active Treatment":
        return "bg-emerald-100 text-emerald-800";
      case "Reauthorization":
        return "bg-violet-100 text-violet-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const calculateAge = (dob) => {
    if (!dob) return "N/A";
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  useEffect(() => {
    dispatch(fetchClients());
  }, [dispatch]);

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const response = await mahaverseFetch('/staff.php');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        if (result.success) {
          setStaffList(result.staff_records);
        } else {
          toast.error(`Failed to fetch staff: ${result.message}`);
        }
      } catch (error) {
        console.error("Error fetching staff:", error);
        toast.error("Failed to load staff data.");
      }
    };

    fetchStaff();
  }, [baseUrl]);

  const filteredStaff = staffList.filter(
    (staff) => staff.staffType === "BCBA" || staff.staffType === "BCaBA",
  );
  const toggleExpanded = (clientId) => {
    if (!allowReadDetails) return;
    setExpandedClient((prev) => (prev === clientId ? null : clientId));
  };

  const formatTimeForDisplay = (time24hr) => {
    if (!time24hr) return "N/A";
    const [hours, minutes] = time24hr.split(":").map(Number);
    const ampm = hours >= 12 ? "PM" : "AM";
    const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
    return `${formattedHours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")} ${ampm}`;
  };

  const [isClientModulesOpen, setIsClientModulesOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [isClientDomainsOpen, setIsClientDomainsOpen] = useState(false);
  const [isClientProgramsOpen, setIsClientProgramsOpen] = useState(false);
  const [isClientTargetsOpen, setIsClientTargetsOpen] = useState(false);
  const [domainDetailProps, setDomainDetailProps] = useState(null);

  const [programs, setPrograms] = useState([]);
  const [editingProgram, setEditingProgram] = useState(null);
  const [programsLoading, setProgramsLoading] = useState(false);
  const [clientModules, setClientModules] = useState([]);
  const [clientDomains, setClientDomains] = useState([]);
  const [targets, setTargets] = useState([]);
  const [targetsLoading, setTargetsLoading] = useState(false);

  // const loadClientPrograms = async (clientId) => {
  //   setProgramsLoading(true);
  //   try {
  //     const res = await fetch(
  //       `${baseUrl}/client-modules.php?client_id=${clientId}`
  //     );
  //     const result = await res.json();

  //     if (result.success && result.data) {
  //       // Correctly extract both domains and modules
  //       const domains = result.data.domains || [];
  //       const modules = result.data.modules || [];
  //       console.log(result.data, "domains");
  //       // Optional: Normalize keys once here (recommended!)
  //       const normalizedDomains = domains.map((d) => ({
  //         id: d.id,
  //         name: d.NAME || d.name || "Unnamed Domain",
  //         module_id: d.module_id,
  //         description: d.description || "",
  //       }));

  //       const normalizedModules = modules.map((m) => ({
  //         id: m.id,
  //         name: m.NAME || m.name || "Unnamed Module",
  //         description: m.description || "",
  //       }));

  //       setClientDomains(normalizedDomains);
  //       setClientModules(normalizedModules);
  //     } else {
  //       toast.error(result.message || "Failed to load programs");
  //       setClientDomains([]);
  //       setClientModules([]);
  //     }
  //   } catch (err) {
  //     console.error("Error fetching programs", err);
  //     toast.error("Failed to load programs");
  //     setClientDomains([]);
  //     setClientModules([]);
  //   } finally {
  //     setProgramsLoading(false);
  //   }
  // };

  const loadClientPrograms = async (clientId) => {
    setProgramsLoading(true);
    try {
      const res = await mahaverseFetch(`/client-modules.php?client_id=${clientId}`,
      );
      const result = await res.json();

      if (result.success && result.data) {
        const domains = result.data.domains || [];
        const modules = result.data.modules || [];
        const rawPrograms = result.data.programs || [];
        const rawTargets = result.data.activities || [];

        const normalizedDomains = domains.map((d) => ({
          id: d.id,
          name: d.NAME || d.name || "Unnamed Domain",
          description: d.description || "",
        }));

        const normalizedModules = modules.map((m) => ({
          id: m.id,
          name: m.NAME || m.name || "Unnamed Module",
          description: m.description || "",
        }));

        const normalizedPrograms = rawPrograms.map((p) => ({
          id: p.id,
          name: p.NAME || p.name || "Unnamed Program",
          description: p.description || "",
          domain_id: p.domain_id,
          status: p.status || "Active",
        }));

        const normalizedTargets = rawTargets.map((t) => ({
          id: t.id,
          name: t.name || t.NAME || "Unnamed Target",
          description: t.description || "",
          program_id: t.program_id,
          activity_type: t.activity_type || "",
          status: t.status || "Active",
        }));

        setClientDomains(normalizedDomains);
        setClientModules(normalizedModules);
        setPrograms(normalizedPrograms);
        setTargets(normalizedTargets);

        console.log("Programs from API", normalizedPrograms);
        console.log("Targets from API", normalizedTargets);
      } else {
        toast.error(result.message || "Failed to load programs/targets");
        setClientDomains([]);
        setClientModules([]);
        setPrograms([]);
        setTargets([]);
      }
    } catch (err) {
      console.error("Error fetching programs/targets", err);
      toast.error("Failed to load programs/targets");
      setClientDomains([]);
      setClientModules([]);
      setPrograms([]);
      setTargets([]);
    } finally {
      setProgramsLoading(false);
    }
  };

  const handleMasterDataSelect = async (itemId, client) => {
    if (!canOpenClientMasterDataNav(can, itemId)) {
      toast.error("You do not have permission to open that screen.");
      return;
    }
    // Store client info in localStorage for the master data component to pick up
    const clientInfo = {
      id: client.id,
      name:
        `${client.first_name || ""} ${client.last_name || ""}`.trim() ||
        client.name ||
        "Unknown Client",
      first_name: client.first_name,
      last_name: client.last_name,
    };
    localStorage.setItem(
      "pendingClientForMasterData",
      JSON.stringify(clientInfo),
    );
    localStorage.setItem("pendingAction", "add"); // Indicate we want to add new item
    localStorage.setItem("pendingMasterDataType", itemId); // Store which type (modules/domains/programs/targets)

    // Navigate to the appropriate master data view using custom event
    localStorage.setItem("currentView", itemId);
    window.dispatchEvent(
      new CustomEvent("navigateToView", { detail: { view: itemId } }),
    );
  };

  const handleAddProgram = async (payload) => {
    if (!allowUpdate) {
      toast.error("You do not have permission to modify client programs.");
      return;
    }
    try {
      setProgramsLoading(true);
      const res = await mahaverseFetch('/client-programs.php', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // payload already contains client_id and programs at root:
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        const saved = data.program || payload.programs[0];
        setPrograms((prev) => [...prev, saved]);
        toast.success("Program added successfully");
      } else {
        toast.error(data.message || "Failed to add program");
      }
    } catch (err) {
      console.error("Error adding program", err);
      toast.error("Failed to add program");
    } finally {
      setProgramsLoading(false);
    }
  };

  const handleEditProgram = async (payload) => {
    if (!allowUpdate) {
      toast.error("You do not have permission to modify client programs.");
      return;
    }
    try {
      setProgramsLoading(true);
      const res = await mahaverseFetch('/client-programs.php', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // payload already contains client_id and programs
        body: JSON.stringify({ action: "update", ...payload }),
      });
      const data = await res.json();

      if (data.success) {
        const saved = data.program || payload.programs[0];
        setPrograms((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
        toast.success("Program updated successfully");
      } else {
        toast.error(data.message || "Failed to update program");
      }
    } catch (err) {
      console.error("Error updating program", err);
      toast.error("Failed to update program");
    } finally {
      setProgramsLoading(false);
    }
  };

  const handleAddTarget = async (payload) => {
    if (!allowUpdate) {
      toast.error("You do not have permission to modify client targets.");
      return;
    }
    try {
      setTargetsLoading(true);
      const res = await mahaverseFetch('/client-target.php', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        const saved =
          data.target || (payload.targets ? payload.targets[0] : payload);
        setTargets((prev) => [...prev, saved]);
        toast.success("Target added successfully");
        return true;
      } else {
        toast.error(data.message || "Failed to add target");
        return false;
      }
    } catch (err) {
      console.error("Error adding target", err);
      toast.error("Failed to add target");
      return false;
    } finally {
      setTargetsLoading(false);
    }
  };

  const handleEditTarget = async (payload) => {
    if (!allowUpdate) {
      toast.error("You do not have permission to modify client targets.");
      return;
    }
    try {
      setTargetsLoading(true);
      const res = await mahaverseFetch('/client-target.php', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", ...payload }),
      });
      const data = await res.json();

      if (data.success) {
        const saved =
          data.target || (payload.targets ? payload.targets[0] : payload);
        setTargets((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
        toast.success("Target updated successfully");
        return true;
      } else {
        toast.error(data.message || "Failed to update target");
        return false;
      }
    } catch (err) {
      console.error("Error updating target", err);
      toast.error("Failed to update target");
      return false;
    } finally {
      setTargetsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <Toaster />
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row lg:justify-between sm:justify-center sm:items-center ">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">
            Client Management
          </h2>
          <p className="text-slate-600 mt-1">
            Manage client profiles and information
          </p>
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
                {activeClientCount})
              </>
            ) : (
              <>
                <Archive className="h-4 w-4 mr-2" /> Show Archived (
                {archivedClientCount})
              </>
            )}
          </Button>
          {allowCreate && (
            <Button
              onClick={() => {
                setEditingClient(null);
                setModalInitialTab(null);
                setIsAddModalOpen(true);
              }}
              size="sm"
              className="bg-teal-600 hover:bg-teal-700 shadow-lg"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Client
            </Button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="shadow-lg border-0">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search all client fields..."
                className="pl-10 border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-52 border-slate-200">
                <SelectValue placeholder="Workflow status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="New">New</SelectItem>
                <SelectItem value="Benefits Verification">
                  Benefits Verification
                </SelectItem>
                <SelectItem value="Prior Authorization">
                  Prior Authorization
                </SelectItem>
                <SelectItem value="Client Assessment">
                  Client Assessment
                </SelectItem>
                <SelectItem value="Pending Authorization">
                  Pending Authorization
                </SelectItem>
                <SelectItem value="Initial Authorization">
                  Initial Authorization
                </SelectItem>
                <SelectItem value="Active Treatment">
                  Active Treatment
                </SelectItem>
                <SelectItem value="Reauthorization">
                  Reauthorization
                </SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={activeInactiveFilter}
              onValueChange={setActiveInactiveFilter}
            >
              <SelectTrigger className="w-full sm:w-44 border-slate-200">
                <SelectValue placeholder="Active / Inactive" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                <SelectItem value="active">Active only</SelectItem>
                <SelectItem value="inactive">Inactive only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Client Table */}
      {loading ? (
        <div className="h-64 w-64 mx-auto">
          <p className="text-center animate-pulse text-gray-500">
            Fetching clients
          </p>
          {/* loader svg ... */}
        </div>
      ) : (
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-slate-800 flex items-center">
              <Users className="h-5 w-5 mr-2 text-teal-600" />
              {showArchived ? "Archived" : "Active"} Clients (
              {filteredClients.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 border-b">
                    <TableHead className="font-semibold text-slate-700">
                      Client - fullname
                    </TableHead>
                    <TableHead className="hidden md:table-cell font-semibold text-slate-700">
                      Contact and Email
                    </TableHead>
                    <TableHead className="hidden md:table-cell font-semibold text-slate-700">
                      City and Zip code
                    </TableHead>
                    <TableHead className="hidden lg:table-cell font-semibold text-slate-700">
                      Active/Inactive
                    </TableHead>
                    <TableHead className="hidden lg:table-cell font-semibold text-slate-700">
                      Status
                    </TableHead>
                    <TableHead className="hidden xl:table-cell font-semibold text-slate-700 ">
                      Provider
                    </TableHead>
                    <TableHead className="hidden xl:table-cell font-semibold text-slate-700">
                      Insurance ID
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700 lg:text-center text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients
                    .sort((a, b) => a.first_name.localeCompare(b.first_name))
                    .map((client) => {
                      const isExpanded = expandedClient === client.id;
                      const insurances = Array.isArray(client.insurances)
                        ? client.insurances
                        : [];
                      const primaryInsurance =
                        insurances.find(
                          (ins) => ins?.insurance_type === "Primary",
                        ) ||
                        insurances[0] ||
                        null;
                      return (
                        <Fragment key={client.id}>
                          {/* Main Row */}
                          <TableRow className="hover:bg-slate-50 transition-colors border-b">
                            <TableCell className="lg:px-4 sm:px-2 py-4">
                              <div className="flex items-center space-x-3">
                                <span className="hidden sm:inline-block">
                                  <div className="bg-teal-100 p-2 rounded-lg flex-shrink-0">
                                    <Users className="h-4 w-4 text-teal-600" />
                                  </div>
                                </span>
                                <div>
                                  <div className="font-semibold text-slate-800 capitalize">
                                    {client.first_name} {client.middle_name}{" "}
                                    {client.last_name}
                                  </div>
                                  <div className="lg:visible sm:hidden flex flex-wrap gap-1 mt-1">
                                    {client.wait_list_status === "Yes" && (
                                      <Badge
                                        variant="outline"
                                        className=" border-yellow-300 text-yellow-700 text-xs"
                                      >
                                        Wait List
                                      </Badge>
                                    )}
                                    {client.archived && (
                                      <Badge
                                        variant="outline"
                                        className="border-amber-300 text-amber-700 text-xs"
                                      >
                                        Archived
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell py-4">
                              <div className="text-sm">
                                {client.phone && (
                                  <div className="flex items-center gap-1">
                                    <Phone className="h-3 w-3 text-slate-400" />
                                    {client.phone}
                                  </div>
                                )}
                                {client.email && (
                                  <div className="text-slate-600 mt-1">
                                    {client.email}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell py-4">
                              <div className="text-sm text-slate-700">
                                {client.city || client.zipcode ? (
                                  <div className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3 text-slate-400" />
                                    <span>
                                      {client.city || "—"}
                                      {client.zipcode
                                        ? `, ${client.zipcode}`
                                        : ""}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-slate-500">—</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell py-4">
                              <Badge
                                variant="outline"
                                className={
                                  client.is_active === false ||
                                  client.is_active === 0 ||
                                  client.is_active === "0"
                                    ? "border-gray-300 text-gray-700"
                                    : "border-green-300 text-green-700"
                                }
                              >
                                {client.is_active === false ||
                                client.is_active === 0 ||
                                client.is_active === "0"
                                  ? "Inactive"
                                  : "Active"}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell py-4">
                              <Badge
                                className={getStatusColor(client.client_status)}
                              >
                                {client.client_status}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden xl:table-cell py-4">
                              <span
                                className="text-sm text-slate-700 block "
                                title={
                                  primaryInsurance?.insurance_provider || ""
                                }
                              >
                                {primaryInsurance?.insurance_provider || "—"}
                              </span>
                            </TableCell>
                            <TableCell className="hidden xl:table-cell py-4">
                              <span className="text-sm text-slate-700">
                                {primaryInsurance?.insurance_id_number || "—"}
                              </span>
                            </TableCell>
                            <TableCell className="py-4">
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    toggleExpanded(client.id || "")
                                  }
                                  disabled={!allowReadDetails}
                                  className="border-slate-300"
                                  title={
                                    allowReadDetails
                                      ? isExpanded
                                        ? "View less"
                                        : "View more"
                                      : "No permission to view client details"
                                  }
                                >
                                  {isExpanded ? (
                                    <span>
                                      <EyeOff className="h-3 w-3" />
                                    </span>
                                  ) : (
                                    <span>
                                      <Eye className="h-3 w-3" />
                                    </span>
                                  )}
                                </Button>
                                {allowUpdate && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenEditModal(client)}
                                    className="border-slate-300"
                                    title="Edit"
                                  >
                                    <span>
                                      <Edit className="h-4 w-4" />
                                    </span>
                                  </Button>
                                )}
                                {showRowActionsMenu && (
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
                                      className="w-56"
                                    >
                                      <DropdownMenuLabel className="text-xs text-slate-500 font-semibold p-1">
                                        Actions
                                      </DropdownMenuLabel>
                                      <DropdownMenuSeparator />
                                      {allowSessionNotes && (
                                        <DropdownMenuItem
                                          onClick={() => {
                                            setSessionNotesClient(client);
                                            setIsSessionNotesModalOpen(true);
                                          }}
                                          className="cursor-pointer"
                                        >
                                          <BookOpen className="h-4 w-4 mr-2" />
                                          Session Notes
                                        </DropdownMenuItem>
                                      )}
                                      {allowSessionNotes &&
                                        (allowUpdate ||
                                          filteredMasterDataMenu.length ||
                                          allowArchive) && (
                                          <DropdownMenuSeparator />
                                        )}
                                      {allowUpdate && (
                                        <>
                                          <DropdownMenuLabel className="text-xs text-slate-500 font-semibold p-1">
                                            Data Collection
                                          </DropdownMenuLabel>
                                          <DropdownMenuItem
                                            onClick={() => {
                                              setModalInitialTab(
                                                "configureData",
                                              );
                                              setEditingClient(client);
                                              setIsAddModalOpen(true);
                                            }}
                                            className="cursor-pointer"
                                          >
                                            <ListChecks className="h-4 w-4 mr-2 text-teal-600" />
                                            Configure data
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                        </>
                                      )}
                                      {filteredMasterDataMenu.map((subItem) => {
                                        const SubIcon = subItem.icon;
                                        return (
                                          <DropdownMenuItem
                                            key={subItem.id}
                                            onClick={() =>
                                              handleMasterDataSelect(
                                                subItem.id,
                                                client,
                                              )
                                            }
                                            className="cursor-pointer text-xs"
                                          >
                                            <SubIcon
                                              className={`h-4 w-4 mr-2 ${subItem.color}`}
                                            />
                                            {subItem.label}
                                          </DropdownMenuItem>
                                        );
                                      })}
                                      {allowArchive && (
                                        <>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            onClick={() =>
                                              handleArchiveClient(
                                                client.id || "",
                                              )
                                            }
                                            className={
                                              client.archived
                                                ? "text-green-600"
                                                : "text-amber-600"
                                            }
                                          >
                                            {client.archived ? (
                                              <>
                                                <ArchiveRestore className="h-4 w-4 mr-2" />{" "}
                                                Restore Client
                                              </>
                                            ) : (
                                              <>
                                                <Archive className="h-4 w-4 mr-2" />{" "}
                                                Archive Client
                                              </>
                                            )}
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>

                          {/* Expanded Details Row */}
                          {isExpanded && allowReadDetails && (
                            <TableRow className="bg-slate-50">
                              <TableCell colSpan={8} className="px-6 py-6">
                                <div className="space-y-6">
                                  {/* Personal Information Section */}
                                  <Card className="border-slate-200">
                                    <CardHeader className="pb-3">
                                      <CardTitle className="flex items-center gap-2 text-base">
                                        <User className="h-4 w-4 text-teal-600" />{" "}
                                        Personal Information
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3 text-sm">
                                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                        <div>
                                          <p className="text-slate-500 mb-1">
                                            First Name
                                          </p>
                                          <p className="font-medium">
                                            {client.first_name || "N/A"}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-slate-500 mb-1">
                                            Middle Name
                                          </p>
                                          <p className="font-medium">
                                            {client.middle_name || "N/A"}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-slate-500 mb-1">
                                            Last Name
                                          </p>
                                          <p className="font-medium">
                                            {client.last_name || "N/A"}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-slate-500 mb-1">
                                            Gender
                                          </p>
                                          <p className="font-medium">
                                            {client.gender || "N/A"}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                        <div>
                                          <p className="text-slate-500 mb-1">
                                            Date of Birth
                                          </p>
                                          <p className="font-medium">
                                            {client.date_of_birth || "N/A"}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-slate-500 mb-1">
                                            Age
                                          </p>
                                          <p className="font-medium">
                                            {calculateAge(client.date_of_birth)}{" "}
                                            years
                                          </p>
                                        </div>

                                        <div>
                                          <p className="text-slate-500 mb-1">
                                            Preferred Language
                                          </p>
                                          <p className="font-medium">
                                            {client.preferred_language || "N/A"}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-slate-500 mb-1">
                                            Location
                                          </p>
                                          <p className="font-medium">
                                            {client.location || "N/A"}
                                          </p>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>

                                  {/* Contact and Address */}
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <Card className="border-slate-200">
                                      <CardHeader className="pb-3">
                                        <CardTitle className="flex items-center gap-2 text-base">
                                          <MapPin className="h-4 w-4 text-teal-600" />{" "}
                                          Address Information
                                        </CardTitle>
                                      </CardHeader>
                                      <CardContent className="space-y-3 text-sm">
                                        {client.addresses &&
                                        client.addresses.length > 0 ? (
                                          client.addresses.map(
                                            (address, index) => (
                                              <div
                                                key={index}
                                                className={`${
                                                  index > 0
                                                    ? "border-t pt-3 mt-3"
                                                    : ""
                                                }`}
                                              >
                                                {client.addresses.length >
                                                  1 && (
                                                  <div className="flex items-center gap-2 mb-2">
                                                    <Badge
                                                      variant="outline"
                                                      className="text-xs"
                                                    >
                                                      Address #{index + 1}
                                                    </Badge>
                                                    <Badge
                                                      variant="secondary"
                                                      className="text-xs"
                                                    >
                                                      {address.service_location ||
                                                        "Home"}
                                                    </Badge>
                                                  </div>
                                                )}
                                                {client.addresses.length ===
                                                  1 &&
                                                  address.service_location && (
                                                    <div className="mb-2">
                                                      <Badge
                                                        variant="secondary"
                                                        className="text-xs"
                                                      >
                                                        {
                                                          address.service_location
                                                        }
                                                      </Badge>
                                                    </div>
                                                  )}
                                                <div>
                                                  <p className="text-slate-500 mb-1">
                                                    Street Address
                                                  </p>
                                                  <p className="font-medium">
                                                    {address.address_line_1 ||
                                                      "Not specified"}
                                                    {address.address_line_2 && (
                                                      <>
                                                        <br />
                                                        {address.address_line_2}
                                                      </>
                                                    )}
                                                  </p>
                                                </div>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                  <div>
                                                    <p className="text-slate-500 mb-1">
                                                      City
                                                    </p>
                                                    <p className="font-medium">
                                                      {address.city ||
                                                        "Not specified"}
                                                    </p>
                                                  </div>
                                                  <div>
                                                    <p className="text-slate-500 mb-1">
                                                      State
                                                    </p>
                                                    <p className="font-medium">
                                                      {address.state ||
                                                        "Not specified"}
                                                    </p>
                                                  </div>
                                                  <div>
                                                    <p className="text-slate-500 mb-1">
                                                      Country
                                                    </p>
                                                    <p className="font-medium">
                                                      {address.country ||
                                                        "Not specified"}
                                                    </p>
                                                  </div>
                                                  <div>
                                                    <p className="text-slate-500 mb-1">
                                                      ZIP
                                                    </p>
                                                    <p className="font-medium">
                                                      {address.zipcode ||
                                                        "Not specified"}
                                                    </p>
                                                  </div>
                                                </div>
                                              </div>
                                            ),
                                          )
                                        ) : (
                                          <div>
                                            <p className="text-slate-500 mb-1">
                                              Street Address
                                            </p>
                                            <p className="font-medium">
                                              {client.address_line_1 ||
                                                "Not specified"}
                                              {client.address_line_2 && (
                                                <>
                                                  <br />
                                                  {client.address_line_2}
                                                </>
                                              )}
                                            </p>
                                          </div>
                                        )}
                                      </CardContent>
                                    </Card>
                                    <Card className="border-slate-200">
                                      <CardHeader className="pb-3">
                                        <CardTitle className="flex items-center gap-2 text-base">
                                          <Phone className="h-4 w-4 text-teal-600" />{" "}
                                          Contact Information
                                        </CardTitle>
                                      </CardHeader>
                                      <CardContent className="space-y-3 text-sm">
                                        <div>
                                          <p className="text-slate-500 mb-1">
                                            Phone
                                          </p>
                                          <p className="font-medium">
                                            {client.phone || "Not specified"}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-slate-500 mb-1">
                                            Email
                                          </p>
                                          <p className="font-medium">
                                            {client.email || "Not specified"}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-slate-500 mb-1">
                                            Appointment Reminder
                                          </p>
                                          <p className="font-medium capitalize">
                                            {client.appointment_reminder ||
                                              "Not specified"}
                                          </p>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  </div>

                                  {/* Parent/Guardian and Emergency Contact */}
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <Card className="border-slate-200">
                                      <CardHeader className="pb-3">
                                        <CardTitle className="flex items-center gap-2 text-base">
                                          <User className="h-4 w-4 text-teal-600" />{" "}
                                          Parent/Guardian Information
                                        </CardTitle>
                                      </CardHeader>
                                      <CardContent className="space-y-3 text-sm">
                                        <div>
                                          <p className="text-slate-500 mb-1">
                                            Name
                                          </p>
                                          <p className="font-medium">
                                            {client.parent_first_name}{" "}
                                            {client.parent_last_name ||
                                              "Not specified"}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-slate-500 mb-1">
                                            Relationship
                                          </p>
                                          <p className="font-medium">
                                            {client.relationship_to_insured ===
                                            "Other"
                                              ? client.relation_other
                                              : client.relationship_to_insured ||
                                                "Not specified"}
                                          </p>
                                        </div>
                                      </CardContent>
                                    </Card>
                                    <Card className="border-slate-200">
                                      <CardHeader className="pb-3">
                                        <CardTitle className="flex items-center gap-2 text-base">
                                          <Heart className="h-4 w-4 text-teal-600" />{" "}
                                          Emergency Contact
                                        </CardTitle>
                                      </CardHeader>
                                      <CardContent className="space-y-3 text-sm">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                          <div>
                                            <p className="text-slate-500 mb-1">
                                              Name
                                            </p>
                                            <p className="font-medium">
                                              {client.emergency_contact_name ||
                                                "Not specified"}
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-slate-500 mb-1">
                                              Relationship
                                            </p>
                                            <p className="font-medium">
                                              {client.emg_relationship ||
                                                "Not specified"}
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-slate-500 mb-1">
                                              Phone
                                            </p>
                                            <p className="font-medium">
                                              {client.emg_phone ||
                                                "Not specified"}
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-slate-500 mb-1">
                                              Email
                                            </p>
                                            <p className="font-medium">
                                              {client.emg_email ||
                                                "Not specified"}
                                            </p>
                                          </div>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  </div>

                                  {/* Insurance Information */}
                                  {client.insurances &&
                                    Array.isArray(client.insurances) &&
                                    client.insurances.length > 0 && (
                                      <Card className="border-slate-200">
                                        <CardHeader className="pb-3">
                                          <CardTitle className="flex items-center gap-2 text-base">
                                            <Shield className="h-4 w-4 text-teal-600" />{" "}
                                            Insurance Information
                                          </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                          <div className="space-y-4">
                                            {client.insurances.map(
                                              (insurance, index) => (
                                                <div
                                                  key={index}
                                                  className="border rounded-lg p-4 bg-slate-50"
                                                >
                                                  <div className="flex items-center justify-between mb-3">
                                                    <h4 className="font-semibold">
                                                      Insurance #{index + 1}
                                                    </h4>
                                                    <Badge
                                                      variant="outline"
                                                      className={
                                                        insurance.insurance_type ===
                                                        "Primary"
                                                          ? "border-blue-300 text-blue-700"
                                                          : "border-green-300 text-green-700"
                                                      }
                                                    >
                                                      {insurance.insurance_type}
                                                    </Badge>
                                                  </div>
                                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                                                    <div>
                                                      <p className="text-slate-500 mb-1">
                                                        Provider
                                                      </p>
                                                      <p className="font-medium">
                                                        {insurance.insurance_provider ||
                                                          "Not specified"}
                                                      </p>
                                                    </div>
                                                    <div>
                                                      <p className="text-slate-500 mb-1">
                                                        Carrier Payer ID
                                                      </p>
                                                      <p className="font-medium">
                                                        {insurance.carrier_payer_id ||
                                                          "Not specified"}
                                                      </p>
                                                    </div>
                                                    <div>
                                                      <p className="text-slate-500 mb-1">
                                                        Insurance Plan Name
                                                      </p>
                                                      <p className="font-medium">
                                                        {insurance.insurance_plan_name ||
                                                          "Not specified"}
                                                      </p>
                                                    </div>
                                                    <div>
                                                      <p className="text-slate-500 mb-1">
                                                        Insurance Company
                                                        Address
                                                      </p>
                                                      <p className="font-medium">
                                                        {insurance.insurance_company_address ||
                                                          "Not specified"}
                                                      </p>
                                                    </div>
                                                    <div>
                                                      <p className="text-slate-500 mb-1">
                                                        Insurance ID
                                                      </p>
                                                      <p className="font-medium">
                                                        {insurance.insurance_id_number ||
                                                          "Not specified"}
                                                      </p>
                                                    </div>
                                                    <div>
                                                      <p className="text-slate-500 mb-1">
                                                        Group Number
                                                      </p>
                                                      <p className="font-medium">
                                                        {insurance.group_number ||
                                                          "Not specified"}
                                                      </p>
                                                    </div>
                                                    <div>
                                                      <p className="text-slate-500 mb-1">
                                                        Rendering provider
                                                      </p>
                                                      <p className="font-medium">
                                                        {insurance.provider_name ||
                                                          insurance.rendering_provider ||
                                                          "Not specified"}
                                                      </p>
                                                    </div>
                                                    <div>
                                                      <p className="text-slate-500 mb-1">
                                                        Treatment Type
                                                      </p>
                                                      <p className="font-medium">
                                                        {insurance.treatment_type ||
                                                          "Not specified"}
                                                      </p>
                                                    </div>
                                                    <div>
                                                      <p className="text-slate-500 mb-1">
                                                        Coinsurance
                                                      </p>
                                                      <p className="font-medium">
                                                        {insurance.coinsurance ||
                                                          "Not specified"}
                                                      </p>
                                                    </div>
                                                    <div>
                                                      <p className="text-slate-500 mb-1">
                                                        Deductible
                                                      </p>
                                                      <p className="font-medium">
                                                        {insurance.deductible ||
                                                          "Not specified"}
                                                      </p>
                                                    </div>
                                                    <div>
                                                      <p className="text-slate-500 mb-1">
                                                        Copay Rate
                                                      </p>
                                                      <p className="font-medium">
                                                        {insurance.copay_rate ||
                                                          "Not specified"}
                                                      </p>
                                                    </div>
                                                    <div>
                                                      <p className="text-slate-500 mb-1">
                                                        Authorized Payment (Box
                                                        13)
                                                      </p>
                                                      <p className="font-medium">
                                                        {insurance.authorized_payment_box13 ||
                                                          "Not specified"}
                                                      </p>
                                                    </div>
                                                    <div>
                                                      <p className="text-slate-500 mb-1">
                                                        Authorization Release
                                                        (Box 12)
                                                      </p>
                                                      <p className="font-medium">
                                                        {insurance.authorized_release_box12 ||
                                                          "Not specified"}
                                                      </p>
                                                    </div>
                                                    <div>
                                                      <p className="text-slate-500 mb-1">
                                                        Authorization Release
                                                        (Box 17)
                                                      </p>
                                                      <p className="font-medium">
                                                        {insurance.authorized_release_box17 ||
                                                          "Not specified"}
                                                      </p>
                                                    </div>
                                                    <div>
                                                      <p className="text-slate-500 mb-1">
                                                        Do Not Accept Assignment
                                                        (Box 27)
                                                      </p>
                                                      <p className="font-medium">
                                                        {insurance.do_not_accept_assignment_box27
                                                          ? "Yes"
                                                          : "No"}
                                                      </p>
                                                    </div>
                                                    <div>
                                                      <p className="text-slate-500 mb-1">
                                                        Insured Same as Client
                                                      </p>
                                                      <p className="font-medium">
                                                        {insurance.insured_same_as_client !==
                                                        false
                                                          ? "Yes"
                                                          : "No"}
                                                      </p>
                                                    </div>
                                                    <div>
                                                      <p className="text-slate-500 mb-1">
                                                        Insurance Inactive
                                                      </p>
                                                      <p className="font-medium">
                                                        {(insurance.insurance_inactive === 1 || insurance.insurance_inactive === "1" || insurance.insurance_inactive === true)
                                                          ? "Yes"
                                                          : "No"}
                                                      </p>
                                                    </div>
                                                  </div>
                                                  {insurance.start_date && (
                                                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                                                      <div>
                                                        <p className="text-slate-500 mb-1">
                                                          Start Date
                                                        </p>
                                                        <p className="font-medium">
                                                          {insurance.start_date}
                                                        </p>
                                                      </div>
                                                      <div>
                                                        <p className="text-slate-500 mb-1">
                                                          End Date
                                                        </p>
                                                        <p className="font-medium">
                                                          {insurance.end_date ||
                                                            "Ongoing"}
                                                        </p>
                                                      </div>
                                                      <div>
                                                        <p className="text-slate-500 mb-1">
                                                          Insurance Issue Date
                                                        </p>
                                                        <p className="font-medium">
                                                          {insurance.insurance_issue_date ||
                                                            "Not specified"}
                                                        </p>
                                                      </div>
                                                      <div>
                                                        <p className="text-slate-500 mb-1">
                                                          Date of Signature
                                                        </p>
                                                        <p className="font-medium">
                                                          {insurance.date_of_signature ||
                                                            "Not specified"}
                                                        </p>
                                                      </div>
                                                    </div>
                                                  )}
                                                  {(insurance.additional_claim_info_box19 ||
                                                    insurance.insurance_notes ||
                                                    insurance.primary_insurance_notes) && (
                                                    <div className="mt-3 space-y-2 text-sm">
                                                      {insurance.additional_claim_info_box19 && (
                                                        <div>
                                                          <p className="text-slate-500 mb-1">
                                                            Additional Claim
                                                            Information (Box 19)
                                                          </p>
                                                          <p className="font-medium">
                                                            {
                                                              insurance.additional_claim_info_box19
                                                            }
                                                          </p>
                                                        </div>
                                                      )}
                                                      {insurance.primary_insurance_notes && (
                                                        <div>
                                                          <p className="text-slate-500 mb-1">
                                                            Primary Insurance
                                                            Notes
                                                          </p>
                                                          <p className="font-medium whitespace-pre-wrap">
                                                            {
                                                              insurance.primary_insurance_notes
                                                            }
                                                          </p>
                                                        </div>
                                                      )}
                                                      {insurance.insurance_notes && (
                                                        <div>
                                                          <p className="text-slate-500 mb-1">
                                                            Insurance Notes
                                                          </p>
                                                          <p className="font-medium whitespace-pre-wrap">
                                                            {
                                                              insurance.insurance_notes
                                                            }
                                                          </p>
                                                        </div>
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
                                              ),
                                            )}
                                          </div>
                                        </CardContent>
                                      </Card>
                                    )}

                                  {/* Authorization Information */}
                                  {client.authorizations &&
                                  client.authorizations.length > 0 ? (
                                    <Card className="border-slate-200">
                                      <CardHeader className="pb-3">
                                        <CardTitle className="flex items-center gap-2 text-base">
                                          <FileText className="h-4 w-4 text-teal-600" />{" "}
                                          Authorization Information
                                        </CardTitle>
                                      </CardHeader>
                                      <CardContent>
                                        <div className="space-y-4">
                                          {client.authorizations.map(
                                            (auth, index) => {
                                              // `auth.insurance_id` can be:
                                              // - DB insurance_id (from get-clients.php), or
                                              // - an index string (from in-flight UI state before refetch).
                                              let linkedInsurance = null;
                                              if (
                                                Array.isArray(client.insurances)
                                              ) {
                                                linkedInsurance =
                                                  client.insurances.find(
                                                    (ins) =>
                                                      String(
                                                        ins?.insurance_id,
                                                      ) ===
                                                      String(
                                                        auth?.insurance_id,
                                                      ),
                                                  ) || null;

                                                if (!linkedInsurance) {
                                                  const maybeIdx =
                                                    Number.parseInt(
                                                      String(
                                                        auth?.insurance_id ||
                                                          "",
                                                      ),
                                                      10,
                                                    );
                                                  if (
                                                    Number.isFinite(maybeIdx) &&
                                                    maybeIdx >= 0 &&
                                                    client.insurances[maybeIdx]
                                                  ) {
                                                    linkedInsurance =
                                                      client.insurances[
                                                        maybeIdx
                                                      ];
                                                  }
                                                }
                                              }
                                              const approvedUnits =
                                                Number.parseFloat(
                                                  auth.units_approved_per_15_min,
                                                ) || 0;
                                              const servicedUnits =
                                                Number.parseFloat(
                                                  auth.units_serviced,
                                                ) || 0;
                                              const balanceUnits =
                                                approvedUnits - servicedUnits;
                                              return (
                                                <div
                                                  key={index}
                                                  className="border rounded-lg p-4 bg-slate-50"
                                                >
                                                  <h4 className="font-semibold mb-3">
                                                    Authorization #{index + 1}
                                                  </h4>
                                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                                                    <div>
                                                      <p className="text-slate-500 mb-1">
                                                        Authorization Number
                                                      </p>
                                                      <p className="font-medium">
                                                        {auth.authorization_number ||
                                                          "Not specified"}
                                                      </p>
                                                    </div>
                                                    <div>
                                                      <p className="text-slate-500 mb-1">
                                                        Billing Codes
                                                      </p>
                                                      <p className="font-medium">
                                                        {auth.billing_codes ||
                                                          "Not specified"}
                                                      </p>
                                                    </div>
                                                    <div>
                                                      <p className="text-slate-500 mb-1">
                                                        Units Approved (per 15
                                                        min)
                                                      </p>
                                                      <p className="font-medium">
                                                        {auth.units_approved_per_15_min ||
                                                          "Not specified"}
                                                      </p>
                                                    </div>
                                                    <div>
                                                      <p className="text-slate-500 mb-1">
                                                        Units Serviced
                                                      </p>
                                                      <p className="font-medium">
                                                        {auth.units_serviced ||
                                                          "Not specified"}
                                                      </p>
                                                    </div>
                                                    <div>
                                                      <p className="text-slate-500 mb-1">
                                                        Balance Units
                                                      </p>
                                                      <p className="font-medium">
                                                        {balanceUnits ||
                                                          "Not specified"}
                                                      </p>
                                                    </div>
                                                    <div>
                                                      <p className="text-slate-500 mb-1">
                                                        Status
                                                      </p>
                                                      <p className="font-medium">
                                                        {auth.status ||
                                                          "Not specified"}
                                                      </p>
                                                    </div>
                                                    <div>
                                                      <p className="text-slate-500 mb-1">
                                                        Linked Insurance
                                                      </p>
                                                      <p className="font-medium">
                                                        {linkedInsurance
                                                          ? linkedInsurance.insurance_provider ||
                                                            `Insurance #${
                                                              auth.insurance_id
                                                                ? Number.parseInt(
                                                                    auth.insurance_id,
                                                                    10,
                                                                  ) + 1
                                                                : "-"
                                                            }`
                                                          : "Not specified"}
                                                      </p>
                                                    </div>
                                                    <div>
                                                      <p className="text-slate-500 mb-1">
                                                        Period
                                                      </p>
                                                      <p className="font-medium">
                                                        {auth.start_date &&
                                                        auth.end_date
                                                          ? `${auth.start_date} to ${auth.end_date}`
                                                          : "Not specified"}
                                                      </p>
                                                    </div>
                                                  </div>

                                                  {Array.isArray(auth.ready_to_bill_sessions) &&
                                                    auth.ready_to_bill_sessions.length > 0 && (
                                                      <div className="mt-4 pt-3 border-t border-slate-200">
                                                        <p className="text-green-700 mb-2 text-sm font-semibold">
                                                          Completed sessions (Ready to Bill)
                                                        </p>
                                                        <div className="space-y-1 text-sm">
                                                          {auth.ready_to_bill_sessions.map(
                                                            (sess) => (
                                                              <div
                                                                key={sess.session_id}
                                                                className="flex flex-wrap justify-between gap-2 text-slate-700"
                                                              >
                                                                <span>
                                                                  {sess.service_date}
                                                                </span>
                                                                <span>
                                                                  {sess.units} unit
                                                                  {sess.units === 1 ? "" : "s"}
                                                                  {sess.hours != null
                                                                    ? ` (${sess.hours} hr)`
                                                                    : ""}
                                                                </span>
                                                              </div>
                                                            ),
                                                          )}
                                                        </div>
                                                      </div>
                                                    )}
                                                </div>
                                              );
                                            },
                                          )}
                                        </div>
                                      </CardContent>
                                    </Card>
                                  ) : (
                                    <Card className="border-slate-200">
                                      <CardHeader className="pb-3">
                                        <CardTitle className="text-slate-600 text-base text-center italic">
                                          No authorizations found.
                                        </CardTitle>
                                      </CardHeader>
                                    </Card>
                                  )}

                                  {/* Documents Display */}
                                  {client.documents &&
                                    client.documents.length > 0 && (
                                      <Card className="border-slate-200">
                                        <CardHeader className="pb-3">
                                          <CardTitle className="flex items-center gap-2 text-base">
                                            <File className="h-4 w-4 text-teal-600" />{" "}
                                            Client Documents
                                          </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                          <div className="space-y-4">
                                            {client.documents.map(
                                              (doc, index) => (
                                                <div
                                                  key={index}
                                                  className="border rounded-lg p-4 bg-slate-50"
                                                >
                                                  <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-3 flex-1">
                                                      <File className="h-5 w-5 text-teal-600" />
                                                      <div className="flex-1 min-w-0">
                                                        <h4 className="font-semibold text-slate-800">
                                                          {doc.document_type ||
                                                            doc.document_original_filename ||
                                                            doc.document_filename ||
                                                            `Document #${index + 1}`}
                                                        </h4>
                                                        {(doc.document_original_filename ||
                                                          doc.document_filename) && (
                                                          <p className="text-xs text-slate-500 mt-1 truncate">
                                                            {doc.document_original_filename ||
                                                              doc.document_filename}
                                                          </p>
                                                        )}
                                                        {doc.document_type && (
                                                          <Badge
                                                            variant="outline"
                                                            className="border-gray-300 text-gray-700 mt-1"
                                                          >
                                                            Document {index + 1}
                                                          </Badge>
                                                        )}
                                                      </div>
                                                    </div>
                                                    {(doc.document_path ||
                                                      doc.file_url) &&
                                                      allowReadDetails && (
                                                      <div className="flex items-center gap-2 ml-4">
                                                        <Button
                                                          variant="outline"
                                                          size="sm"
                                                          onClick={() => {
                                                            setViewingDocument({
                                                              path:
                                                                doc.document_path ||
                                                                doc.file_url,
                                                              filename:
                                                                doc.document_original_filename ||
                                                                doc.document_filename ||
                                                                "document",
                                                              documentFilename:
                                                                doc.document_filename,
                                                            });
                                                          }}
                                                          className="text-teal-600 hover:text-teal-700"
                                                        >
                                                          <Eye className="h-4 w-4 mr-2" />
                                                          View
                                                        </Button>
                                                        <Button
                                                          variant="outline"
                                                          size="sm"
                                                          onClick={async () => {
                                                            try {
                                                              let downloadUrl;
                                                              const docPath =
                                                                doc.document_path ||
                                                                doc.file_url;
                                                              const isDrivePath =
                                                                docPath &&
                                                                docPath.startsWith("drive://");
                                                              const driveFileId =
                                                                isDrivePath
                                                                  ? (doc.document_filename && String(doc.document_filename).trim()
                                                                    ? doc.document_filename
                                                                    : docPath.slice("drive://".length))
                                                                  : null;

                                                              if (driveFileId) {
                                                                const params = new URLSearchParams();
                                                                params.set("file_id", driveFileId);
                                                                if (doc.document_original_filename) {
                                                                  params.set("filename", doc.document_original_filename);
                                                                }
                                                                downloadUrl = baseUrl
                                                                  ? `${baseUrl}/download-client-document.php?${params.toString()}`
                                                                  : null;
                                                              } else if (docPath && docPath.startsWith("http")) {
                                                                downloadUrl = docPath;
                                                              } else if (
                                                                docPath &&
                                                                (docPath.startsWith("uploads/") || docPath.startsWith("/uploads/"))
                                                              ) {
                                                                const params = new URLSearchParams();
                                                                params.set("path", docPath.startsWith("/") ? docPath.slice(1) : docPath);
                                                                if (doc.document_original_filename) {
                                                                  params.set("filename", doc.document_original_filename);
                                                                }
                                                                downloadUrl = baseUrl
                                                                  ? `${baseUrl}/download-client-upload.php?${params.toString()}`
                                                                  : null;
                                                              } else if (docPath) {
                                                                downloadUrl = baseUrl
                                                                  ? `${baseUrl}/${docPath}`
                                                                  : `/${docPath}`;
                                                              } else {
                                                                return;
                                                              }

                                                              if (!downloadUrl) {
                                                                alert(
                                                                  "Backend URL (NEXT_PUBLIC_BASE_URL) is not configured. Please set it to enable document downloads.",
                                                                );
                                                                return;
                                                              }

                                                              const response = await fetch(downloadUrl, {
                                                                credentials: "omit",
                                                              });
                                                              if (!response.ok) {
                                                                let errMsg = `Download failed (${response.status})`;
                                                                const ct = response.headers.get("content-type");
                                                                const errText = await response.text().catch(() => "");
                                                                if (
                                                                  ct &&
                                                                  ct.includes("application/json") &&
                                                                  errText
                                                                ) {
                                                                  try {
                                                                    const j = JSON.parse(errText);
                                                                    errMsg = j.message || errMsg;
                                                                  } catch { /* use errMsg */ }
                                                                } else if (errText) errMsg = errText;
                                                                throw new Error(errMsg);
                                                              }
                                                              const blob =
                                                                await response.blob();
                                                              const url =
                                                                window.URL.createObjectURL(
                                                                  blob,
                                                                );
                                                              const link =
                                                                document.createElement(
                                                                  "a",
                                                                );
                                                              link.href = url;
                                                              link.download =
                                                                doc.document_original_filename ||
                                                                doc.document_filename ||
                                                                "document";
                                                              document.body.appendChild(
                                                                link,
                                                              );
                                                              link.click();
                                                              document.body.removeChild(
                                                                link,
                                                              );
                                                              window.URL.revokeObjectURL(
                                                                url,
                                                              );
                                                            } catch (error) {
                                                              console.error(
                                                                "Download error:",
                                                                error,
                                                              );
                                                              alert(
                                                                "Failed to download file: " +
                                                                  (error.message || "Please try again."),
                                                              );
                                                            }
                                                          }}
                                                          className="text-blue-600 hover:text-blue-700"
                                                        >
                                                          <Download className="h-4 w-4 mr-2" />
                                                          Download
                                                        </Button>
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              ),
                                            )}
                                          </div>
                                        </CardContent>
                                      </Card>
                                    )}

                                  {/* Notes */}
                                  {(client.client_notes ||
                                    client.other_information) && (
                                    <Card className="border-slate-200">
                                      <CardHeader className="pb-3">
                                        <CardTitle className="flex items-center gap-2 text-base">
                                          <FileText className="h-4 w-4 text-teal-600" />{" "}
                                          Notes & Additional Information
                                        </CardTitle>
                                      </CardHeader>
                                      <CardContent className="space-y-4 text-sm">
                                        {client.client_notes && (
                                          <div>
                                            <p className="text-slate-500 mb-2 font-medium">
                                              Client Notes
                                            </p>
                                            <p className="bg-slate-50 p-3 rounded-lg">
                                              {client.client_notes}
                                            </p>
                                          </div>
                                        )}
                                        {client.other_information && (
                                          <div>
                                            <p className="text-slate-500 mb-2 font-medium">
                                              Other Information
                                            </p>
                                            <p className="bg-slate-50 p-3 rounded-lg">
                                              {client.other_information}
                                            </p>
                                          </div>
                                        )}
                                      </CardContent>
                                    </Card>
                                  )}

                                  {/* Availability */}
                                  {client.availability &&
                                    Object.keys(client.availability).length >
                                      0 && (
                                      <Card className="border-slate-200">
                                        <CardHeader className="pb-3">
                                          <CardTitle className="flex items-center gap-2 text-base">
                                            <Clock className="h-4 w-4 text-teal-600" />{" "}
                                            Availability
                                          </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                            {Object.entries(
                                              client.availability,
                                            ).map(([day, data]) => (
                                              <div
                                                key={day}
                                                className="border rounded-lg p-3 bg-slate-50"
                                              >
                                                <h4 className="font-semibold mb-2 capitalize">
                                                  {day}
                                                </h4>
                                                {data.available ? (
                                                  <p className="text-green-600">
                                                    Available:{" "}
                                                    {formatTimeForDisplay(
                                                      data.start,
                                                    )}{" "}
                                                    -{" "}
                                                    {formatTimeForDisplay(
                                                      data.end,
                                                    )}
                                                  </p>
                                                ) : (
                                                  <p className="text-gray-500">
                                                    Not Available
                                                  </p>
                                                )}
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
              {filteredClients.length === 0 && (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-500">
                    {showArchived
                      ? "No archived clients found."
                      : "No clients match your search."}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Modal */}
      <AddClientModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingClient(null);
          setModalInitialTab(null);
        }}
        onSave={editingClient ? handleEditClient : handleAddClient}
        editingClient={editingClient}
        filteredStaff={filteredStaff}
        initialTab={modalInitialTab}
      />

      {/* Session Notes Modal */}
      <SessionNotesModal
        isOpen={isSessionNotesModalOpen}
        onClose={() => {
          setIsSessionNotesModalOpen(false);
          setSessionNotesClient(null);
        }}
        client={sessionNotesClient}
      />

      {/* Modules Modal — now supports clicking into domains */}
      {selectedClient && (
        <ClientModulesModal
          isOpen={isClientModulesOpen}
          onClose={() => {
            setIsClientModulesOpen(false);
            setSelectedClient(null);
          }}
          clientId={selectedClient.id}
          clientName={`${selectedClient.first_name} ${selectedClient.last_name}`}
          onDomainSelect={setDomainDetailProps} // THIS LINE IS KEY
        />
      )}

      {selectedClient && (
        <ClientDomainModal
          isOpen={isClientDomainsOpen}
          onClose={() => {
            setIsClientDomainsOpen(false);
            setSelectedClient(null);
          }}
          clientId={selectedClient.id}
          clientName={`${selectedClient.first_name} ${selectedClient.last_name}`}
        />
      )}
      {viewingDocument && (
        <DocumentViewerModal
          isOpen={!!viewingDocument}
          documentPath={viewingDocument.path}
          filename={viewingDocument.filename}
          documentFilename={viewingDocument.documentFilename}
          baseUrl={baseUrl}
          onClose={() => setViewingDocument(null)}
        />
      )}
      {selectedClient && (
        <ProgramsListModal
          isOpen={isClientProgramsOpen}
          onClose={() => {
            setIsClientProgramsOpen(false);
            setEditingProgram(null);
          }}
          clientId={selectedClient.id}
          clientName={`${selectedClient.first_name} ${selectedClient.last_name}`}
          programs={programs}
          domains={clientDomains}
          modules={clientModules}
          loading={programsLoading}
          onReload={() => loadClientPrograms(selectedClient.id)}
          onAddProgram={handleAddProgram}
          onEditProgram={handleEditProgram}
        />
      )}

      {selectedClient && (
        <TargetsListModal
          isOpen={isClientTargetsOpen}
          onClose={() => {
            setIsClientTargetsOpen(false);
            // clear any parent editingTarget state if you have one
          }}
          clientId={selectedClient.id}
          clientName={`${selectedClient.first_name} ${selectedClient.last_name}`}
          targets={targets}
          programs={programs}
          domains={clientDomains}
          modules={clientModules}
          loading={targetsLoading}
          onReload={() => loadClientPrograms(selectedClient.id)}
          onAddTarget={handleAddTarget}
          onEditTarget={handleEditTarget}
        />
      )}

    </div>
  );
}
