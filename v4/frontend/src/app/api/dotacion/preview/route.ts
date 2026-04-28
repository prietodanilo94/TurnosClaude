import { NextRequest, NextResponse } from "next/server";
import { parseDotacionExcel } from "@/lib/excel/parser";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Sin archivo" }, { status: 400 });

    const buffer = await file.arrayBuffer();
    const { rows, errors } = parseDotacionExcel(buffer);

    const branches = new Set(rows.map((r) => r.codigoBranch));

    return NextResponse.json({
      rowCount: rows.length,
      branchCount: branches.size,
      errors,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al procesar" },
      { status: 400 },
    );
  }
}
