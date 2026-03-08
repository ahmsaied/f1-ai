import { Handler } from "@netlify/functions";
import { DataAPIClient } from "@datastax/astra-db-ts";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const astraClient = new DataAPIClient(process.env.ASTRA_DB_TOKEN!);
const db = astraClient.db(process.env.ASTRA_DB_ENDPOINT!);

// F1 knowledge chunks to seed the DB with
const F1_DATA = [
  { text: "Formula One (F1) is the highest class of international racing for open-wheel single-seater formula racing cars sanctioned by the Fédération Internationale de l'Automobile (FIA). The World Drivers' Championship, which became the FIA Formula One World Championship in 1981, has been one of the premier forms of racing around the world since its inaugural season in 1950.", source: "f1-knowledge" },
  { text: "Max Verstappen is a Belgian-Dutch racing driver who competes in Formula One for Red Bull Racing. He is a four-time Formula One World Champion, having won the championship in 2021, 2022, 2023, and 2024.", source: "f1-knowledge" },
  { text: "George Russell is a British racing driver competing in Formula One for Mercedes. He won his first Formula One World Championship in 2025. Russell is known for his precise driving style and technical feedback.", source: "f1-knowledge" },
  { text: "Lewis Hamilton is a British racing driver who holds the record for most Formula One World Championship titles with seven, tied with Michael Schumacher. He also holds records for most wins, pole positions, and podium finishes.", source: "f1-knowledge" },
  { text: "The Qatar Grand Prix 2024 saw controversy between George Russell and Max Verstappen following an incident on track. Russell felt Verstappen's driving was dangerous while Verstappen defended his racing line. The dispute led to heated exchanges in the media and post-race interviews.", source: "f1-knowledge" },
  { text: "Formula One cars are the fastest regulated road-course racing cars in the world, owing to very high cornering speeds achieved through generating large amounts of aerodynamic downforce. The cars are powered by 1.6-litre turbocharged hybrid V6 engines.", source: "f1-knowledge" },
  { text: "The Formula One season consists of a series of races, known as Grands Prix, which take place worldwide on purpose-built circuits and public roads. Results of each race are evaluated using a points-based system to determine two annual World Championships: one for drivers and one for constructors.", source: "f1-knowledge" },
  { text: "Red Bull Racing is an Austrian Formula One racing team based in Milton Keynes, England. The team has won multiple Constructors' Championships and Drivers' Championships, most recently with Max Verstappen.", source: "f1-knowledge" },
  { text: "Mercedes-AMG Petronas Formula One Team is a German Formula One constructor. The team dominated Formula One from 2014 to 2021 winning eight consecutive Constructors' Championships. Lewis Hamilton won six of his seven titles with Mercedes.", source: "f1-knowledge" },
  { text: "Ferrari is an Italian luxury sports car manufacturer based in Maranello. Ferrari has been in Formula One since the inaugural 1950 season. Charles Leclerc and Carlos Sainz drove for Ferrari in 2024.", source: "f1-knowledge" },
  { text: "DRS (Drag Reduction System) is a system that reduces aerodynamic drag on a Formula One car by opening a flap on the rear wing. Drivers can use DRS only in designated DRS zones when they are within one second of the car ahead.", source: "f1-knowledge" },
  { text: "Tyre strategy is crucial in Formula One. Teams choose between different tyre compounds: Soft (fastest but wears quickly), Medium, and Hard. Pit stop timing and tyre management can often decide race outcomes.", source: "f1-knowledge" },
  { text: "The Monaco Grand Prix is considered one of the most prestigious and challenging races in Formula One. Held on the Circuit de Monaco, it features narrow streets, tight corners, and little room for overtaking.", source: "f1-knowledge" },
  { text: "Carlos Sainz Jr. is a Spanish racing driver. He raced for Ferrari from 2021 to 2024 and won the 2024 Australian Grand Prix. He joined Williams Racing for the 2025 season.", source: "f1-knowledge" },
  { text: "Charles Leclerc is a Monégasque racing driver competing in Formula One for Ferrari. He is known for his exceptional qualifying pace and has achieved multiple pole positions throughout his career.", source: "f1-knowledge" },
  { text: "Lando Norris is a British racing driver competing for McLaren in Formula One. He secured his first race win at the 2024 Miami Grand Prix and has been a consistent frontrunner in the 2024 season.", source: "f1-knowledge" },
  { text: "McLaren Racing is a British Formula One constructor based in Woking, England. McLaren had a dominant era in the late 1980s and early 1990s with drivers like Ayrton Senna and Alain Prost, winning multiple championships.", source: "f1-knowledge" },
  { text: "Safety Car periods in Formula One occur when there is a crash or dangerous conditions on track. All cars must slow down and follow the Safety Car, maintaining position. This often dramatically affects race strategy.", source: "f1-knowledge" },
];

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS" },
      body: "",
    };
  }

  // Simple auth check via secret header
  const secret = event.headers["x-ingest-secret"];
  if (secret !== process.env.INGEST_SECRET) {
    return { statusCode: 401, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  try {
    // Create collection
    try {
      await db.createCollection("f1gpt", {
        vector: { dimension: 1536, metric: "dot_product" }
      });
    } catch (e: any) {
      if (!e?.message?.includes("already exists")) throw e;
    }

    const collection = db.collection("f1gpt");

    // Generate embeddings and upload
    const chunks = await Promise.all(
      F1_DATA.map(async (item) => {
        const embeddingRes = await openai.embeddings.create({
          model: "text-embedding-ada-002",
          input: item.text,
        });
        return {
          $vector: embeddingRes.data[0].embedding,
          text: item.text,
          source: item.source,
        };
      })
    );

    await collection.insertMany(chunks as any);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: true, inserted: chunks.length }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
