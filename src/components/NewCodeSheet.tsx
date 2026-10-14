import { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { AtSign, Link2, MessageSquare, Phone, Type, UserRound, Wifi } from "lucide-react-native";
import { useTheme } from "../theme";
import { contentColors } from "../theme/colors";
import { Sheet, Field, inputStyle } from "./Sheet";
import { Chip } from "./Bits";
import { PrimaryButton } from "./PrimaryButton";
import { SuccessBurst } from "./SuccessBurst";
import { CONTENT_FIELDS, CONTENT_LABELS, buildPayload, summary, type ContentType, type Fields } from "../lib/content.ts";
import { useApp } from "../store/appStore";
import * as actions from "../store/actions";
import { haptics } from "../services/haptics";
import type { LogoIcon } from "../data/repo";

export const TYPE_ICON: Record<ContentType, (c: string, s?: number) => React.ReactNode> = {
  url: (c, s = 15) => <Link2 size={s} color={c} />,
  text: (c, s = 15) => <Type size={s} color={c} />,
  wifi: (c, s = 15) => <Wifi size={s} color={c} />,
  contact: (c, s = 15) => <UserRound size={s} color={c} />,
  email: (c, s = 15) => <AtSign size={s} color={c} />,
  phone: (c, s = 15) => <Phone size={s} color={c} />,
  sms: (c, s = 15) => <MessageSquare size={s} color={c} />,
};

// Куда пойдёт код — задаёт и размер печати, и дистанцию сканирования.
export const TARGET_PRESETS: { label: string; printMm: number; distanceCm: number }[] = [
  { label: "Business card", printMm: 22, distanceCm: 15 },
  { label: "Sticker", printMm: 35, distanceCm: 25 },
  { label: "Flyer", printMm: 50, distanceCm: 40 },
  { label: "Table tent", printMm: 60, distanceCm: 60 },
  { label: "Poster", printMm: 150, distanceCm: 150 },
  { label: "Window sign", printMm: 250, distanceCm: 300 },
];

const DEFAULT_LOGO: Record<ContentType, LogoIcon> = { url: "none", text: "none", wifi: "none", contact: "none", email: "none", phone: "none", sms: "none" };

export function NewCodeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const settings = useApp((s) => s.settings);
  const [type, setType] = useState<ContentType>("url");
  const [fields, setFields] = useState<Fields>({});
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState(1);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setType("url");
    setFields({});
    setTitle("");
    setTarget(1);
    setDone(null);
  }, [visible]);

  const payload = buildPayload(type, fields);
  const create = async () => {
    if (!payload) return;
    const p = TARGET_PRESETS[target];
    const id = await actions.addCode({
      title: title.trim() || summary(type, fields),
      type,
      fields,
      ecl: settings.defaultEcl,
      logoFrac: 0,
      logoIcon: DEFAULT_LOGO[type],
      fg: "#000000",
      bg: "#FFFFFF",
      quiet: 4,
      printMm: p.printMm,
      distanceCm: p.distanceCm,
      profileId: settings.defaultProfileId,
    });
    haptics.success();
    setDone(id);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="New code" subtitle="What should a phone camera open?" footer={done ? null : <PrimaryButton label="Create code" onPress={create} disabled={!payload} />}>
      {done ? (
        <View style={{ alignItems: "center", paddingVertical: 24 }}>
          <SuccessBurst
            visible
            size={84}
            onDone={() =>
              setTimeout(() => {
                onClose();
                router.push(`/code/${done}`);
              }, 240)
            }
          />
        </View>
      ) : (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(Object.keys(CONTENT_LABELS) as ContentType[]).map((k) => (
              <Chip
                key={k}
                label={CONTENT_LABELS[k]}
                active={type === k}
                icon={TYPE_ICON[k](type === k ? t.colors.onAccent : contentColors[k])}
                onPress={() => {
                  setType(k);
                  setFields({});
                }}
              />
            ))}
          </View>
          {CONTENT_FIELDS[type].map((f) =>
            f.key === "security" ? (
              <Field key={f.key} label={f.label}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {["WPA", "WEP"].map((s) => (
                    <Chip key={s} label={s} active={(fields.security || "WPA") === s} onPress={() => setFields({ ...fields, security: s })} />
                  ))}
                </View>
              </Field>
            ) : (
              <Field key={f.key} label={f.label}>
                <TextInput
                  value={fields[f.key] ?? ""}
                  onChangeText={(v) => setFields({ ...fields, [f.key]: v })}
                  placeholder={f.placeholder}
                  placeholderTextColor={t.colors.inkFaint}
                  autoCapitalize={f.key === "name" || f.key === "text" || f.key === "message" || f.key === "org" ? "sentences" : "none"}
                  autoCorrect={false}
                  multiline={f.multiline}
                  keyboardType={f.key === "number" || f.key === "phone" ? "phone-pad" : f.key === "email" || f.key === "to" ? "email-address" : f.key === "url" ? "url" : "default"}
                  style={[inputStyle(t), f.multiline ? { minHeight: 80, textAlignVertical: "top" } : null]}
                />
              </Field>
            )
          )}
          <Field label="Name in your library" hint="Optional — defaults to the content.">
            <TextInput value={title} onChangeText={setTitle} placeholder={payload ? summary(type, fields) : "e.g. Café Wi-Fi"} placeholderTextColor={t.colors.inkFaint} style={inputStyle(t)} />
          </Field>
          <Field label="Where will it live" hint="Sets print size and scan distance; both stay editable.">
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {TARGET_PRESETS.map((p, i) => (
                <Chip key={p.label} label={`${p.label} · ${p.printMm} mm`} active={target === i} onPress={() => setTarget(i)} />
              ))}
            </View>
          </Field>
          {payload ? (
            <Text style={{ ...t.typography.caption, ...t.typography.mono, color: t.colors.inkMuted }} numberOfLines={2}>
              Encodes: {payload}
            </Text>
          ) : null}
        </>
      )}
    </Sheet>
  );
}
