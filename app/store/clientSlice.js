// store/clientsSlice.js
"use client";

import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  items: [], // This will hold the formatted clients array
  loading: false,
  error: null,
};

const clientsSlice = createSlice({
  name: "clients",
  initialState,
  reducers: {
    setClients(state, action) {
      state.items = action.payload; // This should be the formatted clients array
    },
    addClient(state, action) {
      state.items.push(action.payload);
    },
    updateClient(state, action) {
      const idx = state.items.findIndex((c) => c.id === action.payload.id);
      if (idx !== -1) state.items[idx] = action.payload;
    },
    toggleArchive(state, action) {
      const { id, archived, client_status } = action.payload;
      const idx = state.items.findIndex((c) => c.id === id);
      if (idx !== -1) {
        state.items[idx].archived = archived;
        if (client_status) state.items[idx].client_status = client_status;
      }
    },
    setClientsLoading(state, action) {
      state.loading = action.payload;
    },
    setClientsError(state, action) {
      state.error = action.payload;
    },
  },
});

export const {
  setClients,
  addClient,
  updateClient,
  toggleArchive,
  setClientsLoading,
  setClientsError,
} = clientsSlice.actions;

// ✅ Helper function to format client data
const formatClientData = (client) => {
  const insurances = Array.isArray(client.insurances) ? client.insurances : [];
  const authorizations = Array.isArray(client.authorizations)
    ? client.authorizations.map((auth) => {
        let index = '';
        if (insurances.length && auth.insurance_id) {
          index = insurances.findIndex(
            (ins) => String(ins.insurance_id) === String(auth.insurance_id)
          );
          index = index === -1 ? '' : String(index);
        }
        const approved = Number.parseFloat(auth.units_approved_per_15_min) || 0;
        const serviced = Number.parseFloat(auth.units_serviced) || 0;
        const balance = approved - serviced;
        return {
          ...auth,
          insurance_id: index,
          units_serviced: auth.units_serviced || '',
          balance_units: balance.toString(),
        };
      })
    : [];
  const documents = Array.isArray(client.documents) ? client.documents : [];

  return {
    ...client,
    id: client.client_id || client.id,
    client_id: client.client_id || client.id,
    first_name: client.first_name || client.firstName || '',
    last_name: client.last_name || client.lastName || '',
    date_of_birth: client.date_of_birth?.slice(0, 10) || '',
    client_status: client.client_status || client.STATUS || 'Active',
    archived: client.archived == 1,
    insurances,
    authorizations,
    documents,
    relationship_to_insured: client.relationship_to_insured || '',
    relation_other: client.relation_other || '',
    appointment_reminder: client.appointment_reminder || '',
  };
};

// ✅ Thunk: fetch clients from API with proper data transformation
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
export const fetchClients = () => async (dispatch) => {
  try {
    dispatch(setClientsLoading(true));
    dispatch(setClientsError(null));

    const res = await fetch(`${baseUrl}/get-clients.php`);
    if (!res.ok) throw new Error("Failed to fetch clients");

    const json = await res.json();
    
    if (!json.success || !Array.isArray(json.clients)) {
      throw new Error(json.message || 'Failed to fetch clients');
    }

    // ✅ Transform the data before dispatching
    const formattedClients = json.clients.map(formatClientData);
    dispatch(setClients(formattedClients));

  } catch (err) {
    console.error('Error fetching clients:', err);
    dispatch(setClientsError(err.message));
  } finally {
    dispatch(setClientsLoading(false));
  }
};

export default clientsSlice.reducer;