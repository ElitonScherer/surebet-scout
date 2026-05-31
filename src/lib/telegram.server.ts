import { createServerFn } from "@tanstack/react-start";

export const sendTelegramMessage = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; chatId: string; message: string }) => ({
    token: String(input.token).trim(),
    chatId: String(input.chatId).trim(),
    message: String(input.message),
  }))
  .handler(async ({ data }) => {
    if (!data.token || !data.chatId) {
      throw new Error("Token e Chat ID são obrigatórios.");
    }
    const url = `https://api.telegram.org/bot${data.token}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: data.chatId,
        text: data.message,
        parse_mode: "HTML",
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Telegram API: ${body.slice(0, 300)}`);
    }
    return { ok: true };
  });
