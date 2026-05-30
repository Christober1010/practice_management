// app/store/usersSlice.js
"use client";

import { createSlice } from "@reduxjs/toolkit";
import { getMahaverseAuthHeaders } from "@/lib/api-auth";

/** Normalize API row so UI never treats MySQL string "0" as truthy for is_active; map alternate keys. */
export function normalizeUserRow(row) {
  if (!row || typeof row !== "object") return row;
  const rawActive = row.is_active;
  const isActive =
    rawActive === 1 || rawActive === true || rawActive === "1" ? 1 : 0;
  let role = row.role ?? row.Role ?? row.user_role ?? "";
  if (typeof role !== "string") role = String(role ?? "");
  return {
    ...row,
    id: row.id,
    email: row.email ?? "",
    role: role.trim(),
    first_name: row.first_name ?? row.firstName ?? "",
    last_name: row.last_name ?? row.lastName ?? "",
    is_active: isActive,
  };
}

const initialState = {
  items: [], // This will hold the users array
  loading: false,
  error: null,
};

const usersSlice = createSlice({
  name: "users",
  initialState,
  reducers: {
    setUsers(state, action) {
      state.items = action.payload; // This should be the users array
    },
    addUser(state, action) {
      state.items.push(action.payload);
    },
    updateUser(state, action) {
      const idx = state.items.findIndex((u) => u.id === action.payload.id);
      if (idx !== -1) state.items[idx] = action.payload;
    },
    deleteUser(state, action) {
      const id = action.payload; // Expecting payload to be the user ID
      state.items = state.items.filter((user) => user.id !== id);
    },
    toggleActive(state, action) {
      const { id, is_active } = action.payload;
      const idx = state.items.findIndex((u) => u.id === id);
      if (idx !== -1) {
        state.items[idx].is_active = is_active;
      }
    },
    setUsersLoading(state, action) {
      state.loading = action.payload;
    },
    setUsersError(state, action) {
      state.error = action.payload;
    },
  },
});

export const {
  setUsers,
  addUser,
  updateUser,
  deleteUser,
  toggleActive,
  setUsersLoading,
  setUsersError,
} = usersSlice.actions;

export default usersSlice.reducer;

// ✅ Thunk: fetch users from API
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
export const fetchUsers = () => async (dispatch) => {
  try {
    dispatch(setUsersLoading(true));
    dispatch(setUsersError(null));

    if (!baseUrl) {
      throw new Error("NEXT_PUBLIC_BASE_URL is not configured");
    }

    const res = await fetch(`${baseUrl}/get-users.php`, {
      headers: getMahaverseAuthHeaders(),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || `Failed to fetch users (${res.status})`);
    }

    const json = await res.json();

    if (!json.success || !Array.isArray(json.users)) {
      throw new Error(json.message || "Failed to fetch users");
    }

    dispatch(setUsers(json.users.map(normalizeUserRow)));
  } catch (err) {
    console.error("Error fetching users:", err);
    dispatch(setUsersError(err.message));
  } finally {
    dispatch(setUsersLoading(false));
  }
};
