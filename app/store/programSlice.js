// app/store/programSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

export const fetchPrograms = createAsyncThunk(
  "programs/fetchPrograms",
  async () => {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"; // Fallback URL
    const response = await fetch(`${baseUrl}/programs.php`);
    const result = await response.json();
    if (result.success) {
      return result.data; // Expected: { modules, domains, programs, activities }
    }
    throw new Error(result.message || "Failed to fetch programs");
  }
);

const programSlice = createSlice({
  name: "programs",
  initialState: {
    items: { modules: [], domains: [], programs: [], activities: [] },
    loading: false,
    error: null,
  },
  reducers: {
    addProgramStructure(state, action) {
      state.items.modules.push(...action.payload.modules);
      state.items.domains.push(...action.payload.domains);
      state.items.programs.push(...action.payload.programs);
      state.items.activities.push(...action.payload.activities);
    },
    updateProgramStructure(state, action) {
      const { modules, domains, programs, activities } = action.payload;
      state.items.modules = state.items.modules.map(
        (m) => modules.find((newM) => newM.id === m.id) || m
      );
      state.items.domains = state.items.domains.map(
        (d) => domains.find((newD) => newD.id === d.id) || d
      );
      state.items.programs = state.items.programs.map(
        (p) => programs.find((newP) => newP.id === p.id) || p
      );
      state.items.activities = state.items.activities.map(
        (a) => activities.find((newA) => newA.id === a.id) || a
      );
    },
    toggleArchiveProgram(state, action) {
      const { moduleId, archived, status } = action.payload;
      const module = state.items.modules.find((m) => m.id === moduleId);
      if (module) {
        module.archived = archived;
        module.status = status;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPrograms.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPrograms.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchPrograms.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  },
});

export const {
  addProgramStructure,
  updateProgramStructure,
  toggleArchiveProgram,
} = programSlice.actions;
export default programSlice.reducer;
