import { registerPlugin } from "@capacitor/core";

export interface SendIntentResult {
  title?: string;
  description?: string;
  type?: string;
  url?: string;
  additionalItems?: Array<{ title?: string; description?: string; type?: string; url?: string }>;
}

export interface SendIntentPlugin {
  checkSendIntentReceived(): Promise<SendIntentResult>;
  finish(): Promise<void>;
}

export const SendIntent = registerPlugin<SendIntentPlugin>("SendIntent", {
  web: () => ({
    async checkSendIntentReceived() {
      return {} as SendIntentResult;
    },
    async finish() {
      /* no-op on web */
    },
  }),
});
