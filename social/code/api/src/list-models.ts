async function listModels() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    console.error("Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN in environment variables.");
    return;
  }

  console.log("Querying Cloudflare Workers AI for available models...");

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/models/search`,
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
        },
      }
    );
    const data = await response.json() as any;

    if (!data.success) {
      console.error("API Error:", JSON.stringify(data.errors, null, 2));
      return;
    }

    if (data.result) {
      console.log("Available Text Generation Models:");
      const textModels = data.result.filter((m: any) => m.task?.name === 'Text Generation');
      textModels.forEach((m: any) => {
        console.log(`- ${m.name} (${m.description || 'no description'})`);
      });
      console.log(`\nTotal text generation models: ${textModels.length}`);
    } else {
      console.log("No models returned. Full response:", data);
    }

  } catch (e) {
    console.error("Network/Fetch Error:", e);
  }
}

listModels();
