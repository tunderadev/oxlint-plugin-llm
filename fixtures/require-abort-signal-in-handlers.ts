import { streamText } from "ai";

export async function POST(req: Request) {
  const { messages } = await req.json();
  return streamText({ model: "x", messages });
}
