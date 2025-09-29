"use client";

import { configureStore } from "@reduxjs/toolkit";
import clientsReducer from "../store/clientSlice";
import usersReducer from "../store/usersSlice";

export const store = configureStore({
  reducer: {
    clients: clientsReducer,
    users: usersReducer, // Added here
  },
  devTools: process.env.NODE_ENV !== "production",
});

// Optionally export types if you later migrate to TS.
// For JS, you can still import store.dispatch directly where needed.
