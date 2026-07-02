import { Document, Page, View, Text, StyleSheet, pdf } from "@react-pdf/renderer";
import { MEASURES, getCutpoints, getPoints, getQuintile, getGapToNext } from "./scoring.js";

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: "Helvetica", color: "#111827" },
  headerBar: { height: 4, backgroundColor: "#1d4ed8", marginBottom: 10 },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 9, color: "#6b7280", marginBottom: 12 },
  scoreRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  scoreCard: { flex: 1, border: "1px solid #e5e7eb", borderRadius: 4, padding: 8 },
  scoreLabel: { fontSize: 7, color: "#6b7280", marginBottom: 3, textTransform: "uppercase" },
  scoreVal: { fontSize: 16, fontWeight: 700 },
  sectionTitle: { fontSize: 9, fontWeight: 700, marginTop: 10, marginBottom: 4, color: "#1d4ed8" },
  table: { border: "1px solid #e5e7eb", borderRadius: 3 },
  tHeadRow: { flexDirection: "row", backgroundColor: "#f3f4f6", borderBottom: "1px solid #e5e7eb" },
  tRow: { flexDirection: "row", borderBottom: "1px solid #f3f4f6" },
  th: { padding: 3, fontSize: 7, fontWeight: 700, color: "#374151" },
  td: { padding: 3, fontSize: 7.5, color: "#111827" },
  colMeasure: { width: "34%" },
  colVal: { width: "14%", textAlign: "right" },
  colQ: { width: "10%", textAlign: "center" },
  colPts: { width: "14%", textAlign: "right" },
  priorityRow: { flexDirection: "row", justifyContent: "space-between", border: "1px solid #e5e7eb", borderRadius: 3, padding: 5, marginBottom: 3 },
  footer: { position: "absolute", bottom: 20, left: 28, right: 28, fontSize: 7, color: "#9ca3af" },
});

function fmt(v) {
  if (v === null || v === undefined) return "—";
  return typeof v === "number" ? v : v;
}

