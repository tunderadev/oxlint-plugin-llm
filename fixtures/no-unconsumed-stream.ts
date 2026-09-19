import { streamText } from "ai";

export async function POST() {
  streamText({ model: "x", prompt: "Hi" });
  return new Response("ok");
}
