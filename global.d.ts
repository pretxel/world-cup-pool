import type messages from "./messages/en.json";

declare global {
  type IntlMessages = typeof messages;
}
