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
import {
  Search,
  MapPin,
  Plus,
  Edit,
  Trash2,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import AddLocationModal from "./add-location-modal";
import DeleteConfirmModal from "../master-data/DeleteConfirmModal";
import {
  clearClaimWarningFocus,
  peekClaimWarningFocus,
} from "@/lib/claim-warning-nav";

export default function LocationsSetup() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [locationInitialTab, setLocationInitialTab] = useState(null);
  const [locationFocusField, setLocationFocusField] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState(null);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  const loadLocations = async () => {
    try {
      setLoading(true);
      const res = await mahaverseFetch(`/locations.php?showArchived=${showArchived}`);
      const data = await res.json();
      if (data?.success) {
        setLocations(data.data || []);
      } else {
        toast.error(data?.message || "Failed to load locations");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load locations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!baseUrl) return;
    loadLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, showArchived]);

  // Open specific location (+ NPI/tax tab) from claim-warning deep link.
  useEffect(() => {
    if (loading || !locations.length) return;
    const focus = peekClaimWarningFocus("locations");
    if (!focus?.locationId && !focus?.focus) return;

    let loc = null;
    if (focus.locationId) {
      loc = locations.find((l) => String(l.id) === String(focus.locationId));
    }
    if (!loc && focus.locationId) {
      toast.error("Location not found");
      clearClaimWarningFocus();
      return;
    }
    if (!loc && focus.focus) {
      loc =
        locations.find((l) => {
          const fac = String(l.facility_npi_number || "").replace(/\D/g, "");
          const bill = String(l.billing_npi_number || "").replace(/\D/g, "");
          const tax = String(l.tax_id_professional || "").replace(/\D/g, "");
          if (focus.focus === "facility_npi") return fac.length !== 10;
          if (focus.focus === "billing_npi") return bill.length !== 10;
          if (focus.focus === "tax_id") return tax.length !== 9;
          return false;
        }) || null;
    }
    if (!loc) return;

    clearClaimWarningFocus();
    setEditingLocation(loc);
    setLocationInitialTab(focus.tab || "facility");
    setLocationFocusField(focus.focus || null);
    setIsAddModalOpen(true);
    toast.success(`Editing ${loc.location_name || loc.facility_name || "location"}`);
  }, [loading, locations]);

  const openEditModal = (location) => {
    setEditingLocation(location);
    setLocationInitialTab(null);
    setLocationFocusField(null);
    setIsAddModalOpen(true);
  };

  const displayedLocations = useMemo(() => {
    return locations
      .filter((l) => {
        const matchesSearch = [
          l.location_name,
          l.facility_name,
          l.facility_city,
          l.facility_state,
          l.tax_id_professional,
        ].some((v) =>
          String(v || "")
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
        );
        const matchesStatus =
          statusFilter === "all" || l.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => a.location_name.localeCompare(b.location_name));
  }, [locations, searchTerm, statusFilter]);

  const handleAddLocation = async (location) => {
    try {
      const method = editingLocation ? "PUT" : "POST";
      const res = await mahaverseFetch("/locations.php", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(location),
      });
      const text = await res.text();
      let result;
      try {
        result = text ? JSON.parse(text) : {};
      } catch {
        console.error("locations save: non-JSON response", res.status, text?.slice(0, 500));
        toast.error(
          res.ok
            ? "Save failed (invalid server response)"
            : `Save failed (HTTP ${res.status})`
        );
        return;
      }

      if (result.success) {
        toast.success(editingLocation ? "Location updated!" : "Location saved!");
        await loadLocations();
        setIsAddModalOpen(false);
        setEditingLocation(null);
        setLocationInitialTab(null);
        setLocationFocusField(null);
      } else {
        toast.error(result.message || "Save failed");
      }
    } catch (err) {
      console.error(err);
      toast.error(err?.message || "Network error");
    }
  };

  const handleDelete = async () => {
    if (!locationToDelete) return;
    try {
      const res = await mahaverseFetch('/locations.php', {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: locationToDelete.id }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Location archived");
        await loadLocations();
        setIsDeleteModalOpen(false);
        setLocationToDelete(null);
      } else {
        toast.error(result.message || "Failed to archive");
      }
    } catch (err) {
      toast.error("Network error");
    }
  };

  return (
    <div className="space-y-6">
      <Toaster />
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-teal-600" />
              Locations Management
            </CardTitle>
            <Button
              onClick={() => {
                setEditingLocation(null);
                setIsAddModalOpen(true);
              }}
              className="bg-teal-600 hover:bg-teal-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Location
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search locations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => setShowArchived(!showArchived)}
            >
              {showArchived ? (
                <>
                  <ArchiveRestore className="h-4 w-4 mr-2" />
                  Show Active
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4 mr-2" />
                  Show Archived
                </>
              )}
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : displayedLocations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No locations found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Location Name</TableHead>
                    <TableHead>Facility Name</TableHead>
                    <TableHead>Tax ID</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedLocations.map((location) => (
                    <TableRow key={location.id}>
                      <TableCell className="font-medium">
                        {location.location_name || "N/A"}
                      </TableCell>
                      <TableCell>{location.facility_name || "N/A"}</TableCell>
                      <TableCell>{location.tax_id_professional || "N/A"}</TableCell>
                      <TableCell>{location.office_phone_number || "N/A"}</TableCell>
                      <TableCell>{location.facility_city || "N/A"}</TableCell>
                      <TableCell>{location.facility_state || "N/A"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            location.status === "Active"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {location.status || "Active"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(location)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setLocationToDelete(location);
                              setIsDeleteModalOpen(true);
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AddLocationModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingLocation(null);
          setLocationInitialTab(null);
          setLocationFocusField(null);
        }}
        onAdd={handleAddLocation}
        editingLocation={editingLocation}
        initialTab={locationInitialTab}
        focusField={locationFocusField}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setLocationToDelete(null);
        }}
        onConfirm={handleDelete}
        title="Archive Location"
        message={`Are you sure you want to archive "${locationToDelete?.location_name}"?`}
      />
    </div>
  );
}
