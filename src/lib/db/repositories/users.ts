// The `users` table IS the scoping root — its functions are keyed by
// username or user id directly, never by a userId filter (unlike every
// other repository module in this directory).
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users, type User } from "@/lib/db/schema";

export async function getUserByUsername(username: string): Promise<User | null> {
  const [row] = await db.select().from(users).where(eq(users.username, username));
  return row ?? null;
}

export async function getUserById(id: string): Promise<User | null> {
  const [row] = await db.select().from(users).where(eq(users.id, id));
  return row ?? null;
}

export async function createUser(username: string, passwordHash: string): Promise<User | null> {
  const [row] = await db
    .insert(users)
    .values({ username, passwordHash })
    .onConflictDoNothing({ target: users.username })
    .returning();
  return row ?? null;
}

export async function updatePasswordHash(userId: string, passwordHash: string): Promise<string | null> {
  const [row] = await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, userId))
    .returning({ id: users.id });
  return row?.id ?? null;
}
