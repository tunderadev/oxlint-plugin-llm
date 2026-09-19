import OpenAI from "openai";

const client = new OpenAI();

const res = await client.chat.completions.create({ model: "x", messages: [], stream: true });
export const first = res.choices[0];
