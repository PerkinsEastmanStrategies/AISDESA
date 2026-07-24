import { seedAllisonEsFinalizedDemo } from "@/lib/seed-allison-es-demo"
import { seedDavisEsQaDemo } from "@/lib/seed-davis-es-demo"

/** Seed Allison (Finalized) and Davis (Ready for QA) together. */
export function seedAdminEsDemos(): void {
  seedAllisonEsFinalizedDemo()
  seedDavisEsQaDemo()
}
