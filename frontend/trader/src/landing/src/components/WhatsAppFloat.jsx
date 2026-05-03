import { MessageCircle } from "lucide-react";
import { EXTERNAL } from "@/lib/forexData";

export function WhatsAppFloat() {
  return (
    <a
      href={EXTERNAL.whatsapp}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-5 right-5 z-50 size-14 rounded-full liquid-glass-strong flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
    >
      <MessageCircle className="size-6 text-emerald-400" />
    </a>
  );
}
