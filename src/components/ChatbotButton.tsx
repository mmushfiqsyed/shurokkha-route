"use client";

import { FormEvent, useEffect, useState } from "react";

interface ChatbotButtonProps {
  onSubmit: (message: string) => void;
  loading: boolean;
}

interface Message {
  id: number;
  text: string;
  sender: "user" | "bot";
}

export default function ChatbotButton({ onSubmit, loading }: ChatbotButtonProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      sender: "bot",
      text: "Tell me about the disaster scenario you need help with.",
    },
  ]);

  useEffect(() => {
    if (!loading) return;
    setMessages((current) => {
      if (current.at(-1)?.text === "I am analyzing the scenario now...") return current;
      return [
        ...current,
        { id: Date.now(), sender: "bot", text: "I am analyzing the scenario now..." },
      ];
    });
  }, [loading]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setMessages((current) => [...current, { id: Date.now(), sender: "user", text }]);
    setInput("");
    onSubmit(text);
  }

  return (
    <div
      className={`fixed bottom-4 right-4 z-[1000] overflow-hidden shadow-2xl transition-[width,height,border-radius] duration-300 ${
        open
          ? "h-[25rem] w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-zinc-200 dark:border-zinc-700"
          : "h-10 w-[4.5rem] rounded-md border-0"
      }`}
    >
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open chat"
          className="h-full w-full cursor-pointer border-0 bg-green-600 px-4 text-sm font-medium text-white outline-none hover:bg-green-700 focus:outline-none focus:ring-0"
        >
          Chat
        </button>
      ) : (
        <div className="flex h-full w-full flex-col bg-white dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-900 px-4 py-3 text-white dark:border-zinc-700">
          <div>
            <p className="text-sm font-semibold">Shurokkha Assistant</p>
            <p className="text-[11px] text-zinc-400">Emergency route support</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close chat"
            className="flex h-7 w-7 items-center justify-center rounded-md text-lg text-zinc-300 cursor-pointer"
          >
            X
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-zinc-50 p-4 dark:bg-zinc-800">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <p
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                  message.sender === "user"
                    ? "rounded-br-md bg-green-600 text-white"
                    : "rounded-bl-md bg-white text-zinc-700 shadow-sm dark:bg-zinc-700 dark:text-zinc-200"
                }`}
              >
                {message.text}
              </p>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2 border-t border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Type a message..."
            disabled={loading}
            aria-label="Chat message"
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-zinc-800 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </div>
      )}
    </div>
  );
}