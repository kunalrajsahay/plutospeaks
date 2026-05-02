import OpenAI from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    const response = await client.responses.create({
      model: "gpt-4.1-mini", // safest working model
      input: `You are PlutoSpeaks 🚀, a friendly AI assistant. Reply short and engaging.\nUser: ${message}`,
    });

    return NextResponse.json({
      reply: response.output_text,
    });
  } catch (error: any) {
    console.error("🔥 OpenAI Error:", error);

    return NextResponse.json({
      reply: "⚠️ Pluto is having trouble connecting to AI...",
    });
  }
}