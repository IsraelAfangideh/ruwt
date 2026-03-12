/** Health check endpoint */
export async function onRequestGet() {
  return new Response(JSON.stringify({ status: 'ok', service: 'ruwt-health' }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
