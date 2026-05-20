import { NextRequest, NextResponse } from "next/server";

const MODES: Record<string, string> = {
  safety: `You are a construction site safety inspector. Analyze this photo for safety violations, missing PPE, unsafe conditions, and hazards. Return ONLY valid JSON:
{
  "safetyScore": 0-100,
  "overallRisk": "Low|Medium|High|Critical",
  "violations": [{"issue": string, "severity": "Low|Medium|High|Critical", "location": string, "action": string}],
  "positives": [string],
  "recommendations": [string],
  "requiresImmediateAction": boolean
}`,
  progress: `You are a construction progress inspector. Analyze this photo and estimate progress. Return ONLY valid JSON:
{
  "progressSummary": string,
  "estimatedCompletion": "percentage as string e.g. 65%",
  "phase": string,
  "workVisible": [string],
  "nextSteps": [string],
  "concerns": [string],
  "qualityObservations": [string]
}`,
  defects: `You are a construction quality control inspector. Identify defects, quality issues, and items needing rework. Return ONLY valid JSON:
{
  "qualityScore": 0-100,
  "defectsFound": [{"type": string, "location": string, "severity": "Minor|Major|Critical", "action": string}],
  "requiresRework": boolean,
  "passesInspection": boolean,
  "notes": string,
  "recommendations": [string]
}`,
  materials: `You are a construction materials expert. Identify all materials, equipment, and quantities visible. Return ONLY valid JSON:
{
  "summary": string,
  "materials": [{"name": string, "type": string, "estimatedQuantity": string, "condition": "Good|Fair|Poor", "notes": string}],
  "equipment": [{"name": string, "type": string, "condition": "Good|Fair|Poor"}],
  "wasteObserved": boolean,
  "storageIssues": boolean,
  "recommendations": [string]
}`
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const image    = formData.get("image") as File;
    const mode     = (formData.get("mode") as string) || "safety";

    if (!image) return NextResponse.json({ error: "No image provided" }, { status: 400 });
    if (!MODES[mode]) return NextResponse.json({ error: "Invalid mode" }, { status: 400 });

    // Convert to base64
    const bytes  = await image.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mtype  = image.type || "image/jpeg";

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key":     process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type":  "application/json",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-6",
        max_tokens: 1200,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mtype, data: base64 } },
            { type: "text",  text: MODES[mode] + "\n\nReturn ONLY valid JSON, no markdown, no explanation." }
          ]
        }]
      })
    });

    const data = await res.json();
    if (data.error) return NextResponse.json({ error: data.error.message }, { status: 500 });

    const text   = data.content?.[0]?.text ?? "{}";
    const result = JSON.parse(text.replace(/```json|```/g, "").trim());

    return NextResponse.json({ result, mode });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