function FacilityReport({ dataset, facility, displayName, vals, starVals, binaryVals, summary }) {
  const priorities = MEASURES
    .filter(m => m.scoring === "quintile" || m.scoring === "quintile_pah")
    .map(m => {
      const cutpoints = getCutpoints(dataset, m.id, facility.region);
      const q = getQuintile(m, vals[m.id], cutpoints);
      const gapInfo = q && q > 1 ? getGapToNext(m, vals[m.id], q, cutpoints) : null;
      const table = m.scoring === "quintile_pah" ? [10, 8, 6, 2, 0] : [5, 3, 1, 0, 0];
      const ptGain = q ? table[q - 2] - table[q - 1] : 0;
      return { m, q, gapInfo, ptGain };
    })
    .filter(x => x.q && x.q > 1)
    .sort((a, b) => b.ptGain !== a.ptGain ? b.ptGain - a.ptGain : (a.gapInfo?.gap ?? 999) - (b.gapInfo?.gap ?? 999))
    .slice(0, 5);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerBar} />
        <Text style={styles.title}>{displayName}</Text>
        <Text style={styles.subtitle}>
          NY DOH NHQI · {dataset.year} Actual vs. 2025 Full-Year · {facility.city}, {facility.county} ({facility.region}) · OPCERT {facility.opcert}
        </Text>

        <View style={styles.scoreRow}>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>{dataset.year} Actual Score</Text>
            <Text style={styles.scoreVal}>{summary.score2023}/90</Text>
            <Text style={{ fontSize: 7, color: "#6b7280" }}>Quintile {summary.quintile2023 ?? "—"}</Text>
          </View>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>2025 Full-Year Score</Text>
            <Text style={styles.scoreVal}>{summary.score2025 !== null ? `${summary.score2025}/90` : "—"}</Text>
            <Text style={{ fontSize: 7, color: "#6b7280" }}>{summary.entered}/{MEASURES.length} measures entered</Text>
          </View>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>Est. 2027 Quintile</Text>
            <Text style={styles.scoreVal}>{summary.quintile2027 !== null ? `Q${summary.quintile2027}` : "—"}</Text>
            <Text style={{ fontSize: 7, color: "#6b7280" }}>
              {summary.ptsDelta !== null ? `${summary.ptsDelta > 0 ? "+" : ""}${summary.ptsDelta} pts vs ${dataset.year}` : "Enter 2025 data to project"}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>All Measures — {dataset.year} Actual vs. 2025 Full-Year</Text>
        <View style={styles.table}>
          <View style={styles.tHeadRow}>
            <Text style={[styles.th, styles.colMeasure]}>Measure</Text>
            <Text style={[styles.th, styles.colVal]}>{dataset.year}</Text>
            <Text style={[styles.th, styles.colQ]}>Q</Text>
            <Text style={[styles.th, styles.colVal]}>2025</Text>
            <Text style={[styles.th, styles.colQ]}>Q</Text>
            <Text style={[styles.th, styles.colPts]}>Pts (yr/'25)</Text>
          </View>
          {MEASURES.map(m => {
            const a = facility.actuals[m.id] || {};
            const cutpoints = getCutpoints(dataset, m.id, facility.region);
            const q25 = (m.scoring === "quintile" || m.scoring === "quintile_pah") ? getQuintile(m, vals[m.id], cutpoints) : null;
            const pts25 = getPoints(m, vals[m.id], starVals[m.id], binaryVals[m.id], cutpoints);
            return (
              <View key={m.id} style={styles.tRow}>
                <Text style={[styles.td, styles.colMeasure]}>{m.short}{m.pointsApproximate ? " *" : ""}</Text>
                <Text style={[styles.td, styles.colVal]}>{fmt(a.value)}{m.unit && typeof a.value === "number" ? m.unit : ""}</Text>
                <Text style={[styles.td, styles.colQ]}>{a.quintile ?? "—"}</Text>
                <Text style={[styles.td, styles.colVal]}>{vals[m.id] || starVals[m.id] || binaryVals[m.id] || "—"}</Text>
                <Text style={[styles.td, styles.colQ]}>{q25 ?? "—"}</Text>
                <Text style={[styles.td, styles.colPts]}>{fmt(a.points)} / {fmt(pts25)}</Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Top Improvement Opportunities</Text>
        {priorities.length === 0 ? (
          <Text style={{ fontSize: 8, color: "#6b7280" }}>Enter 2025 full-year numbers to generate an improvement plan.</Text>
        ) : (
          priorities.map((x, i) => (
            <View key={x.m.id} style={styles.priorityRow}>
              <Text style={{ fontSize: 8 }}>#{i + 1} {x.m.short} — Q{x.q} → Q{x.q - 1}{x.gapInfo ? ` (need ${x.gapInfo.gap.toFixed(1)}${x.m.unit === "%" ? "%" : ` ${x.m.unit}`}, target ${x.gapInfo.target})` : ""}</Text>
              <Text style={{ fontSize: 8, fontWeight: 700, color: "#15803d" }}>+{x.ptGain} pts</Text>
            </View>
          ))
        )}

        <Text style={styles.footer}>
          {`${dataset.year} actuals from NY DOH NHQI dataset (${dataset.source}). Cut points regionally adjusted where applicable (${facility.region}). PAH cannot be self-tracked (requires DOH's MDS→SPARCS match) — treat as an estimate. * = DOH's real points for this measure sometimes differ +/-1 from the standard quintile table; 2025 points shown here are directional. Est. 2027 quintile is directional, not guaranteed. Generated ${new Date().toLocaleDateString()}.`}
        </Text>
      </Page>
    </Document>
  );
}

export async function downloadFacilityPdf(props) {
  const blob = await pdf(<FacilityReport {...props} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `NHQI_${(props.displayName || props.facility.name).replace(/[^a-z0-9]+/gi, "_")}_report.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
