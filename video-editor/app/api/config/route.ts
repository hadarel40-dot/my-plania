import { NextResponse } from "next/server";
import { getCloudConfig } from "@/lib/ai/fal-config";

export const dynamic = "force-dynamic";

/** אילו יכולות ענן זמינות. הדפדפן לא רואה את המפתחות, רק אם הם קיימים */
export function GET() {
  return NextResponse.json(getCloudConfig());
}
