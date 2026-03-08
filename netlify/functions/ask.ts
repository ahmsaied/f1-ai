import { Handler } from "@netlify/functions";
import { DataAPIClient } from "@datastax/astra-db-ts";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const astraClient = new DataAPIClient(process.env.ASTRA_DB_TOKEN!);
const db = astraClient.db(process.env.ASTRA_DB_ENDPOINT!);
const collection = db.collection("f1gpt");

export const handler: Handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { question } = JSON.parse(event.body || "{}");

    if (!question || question.trim() === "") {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Question is required" }),
      };
    }

    // 1. Generate embedding for the question
    const embeddingRes = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: question,
    });
    const embedding = embeddingRes.data[0].embedding;

    // 2. Query Astra DB for relevant context
    const docs = await collection
      .find(null, { sort: { $vector: embedding }, limit: 10 })
      .toArray();

    const context = docs.map((d: any) => d.text).filter(Boolean);

    // 3. Generate answer with GPT-4o
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert Formula 1 analyst. Answer questions accurately using the context provided. Be concise but thorough. Format your answer in clear paragraphs. If the context doesn't contain enough information, use your general F1 knowledge.`,
        },
        {
          role: "user",
          content: `Context:\n${context.join("\n\n")}\n\nQuestion: ${question}`,
        },
      ],
    });

    const answer = response.choices[0].message.content;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ answer, sources: docs.map((d: any) => d.source).filter(Boolean) }),
    };
  } catch (err: any) {
    console.error("Error:", err);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message || "Internal server error" }),
    };
  }
};
