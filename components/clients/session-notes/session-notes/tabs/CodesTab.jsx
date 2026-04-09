"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardList, Table as TableIcon, X } from "lucide-react";
import toast from "react-hot-toast";

export default function CodesTab({ sessionNotes, setSessionNotes }) {
  const [newServiceCode, setNewServiceCode] = useState({
    serviceCode: "",
    modifiers: "",
    units: "",
    description: "",
  });

  const handleAddServiceCode = () => {
    if (!newServiceCode.serviceCode) {
      toast.error("Service code is required");
      return;
    }
    setSessionNotes((prev) => ({
      ...prev,
      serviceCodes: [...(prev.serviceCodes || []), { ...newServiceCode, id: Date.now() }],
    }));
    setNewServiceCode({ serviceCode: "", modifiers: "", units: "", description: "" });
  };

  const handleRemoveServiceCode = (id) => {
    setSessionNotes((prev) => ({
      ...prev,
      serviceCodes: (prev.serviceCodes || []).filter((sc) => sc.id !== id),
    }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-indigo-600" />
            DIAGNOSIS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Diagnosis Code</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>
                  <Input
                    value={sessionNotes.diagnosisCode}
                    onChange={(e) =>
                      setSessionNotes((prev) => ({
                        ...prev,
                        diagnosisCode: e.target.value,
                      }))
                    }
                    placeholder="e.g., F84.0"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={sessionNotes.diagnosisDescription}
                    onChange={(e) =>
                      setSessionNotes((prev) => ({
                        ...prev,
                        diagnosisDescription: e.target.value,
                      }))
                    }
                    placeholder="e.g., Autistic disorder"
                  />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TableIcon className="h-5 w-5 text-blue-600" />
            SERVICE CODES
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service Code</TableHead>
                <TableHead>Modifiers</TableHead>
                <TableHead>Units</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(sessionNotes.serviceCodes || []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-500">
                    No service codes added
                  </TableCell>
                </TableRow>
              ) : (
                (sessionNotes.serviceCodes || []).map((sc) => (
                  <TableRow key={sc.id}>
                    <TableCell>{sc.serviceCode}</TableCell>
                    <TableCell>{sc.modifiers || "-"}</TableCell>
                    <TableCell>{sc.units}</TableCell>
                    <TableCell>{sc.description}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveServiceCode(sc.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className="grid grid-cols-4 gap-2">
            <Input
              placeholder="Service Code"
              value={newServiceCode.serviceCode}
              onChange={(e) =>
                setNewServiceCode((prev) => ({
                  ...prev,
                  serviceCode: e.target.value,
                }))
              }
            />
            <Input
              placeholder="Modifiers"
              value={newServiceCode.modifiers}
              onChange={(e) =>
                setNewServiceCode((prev) => ({
                  ...prev,
                  modifiers: e.target.value,
                }))
              }
            />
            <Input
              type="number"
              placeholder="Units"
              value={newServiceCode.units}
              onChange={(e) =>
                setNewServiceCode((prev) => ({
                  ...prev,
                  units: e.target.value,
                }))
              }
            />
            <div className="flex gap-2">
              <Input
                placeholder="Description"
                value={newServiceCode.description}
                onChange={(e) =>
                  setNewServiceCode((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                className="flex-1"
              />
              <Button onClick={handleAddServiceCode} size="sm" className="bg-teal-600 hover:bg-teal-700">
                Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


