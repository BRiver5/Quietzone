import { useMemo, useRef, useState } from "react";
import { ScrollView, Text, useWindowDimensions, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import { ArrowLeft, ArrowRight, Check, Plus, Printer, Share2, Trash2, X } from "lucide-react-native";
import { useTheme } from "../../src/theme";
import { statusColor } from "../../src/theme/colors";
import { staggerDelay } from "../../src/theme/motion";
import { useApp, designOf, evaluateCached } from "../../src/store/appStore";
import { Chip, IconButton, SectionTitle, Stepper } from "../../src/components/Bits";
import { Sheet, Field } from "../../src/components/Sheet";
import { PressableScale } from "../../src/components/PressableScale";
import { QRView, modulesPath } from "../../src/components/QRView";
import { PosteriorCurve, PrintRuler } from "../../src/components/PrintWidgets";
import { SwipeRow } from "../../src/components/SwipeRow";
import { SuccessBurst } from "../../src/components/SuccessBurst";
import { StatusIcon, VERDICT_TEXT } from "../../src/components/Checks";
import { diffEvaluations, type Design } from "../../src/lib/advisor.ts";
import { logoSide } from "../../src/lib/damage.ts";
import { summarize, suggestTest } from "../../src/lib/profile.ts";
import { wilson } from "../../src/lib/stats.ts";
import { dayLabel } from "../../src/lib/time.ts";
import { ECL_ORDER, type Ecl } from "../../src/lib/qr/tables.ts";
import { PROFILE_PRESETS, type ProfileKind } from "../../src/data/repo";
import * as actions from "../../src/store/actions";
import { haptics } from "../../src/services/haptics";

export default function PrintScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const code = useApp((s) => s.codes.find((c) => c.id === id));
  const profiles = useApp((s) => s.profiles);
  const tests = useApp((s) => s.tests);
  const [tweak, setTweak] = useState<Partial<Design>>({});
  const [profileOpen, setProfileOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [burst, setBurst] = useState(0);
  const shotRef = useRef<View>(null);

  const now = code ? evaluateCached(designOf(code, profiles)) : null;
  const next = code ? evaluateCached(designOf(code, profiles, tweak)) : null;
  const rows = useMemo(() => (now && next ? diffEvaluations(now, next) : []), [now, next]);
  if (!code || !now || !next) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.background, paddingTop: insets.top + 20, alignItems: "center" }}>
        <Text style={{ ...t.typography.body, color: t.colors.inkMuted }}>This code no longer exists.</Text>
      </View>
    );
  }
  const d = next.design;
  const changed = Object.keys(tweak).some((k) => (tweak as Record<string, unknown>)[k] !== (now.design as Record<string, unknown>)[k]);
  const profile = profiles.find((p) => p.id === code.profileId) ?? null;
  const pSummary = profile ? summarize(profile.posterior, profile.tests) : null;
  const myTests = profile ? tests.filter((x) => x.profileId === profile.id).slice().reverse() : [];
  const okRate = wilson(myTests.filter((x) => x.ok).length, myTests.length);
  const currentRatio = now.qr ? now.moduleMm / (code.distanceCm / 10) : null;
  const pxPerMm = 160 / 25.4; // dp на мм: 1 dp = 1/160 дюйма — "примерно натуральная величина"

  const set = (patch: Partial<Design>) => {
    haptics.tick();
    setTweak({ ...tweak, ...patch });
  };

  const doPrint = async () => {
    if (!now.qr) return;
    const q = now.qr;
    const total = q.size + code.quiet * 2;
    const side = logoSide(q, code.logoFrac);
    const logo = side
      ? `<rect x="${code.quiet + (q.size - side) / 2}" y="${code.quiet + (q.size - side) / 2}" width="${side}" height="${side}" rx="${side * 0.22}" fill="${code.bg}"/><rect x="${code.quiet + (q.size - side) / 2 + 0.5}" y="${code.quiet + (q.size - side) / 2 + 0.5}" width="${side - 1}" height="${side - 1}" rx="${(side - 1) * 0.24}" fill="${code.fg}"/>`
      : "";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${code.printMm}mm" height="${code.printMm}mm" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="${code.bg}"/><path d="${modulesPath(q.modules, code.quiet)}" fill="${code.fg}"/>${logo}</svg>`;
    const html = `<html><body style="margin:0;padding:15mm;font-family:monospace"><div>${svg}</div><p style="font-size:9pt;color:#555;margin-top:4mm">${escapeHtml(code.title)} · ${code.printMm} mm · v${q.version}-${q.ecl}</p></body></html>`;
    await Print.printAsync({ html });
    await actions.logExport(code.id, "print", code.printMm);
    haptics.success();
    setBurst((b) => b + 1);
  };

  const doShare = async () => {
    if (!shotRef.current) return;
    const uri = await captureRef(shotRef, { format: "png", quality: 1, width: 1024, height: 1024 });
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: code.title });
    await actions.logExport(code.id, "share", null);
    setBurst((b) => b + 1);
  };

  const cards: { key: string; node: React.ReactNode }[] = [
    {
      key: "export",
      node: (
        <View style={{ backgroundColor: t.colors.surface, borderRadius: t.radius.lg, padding: 16, gap: 14, borderWidth: 1, borderColor: t.colors.border }}>
          <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
            <View ref={shotRef} collapsable={false} style={{ backgroundColor: code.bg }}>
              {now.qr ? <QRView qr={now.qr} size={Math.min(140, width * 0.36)} fg={code.fg} bg={code.bg} quiet={code.quiet} logoFrac={code.logoFrac} logoIcon={code.logoIcon} animate={false} /> : null}
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <StatusIcon status={now.verdict} />
                <Text style={{ ...t.typography.label, color: t.colors.ink }}>{VERDICT_TEXT[now.verdict]}</Text>
              </View>
              <Text style={{ ...t.typography.caption, ...t.typography.number, color: t.colors.inkMuted }}>
                {code.printMm} mm wide · {now.moduleMm.toFixed(2)} mm modules · reads to ~{Math.round(now.maxDistanceCm)} cm
              </Text>
              {burst ? (
                <View key={burst}>
                  <SuccessBurst visible size={40} onDone={() => setTimeout(() => setBurst(0), 500)} />
                </View>
              ) : null}
            </View>
          </View>
          <PrintRuler printMm={code.printMm} pxPerMm={pxPerMm} maxWidth={width - 72} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <PressableScale onPress={doPrint} style={{ flex: 1, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.accent, borderRadius: t.radius.pill, paddingVertical: 12 }}>
              <Printer size={16} color={t.colors.onAccent} />
              <Text style={{ ...t.typography.label, color: t.colors.onAccent }}>Print at {code.printMm} mm</Text>
            </PressableScale>
            <PressableScale onPress={doShare} style={{ flex: 1, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.accentSoft, borderRadius: t.radius.pill, paddingVertical: 12 }}>
              <Share2 size={16} color={t.colors.accentDeep} />
              <Text style={{ ...t.typography.label, color: t.colors.accentDeep }}>Share PNG</Text>
            </PressableScale>
          </View>
        </View>
      ),
    },
    {
      key: "whatif",
      node: (
        <View style={{ backgroundColor: t.colors.surface, borderRadius: t.radius.lg, padding: 16, gap: 14, borderWidth: 1, borderColor: t.colors.border }}>
          <SectionTitle title="What if…" right={changed ? <PressableScale onPress={() => setTweak({})}><Text style={{ ...t.typography.label, color: t.colors.accent }}>Reset</Text></PressableScale> : null} />
          <View style={{ flexDirection: "row", gap: 16, flexWrap: "wrap" }}>
            <Field label="Width">
              <Stepper value={d.printMm} onChange={(v) => set({ printMm: v })} step={5} min={10} max={600} format={(v) => `${v} mm`} />
            </Field>
            <Field label="Distance">
              <Stepper value={d.distanceCm} onChange={(v) => set({ distanceCm: v })} step={5} min={5} max={800} format={(v) => `${v} cm`} />
            </Field>
          </View>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            {ECL_ORDER.map((l: Ecl) => (
              <Chip key={l} label={`Level ${l}`} active={d.ecl === l} onPress={() => set({ ecl: l })} />
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            {[0, 0.1, 0.15, 0.2, 0.25, 0.3].map((f) => (
              <Chip key={f} label={f ? `Logo ${Math.round(f * 100)}%` : "No logo"} active={Math.abs(d.logoFrac - f) < 0.005} onPress={() => set({ logoFrac: f })} />
            ))}
          </View>
          <View style={{ borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.border, overflow: "hidden" }}>
            <View style={{ flexDirection: "row", backgroundColor: t.colors.surfaceAlt, paddingVertical: 8, paddingHorizontal: 12 }}>
              <Text style={{ flex: 1.2, ...t.typography.overline, fontSize: 11, color: t.colors.inkMuted }}> </Text>
              <Text style={{ flex: 1, ...t.typography.overline, fontSize: 11, color: t.colors.inkMuted }}>Now</Text>
              <Text style={{ width: 18 }} />
              <Text style={{ flex: 1, ...t.typography.overline, fontSize: 11, color: t.colors.accent }}>What if</Text>
            </View>
            {rows.map((r, i) => (
              <Animated.View key={r.field} entering={FadeInDown.delay(staggerDelay(i, 40)).duration(260)} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 9, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: t.colors.border }}>
                <Text style={{ flex: 1.2, ...t.typography.caption, color: t.colors.inkMuted }}>{r.field}</Text>
                <Text style={{ flex: 1, ...t.typography.caption, ...t.typography.number, color: t.colors.ink }}>{r.field === "Verdict" ? VERDICT_TEXT[r.before as "ok"] : r.before}</Text>
                <ArrowRight size={12} color={t.colors.inkFaint} style={{ width: 18 }} />
                <Text style={{ flex: 1, ...t.typography.caption, fontFamily: t.typography.title.fontFamily, color: r.better === null ? t.colors.ink : r.better ? t.colors.success : t.colors.danger }}>
                  {r.field === "Verdict" ? VERDICT_TEXT[r.after as "ok"] : r.after}
                </Text>
              </Animated.View>
            ))}
          </View>
          {changed ? (
            <PressableScale
              onPress={async () => {
                haptics.success();
                await actions.patchCode(code.id, { printMm: d.printMm, distanceCm: d.distanceCm, ecl: d.ecl, logoFrac: d.logoFrac });
                setTweak({});
                setBurst((b) => b + 1);
              }}
              style={{ backgroundColor: t.colors.ink, borderRadius: t.radius.pill, paddingVertical: 12, alignItems: "center" }}
            >
              <Text style={{ ...t.typography.label, color: t.colors.surface }}>Make this the code</Text>
            </PressableScale>
          ) : null}
        </View>
      ),
    },
    {
      key: "profile",
      node: (
        <View style={{ backgroundColor: t.colors.surface, borderRadius: t.radius.lg, padding: 16, gap: 14, borderWidth: 1, borderColor: t.colors.border }}>
          <SectionTitle title="Your printer" right={<PressableScale onPress={() => setProfileOpen(true)} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><Plus size={14} color={t.colors.accent} /><Text style={{ ...t.typography.label, color: t.colors.accent }}>New</Text></PressableScale>} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Chip label="Rule of thumb" active={!profile} onPress={() => actions.patchCode(code.id, { profileId: null })} />
            {profiles.map((p) => (
              <Chip key={p.id} label={p.name} active={profile?.id === p.id} onPress={() => actions.patchCode(code.id, { profileId: p.id })} />
            ))}
          </View>
          {profile && pSummary ? (
            <>
              <PosteriorCurve posterior={profile.posterior} current={currentRatio} />
              <Text style={{ ...t.typography.caption, color: t.colors.ink }}>
                {pSummary.confidence === "prior"
                  ? "No tests yet — this is the general rule, not your printer."
                  : `Reads reliably from ${pSummary.recommended.toFixed(2)} mm of module per 10 cm (80% sure), learned from ${profile.tests} test${profile.tests === 1 ? "" : "s"}.`}
                {okRate ? ` ${Math.round(okRate.p * 100)}% of tests scanned.` : ""}
              </Text>
              <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
                Dashed line: this code at {code.distanceCm} cm. Shaded band: where the threshold probably lies (10–90%). Right of it — safe; inside — a coin toss.
              </Text>
              <PressableScale onPress={() => setTestOpen(true)} style={{ backgroundColor: t.colors.accentSoft, borderRadius: t.radius.pill, paddingVertical: 12, alignItems: "center" }}>
                <Text style={{ ...t.typography.label, color: t.colors.accentDeep }}>Log a scan test</Text>
              </PressableScale>
              {myTests.slice(0, 6).map((x) => (
                <SwipeRow key={x.id} left={{ label: "Delete", icon: <Trash2 size={15} color={t.colors.onAccent} />, onTrigger: () => actions.removeTest(x.id, profile) }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: t.colors.surfaceAlt, borderRadius: t.radius.md, paddingHorizontal: 12, paddingVertical: 9 }}>
                    {x.ok ? <Check size={15} color={statusColor.ok} /> : <X size={15} color={statusColor.fail} />}
                    <Text style={{ ...t.typography.caption, ...t.typography.number, color: t.colors.ink, flex: 1 }}>
                      {x.moduleMm.toFixed(2)} mm @ {x.distanceCm} cm
                    </Text>
                    <Text style={{ fontSize: 11, color: t.colors.inkMuted }}>{dayLabel(x.date)}</Text>
                  </View>
                </SwipeRow>
              ))}
            </>
          ) : (
            <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
              The rule of thumb: about 0.3 mm of module per 10 cm of distance. Add a printer profile and log a few scan tests — the advice becomes yours.
            </Text>
          )}
        </View>
      ),
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 40, gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <IconButton label="Back" onPress={() => router.back()}>
            <ArrowLeft size={18} color={t.colors.ink} />
          </IconButton>
          <View style={{ flex: 1 }}>
            <Text style={{ ...t.typography.title, color: t.colors.ink }}>Print & test</Text>
            <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }} numberOfLines={1}>
              {code.title}
            </Text>
          </View>
        </View>
        {cards.map((c, i) => (
          <Animated.View key={c.key} entering={FadeInDown.delay(staggerDelay(i, 70)).duration(380)}>
            {c.node}
          </Animated.View>
        ))}
      </ScrollView>
      <ProfileSheet visible={profileOpen} onClose={() => setProfileOpen(false)} onCreated={(pid) => actions.patchCode(code.id, { profileId: pid })} />
      {profile && now.qr ? (
        <TestSheet visible={testOpen} onClose={() => setTestOpen(false)} moduleMm={now.moduleMm} suggested={suggestTest(profile.posterior, now.moduleMm).distanceCm} onLog={(dist, ok) => actions.logTest(profile, code.id, { moduleMm: now.moduleMm, distanceCm: dist, ok })} />
      ) : null}
    </View>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}

