"use client";

import { mahaverseFetch } from "@/lib/mahaverse-api";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, MessageSquare, Plus, Trash2, MoreVertical, Edit } from "lucide-react";
import { Toaster } from "react-hot-toast";
import toast from "react-hot-toast";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import { fetchPrograms } from "@/app/store/programSlice";
import AddPromptModal from "./add-prompt-modal";

export default function PromptsList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState(null);

  const dispatch = useAppDispatch();
  const { prompts: allPrompts = [] } =
    useAppSelector((state) => state.programs.items) || {};
  const loading = useAppSelector((state) => state.programs.loading);

  useEffect(() => {
    dispatch(fetchPrograms());
  }, [dispatch]);

  const filteredPrompts = useMemo(() => {
    return allPrompts.filter((prompt) =>
      prompt.prompt_name
        ?.toLowerCase()
        .includes(searchTerm.trim().toLowerCase())
    );
  }, [allPrompts, searchTerm]);

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

  const openAddModal = () => {
    setEditingPrompt(null);
    setIsModalOpen(true);
  };

  const openEditModal = (prompt) => {
    setEditingPrompt(prompt);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPrompt(null);
  };

  const handleDeletePrompt = async (promptId) => {
    try {
      const res = await mahaverseFetch('/programs.php', {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: promptId, type: "prompt" }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Prompt deleted!");
        dispatch(fetchPrograms());
      } else {
        toast.error(result.message ?? "Delete failed");
      }
    } catch (err) {
      toast.error("Network error");
      console.error(err);
    }
  };

  const handleAddPrompt = async (newPrompt) => {
    const res = await mahaverseFetch('/programs.php', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompts: [newPrompt],
      }),
    });
    const result = await res.json();
    if (result.success) {
      toast.success("Prompt added!");
      dispatch(fetchPrograms());
    } else {
      toast.error(result.message ?? "Add failed");
      throw new Error(result.message || "Add failed");
    }
  };

  const handleEditPrompt = async (updatedPrompt) => {
    const res = await mahaverseFetch('/programs.php', {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        promptId: updatedPrompt.id,
        prompt_name: updatedPrompt.prompt_name,
        max_score: updatedPrompt.max_score,
        score_as_independent: updatedPrompt.score_as_independent,
        dtt: updatedPrompt.dtt,
        ta: updatedPrompt.ta,
        maintenance: updatedPrompt.maintenance,
        status: updatedPrompt.status,
      }),
    });
    const result = await res.json();
    if (result.success) {
      toast.success("Prompt updated!");
      dispatch(fetchPrograms());
    } else {
      toast.error(result.message ?? "Update failed");
      throw new Error(result.message || "Update failed");
    }
  };

  return (
    <div className="space-y-8">
      <Toaster />
      <AddPromptModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onAdd={handleAddPrompt}
        onEdit={handleEditPrompt}
        editingPrompt={editingPrompt}
        loading={loading}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Master Prompts</h2>
          <p className="text-slate-600 mt-1">
            Manage all prompt templates for targets
          </p>
        </div>
        <Button
          onClick={openAddModal}
          className="bg-teal-600 hover:bg-teal-700 text-white"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" /> Add Prompt
        </Button>
      </div>

      {/* Search */}
      <Card className="shadow-lg border-0">
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search master prompts..."
              className="pl-10 border-slate-200 focus:border-teal-500 focus:ring-teal-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <p className="text-center animate-pulse text-gray-500">
            Fetching master prompts...
          </p>
        </div>
      ) : (
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-slate-800 flex items-center">
              <MessageSquare className="h-5 w-5 mr-2 text-teal-600" />
              Master Prompts ({filteredPrompts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 border-b">
                    <TableHead className="font-semibold text-slate-700">
                      Prompt Name
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700">
                      Max Score
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700">
                      Independent
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700">
                      DTT
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700">
                      TA
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700">
                      Maintenance
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700">
                      Status
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700 text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPrompts.map((item) => (
                    <TableRow
                      key={item.id}
                      className="hover:bg-slate-50 transition-colors border-b"
                    >
                      <TableCell className="p-4 font-medium text-slate-800">
                        {item.prompt_name}
                      </TableCell>
                      <TableCell className="p-4">
                        {item.max_score == null || item.max_score === ""
                          ? "—"
                          : item.max_score}
                      </TableCell>
                      <TableCell className="p-4">
                        {item.score_as_independent === "1" ||
                        item.score_as_independent === 1
                          ? "Yes"
                          : "No"}
                      </TableCell>
                      <TableCell className="p-4">
                        {item.dtt === "1" || item.dtt === 1 ? "Yes" : "No"}
                      </TableCell>
                      <TableCell className="p-4">
                        {item.ta === "1" || item.ta === 1 ? "Yes" : "No"}
                      </TableCell>
                      <TableCell className="p-4">
                        {item.maintenance === "1" || item.maintenance === 1
                          ? "Yes"
                          : "No"}
                      </TableCell>
                      <TableCell className="p-4">
                        <Badge className={getStatusColor(item.status)}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-slate-300 bg-transparent"
                            onClick={() => openEditModal(item)}
                            aria-label={`Edit ${item.prompt_name}`}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
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
                                onClick={() => openEditModal(item)}
                              >
                                <Edit className="h-4 w-4 mr-2" /> Edit Prompt
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeletePrompt(item.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                                Prompt
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {filteredPrompts.length === 0 && (
                <div className="text-center py-12">
                  <MessageSquare className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-500">
                    {allPrompts.length === 0
                      ? "No master prompts found."
                      : "No prompts match your search."}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
