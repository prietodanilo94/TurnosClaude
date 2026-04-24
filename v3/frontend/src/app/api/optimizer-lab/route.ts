import { NextResponse } from "next/server";
import { z } from "zod";
import { runOptimizerLab } from "@/lib/optimizer-lab/engine";

const requestSchema = z.object({
  category: z.enum(["ventas_mall_dominical"]),
  year: z.number().int().min(2024).max(2100),
  month: z.number().int().min(1).max(12),
  dotation: z.number().int().min(1).max(50),
  weeklyHoursTarget: z.number().int().min(1).max(60),
  maxConsecutiveDays: z.number().int().min(1).max(7),
  minFreeSundays: z.number().int().min(0).max(5),
  numProposals: z.number().int().min(1).max(5),
  timeLimitSeconds: z.number().int().min(5).max(180),
});

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Payload invalido para optimizer lab.",
        issues: parsed.error.issues,
      },
      { status: 400 }
    );
  }

  const result = runOptimizerLab(parsed.data);
  return NextResponse.json(result);
}
