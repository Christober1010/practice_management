// utils/fetchClients.js
export async function fetchClientsUtil() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
  const res = await fetch(`${baseUrl}/get-clients.php`)
  const json = await res.json()

  if (!json.success || !Array.isArray(json.clients)) {
    throw new Error(json.message || 'Failed to fetch clients')
  }

  return json.clients.map((client) => {
    const insurances = Array.isArray(client.insurances) ? client.insurances : []
    const authorizations = Array.isArray(client.authorizations)
      ? client.authorizations.map((auth) => {
          let index = ''
          if (insurances.length && auth.insurance_id) {
            index = insurances.findIndex(
              (ins) => String(ins.insurance_id) === String(auth.insurance_id),
            )
            index = index === -1 ? '' : String(index)
          }
          const approved = Number.parseFloat(auth.units_approved_per_15_min) || 0
          const serviced = Number.parseFloat(auth.units_serviced) || 0
          const balance = approved - serviced
          return {
            ...auth,
            insurance_id: index,
            units_serviced: auth.units_serviced || '',
            balance_units: balance.toString(),
          }
        })
      : []
    const documents = Array.isArray(client.documents) ? client.documents : []

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
    }
  })
}
