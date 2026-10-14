// IBM Plex Mono — заголовки, числа и технические подписи (стиль чертежа);
// основной текст — системный.
export const fonts = {
  mono: "IBMPlexMono_400Regular",
  monoMedium: "IBMPlexMono_500Medium",
  monoBold: "IBMPlexMono_600SemiBold",
};

export const typography = {
  display: { fontSize: 34, fontFamily: fonts.monoBold, lineHeight: 40 },
  title: { fontSize: 22, fontFamily: fonts.monoBold, lineHeight: 28 },
  subtitle: { fontSize: 16, fontWeight: "600" as const, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: "400" as const, lineHeight: 21 },
  caption: { fontSize: 13, fontWeight: "400" as const, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: "600" as const, lineHeight: 18 },
  overline: { fontSize: 11, fontFamily: fonts.monoMedium, lineHeight: 14, letterSpacing: 1.2, textTransform: "uppercase" as const },
  number: { fontFamily: fonts.monoMedium },
  mono: { fontFamily: fonts.mono },
};
