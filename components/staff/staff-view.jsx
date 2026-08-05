"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
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
  Edit,
  Archive,
  ArchiveRestore,
  Eye,
  EyeOff,
  Clock,
  Mail,
  Phone,
  MoreVertical,
  File,
  Download,
} from "lucide-react";
import AddStaffModal from "./add-staff-modal";
import DocumentViewerModal from "@/components/clients/DocumentViewerModal";
import toast, { Toaster } from "react-hot-toast";
import { fetchClients } from "@/app/store/clientSlice";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { getMahaverseAuthHeaders } from "@/lib/api-auth";
import { mahaverseFetch } from "@/lib/mahaverse-api";
import {
  allowsStaffArchive,
  allowsStaffRead,
  allowsStaffWrite,
} from "@/lib/staff-rbac-ui";

const jsonAuthHeaders = () =>
  getMahaverseAuthHeaders({ "Content-Type": "application/json" });

const uploadAuthFetchInit = () => ({
  credentials: "omit",
  headers: getMahaverseAuthHeaders(),
});

/** MySQL may send 0/1 tinyint as string — fix counts and filters */
function staffRowArchived(member) {
  const a = member?.archived;
  return a === true || a === 1 || a === "1";
}

function normalizeStaffRecord(row) {
  if (!row || typeof row !== "object") return row;
  return {
    ...row,
    archived: staffRowArchived(row),
  };
}

const STAFF_API_PATH = "/staff.php";

const formatUSPhone = (value) => {
  if (!value) return "";
  const digits = String(value).replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)})-${digits.slice(3)}`;
  return `(${digits.slice(0, 3)})-${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return "N/A";
  const [year, month, day] = dateStr.split("-");
  if (year === "0000" && month === "00" && day === "00") {
    return "N/A";
  }
  return `${month}/${day}/${year}`; // Outputs MM/DD/YYYY - customize as needed
};

