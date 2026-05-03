import { Router } from "express";
import { db, agencySettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpdateSettingsBody } from "@workspace/api-zod";
import { blockDuringImpersonation } from "../middlewares/authMiddleware";

const router = Router();

async function getOrCreateSettings(userId: string) {
  const [existing] = await db
    .select()
    .from(agencySettingsTable)
    .where(eq(agencySettingsTable.userId, userId));

  if (existing) return existing;

  const [created] = await db
    .insert(agencySettingsTable)
    .values({
      userId,
      defaultGhlWidgetId: "69c5a088532eaeb30be7c36d",
      defaultChatPersonaName: "General AI Assistant",
      defaultVoiceAiPhone: "+1-555-555-5555",
      defaultCalendarLink: "https://calendly.com/",
    })
    .returning();

  return created;
}

router.get("/settings", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const settings = await getOrCreateSettings(req.user.id);
  res.json(settings);
});

router.patch("/settings", blockDuringImpersonation, async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data = parsed.data;
  const updates: Record<string, unknown> = {};

  if (data.agencyName !== undefined) updates.agencyName = data.agencyName;
  if (data.agencyWebsite !== undefined) updates.agencyWebsite = data.agencyWebsite;
  if (data.agencyLogoUrl !== undefined) updates.agencyLogoUrl = data.agencyLogoUrl;
  if (data.primaryBrandColor !== undefined) updates.primaryBrandColor = data.primaryBrandColor;
  if (data.secondaryBrandColor !== undefined) updates.secondaryBrandColor = data.secondaryBrandColor;
  if (data.defaultVoiceAiPhone !== undefined) updates.defaultVoiceAiPhone = data.defaultVoiceAiPhone;
  if (data.defaultVoicePersonaName !== undefined) updates.defaultVoicePersonaName = data.defaultVoicePersonaName;
  if (data.defaultCalendarLink !== undefined) updates.defaultCalendarLink = data.defaultCalendarLink;
  if (data.defaultGhlWidgetId !== undefined) {
    const v = data.defaultGhlWidgetId?.trim().replace(/^["'`]+|["'`]+$/g, "").trim();
    updates.defaultGhlWidgetId = v && v.length > 0 ? v : null;
  }
  if (data.defaultChatPersonaName !== undefined) updates.defaultChatPersonaName = data.defaultChatPersonaName;
  if (data.defaultTone !== undefined) updates.defaultTone = data.defaultTone;
  if (data.defaultPrimaryCta !== undefined) updates.defaultPrimaryCta = data.defaultPrimaryCta;
  if (data.defaultDisclaimer !== undefined) updates.defaultDisclaimer = data.defaultDisclaimer;

  await getOrCreateSettings(req.user.id);

  const [settings] = await db
    .update(agencySettingsTable)
    .set(updates)
    .where(eq(agencySettingsTable.userId, req.user.id))
    .returning();

  res.json(settings);
});

export default router;
