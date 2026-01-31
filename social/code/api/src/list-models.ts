async function listModels() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    console.error("No API key found in environment variables.");
    return;
  }

  console.log("🔍 Querying Google AI API for available models...");
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    
    if (data.error) {
      console.error("❌ API Error:", JSON.stringify(data.error, null, 2));
      return;
    }

    if (data.models) {
      console.log("✅ Available Models:");
      data.models.forEach((m: any) => {
        // Filter for models that support 'generateContent' which is what we need for chat
        if (m.supportedGenerationMethods?.includes('generateContent')) {
           console.log(`- ${m.name} (${m.displayName})`);
        }
      });
    } else {
      console.log("⚠️ No models returned. Full response:", data);
    }

  } catch (e) {
    console.error("❌ Network/Fetch Error:", e);
  }
}

listModels();

