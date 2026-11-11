import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { readQuote } from "@/lib/server/freight";
import { getActor } from "@/lib/server/session";
import React from "react";

Font.register({
  family: "NotoSansSC",
  src: path.join(process.cwd(), "assets/fonts/NotoSansSC-Regular.otf"),
});

const styles = StyleSheet.create({
  page: { fontFamily: "NotoSansSC", padding: 36, fontSize: 11, color: "#1d1d1f" },
  title: { fontSize: 22, marginBottom: 8 },
  muted: { color: "#6e6e73", marginBottom: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", borderBottom: "1px solid #d2d2d7", paddingVertical: 4 },
});

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor) return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "private, no-store" } });
  const { id } = await context.params;
  const quote = await readQuote(actor, id);
  if (!quote) return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  const snapshot = quote.snapshot;
  const locale = snapshot.locale;
  const buffer = await renderToBuffer(
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{snapshot.quoteNumber}</Text>
        <Text style={styles.muted}>{snapshot.card.origin.name[locale]} → {snapshot.card.destination.name[locale]}</Text>
        <Text style={styles.muted}>{snapshot.card.carrierName} · {snapshot.card.selectedCode} × {snapshot.quantity}</Text>
        {snapshot.calculation.lines.filter((line) => line.status === "priced").map((line) => (
          <View key={line.code} style={styles.row}>
            <Text>{line.name[locale]}</Text>
            <Text>{line.amount} {line.currency}</Text>
          </View>
        ))}
        {snapshot.calculation.subtotals.map((item) => (
          <Text key={item.currency}>{item.currency} {item.amount}</Text>
        ))}
        <Text style={styles.muted}>{snapshot.terms[locale]}</Text>
      </Page>
    </Document>,
  );
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${quote.quote_number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
