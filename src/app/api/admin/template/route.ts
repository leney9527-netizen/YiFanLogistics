import ExcelJS from "exceljs";
import { RATE_IMPORT_COLUMNS } from "@/lib/import/rates";
import { getActor } from "@/lib/server/session";
import { isStaffRole } from "@/lib/authz";

export async function GET() {
  const actor = await getActor();
  if (!actor || !isStaffRole(actor.role)) {
    return new Response("Forbidden", { status: 403, headers: { "Cache-Control": "private, no-store" } });
  }
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("rates");
  sheet.addRow([...RATE_IMPORT_COLUMNS]);
  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=yifan-rate-template.xlsx",
      "Cache-Control": "private, no-store",
    },
  });
}
