// T10 - POST /api/docker/scan — scan running Docker containers and return
// recommended link metadata. Requires authentication.
//
// Reads the NAS host address from the Setting store (key "nas:hostAddress") so
// the scanner can build URLs of the form http://<host>:<publicPort>.
//
// For each scanned container, we also check whether it is already imported
// (by containerId on the Link table) and attach an `alreadyImported` flag.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-guard";
import { scanContainers } from "@/lib/docker-scan";

const HOST_ADDRESS_KEY = "nas:hostAddress";

export async function POST(req: NextRequest) {
  const guard = await requireAuth();
  if (!guard.authenticated) return guard.response;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  // Allow the client to override the host address per-request (e.g. after
  // editing Settings but before refreshing). Falls back to the stored Setting.
  const clientHost = typeof body.hostAddress === "string" && body.hostAddress.trim()
    ? body.hostAddress.trim()
    : null;

  let storedHost = clientHost;
  if (!storedHost) {
    const row = await db.setting.findUnique({ where: { key: HOST_ADDRESS_KEY } });
    storedHost = row?.value ?? null;
  }

  // Pre-fetch already-imported container ids (source DOCKER_SCAN) for marking.
  const importedLinks = await db.link.findMany({
    where: { source: "DOCKER_SCAN", containerId: { not: null } },
    select: { containerId: true, id: true },
  });
  const importedByContainerId = new Map<string, string>(
    importedLinks.map((l) => [l.containerId!, l.id]),
  );

  const { containers, dockerAvailable, error } = await scanContainers(storedHost ?? undefined);

  return NextResponse.json({
    containers: containers.map((c) => ({
      id: c.id,
      shortId: c.shortId,
      name: c.name,
      image: c.image,
      status: c.status,
      url: c.url,
      publicPort: c.publicPort,
      hasPortMapping: c.hasPortMapping,
      labels: c.labels,
      lanboard: c.lanboard,
      title: c.title,
      icon: c.icon,
      category: c.category,
      recommendedUrl: c.recommendedUrl,
      alreadyImported: importedByContainerId.has(c.id),
      existingLinkId: importedByContainerId.get(c.id) ?? null,
    })),
    dockerAvailable,
    hostAddress: storedHost,
    error,
  });
}
