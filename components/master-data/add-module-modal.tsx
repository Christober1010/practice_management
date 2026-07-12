// add-module-modal.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useAppSelector } from "@/app/store/hooks";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import toast from "react-hot-toast";
import { mahaverseFetch } from "@/lib/mahaverse-api";

interface Module {
  id: string;
  name: string;
  description: string;
  status: string;
  archived: boolean | number;
  // optional fields that may exist when editing a client-module
  client_name?: string;
  client_id?: string | number;
}

interface AddModuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  // callbacks invoked after successful add/edit to allow parent to refresh lists
  onAdd: (module: Module) => Promise<void>;
  onEdit?: (module: Module) => Promise<void>;
  loading: boolean;
  editingModule?: Module | null;
  // optional: allow callers to pass pre-fetched clients list (array of objects)
  clientsProp?: Array<{ id?: string | number; name: string; [key: string]: any }>;
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "";

export default function AddModuleModal({
  isOpen,
  onClose,
  onAdd,
  onEdit,
  loading,
  editingModule,
  clientsProp,
}: AddModuleModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("Active");
  const [archived, setArchived] = useState<false | 0 | true | 1>(0);

  // selectedClient is client id if available, otherwise client name string.
  // value "generic" indicates no client link.
  console.log(clientsProp,"clients")
  const [selectedClientValue, setSelectedClientValue] = useState<string | number | "generic">("generic");

  // Pull clients from redux store if available, otherwise fallback to prop
  // Expectation: state.clients.items = [{ id, name, email, phone, ...}, ...]
  const storeClients = useAppSelector((s: any) => s.clients?.items || []);
  const clients = (clientsProp && clientsProp.length ? clientsProp : storeClients) as Array<
    { id?: string | number; name: string; [key: string]: any }
  >;

  // find selected client object for displaying details
  const selectedClientObj = (() => {
    if (selectedClientValue === "generic") return null;
    return clients.find((c) => String(c.id) === String(selectedClientValue) || c.name === selectedClientValue) || null;
  })();

  useEffect(() => {
    if (editingModule) {
      setName(editingModule.name || "");
      setDescription(editingModule.description || "");
      setStatus(editingModule.status || "Active");
      setArchived(editingModule.archived ? (editingModule.archived === 1 ? 1 : true) : 0);
      // preselect client if editing a client-module
      if (editingModule.client_id) {
        setSelectedClientValue(editingModule.client_id as string | number);
      } else if (editingModule.client_name) {
        // fallback to name if id is not present
        setSelectedClientValue(editingModule.client_name);
      } else {
        setSelectedClientValue("generic");
      }
    } else {
      setName("");
      setDescription("");
      setStatus("Active");
      setArchived(0);
      
      // Check for pending client from client view navigation
      const pendingClient = localStorage.getItem("pendingClientForMasterData");
      if (pendingClient && isOpen) {
        try {
          const clientInfo = JSON.parse(pendingClient);
          // Try to find client by ID first, then by name
          const foundClient = clients.find(
            (c) => String(c.id) === String(clientInfo.id) || c.name === clientInfo.name
          );
          if (foundClient) {
            setSelectedClientValue(foundClient.id ?? foundClient.name);
          } else if (clientInfo.id) {
            setSelectedClientValue(clientInfo.id);
          } else if (clientInfo.name) {
            setSelectedClientValue(clientInfo.name);
          } else {
            setSelectedClientValue("generic");
          }
        } catch (err) {
          console.error("Error parsing pending client info:", err);
          setSelectedClientValue("generic");
        }
      } else {
        setSelectedClientValue("generic");
      }
    }
  }, [editingModule, isOpen, clients]);

  const buildModulePayload = (): Module => {
    return {
      id: editingModule?.id || `module_${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      status,
      archived,
      // when client selected, include client fields to help the API and parent
      ...(selectedClientValue !== "generic"
        ? {
            client_id: selectedClientObj?.id ?? selectedClientValue,
            client_name: selectedClientObj?.name ?? String(selectedClientValue),
          }
        : {}),
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Module name is required");
      return;
    }

    const modulePayload = buildModulePayload();

    // Choose API route depending on client assignment
    // - If client selected (selectedClientValue !== "generic") -> POST to client-modules.php
    // - Else -> POST to generic modules endpoint (modules.php) — adjust if your API name differs
    try {
      if (selectedClientValue !== "generic") {
        // client-specific flow
        const clientIdToSend = selectedClientObj?.id ?? selectedClientValue;
        const body = {
          client_id: clientIdToSend,
          modules: [
            {
              id: modulePayload.id,
              name: modulePayload.name,
              description: modulePayload.description,
              status: modulePayload.status,
              archived: modulePayload.archived ? 1 : 0,
            },
          ],
        };

        const res = await mahaverseFetch("/client-modules.php", {
          method: editingModule ? "PUT" : "POST", // some servers use PUT for update; adapt if required
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const json = await res.json();
        if (json && json.success) {
          toast.success("Client module saved");
          // notify parent so it can refresh lists
          await onAdd(modulePayload).catch(() => {});
          onClose();
        } else {
          const msg = json?.message || "Failed to save client module";
          toast.error(msg);
        }
      } else {
        // generic module flow
        const body = {
          modules: [
            {
              id: modulePayload.id,
              name: modulePayload.name,
              description: modulePayload.description,
              status: modulePayload.status,
              archived: modulePayload.archived ? 1 : 0,
            },
          ],
        };

        const res = await mahaverseFetch("/modules.php", {
          method: editingModule ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const json = await res.json();
        if (json && json.success) {
          toast.success("Module saved");
          await onAdd(modulePayload).catch(() => {});
          onClose();
        } else {
          const msg = json?.message || "Failed to save module";
          toast.error(msg);
        }
      }
    } catch (err) {
      console.error("Error saving module:", err);
      toast.error("Network or server error while saving module");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editingModule ? "Edit Module" : "Add New Module"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="module-name">Module Name</Label>
            <Input
              id="module-name"
              placeholder="Enter module name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="module-description">Description (optional)</Label>
            <Textarea
              id="module-description"
              placeholder="Enter module description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(String(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Assign to client</Label>
              <Select
                value={selectedClientValue === "generic" ? "generic" : String(selectedClientValue)}
                onValueChange={(val) => {
                  if (val === "generic") setSelectedClientValue("generic");
                  else {
                    // prefer id if the client object has id property
                    const found = clients.find((c) => String(c.id) === String(val) || c.name === val);
                    setSelectedClientValue(found?.id ?? val);
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="generic">Generic (no client)</SelectItem>
                  {clients.map((c) => {
                    const clientId = c.id ?? c.name;
                    console.log(c,"clients")
                    return (
                      <SelectItem key={String(clientId)} value={String(clientId)}>
                        {c.first_name}{c.last_name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* show a compact client details card if a client is selected */}
          {selectedClientObj && (
            <div className="border rounded p-3 bg-slate-50">
              <div className="font-medium">{selectedClientObj.name}</div>
              {selectedClientObj.email && <div className="text-sm">Email: {selectedClientObj.email}</div>}
              {selectedClientObj.phone && <div className="text-sm">Phone: {selectedClientObj.phone}</div>}
              {/* render additional fields if present */}
              {selectedClientObj.contact_person && (
                <div className="text-sm">Contact: {selectedClientObj.contact_person}</div>
              )}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : editingModule ? "Update Module" : "Add Module"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
