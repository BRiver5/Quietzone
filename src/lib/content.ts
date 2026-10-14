// Что именно кодируется: поля формы → строка полезной нагрузки по
// соглашениям, которые понимают камеры телефонов (WIFI:, MECARD:, SMSTO: …).
// Экранирование обязательно: точка с запятой в пароле Wi-Fi без "\;"
// обрезает пароль, и код "читается", но не подключается.

export type ContentType = "url" | "text" | "wifi" | "contact" | "email" | "phone" | "sms";

export type Fields = Record<string, string>;

export const CONTENT_LABELS: Record<ContentType, string> = {
  url: "Link",
  text: "Text",
  wifi: "Wi-Fi",
  contact: "Contact",
  email: "Email",
  phone: "Phone",
  sms: "SMS",
};

export const CONTENT_FIELDS: Record<ContentType, { key: string; label: string; placeholder: string; multiline?: boolean; secure?: boolean }[]> = {
  url: [{ key: "url", label: "Link", placeholder: "https://example.com" }],
  text: [{ key: "text", label: "Text", placeholder: "Anything you like", multiline: true }],
  wifi: [
    { key: "ssid", label: "Network name", placeholder: "Home" },
    { key: "password", label: "Password", placeholder: "Leave empty for an open network", secure: true },
    { key: "security", label: "Security", placeholder: "WPA" },
  ],
  contact: [
    { key: "name", label: "Name", placeholder: "Alex Doe" },
    { key: "phone", label: "Phone", placeholder: "+1 555 0100" },
    { key: "email", label: "Email", placeholder: "alex@example.com" },
    { key: "org", label: "Company", placeholder: "Optional" },
  ],
  email: [
    { key: "to", label: "To", placeholder: "hello@example.com" },
    { key: "subject", label: "Subject", placeholder: "Optional" },
  ],
  phone: [{ key: "number", label: "Number", placeholder: "+1 555 0100" }],
  sms: [
    { key: "number", label: "Number", placeholder: "+1 555 0100" },
    { key: "message", label: "Message", placeholder: "Optional", multiline: true },
  ],
};

// Экранирование для WIFI: и MECARD: — \ ; , : " получают обратный слэш.
export function escapeMeta(s: string): string {
  return s.replace(/([\\;,:"])/g, "\\$1");
}

export function buildPayload(type: ContentType, f: Fields): string {
  const v = (k: string) => (f[k] ?? "").trim();
  switch (type) {
    case "url": {
      const u = v("url");
      if (!u) return "";
      return /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : `https://${u}`;
    }
    case "text":
      return f.text ?? "";
    case "wifi": {
      if (!v("ssid")) return "";
      const pass = f.password ?? "";
      const sec = pass ? (v("security").toUpperCase() || "WPA") : "nopass";
      return `WIFI:T:${sec};S:${escapeMeta(v("ssid"))};${pass ? `P:${escapeMeta(pass)};` : ""};`;
    }
    case "contact": {
      if (!v("name") && !v("phone") && !v("email")) return "";
      const parts = [`N:${escapeMeta(v("name"))}`];
      if (v("phone")) parts.push(`TEL:${escapeMeta(v("phone").replace(/[^\d+]/g, ""))}`);
      if (v("email")) parts.push(`EMAIL:${escapeMeta(v("email"))}`);
      if (v("org")) parts.push(`ORG:${escapeMeta(v("org"))}`);
      return `MECARD:${parts.join(";")};;`;
    }
    case "email": {
      if (!v("to")) return "";
      return v("subject") ? `mailto:${v("to")}?subject=${encodeURIComponent(v("subject"))}` : `mailto:${v("to")}`;
    }
    case "phone":
      return v("number") ? `tel:${v("number").replace(/[^\d+]/g, "")}` : "";
    case "sms":
      return v("number") ? `SMSTO:${v("number").replace(/[^\d+]/g, "")}:${f.message ?? ""}` : "";
  }
}

// Ссылки, у которых схема и хост в верхнем регистре, кодируются в
// буквенно-цифровом режиме заметно короче — но только если сайт не
// чувствителен к регистру пути. Это подсказка, а не автозамена.
export function upperCaseSavings(payload: string): { upper: string; safe: boolean } | null {
  const m = payload.match(/^(https?:\/\/[^/?#]+)(.*)$/i);
  if (!m) return null;
  return { upper: m[1].toUpperCase() + m[2], safe: m[2] === "" || m[2] === "/" };
}

export function summary(type: ContentType, f: Fields): string {
  const v = (k: string) => (f[k] ?? "").trim();
  switch (type) {
    case "url":
      return v("url").replace(/^https?:\/\//, "") || "Empty link";
    case "text":
      return v("text").slice(0, 60) || "Empty text";
    case "wifi":
      return v("ssid") ? `Network “${v("ssid")}”` : "No network name";
    case "contact":
      return v("name") || v("phone") || "Contact";
    case "email":
      return v("to") || "Email";
    case "phone":
      return v("number") || "Phone";
    case "sms":
      return v("number") || "SMS";
  }
}
