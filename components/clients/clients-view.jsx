"use client";

import { useEffect, useState } from "react";
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
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import AddClientModal from "./add-client-modal";
import toast, { Toaster } from "react-hot-toast";

function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function generateClientUUID() {
  return Math.floor(Math.random() * 9999999999999999)
    .toString()
    .padStart(16, "0");
}

export default function ClientsView() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [clients, setClients] = useState([]);
  const [expandedClients, setExpandedClients] = useState(new Set());

  const activeClientCount = clients.filter((client) => !client.archived).length;
  const archivedClientCount = clients.filter(
    (client) => client.archived
  ).length;

  const filteredClients = clients.filter((client) => {
    const matchesSearch = Object.values(client).some((value) =>
      typeof value === "string"
        ? value.toLowerCase().includes(searchTerm.toLowerCase())
        : typeof value === "number"
        ? String(value).includes(searchTerm)
        : false
    );
    const matchesStatus =
      statusFilter === "all" || client.client_status === statusFilter;
    const matchesArchived = client.archived === showArchived;
    return matchesSearch && matchesStatus && matchesArchived;
  });

  const handleAddClient = async (clientData) => {
    const newClient = {
      ...clientData,
      id: generateUUID(),
      client_uuid: generateClientUUID(),
      archived: false,
    };

    try {
      const res = await fetch(
        "https://www.mahabehavioralhealth.com/update-clients.php",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...newClient,
            archived: 0,
          }),
        }
      );

      const result = await res.json();
      if (result.success) {
        setClients((prev) => [...prev, newClient]);
        setIsAddModalOpen(false);
        fetchClients();
        toast.success("Client added successfully!");
      } else {
        toast.error(
          `Failed to add client: ${result.message || "Unknown error"}`
        );
      }
    } catch (err) {
      console.error("Error adding client:", err);
      toast.error("An error occurred while adding the client.");
    }
  };

  const handleEditClient = async (clientData) => {
    try {
      const res = await fetch(
        "https://www.mahabehavioralhealth.com/update-clients.php",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...clientData,
            archived: clientData.archived ? 1 : 0,
          }),
        }
      );

      const result = await res.json();
      if (result.success) {
        setClients((prev) =>
          prev.map((client) =>
            client.id === clientData.id ? clientData : client
          )
        );
        setEditingClient(null);
        setIsAddModalOpen(false);
        fetchClients();
        toast.success("Client updated successfully!");
      } else {
        toast.error(
          `Failed to update client: ${result.message || "Unknown error"}`
        );
      }
    } catch (err) {
      console.error("Error updating client:", err);
      toast.error("An error occurred while updating the client.");
    }
  };

  const handleOpenEditModal = (client) => {
    setEditingClient(client);
    setIsAddModalOpen(true);
  };

  const handleArchiveClient = async (clientId) => {
    const clientToUpdate = clients.find((c) => c.id === clientId);
    if (!clientToUpdate) return;

    const updatedClient = {
      ...clientToUpdate,
      archived: !clientToUpdate.archived,
    };

    try {
      const res = await fetch(
        "https://www.mahabehavioralhealth.com/update-clients.php",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...updatedClient,
            archived: updatedClient.archived ? 1 : 0,
          }),
        }
      );

      const result = await res.json();
      if (res.ok && result.success) {
        setClients((prev) =>
          prev.map((c) => (c.id === clientId ? updatedClient : c))
        );
        toast.success(
          updatedClient.archived ? "Client archived!" : "Client restored!"
        );
      } else {
        toast.error(
          `Failed to update client: ${result.message || "Unknown error"}`
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

  const fetchClients = async () => {
    try {
      const res = await fetch(
        "https://www.mahabehavioralhealth.com/get-clients.php"
      );
      const json = await res.json();
      if (json.success && Array.isArray(json.clients)) {
        const formattedClients = json.clients.map((client) => ({
          ...client,
          // Map old field names to new ones for compatibility
          id: client.client_id || client.id,
          first_name: client.first_name || client.firstName || "",
          last_name: client.last_name || client.lastName || "",
          date_of_birth: client.date_of_birth || client.dob?.slice(0, 10) || "",
          client_status: client.client_status || client.STATUS || "Active",
          archived: client.archived == 1,
          // Ensure these are always arrays
          insurances: Array.isArray(client.insurances) ? client.insurances : [],
          authorizations: Array.isArray(client.authorizations)
            ? client.authorizations
            : [],
        }));
        setClients(formattedClients);
      } else {
        toast.error(`Failed to fetch: ${json.message || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Error fetching clients:", err);
      toast.error("An error occurred while fetching clients.");
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const toggleExpanded = (clientId) => {
    setExpandedClients((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(clientId)) {
        newSet.delete(clientId);
      } else {
        newSet.add(clientId);
      }
      return newSet;
    });
  };

  return (
    <div className="space-y-8 px-2 sm:px-4 md:px-6">
      <Toaster />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
                <ArchiveRestore className="h-4 w-4 mr-2" />
                Show Active ({activeClientCount})
              </>
            ) : (
              <>
                <Archive className="h-4 w-4 mr-2" />
                Show Archived ({archivedClientCount})
              </>
            )}
          </Button>
          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-teal-600 hover:bg-teal-700 shadow-lg"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Client
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
                placeholder="Search all client fields..."
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
                <SelectItem value="New">New</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
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
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Client List */}
      <Card className="shadow-lg border-0">
        <CardHeader className="pb-4">
          <CardTitle className="text-slate-800 flex items-center">
            <Users className="h-5 w-5 mr-2 text-teal-600" />
            {showArchived ? "Archived" : "Active"} Clients (
            {filteredClients.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredClients.map((client) => {
              const isExpanded = expandedClients.has(client.id || "");
              return (
                <div
                  key={client.id}
                  className="border border-slate-200 rounded-xl p-6 hover:shadow-md transition-all bg-white"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    {/* Left section with icon and client basic info */}
                    <div className="flex items-start space-x-4 flex-1">
                      <div className="bg-teal-100 p-4 rounded-xl flex-shrink-0">
                        <Users className="h-6 w-6 text-teal-600" />
                      </div>
                      <div className="flex-1 flex flex-col min-w-0">
                        <div className="flex items-center flex-wrap gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-slate-800">
                            {client.first_name} {client.middle_name}{" "}
                            {client.last_name}
                          </h3>
                          <Badge
                            className={getStatusColor(client.client_status)}
                          >
                            {client.client_status}
                          </Badge>
                          {client.wait_list_status === "Yes" && (
                            <Badge
                              variant="outline"
                              className="border-yellow-300 text-yellow-700"
                            >
                              Wait List
                            </Badge>
                          )}
                          {client.archived && (
                            <Badge
                              variant="outline"
                              className="border-amber-300 text-amber-700"
                            >
                              Archived
                            </Badge>
                          )}
                        </div>

                        {/* Basic info always visible */}
                        <div className="text-sm space-y-1">
                          <p>
                            <span className="font-medium text-slate-800">
                              Client ID:
                            </span>{" "}
                            {client.client_uuid}
                          </p>
                          <p>
                            <span className="font-medium text-slate-800">
                              Age:
                            </span>{" "}
                            {calculateAge(client.date_of_birth)} years old
                          </p>
                          <p>
                            <span className="font-medium text-slate-800">
                              Gender:
                            </span>{" "}
                            {client.gender || "N/A"}
                          </p>
                          <p>
                            <span className="font-medium text-slate-800">
                              Language:
                            </span>{" "}
                            {client.preferred_language || "N/A"}
                          </p>
                        </div>

                        {/* Mobile action buttons */}
                        <div className="mt-4 flex flex-row flex-wrap gap-2 sm:hidden justify-start">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleExpanded(client.id || "")}
                            className="border-slate-300"
                          >
                            {isExpanded ? (
                              <>
                                <EyeOff className="h-4 w-4 mr-1" />
                                Hide Details
                              </>
                            ) : (
                              <>
                                <Eye className="h-4 w-4 mr-1" />
                                View Details
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEditModal(client)}
                            className="border-slate-300"
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleArchiveClient(client.id || "")}
                            className="border-slate-300"
                          >
                            {client.archived ? (
                              <>
                                <ArchiveRestore className="h-4 w-4 mr-1" />
                                Restore
                              </>
                            ) : (
                              <>
                                <Archive className="h-4 w-4 mr-1" />
                                Archive
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Desktop action buttons */}
                    <div className="hidden sm:flex flex-row flex-wrap gap-2 sm:items-center sm:justify-end flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleExpanded(client.id || "")}
                        className="border-slate-300"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="h-4 w-4 mr-1" />
                            Hide Details
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4 mr-1" />
                            View Details
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEditModal(client)}
                        className="border-slate-300"
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleArchiveClient(client.id || "")}
                        className="border-slate-300"
                      >
                        {client.archived ? (
                          <>
                            <ArchiveRestore className="h-4 w-4 mr-1" />
                            Restore
                          </>
                        ) : (
                          <>
                            <Archive className="h-4 w-4 mr-1" />
                            Archive
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-slate-300 bg-transparent"
                      >
                        <Calendar className="h-4 w-4 mr-1" />
                        Schedule
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Details Section */}
                  {isExpanded && (
                    <div className="mt-6 pt-6 border-t border-slate-200 space-y-6">
                      {/* Contact Information */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="border-slate-200">
                          <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                              <MapPin className="h-4 w-4 text-teal-600" />
                              Address Information
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3 text-sm">
                            <div>
                              <p className="text-slate-500 mb-1">
                                Street Address
                              </p>
                              <p className="font-medium">
                                {client.address_line_1 || "Not specified"}
                                {client.address_line_2 && (
                                  <>
                                    <br />
                                    {client.address_line_2}
                                  </>
                                )}
                              </p>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              <div>
                                <p className="text-slate-500 mb-1">City</p>
                                <p className="font-medium">
                                  {client.city || "Not specified"}
                                </p>
                              </div>
                              <div>
                                <p className="text-slate-500 mb-1">State</p>
                                <p className="font-medium">
                                  {client.state || "Not specified"}
                                </p>
                              </div>
                              <div>
                                <p className="text-slate-500 mb-1">ZIP</p>
                                <p className="font-medium">
                                  {client.zipcode || "Not specified"}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="border-slate-200">
                          <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                              <Phone className="h-4 w-4 text-teal-600" />
                              Contact Information
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3 text-sm">
                            <div>
                              <p className="text-slate-500 mb-1">Phone</p>
                              <p className="font-medium">
                                {client.phone || "Not specified"}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500 mb-1">Email</p>
                              <p className="font-medium">
                                {client.email || "Not specified"}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500 mb-1">
                                Appointment Reminder
                              </p>
                              <p className="font-medium capitalize">
                                {client.appointment_reminder || "Not specified"}
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
                              <User className="h-4 w-4 text-teal-600" />
                              Parent/Guardian Information
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3 text-sm">
                            <div>
                              <p className="text-slate-500 mb-1">Name</p>
                              <p className="font-medium">
                                {client.parent_first_name}{" "}
                                {client.parent_last_name || "Not specified"}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500 mb-1">
                                Relationship
                              </p>
                              <p className="font-medium">
                                {client.relationship_to_insured === "Other"
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
                              <Heart className="h-4 w-4 text-teal-600" />
                              Emergency Contact
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3 text-sm">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <p className="text-slate-500 mb-1">Name</p>
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
                                  {client.emg_relationship || "Not specified"}
                                </p>
                              </div>
                              <div>
                                <p className="text-slate-500 mb-1">Phone</p>
                                <p className="font-medium">
                                  {client.emg_phone || "Not specified"}
                                </p>
                              </div>
                              <div>
                                <p className="text-slate-500 mb-1">Email</p>
                                <p className="font-medium">
                                  {client.emg_email || "Not specified"}
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
                                <Shield className="h-4 w-4 text-teal-600" />
                                Insurance Information
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-4">
                                {client.insurances.map((insurance, index) => (
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
                                          insurance.insurance_type === "Primary"
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
                                          Treatment Type
                                        </p>
                                        <p className="font-medium">
                                          {insurance.treatment_type ||
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
                                    </div>

                                    {insurance.start_date && (
                                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
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
                                            {insurance.end_date || "Ongoing"}
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}

                      {/* Authorization Information */}
                      {client.authorizations &&
                        Array.isArray(client.authorizations) &&
                        client.authorizations.length > 0 && (
                          <Card className="border-slate-200">
                            <CardHeader className="pb-3">
                              <CardTitle className="flex items-center gap-2 text-base">
                                <FileText className="h-4 w-4 text-teal-600" />
                                Authorization Information
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-4">
                                {client.authorizations.map((auth, index) => (
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
                                          Units Approved (per 15 min)
                                        </p>
                                        <p className="font-medium">
                                          {auth.units_approved_per_15_min ||
                                            "Not specified"}
                                        </p>
                                      </div>
                                      <div className="sm:col-span-2 lg:col-span-3">
                                        <p className="text-slate-500 mb-1">
                                          Period
                                        </p>
                                        <p className="font-medium">
                                          {auth.start_date && auth.end_date
                                            ? `${auth.start_date} to ${auth.end_date}`
                                            : "Not specified"}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}

                      {/* Notes */}
                      {(client.client_notes || client.other_information) && (
                        <Card className="border-slate-200">
                          <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                              <FileText className="h-4 w-4 text-teal-600" />
                              Notes & Information
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
                    </div>
                  )}
                </div>
              );
            })}

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

      {/* Add/Edit Modal */}
      <AddClientModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingClient(null);
        }}
        onSave={editingClient ? handleEditClient : handleAddClient}
        editingClient={editingClient}
      />
    </div>
  );
}
