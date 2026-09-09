"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { getSessionAllowInactive } from "@/lib/auth/session";

async function requireSupportSession() {
  const session = await getSessionAllowInactive();
  if (!session || session.kind !== "tenant" || !session.tenantId) throw new Error("FORBIDDEN");
  return session;
}

const TicketSchema = z.object({
  subject: z.string().min(3),
  category: z.string().optional(),
  message: z.string().min(10),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
});

export async function createSupportTicketAction(_prev: unknown, formData: FormData) {
  try {
    const session = await requireSupportSession();
    const parsed = TicketSchema.safeParse({
      subject: formData.get("subject"),
      category: formData.get("category") || undefined,
      message: formData.get("message"),
      priority: formData.get("priority") ?? "NORMAL",
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

    const data = parsed.data;
    const ticket = await db.$transaction(async (tx) => {
      const created = await tx.supportTicket.create({
        data: {
          companyId: session.tenantId!,
          subject: data.subject,
          category: data.category,
          message: data.message,
          priority: data.priority,
          status: "OPEN",
          createdByEmail: session.email,
          createdById: session.sub,
        },
      });
      await tx.supportMessage.create({
        data: {
          ticketId: created.id,
          authorId: session.sub,
          authorEmail: session.email,
          authorRole: session.role,
          body: data.message,
          isInternal: false,
        },
      });
      return created;
    });

    revalidatePath("/support");
    revalidatePath(`/support/${ticket.id}`);
    return { ok: true };
  } catch (error) {
    console.error("[support] createSupportTicketAction failed:", error);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}

const TicketReplySchema = z.object({
  ticketId: z.string().min(1),
  body: z.string().min(1),
});

export async function replyToSupportTicketAction(_prev: unknown, formData: FormData) {
  try {
    const session = await requireSupportSession();
    const parsed = TicketReplySchema.safeParse({
      ticketId: formData.get("ticketId"),
      body: formData.get("body"),
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

    const ticket = await db.supportTicket.findFirst({
      where: { id: parsed.data.ticketId, companyId: session.tenantId! },
      select: { id: true },
    });
    if (!ticket) return { ok: false, error: "Ticket not found" };

    await db.$transaction([
      db.supportMessage.create({
        data: {
          ticketId: ticket.id,
          authorId: session.sub,
          authorEmail: session.email,
          authorRole: session.role,
          body: parsed.data.body,
          isInternal: false,
        },
      }),
      db.supportTicket.update({
        where: { id: ticket.id },
        data: { status: "WAITING_CUSTOMER" },
      }),
    ]);

    revalidatePath(`/support/${ticket.id}`);
    revalidatePath("/support");
    return { ok: true };
  } catch (error) {
    console.error("[support] replyToSupportTicketAction failed:", error);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}
