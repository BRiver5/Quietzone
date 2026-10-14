import { useEffect } from "react";
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { Easing, FadeIn, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { useTheme } from "../theme";
import { PressableScale } from "./PressableScale";
import { useUi } from "../store/uiStore";

// Нижняя шторка для всех форм: явный триггер → шторка выезжает, фон затемняется;
// закрытие — крестик, тап по фону или системное "назад".
// Оверлей внутри экрана, а не <Modal>: окно Modal на Android не заходило под
// навигационную панель, и снизу просвечивала незатемнённая кнопка экрана.
// Поэтому шторка рендерится ПОСЛЕДНИМ ребёнком корня экрана.
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  // Явный потолок в пикселях: процент от контейнера не учитывал верхний отступ,
  // и длинная форма выталкивала кнопку ниже края экрана.
  const maxSheet = height - insets.top - 56;
  useEffect(() => {
    if (!visible) return;
    useUi.getState().add(1);
    return () => useUi.getState().add(-1);
  }, [visible]);
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);
  if (!visible) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 50, elevation: 50 }]}>
      <Animated.View entering={FadeIn.duration(200)} style={[StyleSheet.absoluteFill, { backgroundColor: t.colors.scrim }]} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Pressable onPress={onClose} style={{ flex: 1 }} />
        <Animated.View
          entering={SlideInDown.duration(320).easing(Easing.out(Easing.cubic))}
          style={{
            backgroundColor: t.colors.surface,
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            maxHeight: maxSheet,
            paddingBottom: insets.bottom + t.spacing.md,
          }}
        >
          <View style={{ alignItems: "center", paddingTop: 10 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: t.colors.border }} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "flex-start", paddingHorizontal: t.spacing.xl, paddingTop: t.spacing.md, gap: t.spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...t.typography.title, color: t.colors.ink }}>{title}</Text>
              {subtitle ? <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, marginTop: 2 }}>{subtitle}</Text> : null}
            </View>
            <PressableScale
              onPress={onClose}
              accessibilityLabel="Close"
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.colors.surfaceAlt, alignItems: "center", justifyContent: "center" }}
            >
              <X size={18} color={t.colors.inkMuted} />
            </PressableScale>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: t.spacing.xl, paddingTop: t.spacing.lg, gap: t.spacing.lg }}>
            {children}
          </ScrollView>
          {footer ? <View style={{ paddingHorizontal: t.spacing.xl }}>{footer}</View> : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>{label}</Text>
      {children}
      {hint ? <Text style={{ ...t.typography.caption, color: t.colors.inkFaint }}>{hint}</Text> : null}
    </View>
  );
}

export function inputStyle(t: ReturnType<typeof useTheme>) {
  return {
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: t.radius.md,
    paddingHorizontal: t.spacing.md,
    paddingVertical: 11,
    color: t.colors.ink,
    backgroundColor: t.colors.surfaceAlt,
    ...t.typography.body,
  } as const;
}
