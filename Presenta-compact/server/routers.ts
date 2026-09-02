import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import pptxgenModule from "pptxgenjs";
import { createPresentation, deletePresentation, getPresentationById, listPresentationsByUserId, updatePresentation } from "./db";

const PptxGenJS = (pptxgenModule as unknown as { default?: typeof pptxgenModule }).default ?? pptxgenModule;

const themeSchema = z.enum(["Corporate Blue", "Vibrant Purple", "Forest Green", "Minimal Dark"]);
const slideSchema = z.object({
  title: z.string().min(1).max(180),
  bullet_points: z.array(z.string().min(1).max(240)).min(2).max(6),
  speaker_notes: z.string().max(1200).optional().nullable(),
});
const customizationSchema = z.object({
  accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#E85D4A"),
  font: z.enum(["editorial", "modern", "classic"]).default("editorial"),
  density: z.enum(["airy", "compact"]).default("airy"),
  footer: z.string().trim().max(40).default("Deckcraft Studio"),
});
const presentationSchema = z.object({
  topic: z.string().trim().min(3).max(120),
  num_slides: z.number().int().min(3).max(10),
  theme: themeSchema,
});
export const deckSchema = z.object({ topic: z.string().min(1).max(120), slides: z.array(slideSchema).min(3).max(10), theme: themeSchema, customization: customizationSchema.default({ accent: "#E85D4A", font: "editorial", density: "airy", footer: "Deckcraft Studio" }) });

type ThemeConfig = { background: string; ink: string; accent: string; muted: string; light: string };
const themeConfigs: Record<z.infer<typeof themeSchema>, ThemeConfig> = {
  "Corporate Blue": { background: "F4F7FA", ink: "18324B", accent: "2B78A8", muted: "5A748A", light: "E7F0F5" },
  "Vibrant Purple": { background: "FBF7FE", ink: "332246", accent: "9C50C5", muted: "765F86", light: "F1E5F7" },
  "Forest Green": { background: "F5FAF5", ink: "1D3B2B", accent: "4E8A61", muted: "607A68", light: "E2F0E4" },
  "Minimal Dark": { background: "171717", ink: "F8F3EB", accent: "E85D4A", muted: "B1AAA0", light: "2C2C2C" },
};

async function generateWithGemini(input: z.infer<typeof presentationSchema>) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Gemini is not configured. Add GEMINI_API_KEY in project secrets." });

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: "You are an expert presentation editor. Create a sharp, coherent slide outline. Return only valid JSON matching the requested schema. Avoid filler, repetition, and unsupported statistics." }] },
      contents: [{ role: "user", parts: [{ text: `Create a ${input.num_slides}-slide presentation about: ${input.topic}. Visual direction: ${input.theme}. Slide 1 should be a strong title/point-of-view slide. Every slide needs a concise title and 3-5 specific bullet points. Include speaker_notes only when they add useful delivery context.` }] }],
      generationConfig: {
        temperature: 0.65,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: { topic: { type: "STRING" }, slides: { type: "ARRAY", items: { type: "OBJECT", properties: { title: { type: "STRING" }, bullet_points: { type: "ARRAY", items: { type: "STRING" } }, speaker_notes: { type: "STRING", nullable: true } }, required: ["title", "bullet_points"], propertyOrdering: ["title", "bullet_points", "speaker_notes"] } } },
          required: ["topic", "slides"],
          propertyOrdering: ["topic", "slides"],
        },
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("[Gemini] generation failed", response.status, detail.slice(0, 500));
    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after");
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: retryAfter ? `AI generation is temporarily busy. Try again in ${retryAfter} seconds.` : "AI generation is temporarily busy. Please wait a moment and try again." });
    }
    throw new TRPCError({ code: "BAD_GATEWAY", message: "Gemini could not generate the outline. Try a more specific topic." });
  }
  const payload = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const raw = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new TRPCError({ code: "BAD_GATEWAY", message: "Gemini returned an empty outline. Please try again." });
  try {
    const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ""));
    const validated = z.object({ topic: z.string(), slides: z.array(slideSchema).min(3).max(10) }).parse(parsed);
    return { topic: validated.topic || input.topic, slides: validated.slides, theme: input.theme };
  } catch (error) {
    console.error("[Gemini] invalid structured output", error);
    throw new TRPCError({ code: "BAD_GATEWAY", message: "The generated outline was not valid. Please try again." });
  }
}

