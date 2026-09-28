// Stub: facility types were previously loaded from Mahaverse.
// Standalone Launchpad uses a static list so LocationStep does not depend on Mahaverse.
export async function mahaverseFetch(_path: string): Promise<Response> {
  const body = JSON.stringify({
    success: true,
    data: [
      { id: 1, name: 'Office', code: 'office' },
      { id: 2, name: 'Home', code: 'home' },
      { id: 3, name: 'School', code: 'school' },
      { id: 4, name: 'Community', code: 'community' },
      { id: 5, name: 'Telehealth', code: 'telehealth' },
    ],
  });
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