export default function StaffView({ userRole }) {
  const { canAny } = usePermissions(userRole ?? {});
  const allowStaffRead = allowsStaffRead(canAny);
  const allowStaffWrite = allowsStaffWrite(canAny);
  const allowStaffArchive = allowsStaffArchive(canAny);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Active");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [staff, setStaff] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedStaff, setExpandedStaff] = useState(null);
  const [viewingDocument, setViewingDocument] = useState(null);

  const activeStaffCount = staff?.filter((m) => !staffRowArchived(m)).length;
  const archivedStaffCount = staff?.filter((m) => staffRowArchived(m)).length;
  const fetchStaff = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await mahaverseFetch(
        `${STAFF_API_PATH}?showArchived=${showArchived}`,
      );
      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.message || `HTTP ${response.status}`);
      }
      const result = await response.json();
      if (result.success) {
        const rows = Array.isArray(result.staff_records)
          ? result.staff_records.map(normalizeStaffRecord)
          : [];
        setStaff(rows);
      } else {
        toast.error(`Failed to fetch staff: ${result.message}`);
      }
    } catch (error) {
      console.error("Error fetching staff:", error);
      toast.error(error?.message || "Failed to load staff data.");
    } finally {
      setIsLoading(false);
    }
  }, [showArchived]);
  const dispatch = useAppDispatch();
  const clients = useAppSelector((state) => state.clients.items || []);

  useEffect(() => {
    dispatch(fetchClients());
  }, []);

  useEffect(() => {
    if (!allowStaffRead) {
      setStaff([]);
      setIsLoading(false);
      return;
    }
    fetchStaff();
  }, [fetchStaff, allowStaffRead]);

  const filteredStaff = staff?.filter((member) => {
    const nm = String(member.fullName ?? "").toLowerCase();
    const sid = String(member.id ?? "").toLowerCase();
    const matchesSearch =
      nm.includes(searchTerm.toLowerCase()) ||
      sid.includes(searchTerm.toLowerCase()) ||
      (member.certificationNumber || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || member.status === statusFilter;
    const matchesType = typeFilter === "all" || member.staffType === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/$/, "");

  const uploadStaffDocuments = async (docs, staffId) => {
    if (!Array.isArray(docs) || docs.length === 0) return docs;
    const needsUpload = docs.some((d) => d?.document_file);
    if (!needsUpload) return docs.map(({ document_file, ...rest }) => rest);

    if (!baseUrl) {
      throw new Error(
        "NEXT_PUBLIC_BASE_URL is not set; cannot upload staff documents.",
      );
    }

    const uploadUrl = `${baseUrl}/upload-staff-document.php`;
    const uploaded = await Promise.all(
      docs.map(async (doc) => {
        const file = doc?.document_file;
        if (!file) return doc;
        const fd = new FormData();
        fd.append("file", file);
        fd.append("doc_uuid", doc.doc_uuid || "");
        fd.append("staff_id", staffId);
        const res = await mahaverseFetch("/upload-staff-document.php", {
          method: "POST",
          body: fd,
          ...uploadAuthFetchInit(),
        });
        if (res.status === 404) {
          throw new Error(
            "upload-staff-document.php returned 404. Deploy it next to staff.php in mahaverse-backend-logics (same folder as upload-client-document.php).",
          );
        }
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success) {
          throw new Error(json?.message || "Failed to upload document");
        }
        return {
          ...doc,
          document_path: json.document_path || "",
          document_filename: json.document_filename || "",
          document_original_filename:
            doc.document_original_filename || json.filename || "",
          document_file: null,
        };
      }),
    );
    return uploaded.map(({ document_file, ...rest }) => rest);
  };

  const handleAddStaff = async (staffData) => {
    if (!allowStaffWrite) {
      toast.error("You don’t have permission to add staff.");
      return false;
    }
    try {
      const staffId = staffData.id;
      const docsUploaded = await uploadStaffDocuments(staffData.documents || [], staffId);
      const docsToSave = docsUploaded.filter((d) => d.document_path || d.document_filename);
      const toSend = { ...staffData, documents: docsToSave };
      const response = await mahaverseFetch(STAFF_API_PATH, {
        method: "POST",
        headers: jsonAuthHeaders(),
        body: JSON.stringify(toSend),
      });
      const result = await response.json();
      if (result.success) {
        toast.success("Staff added successfully!");
        fetchStaff();
        return true;
      }
      toast.error(`Failed to add staff: ${result.message}`);
      return false;
    } catch (error) {
      console.error("Error adding staff:", error);
      toast.error(error?.message || "Failed to add staff member.");
      return false;
    }
  };

  const handleEditStaff = async (staffData) => {
    if (!allowStaffWrite) {
      toast.error("You don’t have permission to edit staff.");
      return false;
    }
    try {
      const staffId = staffData.id;
      const docsUploaded = await uploadStaffDocuments(staffData.documents || [], staffId);
      const docsToSave = docsUploaded.filter((d) => d.document_path || d.document_filename);
      const toSend = { ...staffData, documents: docsToSave };
      const response = await mahaverseFetch(STAFF_API_PATH, {
        method: "PUT",
        headers: jsonAuthHeaders(),
        body: JSON.stringify(toSend),
      });
      const result = await response.json();
      if (result.success) {
        toast.success("Staff updated successfully!");
        fetchStaff();
        return true;
      }
      toast.error(`Failed to update staff: ${result.message}`);
      return false;
    } catch (error) {
      console.error("Error updating staff:", error);
      toast.error(error?.message || "Failed to update staff member.");
      return false;
    }
  };

  const handleOpenEditModal = (member) => {
    if (!allowStaffWrite) {
      toast.error("You don’t have permission to edit staff.");
      return;
    }
    const staffCopy = {
      ...member,
      documents: Array.isArray(member.documents)
        ? member.documents.map((d) => ({ ...d }))
        : [],
      firstName: member.firstName || "",
      lastName: member.lastName || "",
      staffType: member.staffType || "RBT",
      certificationNumber: member.certificationNumber || "",
      npiNumber: member.npiNumber || "",
      address: member.address || "",
      address_line_1: member.address_line_1 ?? "",
      address_line_2: member.address_line_2 ?? "",
      city: member.city ?? "",
      state: member.state ?? "",
      zipcode: member.zipcode ?? "",
      country: member.country ?? "",
      location: member.location ?? "",
      taxonomyCode: member.taxonomy_code ?? member.taxonomyCode ?? "",
      email: member.email || "",
      phone: member.phone || "",
      dateOfJoining: member.dateOfJoining?.slice(0, 10) || "",
      dateOfLeaving: member.dateOfLeaving?.slice(0, 10) || "",
      status: member.status || "Active",
      availability: member.availability || {},
      locationPreferences: member.locationPreferences || {},
      certifications: member.certifications || [], // <-- add this line
    };

    setEditingStaff(staffCopy);
    setIsAddModalOpen(true);
  };

  const handleArchiveStaff = async (staffId) => {
    if (!allowStaffArchive) {
      toast.error("You don’t have permission to archive or restore staff.");
      return;
    }
    const member = staff.find((s) => s.id === staffId);
    if (!member) {
      toast.error("Staff member not found");
      return;
    }

    const newArchivedStatus = !staffRowArchived(member);
    const newStatus = newArchivedStatus ? "Inactive" : "Active";
    const action = newArchivedStatus ? "archived" : "restored";

    try {
      const response = await mahaverseFetch(STAFF_API_PATH, {
        method: "DELETE",
        headers: jsonAuthHeaders(),
        body: JSON.stringify({
          id: staffId,
          archived: newArchivedStatus,
          status: newStatus,
        }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success(
          `Staff member ${member.fullName} ${action} successfully!`
        );
        fetchStaff();
      } else {
        toast.error(`Failed to ${action} staff: ${result.message}`);
      }
    } catch (error) {
      console.error(`Error ${action} staff:`, error);
      toast.error(`Failed to ${action} staff member.`);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-800";
      case "Inactive":
        return "bg-gray-100 text-gray-800";
      case "On Leave":
        return "bg-yellow-100 text-yellow-800";
      case "Terminated":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case "BCBA":
        return "bg-blue-100 text-blue-800";
      case "BCaBA":
        return "bg-purple-100 text-purple-800";
      case "RBT":
        return "bg-teal-100 text-teal-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
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

  const toggleExpanded = (staffId) => {
    setExpandedStaff((prev) => (prev === staffId ? null : staffId));
  };

  // Helper function to map IDs to names
  const mapIdsToNames = (
    ids,
    list,
    idKey = "id",
    nameFunc = (item) => item.fullName
  ) => {
    if (!ids || ids.length === 0) return [];
    return ids.map((id) => {
      const item = list.find((obj) => obj[idKey] === id);
      return item ? nameFunc(item) : id; // Fallback to ID if not found
    });
  };

  return (
    <div className="space-y-8 px-2 sm:px-0 md:px-6">
      <Toaster />
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row lg:justify-between sm:justify-center sm:items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">
            Staff Management
          </h2>
          <p className="text-slate-600 mt-1">
            Manage staff profiles and information
          </p>
        </div>
        <div className="flex flex-row flex-wrap gap-2 sm:items-center sm:space-x-3 sm:justify-end">
          {allowStaffRead && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowArchived(!showArchived)}
              className="border-slate-300"
            >
              {showArchived ? (
                <>
                  <ArchiveRestore className="h-4 w-4 mr-2" /> Show Active (
                  {activeStaffCount})
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4 mr-2" /> Show Archived (
                  {archivedStaffCount})
                </>
              )}
            </Button>
          )}
          {allowStaffWrite && (
            <Button
              onClick={() => setIsAddModalOpen(true)}
              size="sm"
              className="bg-teal-600 hover:bg-teal-700 shadow-lg"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Staff
            </Button>
          )}
        </div>
      </div>

      {!allowStaffRead && (
        <Card className="shadow-lg border-amber-200 bg-amber-50">
          <CardContent className="py-6 text-sm text-slate-700">
            You don&apos;t have permission to view staff records (requires
            staff.read).
          </CardContent>
        </Card>
      )}

      {/* Search and Filters + Table */}
      {allowStaffRead && (
      <>
      <Card className="shadow-lg border-0">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name, staff ID, or certification number..."
                className="pl-10 border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-48 border-slate-200">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="BCBA">BCBA</SelectItem>
                <SelectItem value="BCaBA">BCaBA</SelectItem>
                <SelectItem value="RBT">RBT</SelectItem>
                <SelectItem value="BT">BT</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48 border-slate-200">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="On Leave">On Leave</SelectItem>
                <SelectItem value="Terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Staff Table */}
      {isLoading ? (
        <div className="h-64 w-64 mx-auto">
          <p className="text-center animate-pulse text-gray-500">
            Fetching staff
          </p>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
            <radialGradient
              id="a8"
              cx=".66"
              fx=".66"
              cy=".3125"
              fy=".3125"
              gradientTransform="scale(1.5)"
            >
              <stop offset="0" stopColor="#0C30FF" />
              <stop offset=".3" stopColor="#0C30FF" stopOpacity=".9" />
              <stop offset=".6" stopColor="#0C30FF" stopOpacity=".6" />
              <stop offset=".8" stopColor="#0C30FF" stopOpacity=".3" />
              <stop offset="1" stopColor="#0C30FF" stopOpacity="0" />
            </radialGradient>
            <circle
              transformOrigin="center"
              fill="none"
              stroke="url(#a8)"
              strokeWidth={15}
              strokeLinecap="round"
              strokeDasharray="200 1000"
              strokeDashoffset="0"
              cx={100}
              cy={100}
              r={70}
            >
              <animateTransform
                attributeName="transform"
                type="rotate"
                dur="2s"
                values="360;0"
                keyTimes="0;1"
                keySplines="0 0 1 1"
                calcMode="spline"
                repeatCount="indefinite"
              />
            </circle>
            <circle
              transformOrigin="center"
              fill="none"
              opacity={0.2}
              stroke="#0C30FF"
              strokeWidth={15}
              strokeLinecap="round"
              cx={100}
              cy={100}
              r={70}
            />
          </svg>
        </div>
      ) : (
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-slate-800 flex items-center">
              <Users className="h-5 w-5 mr-2 text-teal-600" />
              {showArchived ? "Archived" : "Active"} Staff (
              {filteredStaff?.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 border-b">
                    <TableHead className="font-semibold text-slate-700">
                      Staff Name
                    </TableHead>
                    <TableHead className="hidden sm:table-cell font-semibold text-slate-700">
                      Contact & Email
                    </TableHead>
                    <TableHead className="hidden sm:table-cell font-semibold text-slate-700">
                      City Zipcode
                    </TableHead>
                    <TableHead className="hidden sm:table-cell font-semibold text-slate-700">
                      Status
                    </TableHead>
                    <TableHead className="hidden sm:table-cell font-semibold text-slate-700">
                      Assigned Supervisor
                    </TableHead>
                    <TableHead className="hidden sm:table-cell font-semibold text-slate-700">
                      Assigned Client
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700 lg:text-center text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStaff
                    ?.sort((a, b) => a.fullName.localeCompare(b.fullName))
                    .map((member) => {
                      const isExpanded = expandedStaff === member.id;
                      const memberDocuments = Array.isArray(member.documents)
                        ? member.documents
                        : [];
                      return (
                        <Fragment key={member.id}>
                          {/* Main Row */}
                          <TableRow
                            className="hover:bg-slate-50 transition-colors border-b"
                          >
                            <TableCell className="lg:px-4 sm:px-2 py-4">
                              <div className="flex items-center space-x-3">
                                <span className="hidden sm:inline-block">
                                  <div className="bg-teal-100 p-2 rounded-lg flex-shrink-0">
                                    <Users className="h-4 w-4 text-teal-600" />
                                  </div>
                                </span>
                                <div>
                                  <div className="font-semibold text-slate-800 capitalize">
                                    {member.fullName}
                                  </div>
                                  <div className="lg:visible sm:hidden flex flex-wrap gap-1 mt-1">
                                    <Badge
                                      className={getTypeColor(member.staffType)}
                                    >
                                      {member.staffType}
                                    </Badge>
                                    <Badge
                                      className={getStatusColor(member.status)}
                                    >
                                      {member.status}
                                    </Badge>
                                    {staffRowArchived(member) && (
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
                            <TableCell className="hidden sm:table-cell py-4">
                              <div className="text-sm space-y-1">
                                {member.phone && (
                                  <div className="flex items-center gap-1">
                                    <Phone className="h-3 w-3 text-slate-400 flex-shrink-0" />
                                    {formatUSPhone(member.phone)}
                                  </div>
                                )}
                                {member.email && (
                                  <div className="flex items-center gap-1">
                                    <Mail className="h-3 w-3 text-slate-400 flex-shrink-0" />
                                    <span className="truncate max-w-[180px]">{member.email}</span>
                                  </div>
                                )}
                                {!member.phone && !member.email && (
                                  <span className="text-slate-400">—</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell py-4">
                              <span className="text-sm text-slate-600">
                                {[member.city, member.zipcode].filter(Boolean).join(", ") || "—"}
                              </span>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell py-4">
                              <Badge className={getStatusColor(member.status)}>
                                {member.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell py-4">
                              <span className="text-sm text-slate-600">
                                {Array.isArray(member.assignedStaffNames) && member.assignedStaffNames.filter(Boolean).length > 0
                                  ? member.assignedStaffNames.filter(Boolean).join(", ")
                                  : "—"}
                              </span>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell py-4">
                              <span className="text-sm text-slate-600">
                                {Array.isArray(member.assignedClientNames) && member.assignedClientNames.filter(Boolean).length > 0
                                  ? member.assignedClientNames.filter(Boolean).join(", ")
                                  : "—"}
                              </span>
                            </TableCell>
                            <TableCell className="py-4">
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    toggleExpanded(member.id || "")
                                  }
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
                                {allowStaffWrite && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleOpenEditModal(member)
                                    }
                                    className="border-slate-300"
                                  >
                                    <span title="Edit">
                                      <Edit className="h-4 w-4 mr-2" />
                                    </span>
                                  </Button>
                                )}
                                {allowStaffArchive && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        title="Archive options"
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
                                          handleArchiveStaff(member.id || "")
                                        }
                                        className={
                                          staffRowArchived(member)
                                            ? "text-green-600"
                                            : "text-amber-600"
                                        }
                                      >
                                        {staffRowArchived(member) ? (
                                          <>
                                            <ArchiveRestore className="h-4 w-4 mr-2" />{" "}
                                            Restore Staff
                                          </>
                                        ) : (
                                          <>
                                            <Archive className="h-4 w-4 mr-2" />{" "}
                                            Archive Staff
                                          </>
                                        )}
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                          {/* Expanded Details Row */}
                          {isExpanded && (
                            <TableRow className="bg-slate-50">
                              <TableCell colSpan={7} className="px-6 py-6">
                                <div className="space-y-6">
                                  {/* Personal Information Section */}
                                  <Card className="border-slate-200">
                                    <CardHeader className="pb-3">
                                      <CardTitle className="flex items-center gap-2 text-base">
                                        <Users className="h-4 w-4 text-teal-600" />{" "}
                                        Personal Information
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3 text-sm">
                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                          <p className="text-slate-500 mb-1">
                                            First Name
                                          </p>
                                          <p className="font-medium">
                                            {member.firstName || "N/A"}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-slate-500 mb-1">
                                            Last Name
                                          </p>
                                          <p className="font-medium">
                                            {member.lastName || "N/A"}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-slate-500 mb-1">
                                            Email
                                          </p>
                                          <p className="font-medium">
                                            {member.email || "N/A"}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                          <p className="text-slate-500 mb-1">Phone</p>
                                          <p className="font-medium">{member.phone ? formatUSPhone(member.phone) : "N/A"}</p>
                                        </div>
                                        <div>
                                          <p className="text-slate-500 mb-1">Job Title</p>
                                          <p className="font-medium">{member.job_title || member.jobTitle || "N/A"}</p>
                                        </div>
                                        <div>
                                          <p className="text-slate-500 mb-1">SSN</p>
                                          <p className="font-medium">
                                            {member.ssn_encrypted || member.ssn ? "***-**-" + String(member.ssn_encrypted || member.ssn).slice(-4) : "N/A"}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-slate-500 mb-1">Date of birth</p>
                                          <p className="font-medium">{member.dob || "N/A"}</p>
                                        </div>
                                        <div>
                                          <p className="text-slate-500 mb-1">Date of Joining</p>
                                          <p className="font-medium">{formatDate(member.dateOfJoining)}</p>
                                        </div>
                                        <div>
                                          <p className="text-slate-500 mb-1">Date of Leaving</p>
                                          <p className="font-medium">{formatDate(member.dateOfLeaving)}</p>
                                        </div>
                                      </div>
                                      {((member.address_line_1 || member.address) && (
                                        <div className="grid grid-cols-1 sm:grid-cols-1 gap-3">
                                          <div>
                                            <p className="text-slate-500 mb-1">Address</p>
                                            <p className="font-medium">
                                              {[member.address_line_1 || member.address, member.address_line_2, [member.city, member.state, member.zipcode].filter(Boolean).join(", "), member.country].filter(Boolean).join(", ") || "N/A"}
                                            </p>
                                          </div>
                                        </div>
                                      )) || null}
                                      {(member.emergency_contact_name || member.emergencyContactName) && (
                                        <div className="border-t pt-3 mt-3">
                                          <p className="text-slate-500 font-medium mb-2">Emergency Contact</p>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                            <div>
                                              <p className="text-slate-500 text-xs mb-0.5">Name</p>
                                              <p className="font-medium">{member.emergency_contact_name || member.emergencyContactName}</p>
                                            </div>
                                            <div>
                                              <p className="text-slate-500 text-xs mb-0.5">Relationship</p>
                                              <p className="font-medium">{member.emergency_relationship || member.emergencyRelationship || "N/A"}</p>
                                            </div>
                                            <div>
                                              <p className="text-slate-500 text-xs mb-0.5">Phone</p>
                                              <p className="font-medium">
                                                {(member.emergency_phone || member.emergencyPhone) ? formatUSPhone(member.emergency_phone || member.emergencyPhone) : "N/A"}
                                              </p>
                                            </div>
                                            <div>
                                              <p className="text-slate-500 text-xs mb-0.5">Email</p>
                                              <p className="font-medium">{member.emergency_email || member.emergencyEmail || "N/A"}</p>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </CardContent>
                                  </Card>

                                  {/* Professional Information Section */}
                                  <Card className="border-slate-200">
                                    <CardHeader className="pb-3">
                                      <CardTitle className="flex items-center gap-2 text-base">
                                        <Users className="h-4 w-4 text-teal-600" />
                                        Professional Information
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3 text-sm">
                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                          <p className="text-slate-500 mb-1">Staff Type</p>
                                          <p className="font-medium">{member.staffType || "N/A"}</p>
                                        </div>
                                        <div>
                                          <p className="text-slate-500 mb-1">Status</p>
                                          <p className="font-medium">{member.status || "N/A"}</p>
                                        </div>
                                        <div>
                                          <p className="text-slate-500 mb-1">Date of Joining</p>
                                          <p className="font-medium">
                                            {member.dateOfJoining ? new Date(member.dateOfJoining).toLocaleDateString() : "N/A"}
                                          </p>
                                        </div>
                                      </div>
                                      {(member.highest_degree || member.highestDegree || member.year_awarded || member.yearAwarded || member.major) && (
                                        <div className="border-t pt-3 mt-3">
                                          <p className="text-slate-500 font-medium mb-2">Education</p>
                                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div>
                                              <p className="text-slate-500 text-xs mb-0.5">Highest Degree</p>
                                              <p className="font-medium">{member.highest_degree || member.highestDegree || "N/A"}</p>
                                            </div>
                                            <div>
                                              <p className="text-slate-500 text-xs mb-0.5">Year Awarded</p>
                                              <p className="font-medium">{member.year_awarded || member.yearAwarded || "N/A"}</p>
                                            </div>
                                            <div>
                                              <p className="text-slate-500 text-xs mb-0.5">Major</p>
                                              <p className="font-medium">{member.major || "N/A"}</p>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                      {(member.taxonomy_code || member.taxonomyCode) && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                          <div>
                                            <p className="text-slate-500 mb-1">Taxonomy Code</p>
                                            <p className="font-medium">
                                              {member.taxonomy_code || member.taxonomyCode}
                                            </p>
                                          </div>
                                        </div>
                                      )}
                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                          <p className="text-slate-500 mb-1">
                                            Date of Leaving
                                          </p>
                                          <p className="font-medium">
                                            {member.dateOfLeaving
                                              ? new Date(
                                                  member.dateOfLeaving
                                                ).toLocaleDateString()
                                              : "N/A"}
                                          </p>
                                        </div>

                                        <div>
                                          <p className="text-slate-500 mb-1 font-semibold">
                                            Assigned Staff
                                          </p>
                                          {member.assignedStaffNames &&
                                          member.assignedStaffNames.length >
                                            0 ? (
                                            <div className="flex flex-wrap gap-2">
                                              {member.assignedStaffNames.map(
                                                (item, index) => (
                                                  <span
                                                    key={index}
                                                    className="inline-block bg-teal-100 text-teal-800 text-sm font-medium px-3 py-1 rounded-full shadow-sm hover:bg-teal-200 transition-colors"
                                                  >
                                                    {item.length > 20
                                                      ? `${item.slice(
                                                          0,
                                                          17
                                                        )}...`
                                                      : item}
                                                  </span>
                                                )
                                              )}
                                            </div>
                                          ) : (
                                            <p className="italic text-gray-500">
                                              No assigned staff.
                                            </p>
                                          )}
                                        </div>

                                        <div>
                                          <p className="text-slate-500 mb-1 font-semibold">
                                            Assigned Clients
                                          </p>
                                          {member.assignedClientNames &&
                                          member.assignedClientNames.length >
                                            0 ? (
                                            <div className="flex flex-wrap gap-2">
                                              {member.assignedClientNames.map(
                                                (item, index) => (
                                                  <span
                                                    key={index}
                                                    className="inline-block bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full shadow-sm hover:bg-blue-200 transition-colors"
                                                  >
                                                    {item.length > 20
                                                      ? `${item.slice(
                                                          0,
                                                          17
                                                        )}...`
                                                      : item}
                                                  </span>
                                                )
                                              )}
                                            </div>
                                          ) : (
                                            <p className="italic text-gray-500">
                                              No assigned clients.
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>

                                  {/* Certification Details Section */}
                                  {/* Certification Details Section */}
                                  <Card className="border-slate-200">
                                    <CardHeader className="pb-3">
                                      <CardTitle className="flex items-center gap-2 text-base">
                                        <Users className="h-4 w-4 text-teal-600" />
                                        Certification Details
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      {member.certifications &&
                                      member.certifications.length > 0 ? (
                                        <div className="space-y-4">
                                          {member.certifications.map(
                                            (cert, index) => (
                                              <div
                                                key={cert.id || index}
                                                className="border rounded-lg p-4 bg-slate-50 shadow-sm"
                                              >
                                                <h4 className="font-semibold mb-3">
                                                  Certification #{index + 1}
                                                </h4>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                                                  <div>
                                                    <p className="text-slate-500 mb-1">
                                                      Certification Type
                                                    </p>
                                                    <p className="font-medium">
                                                      {cert.certification_type ||
                                                        "N/A"}
                                                    </p>
                                                  </div>
                                                  <div>
                                                    <p className="text-slate-500 mb-1">
                                                      Certification Number
                                                    </p>
                                                    <p className="font-medium">
                                                      {cert.certification_number ||
                                                        "N/A"}
                                                    </p>
                                                  </div>
                                                  <div>
                                                    <p className="text-slate-500 mb-1">
                                                      NPI Number
                                                    </p>
                                                    <p className="font-medium">
                                                      {cert.npi_number ||
                                                        cert.npiNumber ||
                                                        "N/A"}
                                                    </p>
                                                  </div>
                                                  <div>
                                                    <p className="text-slate-500 mb-1">
                                                      Status
                                                    </p>
                                                    <Badge
                                                      className={
                                                        cert.status === "Active"
                                                          ? "bg-green-100 text-green-800"
                                                          : cert.status ===
                                                            "Expired"
                                                          ? "bg-red-100 text-red-800"
                                                          : "bg-gray-100 text-gray-800"
                                                      }
                                                    >
                                                      {cert.status || "N/A"}
                                                    </Badge>
                                                  </div>
                                                  <div>
                                                    <p className="text-slate-500 mb-1">
                                                      Issue Date
                                                    </p>
                                                    <p className="font-medium">
                                                      {cert.issue_date
                                                        ? formatDate(
                                                            cert.issue_date
                                                          )
                                                        : "N/A"}
                                                    </p>
                                                  </div>
                                                  <div>
                                                    <p className="text-slate-500 mb-1">
                                                      Expiry Date
                                                    </p>
                                                    <p className="font-medium">
                                                      {cert.expiry_date
                                                        ? formatDate(
                                                            cert.expiry_date
                                                          )
                                                        : "N/A"}
                                                    </p>
                                                  </div>
                                                </div>
                                              </div>
                                            )
                                          )}
                                        </div>
                                      ) : (
                                        <p className="text-slate-600 text-base text-center italic">
                                          No certifications found.
                                        </p>
                                      )}
                                    </CardContent>
                                  </Card>

                                  {/* Timing Availability */}
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
                                          member.availability || {}
                                        ).map(([day, schedule]) => (
                                          <div
                                            key={day}
                                            className="border rounded-lg p-3 bg-slate-50"
                                          >
                                            <h4 className="font-semibold mb-2 capitalize">
                                              {day}
                                            </h4>
                                            {schedule.available ? (
                                              <p className="text-green-600">
                                                Available:{" "}
                                                {formatTimeForDisplay(
                                                  schedule.start
                                                )}{" "}
                                                -{" "}
                                                {formatTimeForDisplay(
                                                  schedule.end
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
                                      {Object.keys(member.availability || {})
                                        .length === 0 && (
                                        <p className="text-slate-500 italic">
                                          No availability information.
                                        </p>
                                      )}
                                    </CardContent>
                                  </Card>

                                  {/* Documents */}
                                  <Card className="border-slate-200">
                                    <CardHeader className="pb-3">
                                      <CardTitle className="flex items-center gap-2 text-base">
                                        <File className="h-4 w-4 text-teal-600" /> Documents
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      {memberDocuments.length > 0 ? (
                                        <div className="space-y-4">
                                          {memberDocuments.map((doc, index) => (
                                            <div key={doc.doc_uuid || index} className="border rounded-lg p-4 bg-slate-50">
                                              <div className="flex items-center justify-between flex-wrap gap-3">
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                  <File className="h-5 w-5 text-teal-600 flex-shrink-0" />
                                                  <div className="min-w-0">
                                                    <h4 className="font-semibold text-slate-800">
                                                      {doc.document_type || doc.document_original_filename || doc.document_filename || `Document ${index + 1}`}
                                                    </h4>
                                                    {(doc.document_original_filename || doc.document_filename) && (
                                                      <p className="text-xs text-slate-500 mt-1 truncate">
                                                        {doc.document_original_filename || doc.document_filename}
                                                      </p>
                                                    )}
                                                  </div>
                                                </div>
                                                {(doc.document_path || doc.file_url) && (
                                                  <div className="flex items-center gap-2">
                                                    <Button
                                                      variant="outline"
                                                      size="sm"
                                                      onClick={() =>
                                                        setViewingDocument({
                                                          path: doc.document_path || doc.file_url,
                                                          filename: doc.document_original_filename || doc.document_filename || "document",
                                                          documentFilename: doc.document_filename,
                                                        })
                                                      }
                                                      className="text-teal-600 hover:text-teal-700"
                                                    >
                                                      <Eye className="h-4 w-4 mr-2" /> View
                                                    </Button>
                                                    <Button
                                                      variant="outline"
                                                      size="sm"
                                                      onClick={async () => {
                                                        try {
                                                          const docPath = doc.document_path || doc.file_url;
                                                          const isDrive = docPath && docPath.startsWith("drive://");
                                                          const fileId = isDrive ? (doc.document_filename || docPath.slice(8)) : null;
                                                          let url;
                                                          if (fileId) {
                                                            url = `${baseUrl}/download-client-document.php?file_id=${encodeURIComponent(fileId)}${doc.document_original_filename ? "&filename=" + encodeURIComponent(doc.document_original_filename) : ""}`;
                                                          } else if (docPath && (docPath.startsWith("uploads/") || docPath.startsWith("/uploads/"))) {
                                                            url = `${baseUrl}/download-client-upload.php?path=${encodeURIComponent(docPath.startsWith("/") ? docPath.slice(1) : docPath)}${doc.document_original_filename ? "&filename=" + encodeURIComponent(doc.document_original_filename) : ""}`;
                                                          } else if (docPath) {
                                                            url = baseUrl ? `${baseUrl}/${docPath}` : `/${docPath}`;
                                                          } else {
                                                            return;
                                                          }
                                                          if (!url) {
                                                            alert("Backend URL (NEXT_PUBLIC_BASE_URL) is not configured.");
                                                            return;
                                                          }
                                                          const res = await mahaverseFetch(url, {
                                                            credentials: "omit",
                                                            headers: getMahaverseAuthHeaders(),
                                                          });
                                                          if (!res.ok) throw new Error("Download failed");
                                                          const blob = await res.blob();
                                                          const a = document.createElement("a");
                                                          a.href = URL.createObjectURL(blob);
                                                          a.download = doc.document_original_filename || doc.document_filename || "document";
                                                          a.click();
                                                          URL.revokeObjectURL(a.href);
                                                        } catch (e) {
                                                          alert("Failed to download: " + (e?.message || "Unknown error"));
                                                        }
                                                      }}
                                                      className="text-blue-600 hover:text-blue-700"
                                                    >
                                                      <Download className="h-4 w-4 mr-2" /> Download
                                                    </Button>
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-slate-500 italic">No documents uploaded.</p>
                                      )}
                                    </CardContent>
                                  </Card>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                </TableBody>
              </Table>
              {filteredStaff?.length === 0 && !isLoading && (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-500">
                    {showArchived
                      ? "No archived staff found."
                      : "No staff found matching your criteria."}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      </>
      )}

      {/* Add/Edit Staff Modal */}
      <AddStaffModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingStaff(null);
        }}
        onSave={editingStaff ? handleEditStaff : handleAddStaff}
        editingStaff={editingStaff}
        existingStaffs={staff}
      />
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
    </div>
  );
}
