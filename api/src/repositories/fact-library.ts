import { eq, and } from "drizzle-orm";
import { db } from "../db/connection";
import { factLibrary } from "../db/schema";

export const factLibraryRepository = {
  async findByNiche(niche: string) {
    return db.select().from(factLibrary).where(eq(factLibrary.niche, niche));
  },

  async findByNicheAndCategory(niche: string, category: string) {
    return db
      .select()
      .from(factLibrary)
      .where(
        and(eq(factLibrary.niche, niche), eq(factLibrary.category, category))
      );
  },

  async upsert(data: typeof factLibrary.$inferInsert) {
    return db
      .insert(factLibrary)
      .values(data)
      .onConflictDoNothing()
      .returning();
  },

  async bulkInsert(facts: (typeof factLibrary.$inferInsert)[]) {
    if (facts.length === 0) return [];
    return db.insert(factLibrary).values(facts).onConflictDoNothing().returning();
  },
};
