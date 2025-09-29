// app/store/usersSlice.js
"use client";

import { createSlice } from "@reduxjs/toolkit";

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

    const res = await fetch(`${baseUrl}/get-users.php`);
    if (!res.ok) throw new Error("Failed to fetch users");

    const json = await res.json();
    
    if (!json.success || !Array.isArray(json.users)) {
      throw new Error(json.message || 'Failed to fetch users');
    }

    // ✅ No complex formatting needed for users (simple table), so dispatch directly
    dispatch(setUsers(json.users));

  } catch (err) {
    console.error('Error fetching users:', err);
    dispatch(setUsersError(err.message));
  } finally {
    dispatch(setUsersLoading(false));
  }
};
