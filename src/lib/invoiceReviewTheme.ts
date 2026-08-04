// Confidence-based theming for the invoice review screen, ported verbatim
// (hex values and thresholds) from Scantrix_v2
// src/screens/pending/InvoiceReviewScreen.tsx's inline `theme` useMemo.
export interface ReviewTheme {
  headerBg: string;
  screenBg: string;
  cardBg: string;
  progressTrack: string;
  progressFill: string;
  primaryText: string;
  secondaryText: string;
  fieldBorder: string;
  valueText: string;
  buttonBg: string;
  statusText: string;
  actionText: string;
  /** Section header background, matching InvoiceDetailTheme's equivalent tier. */
  sectionHeaderBg: string;
  /** Row divider color, matching InvoiceDetailTheme's equivalent tier. */
  divider: string;
}

export function getReviewTheme(confidenceScore: number): ReviewTheme {
  if (confidenceScore >= 90) {
    return {
      headerBg: "#21A77A",
      screenBg: "#F6FAF8",
      cardBg: "#DDF3E8",
      progressTrack: "#BFE8D5",
      progressFill: "#21A77A",
      primaryText: "#15805D",
      secondaryText: "#34A37B",
      fieldBorder: "#D7E8E0",
      valueText: "#1E7D5C",
      buttonBg: "#24C3B5",
      statusText: "High confidence",
      actionText: "Post to QuickBooks",
      sectionHeaderBg: "#EBF7F3",
      divider: "#D4EFE3",
    };
  }

  if (confidenceScore >= 70) {
    return {
      headerBg: "#EDA320",
      screenBg: "#FEFBF5",
      cardBg: "#F8EBD4",
      progressTrack: "#F3D6A4",
      progressFill: "#EDA320",
      primaryText: "#9F6807",
      secondaryText: "#D8961A",
      fieldBorder: "#F1DFC0",
      valueText: "#A06707",
      buttonBg: "#FF7A1A",
      statusText: "Review required",
      actionText: "Review & Approve",
      sectionHeaderBg: "#FBF2E3",
      divider: "#F3D6A4",
    };
  }

  return {
    headerBg: "#E74949",
    screenBg: "#FFF8F8",
    cardBg: "#F9E3E5",
    progressTrack: "#F3C8CD",
    progressFill: "#E74949",
    primaryText: "#A12832",
    secondaryText: "#E56C73",
    fieldBorder: "#F2D1D4",
    valueText: "#E74949",
    buttonBg: "#E74949",
    statusText: "Low confidence",
    actionText: "Post Manually",
    sectionHeaderBg: "#FDEDEF",
    divider: "#F3C8CD",
  };
}
