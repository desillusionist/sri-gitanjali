import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { secondaryTranslationLanguageCodes, translateAndCacheVerse, translateAndCacheVerses } from "./secondaryTranslations";

const translationRequestsByAddress = new Map<string, number[]>();

function permitTranslationRequest(address: string) {
  const threshold = Date.now() - 60 * 60 * 1_000;
  const recent = (translationRequestsByAddress.get(address) ?? []).filter((timestamp) => timestamp > threshold);
  // Progressive translation uses one request per verse. The higher ceiling
  // preserves the former per-song reader experience while retaining a bound
  // on public LLM usage from a single address.
  if (recent.length >= 120) return false;
  recent.push(Date.now());
  translationRequestsByAddress.set(address, recent);
  return true;
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  secondaryTranslation: router({
    translateVerse: publicProcedure
      .input(z.object({
        language: z.enum(secondaryTranslationLanguageCodes),
        verse: z.object({
          verseId: z.string().regex(/^[a-z0-9-]{1,160}::verse-\d+$/).max(192),
          englishText: z.string().min(1).max(3_200),
        }),
      }))
      .mutation(async ({ ctx, input }) => {
        const address = ctx.req.ip || ctx.req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || "anonymous";
        if (!permitTranslationRequest(address)) throw new Error("Please wait before requesting more translations.");
        return { translation: await translateAndCacheVerse(input.language, input.verse) };
      }),
    translateSong: publicProcedure
      .input(z.object({
        language: z.enum(secondaryTranslationLanguageCodes),
        verses: z.array(z.object({
          verseId: z.string().regex(/^[a-z0-9-]{1,160}::verse-\d+$/).max(192),
          englishText: z.string().min(1).max(3_200),
        })).min(1).max(80),
      }).refine((value) => value.verses.reduce((total, verse) => total + verse.englishText.length, 0) <= 60_000, {
        message: "The selected song is too long to translate in one request.",
      }))
      .mutation(async ({ ctx, input }) => {
        const address = ctx.req.ip || ctx.req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || "anonymous";
        if (!permitTranslationRequest(address)) throw new Error("Please wait before requesting more translations.");
        return { translations: await translateAndCacheVerses(input.language, input.verses) };
      }),
  }),
});

export type AppRouter = typeof appRouter;