function ProfileSheet({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const t = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title="New printer profile" subtitle="It starts from a sensible guess and learns from your tests">
      {PROFILE_PRESETS.map((p) => (
        <PressableScale
          key={p.kind}
          onPress={async () => {
            const id = await actions.addProfile(p.kind as ProfileKind, p.name);
            haptics.success();
            onCreated(id);
            onClose();
          }}
          style={{ padding: 14, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.border, gap: 2 }}
        >
          <Text style={{ ...t.typography.label, color: t.colors.ink }}>{p.name}</Text>
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Starting guess: {p.center.toFixed(2)} mm per 10 cm</Text>
        </PressableScale>
      ))}
    </Sheet>
  );
}

function TestSheet({ visible, onClose, moduleMm, suggested, onLog }: { visible: boolean; onClose: () => void; moduleMm: number; suggested: number; onLog: (distanceCm: number, ok: boolean) => Promise<void> }) {
  const t = useTheme();
  const [dist, setDist] = useState(suggested);
  const [done, setDone] = useState(false);
  const log = async (ok: boolean) => {
    await onLog(dist, ok);
    haptics.success();
    setDone(true);
  };
  return (
    <Sheet
      visible={visible}
      onClose={() => {
        setDone(false);
        setDist(suggested);
        onClose();
      }}
      title="Log a scan test"
      subtitle={`Print this code, then try your phone camera from the distance below. Modules: ${moduleMm.toFixed(2)} mm.`}
    >
      {done ? (
        <View style={{ alignItems: "center", paddingVertical: 20 }}>
          <SuccessBurst
            visible
            size={80}
            onDone={() =>
              setTimeout(() => {
                setDone(false);
                onClose();
              }, 250)
            }
          />
        </View>
      ) : (
        <>
          <Field label="Distance" hint={`Most informative right now: ${suggested} cm — the model is least sure there.`}>
            <Stepper value={dist} onChange={setDist} step={5} min={5} max={800} format={(v) => `${v} cm`} />
          </Field>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <PressableScale onPress={() => log(true)} style={{ flex: 1, backgroundColor: statusColor.ok, borderRadius: t.radius.md, paddingVertical: 18, alignItems: "center", gap: 4 }}>
              <Check size={22} color="#FFFFFF" />
              <Text style={{ ...t.typography.label, color: "#FFFFFF" }}>It scanned</Text>
            </PressableScale>
            <PressableScale onPress={() => log(false)} style={{ flex: 1, backgroundColor: statusColor.fail, borderRadius: t.radius.md, paddingVertical: 18, alignItems: "center", gap: 4 }}>
              <X size={22} color="#FFFFFF" />
              <Text style={{ ...t.typography.label, color: "#FFFFFF" }}>It didn't</Text>
            </PressableScale>
          </View>
        </>
      )}
    </Sheet>
  );
}
