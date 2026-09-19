import { generateText, streamText } from "ai";

export const text = await generateText({ model: "x", system: "Be brief.", maxTokens: 200 });

const result = streamText({ model: "x", prompt: "Hi" });
export const parts = result.fullStream;
