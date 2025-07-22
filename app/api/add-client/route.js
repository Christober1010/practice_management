// app/api/add-client/route.js

export async function POST(req) {
  try {
    const body = await req.json();

    const response = await fetch("https://mahabehavioralhealth.com/api/add-client.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();

    let json;
    try {
      json = JSON.parse(responseText);
    } catch {
      json = { raw: responseText };
    }

    return new Response(JSON.stringify(json), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Proxy error:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
