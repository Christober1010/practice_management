import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

const initialState = {
  items: {
    modules: [],
    domains: [],
    programs: [],
    activities: [],
    prompts: [], // This stores the master prompts list (allPrompts from API)
  },
  loading: false,
  error: null,
};

export const fetchPrograms = createAsyncThunk(
  "programs/fetchPrograms",
  async (_, { rejectWithValue }) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
      const response = await fetch(`${baseUrl}/programs.php`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      const result = await response.json();
      console.log("[fetchPrograms] API response:", result);

      if (result.success) {
        // Normalize field names from database to frontend format
        const normalizeModules = (modules) =>
          modules.map((m) => ({
            ...m,
            name: m.NAME || m.name,
            status: m.STATUS || m.status,
            archived: parseInt(m.archived) || 0,
          }));

        const normalizeDomains = (domains) =>
          domains.map((d) => ({
            ...d,
            moduleId: d.module_id || d.moduleId || d.MODULE_ID,
            name: d.NAME || d.name,
            status: d.STATUS || d.status,
            archived: parseInt(d.archived) || 0,
          }));

        const normalizePrograms = (programs) =>
          programs.map((p) => ({
            ...p,
            domainId: p.domain_id || p.domainId,
            name: p.NAME || p.name,
            status: p.STATUS || p.status,
            archived: parseInt(p.archived) || 0,
          }));

        const normalizeActivities = (activities) =>
          activities.map((a) => ({
            ...a,
            programId: a.program_id || a.programId,
            name: a.NAME || a.name,
            goalDescription: a.goal_description || a.goalDescription,
            activityType: a.activity_type || a.activityType,
            status: a.STATUS || a.status,
            archived: parseInt(a.archived) || 0,
            trials: parseInt(a.trials) || 1,
            prompts: a.prompts || [],
            tasks: a.tasks || [],
          }));

        const normalizePrompts = (prompts) =>
          prompts.map((p) => ({
            ...p,
            targetId: p.target_id || p.targetId,
            promptText: p.prompt_text || p.promptText,
            promptOrder: p.prompt_order || p.promptOrder,
            status: p.STATUS || p.status,
          }));

        return {
          modules: normalizeModules(result.data.modules || []),
          domains: normalizeDomains(result.data.domains || []),
          programs: normalizePrograms(result.data.programs || []),
          activities: normalizeActivities(result.data.activities || []),
          prompts: normalizePrompts(result.data.allPrompts || []),
        };
      } else {
        return rejectWithValue(result.message || "Failed to fetch programs");
      }
    } catch (error) {
      console.error("[fetchPrograms] Error:", error);
      return rejectWithValue(error?.message || "Unknown error");
    }
  }
);

const programSlice = createSlice({
  name: "programs",
  initialState,
  reducers: {
    addProgramStructure(state, action) {
      // Ensure items exists
      if (!state.items) {
        state.items = {
          modules: [],
          domains: [],
          programs: [],
          activities: [],
          prompts: [],
        };
      }

      const {
        modules = [],
        domains = [],
        programs = [],
        activities = [],
        prompts = [],
      } = action.payload || {};

      // Add new items to existing arrays
      state.items.modules.push(...modules);
      state.items.domains.push(...domains);
      state.items.programs.push(...programs);
      state.items.activities.push(...activities);
      state.items.prompts.push(...prompts);
    },

    updateProgramStructure(state, action) {
      if (!state.items) return;

      const { modules, domains, programs, activities, prompts } =
        action.payload || {};

      // Helper function to update items in a list
      const updateList = (list, updates) => {
        if (!updates || !Array.isArray(updates)) return;
        updates.forEach((item) => {
          const index = list.findIndex((i) => i.id === item.id);
          if (index !== -1) {
            // Merge the updates with existing item
            list[index] = { ...list[index], ...item };
          }
        });
      };

      // Update each type of item
      updateList(state.items.modules, modules);
      updateList(state.items.domains, domains);
      updateList(state.items.programs, programs);
      updateList(state.items.activities, activities);
      updateList(state.items.prompts, prompts);
    },

    toggleArchiveProgram(state, action) {
  if (!state.items || !state.items.programs) return;

  const { programId, archived, status } = action.payload;
  const program = state.items.programs.find((p) => p.id === programId);

  if (program) {
    program.archived = archived;
    program.status = status;
  }
},


    toggleArchiveDomain(state, action) {
      if (!state.items || !state.items.domains) return;

      const { domainId, archived, status } = action.payload;
      const domain = state.items.domains.find((d) => d.id === domainId);

      if (domain) {
        domain.archived = archived;
        domain.status = status;
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
        // Directly replace the items with the fetched data
        state.items = {
          modules: action.payload.modules || [],
          domains: action.payload.domains || [],
          programs: action.payload.programs || [],
          activities: action.payload.activities || [],
          prompts: action.payload.prompts || [],
        };
        console.log("[fetchPrograms.fulfilled] State updated:", state.items);
      })
      .addCase(fetchPrograms.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.payload ?? action.error?.message ?? "Failed to fetch programs";
        console.error("[fetchPrograms.rejected] Error:", state.error);
      });
  },
});

export const {
  addProgramStructure,
  updateProgramStructure,
  toggleArchiveProgram,
  toggleArchiveDomain,
} = programSlice.actions;

export default programSlice.reducer;
