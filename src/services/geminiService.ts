import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface DetectionResult {
  status: 'healthy' | 'diseased';
  diseaseName: string;
  confidence: number;
  recommendations: string;
}

export async function detectCropDisease(imageState: string, cropType: string): Promise<DetectionResult> {
  const systemInstruction = `You are an expert plant pathologist specializing in ${cropType}. 
  Analyze the provided image and determine if the crop is healthy or has a disease.
  Provide your response in strict JSON format.
  
  Expected Output Schema:
  {
    "status": "healthy" | "diseased",
    "diseaseName": string,
    "confidence": number,
    "recommendations": string
  }
  
  If healthy, diseaseName should be "None". Recommendations should be brief advice for maintaining health.
  If diseased, provide the specific disease name and actionable advice for the farmer.
  Your accuracy must be above 82%.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          { inlineData: { data: imageState.split(',')[1], mimeType: "image/jpeg" } },
          { text: `Detect disease in this ${cropType} crop.` }
        ]
      }
    ],
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          status: { type: Type.STRING, enum: ["healthy", "diseased"] },
          diseaseName: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          recommendations: { type: Type.STRING }
        },
        required: ["status", "diseaseName", "confidence", "recommendations"]
      }
    }
  });

  try {
    return JSON.parse(response.text) as DetectionResult;
  } catch (e) {
    console.error("Failed to parse AI response", e);
    throw new Error("AI analysis failed to produce a valid result.");
  }
}

export async function getChatAdvisorResponse(history: { role: 'user' | 'model', parts: { text: string }[] }[], prompt: string, language: string) {
  const systemInstruction = `You are CropGuard AI Advisor, an agricultural expert. 
  Help farmers with their crops: potato, tomato, strawberry, blueberry, orange, and corn.
  Language preference: ${language === 'ur' ? 'Urdu' : 'English'}.
  If the user asks in Urdu, respond in Urdu. If they ask in English, respond in English.
  Be concise, practical, and supportive. Use Markdown for formatting.`;

  const chat = ai.chats.create({
    model: "gemini-3-flash-preview",
    config: { systemInstruction },
    history: history
  });

  const response = await chat.sendMessage({
    message: prompt
  });

  return response.text;
}