export async function buildPptx(input: z.infer<typeof deckSchema>) {
  const config = themeConfigs[input.theme];
  const customization = input.customization;
  const accent = customization.accent;
  const fonts = customization.font === "modern" ? { heading: "Aptos Display", body: "Aptos" } : customization.font === "classic" ? { heading: "Georgia", body: "Arial" } : { heading: "Aptos Display", body: "Aptos" };
  const bulletGap = customization.density === "compact" ? 0.44 : 0.58;
  const bulletFontSize = customization.density === "compact" ? 14 : 16;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Deckcraft";
  pptx.subject = input.topic;
  pptx.title = input.topic;
  pptx.company = "Deckcraft Studio";
  pptx.theme = { headFontFace: "Aptos Display", bodyFontFace: "Aptos" };

  input.slides.forEach((slideData, index) => {
    const slide = pptx.addSlide();
    slide.background = { color: config.background };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.18, h: 7.5, fill: { color: accent.replace("#", "") }, line: { color: accent.replace("#", "") } });
    slide.addText(String(index + 1).padStart(2, "0"), { x: 0.55, y: 0.42, w: 0.4, h: 0.25, fontFace: "Aptos Mono", fontSize: 10, color: config.accent, margin: 0, bold: true });
    slide.addText(index === 0 ? input.topic : slideData.title, { x: 0.55, y: index === 0 ? 1.3 : 0.95, w: 11.6, h: index === 0 ? 1.4 : 0.9, fontFace: fonts.heading, fontSize: index === 0 ? 30 : 25, bold: true, color: config.ink, margin: 0, breakLine: false, fit: "shrink" });
    if (index === 0) slide.addText(slideData.title, { x: 0.58, y: 3.05, w: 8.9, h: 0.65, fontFace: fonts.body, fontSize: 18, color: config.muted, margin: 0, italic: true, fit: "shrink" });
    slide.addShape(pptx.ShapeType.line, { x: 0.58, y: index === 0 ? 4.15 : 1.95, w: 10.9, h: 0, line: { color: accent.replace("#", ""), width: 1.5 } });
    const bulletY = index === 0 ? 4.55 : 2.35;
    slideData.bullet_points.forEach((bullet, bulletIndex) => {
      slide.addText(bullet, { x: 0.83, y: bulletY + bulletIndex * bulletGap, w: 10.5, h: 0.38, fontFace: fonts.body, fontSize: bulletFontSize, color: config.ink, margin: 0, bullet: { indent: 14 }, breakLine: false, fit: "shrink" });
    });
    slide.addText(customization.footer.toUpperCase(), { x: 0.58, y: 7.05, w: 3, h: 0.2, fontFace: "Aptos Mono", fontSize: 8, color: config.muted, margin: 0, charSpacing: 1.2 });
    slide.addText(`${String(index + 1).padStart(2, "0")} / ${String(input.slides.length).padStart(2, "0")}`, { x: 10.6, y: 7.05, w: 1.6, h: 0.2, align: "right", fontFace: "Aptos Mono", fontSize: 8, color: config.muted, margin: 0 });
    if (slideData.speaker_notes) slide.addNotes(slideData.speaker_notes);
  });

  const base64 = await pptx.write({ outputType: "base64" });
  return typeof base64 === "string" ? base64 : Buffer.from(base64 as ArrayBuffer).toString("base64");
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  presentation: router({
    generatePreview: publicProcedure.input(presentationSchema).mutation(({ input }) => generateWithGemini(input)),
    exportPptx: publicProcedure.input(deckSchema).mutation(async ({ input }) => ({ filename: `${input.topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "deckcraft-presentation"}.pptx`, mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", base64: await buildPptx(input) })),
    listSaved: protectedProcedure.query(async ({ ctx }) => (await listPresentationsByUserId(ctx.user.id)).map((item) => ({ ...item, customization: JSON.parse(item.customization), slides: JSON.parse(item.slides) }))),
    getSaved: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const item = await getPresentationById(ctx.user.id, input.id);
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Presentation not found." });
      return { ...item, customization: JSON.parse(item.customization), slides: JSON.parse(item.slides) };
    }),
    save: protectedProcedure.input(deckSchema.extend({ id: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
      const payload = { userId: ctx.user.id, topic: input.topic, theme: input.theme, customization: JSON.stringify(input.customization), slides: JSON.stringify(input.slides) };
      if (input.id) {
        const existing = await getPresentationById(ctx.user.id, input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Presentation not found." });
        await updatePresentation(ctx.user.id, input.id, payload);
        return { id: input.id };
      }
      return { id: await createPresentation(payload) };
    }),
    removeSaved: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const existing = await getPresentationById(ctx.user.id, input.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Presentation not found." });
      await deletePresentation(ctx.user.id, input.id);
      return { success: true as const };
    }),
  }),
});

export type AppRouter = typeof appRouter;
