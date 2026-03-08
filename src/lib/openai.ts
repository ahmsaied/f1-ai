import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function generateEmbedding(text: string) {
  const embedding = await client.embeddings.create({
    model: "text-embedding-ada-002",
    input: text
  });
  return embedding;
}

export async function generateResponse(question: string, context: string[]) {
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are an expert Formula 1 analyst. Answer questions accurately using the context provided. Be concise but thorough. If the context doesn't contain enough information, use your general F1 knowledge.`
      },
      {
        role: "user",
        content: `Context:\n${context.join('\n\n')}\n\nQuestion: ${question}`
      }
    ]
  });
  return response.choices[0].message.content;
}
