import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export const message = await client.messages.create({
  model: "claude-sonnet-5",
  messages: [{ role: "user", content: "Hi" }],
});
