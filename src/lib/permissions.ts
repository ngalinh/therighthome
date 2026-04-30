import { prisma } from "@/lib/prisma";
import type { BuildingPermission, UserRole } from "@prisma/client";

export type Capability =
  | "building.read"
  | "building.write"
  | "contract.read"
  | "contract.write"
  | "invoice.read"
  | "invoice.write"
  | "invoice.send"
  | "finance.read"
  | "finance.write"
  | "settings.read"
  | "settings.write"
  | "admin";

const PERMISSION_MATRIX: Record<BuildingPermission, Capability[]> = {
  OWNER: [
    "building.read", "building.write",
    "contract.read", "contract.write",
    "invoice.read", "invoice.write", "invoice.send",
    "finance.read", "finance.write",
    "settings.read", "settings.write",
  ],
  MANAGER: [
    "building.read",
    "contract.read", "contract.write",
    "invoice.read", "invoice.write", "invoice.send",
    "finance.read", "finance.write",
    "settings.read",
  ],
  ACCOUNTANT: [
    "building.read",
    "contract.read",
    "invoice.read",
    "finance.read", "finance.write",
    "settings.read",
  ],
  VIEWER: [
    "building.read",
    "contract.read",
    "invoice.read",
    "finance.read",
    "settings.read",
  ],
};

export async function userBuildings(userId: string) {
  return prisma.userBuildingPermission.findMany({
    where: { userId },
    include: { building: true },
    orderBy: { building: { name: "asc" } },
  });
}

export async function listAccessibleBuildings(userId: string, role: UserRole) {
  if (role === "ADMIN") {
    return prisma.building.findMany({ orderBy: { name: "asc" } });
  }
  const perms = await userBuildings(userId);
  return perms.map((p) => p.building);
}

export async function getBuildingPermission(userId: string, role: UserRole, buildingId: string) {
  if (role === "ADMIN") return "OWNER" as BuildingPermission;
  const p = await prisma.userBuildingPermission.findUnique({
    where: { userId_buildingId: { userId, buildingId } },
  });
  return p?.permission ?? null;
}

export async function can(
  userId: string,
  role: UserRole,
  buildingId: string,
  capability: Capability,
): Promise<boolean> {
  if (role === "ADMIN") return true;
  const perm = await getBuildingPermission(userId, role, buildingId);
  if (!perm) return false;
  return PERMISSION_MATRIX[perm].includes(capability);
}

export async function requireBuildingAccess(
  userId: string,
  role: UserRole,
  buildingId: string,
  capability: Capability,
) {
  const ok = await can(userId, role, buildingId, capability);
  if (!ok) throw new Error("Forbidden");
}
