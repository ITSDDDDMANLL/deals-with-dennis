import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getAdminCookieName,
  isAdminSessionValueValid,
} from "../../../../../lib/admin-auth";

const maxImagesPerRequest = 8;

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "Screenshot recognition is not configured yet.",
        details:
          "Set OPENAI_API_KEY in Vercel to enable image-to-inventory extraction.",
      },
      { status: 501 },
    );
  }

  const formData = await request.formData();
  const files = formData
    .getAll("images")
    .filter((item): item is File => item instanceof File)
    .slice(0, maxImagesPerRequest);

  if (!files.length) {
    return NextResponse.json(
      { error: "Upload at least one screenshot." },
      { status: 400 },
    );
  }

  const imageParts = await Promise.all(
    files.map(async (file) => ({
      image_url: `data:${file.type || "image/png"};base64,${Buffer.from(
        await file.arrayBuffer(),
      ).toString("base64")}`,
      type: "input_image",
    })),
  );

  const response = await fetch("https://api.openai.com/v1/responses", {
    body: JSON.stringify({
      input: [
        {
          content: [
            {
              text:
                "Extract vehicle inventory rows from these screenshots. Return only JSON matching the schema. Use status available when a real price is shown. Use status incoming when price is missing, CALL, TBD, or ask-for-pricing. Use 0 for unknown year. Leave string fields blank when unknown. Map body style to className. Normalize transmission to Manual or Auto when possible. Normalize drivetrain to FWD, RWD, AWD, or 4x4 when possible.",
              type: "input_text",
            },
            ...imageParts,
          ],
          role: "user",
        },
      ],
      model: process.env.OPENAI_VISION_MODEL ?? "gpt-4.1-mini",
      text: {
        format: {
          name: "vehicle_inventory_extract",
          schema: {
            additionalProperties: false,
            properties: {
              vehicles: {
                items: {
                  additionalProperties: false,
                  properties: {
                    className: { type: "string" },
                    drivetrain: { type: "string" },
                    exteriorColor: { type: "string" },
                    fuel: { type: "string" },
                    highlights: { type: "string" },
                    make: { type: "string" },
                    mileageLabel: { type: "string" },
                    model: { type: "string" },
                    priceLabel: { type: "string" },
                    status: {
                      enum: ["available", "incoming", "sold"],
                      type: "string",
                    },
                    stockNumber: { type: "string" },
                    transmission: { type: "string" },
                    trim: { type: "string" },
                    type: { enum: ["new", "used"], type: "string" },
                    vin: { type: "string" },
                    year: { type: "number" },
                  },
                  required: [
                    "year",
                    "make",
                    "model",
                    "trim",
                    "stockNumber",
                    "vin",
                    "className",
                    "exteriorColor",
                    "priceLabel",
                    "mileageLabel",
                    "drivetrain",
                    "transmission",
                    "fuel",
                    "status",
                    "type",
                    "highlights",
                  ],
                  type: "object",
                },
                type: "array",
              },
            },
            required: ["vehicles"],
            type: "object",
          },
          strict: true,
          type: "json_schema",
        },
      },
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return NextResponse.json(
      {
        error: "Screenshot recognition failed.",
        details: getOpenAIError(data),
      },
      { status: response.status },
    );
  }

  const text =
    data?.output_text ??
    data?.output?.flatMap((item: { content?: { text?: string }[] }) =>
      item.content?.map((content) => content.text).filter(Boolean) ?? [],
    )?.[0];

  if (!text) {
    return NextResponse.json(
      { error: "Screenshot recognition did not return text." },
      { status: 502 },
    );
  }

  try {
    return NextResponse.json(JSON.parse(text));
  } catch {
    return NextResponse.json(
      {
        error: "Screenshot recognition returned invalid JSON.",
        details: text,
      },
      { status: 502 },
    );
  }
}

async function isAuthenticated() {
  const cookieStore = await cookies();
  const value = cookieStore.get(getAdminCookieName())?.value;

  return isAdminSessionValueValid(value);
}

function getOpenAIError(data: unknown) {
  const error = data as { error?: { message?: string } };

  return error?.error?.message ?? JSON.stringify(data);
}
