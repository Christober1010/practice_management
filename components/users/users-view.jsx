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
  Users,
  Plus,
  Search,
  Edit,
  Archive,
  ArchiveRestore,
  Eye,
  EyeOff,
  MoreVertical,
  Trash,
  User,
} from "lucide-react";
import AddUserModal from "./add-users"; // See below
import { toast, Toaster } from "react-hot-toast";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks"; // Assuming your Redux hooks
import {
  addUser,
  updateUser,
  toggleActive,
  deleteUser,
  fetchUsers,
  setUsersLoading,
  setUsersError,
} from "@/app/store/usersSlice";

export default function UsersView() {
  // UI-only state
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [showInactive, setShowInactive] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [expandedUser, setExpandedUser] = useState(null);

  // Redux
  const dispatch = useAppDispatch();
  const users = useAppSelector((state) => state.users.items);
  const loading = useAppSelector((state) => state.users.loading);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  const activeUserCount = useMemo(
    () => users.filter((u) => u.is_active).length,
    [users]
  );
  const inactiveUserCount = useMemo(
    () => users.filter((u) => !u.is_active).length,
    [users]
  );

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch = Object.values(user).some((value) =>
        typeof value === "string"
          ? value.toLowerCase().includes(searchTerm.toLowerCase())
          : false
      );
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesActive = user.is_active ? !showInactive : showInactive;
      return matchesSearch && matchesRole && matchesActive;
    });
  }, [users, searchTerm, roleFilter, showInactive]);

  const handleAddUser = async (userData) => {
    try {
      const res = await fetch(`${baseUrl}/update-users.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      });
      const result = await res.json();
      if (result.success) {
        dispatch(addUser(userData));
        setIsAddModalOpen(false);
        toast.success("User added successfully!");
      } else {
        toast.error(`Failed to add user: ${result.message}`);
      }
    } catch (err) {
      console.error("Error adding user:", err);
      toast.error("An error occurred while adding the user.");
    }
  };

  const handleEditUser = async (userData) => {
    try {
      const res = await fetch(`${baseUrl}/update-users.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      });
      const result = await res.json();
      if (result.success) {
        dispatch(updateUser(userData));
        setEditingUser(null);
        toast.success("User updated successfully!");
      } else {
        toast.error(`Failed to update user: ${result.message}`);
      }
    } catch (err) {
      console.error("Error updating user:", err);
      toast.error("An error occurred while updating the user.");
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      const res = await fetch(`${baseUrl}/delete-user.php`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId }),
      });
      const result = await res.json();
      if (result.success) {
        dispatch(deleteUser(userId));
        toast.success("User deleted successfully!");
      } else {
        toast.error(`Failed to delete user: ${result.message}`);
      }
    } catch (err) {
      console.error("Error deleting user:", err);
      toast.error("An error occurred while deleting the user.");
    }
  };

  const handleToggleActive = async (userId) => {
    const userToUpdate = users.find((u) => u.id === userId);
    if (!userToUpdate) return;
    const updatedUser = {
      ...userToUpdate,
      is_active: userToUpdate.is_active ? 0 : 1,
    };
    try {
      const res = await fetch(`${baseUrl}/update-users.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedUser),
      });
      const result = await res.json();
      if (result.success) {
        dispatch(
          toggleActive({ id: userId, is_active: updatedUser.is_active })
        );
        toast.success(
          updatedUser.is_active ? "User activated!" : "User deactivated!"
        );
      } else {
        toast.error(`Failed to update user: ${result.message}`);
      }
    } catch (err) {
      console.error("Error toggling user active status:", err);
      toast.error("An error occurred while updating user status.");
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case "admin":
        return "bg-blue-100 text-blue-800";
      case "bcba":
        return "bg-green-100 text-green-800";
      case "rbt":
        return "bg-yellow-100 text-yellow-800";
      case "parent":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  useEffect(() => {
    dispatch(fetchUsers());
  }, [dispatch]);

  const toggleExpanded = (userId) => {
    setExpandedUser((prev) => (prev === userId ? null : userId));
  };

  return (
    <div className="space-y-8 px-2 sm:px-0 md:px-6">
      <Toaster />
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row lg:justify-between sm:justify-center sm:items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">User Management</h2>
          <p className="text-slate-600 mt-1">Manage user profiles and roles</p>
        </div>
        <div className="flex flex-row flex-wrap gap-2 sm:items-center sm:space-x-3 sm:justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowInactive(!showInactive)}
            className="border-slate-300"
          >
            {showInactive ? (
              <ArchiveRestore className="h-4 w-4 mr-2" />
            ) : (
              <Archive className="h-4 w-4 mr-2" />
            )}
            Show{" "}
            {showInactive
              ? `Active (${activeUserCount})`
              : `Inactive (${inactiveUserCount})`}
          </Button>
          <Button
            onClick={() => setIsAddModalOpen(true)}
            size="sm"
            className="bg-teal-600 hover:bg-teal-700 shadow-lg"
          >
            <Plus className="h-4 w-4 mr-2" /> Add User
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
                placeholder="Search all user fields..."
                className="pl-10 border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-48 border-slate-200">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="bcba">BCBA</SelectItem>
                <SelectItem value="rbt">RBT</SelectItem>
                <SelectItem value="parent">Parent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      {loading ? (
        <div className="h-64 w-64 mx-auto">
          <p className="text-center animate-pulse text-gray-500">
            Fetching users...
          </p>
          {/* Add loader SVG or spinner if needed */}
        </div>
      ) : (
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-slate-800 flex items-center">
              <Users className="h-5 w-5 mr-2 text-teal-600" />
              {showInactive ? "Inactive" : "Active"} Users (
              {filteredUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 border-b">
                    <TableHead className="font-semibold text-slate-700">
                      User
                    </TableHead>
                    <TableHead className="hidden sm:table-cell font-semibold text-slate-700">
                      Email
                    </TableHead>
                    <TableHead className="hidden sm:table-cell font-semibold text-slate-700">
                      Role
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700 lg:text-center text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => {
                    const isExpanded = expandedUser === user.id;
                    return (
                      <Fragment key={user.id}>
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
                                <div className="font-semibold text-slate-800">
                                  {user.first_name} {user.last_name}
                                </div>
                                <div className="lg:hidden sm:hidden flex flex-wrap gap-1 mt-1">
                                  {!user.is_active && (
                                    <Badge
                                      variant="outline"
                                      className="border-amber-300 text-amber-700 text-xs"
                                    >
                                      Inactive
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell py-4">
                            <span className="font-mono text-sm">
                              {user.email}
                            </span>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell py-4 capitalize">
                            <Badge className={getRoleColor(user.role)}>
                              {["bcba", "rbt"].includes(user.role)
                                ? user.role.toUpperCase()
                                : user.role}{" "}
                            </Badge>{" "}
                          </TableCell>
                          
                          
                          <TableCell className="py-4">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => toggleExpanded(user.id)}
                                className="border-slate-300"
                              >
                                {isExpanded ? (
                                  <EyeOff className="h-3 w-3 mr-1" />
                                ) : (
                                  <Eye className="h-3 w-3 mr-1" />
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingUser(user);
                                  setIsAddModalOpen(true);
                                }}
                                className="border-slate-300"
                              >
                                <Edit className="h-4 w-4 mr-2" />
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
                                    onClick={() => handleToggleActive(user.id)}
                                    className={
                                      user.is_active
                                        ? "text-amber-600"
                                        : "text-green-600"
                                    }
                                  >
                                    {user.is_active ? (
                                      <Archive className="h-4 w-4 mr-2" />
                                    ) : (
                                      <ArchiveRestore className="h-4 w-4 mr-2" />
                                    )}
                                    {user.is_active ? "Deactivate" : "Activate"}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  {/* <DropdownMenuItem
                                    onClick={() => handleDeleteUser(user.id)}
                                    className="text-red-600"
                                  >
                                    <Trash className="h-4 w-4 mr-2" /> Delete
                                  </DropdownMenuItem> */}
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
                                {/* User Details Card */}
                                <Card className="border-slate-200">
                                  <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                      <User className="h-4 w-4 text-teal-600" />{" "}
                                      User Details
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-3 text-sm">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      <div>
                                        <p className="text-slate-500 mb-1">
                                          Email
                                        </p>
                                        <p className="font-medium">
                                          {user.email || "N/A"}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 mb-1">
                                          Role
                                        </p>
                                        <Badge
                                          className={getRoleColor(user.role)}
                                        >
                                          {user.role.toUpperCase()}
                                        </Badge>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 mb-1">
                                          First Name
                                        </p>
                                        <p className="font-medium">
                                          {user.first_name || "N/A"}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 mb-1">
                                          Last Name
                                        </p>
                                        <p className="font-medium">
                                          {user.last_name || "N/A"}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 mb-1">
                                          Status
                                        </p>
                                        <Badge
                                          className={
                                            user.is_active
                                              ? "bg-green-100 text-green-800"
                                              : "bg-amber-100 text-amber-800"
                                          }
                                        >
                                          {user.is_active
                                            ? "Active"
                                            : "Inactive"}
                                        </Badge>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 mb-1">
                                          Created At
                                        </p>
                                        <p className="font-medium">
                                          {new Date(
                                            user.created_at
                                          ).toLocaleString() || "N/A"}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500 mb-1">
                                          Updated At
                                        </p>
                                        <p className="font-medium">
                                          {new Date(
                                            user.updated_at
                                          ).toLocaleString() || "N/A"}
                                        </p>
                                      </div>
                                    </div>
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
              {filteredUsers.length === 0 && (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-500">
                    {showInactive
                      ? "No inactive users found."
                      : "No users match your search."}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Modal */}
      <AddUserModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingUser(null);
        }}
        onSave={editingUser ? handleEditUser : handleAddUser}
        editingUser={editingUser}
      />
    </div>
  );
}
