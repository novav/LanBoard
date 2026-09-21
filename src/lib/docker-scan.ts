// T10 - Docker container scanning engine using dockerode.
//
// Connects to the Docker Engine via the unix socket at /var/run/docker.sock,
// lists running containers, and extracts service metadata (name, image, ports,
// labels). Supports lanboard.* labels to override the recommended link data.
//
// Gracefully handles the case where the socket is absent or permission-denied:
// the caller receives { dockerAvailable: false, error }.

import Dockerode from "dockerode";

const DOCKER_SOCKET = "/var/run/docker.sock";

/**
 * A scanned container with its inferred link metadata.
 */
export type ContainerInfo = {
  /** Docker container id (full 64-char). Used for de-duplication. */
  id: string;
  /** Short id (12 chars). Used for display. */
  shortId: string;
  /** Container name without leading "/". */
  name: string;
  /** Image reference, e.g. "nextcloud:latest". */
  image: string;
  /** Status string, e.g. "Up 2 days". */
  status: string;
  /** Inferred public URL (null when no host port mapping found). */
  url: string | null;
  /** The public host port used for the inferred URL (or null). */
  publicPort: number | null;
  /** Whether a host port mapping was detected. */
  hasPortMapping: boolean;
  /** All original container labels. */
  labels: Record<string, string>;
  /** Resolved lanboard.* label overrides (null when not set). */
  lanboard: {
    enable: boolean | null;
    name: string | null;
    icon: string | null;
    category: string | null;
    url: string | null;
  };
  /** Recommended link title (lanboard.name or container name). */
  title: string;
  /** Recommended link icon (lanboard.icon or image slug). */
  icon: string | null;
  /** Recommended category name (lanboard.category or container name). */
  category: string;
  /** Final recommended URL (lanboard.url or inferred URL). */
  recommendedUrl: string | null;
};

/**
 * Whether the Docker socket is reachable on this host.
 * Useful for early UI guidance without launching a full scan.
 */
export async function isDockerSocketAvailable(): Promise<boolean> {
  const fs = await import("fs").then((m) => m.promises);
  try {
    await fs.access(DOCKER_SOCKET);
    return true;
  } catch {
    return false;
  }
}

/**
 * Scan running Docker containers and return recommended link data.
 *
 * @param hostAddress - The NAS LAN address used to build URLs
 *   (http://<host>:<publicPort>). May be a bare hostname or a full URL;
 *   a bare hostname is wrapped with http://.
 */
export async function scanContainers(
  hostAddress?: string,
): Promise<{
  containers: ContainerInfo[];
  dockerAvailable: boolean;
  error?: string;
}> {
  const docker = new Dockerode({ socketPath: DOCKER_SOCKET });

  try {
    const list = await docker.listContainers({ all: false });
    const nasHost = resolveNasHost(hostAddress);

    // Process containers with full inspection for host-mode detection
    const containers: ContainerInfo[] = await Promise.all(
      list.map(async (c: Dockerode.ContainerInfo) => {
        const names = c.Names ?? ["/unnamed"];
        const name = names[0].replace(/^\//, "") || "unnamed";
        const image = c.Image ?? "unknown";
        const status = c.Status ?? "unknown";
        const id = c.Id ?? "";

        const labels = c.Labels ?? {};
        const lb = readLanboardLabels(labels);

        // For host-mode containers, Ports array is empty - need to inspect
        let ports = c.Ports;
        let isHostNetwork = c.HostConfig?.NetworkMode === "host";

        // If no ports detected, inspect container to check for host mode
        if ((!ports || ports.length === 0) && id) {
          try {
            const container = docker.getContainer(id);
            const inspectData = await container.inspect();
            isHostNetwork = inspectData.HostConfig?.NetworkMode === "host";

            // Extract ports from PortBindings for host-mode containers
            if (isHostNetwork && inspectData.HostConfig?.PortBindings) {
              const portBindings = inspectData.HostConfig.PortBindings;
              ports = Object.keys(portBindings).map((key) => {
                const portNum = parseInt(key.split('/')[0], 10);
                return {
                  PrivatePort: portNum,
                  Type: 'tcp',
                } as Dockerode.Port;
              });
            }
          } catch (inspectErr) {
            // Inspection failed, continue with empty ports
          }
        }

        const { url, publicPort, hasPortMapping } = inferUrl(ports, nasHost, isHostNetwork);

        const title = lb.name || name;
        const icon = lb.icon || imageToIcon(image);
        const category = lb.category || name;
        const recommendedUrl = lb.url || url;

        return {
          id,
          shortId: id.slice(0, 12),
          name,
          image,
          status,
          url,
          publicPort,
          hasPortMapping,
          labels,
          lanboard: lb,
          title,
          icon,
          category,
          recommendedUrl,
        };
      })
    );

    return { containers, dockerAvailable: true };
  } catch (err: unknown) {
    const message = dockerErrorToUserMessage(err);
    return { containers: [], dockerAvailable: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Resolve a clean hostname for URL building.
 *
 * - Bare hostname/ip ("192.168.1.50") -> "192.168.1.50"
 * - Full http(s) url ("https://192.168.1.50") -> "192.168.1.50"
 * - Empty/missing -> null (caller must handle).
 */
function resolveNasHost(host?: string): string | null {
  if (!host || !host.trim()) return null;
  const trimmed = host.trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("http://")) return trimmed.slice(7);
  if (lower.startsWith("https://")) return trimmed.slice(8);
  return trimmed;
}

/**
 * Infer a URL from host port mappings.
 *
 * dockerode's ContainerInfo.Ports is an array of Port objects with keys:
 *   IP, PrivatePort, PublicPort, Type
 *
 * For bridge mode: use PublicPort (host-mapped port)
 * For host mode: use PrivatePort (container listens directly on host)
 */
function inferUrl(
  ports: Dockerode.Port[] | undefined,
  nasHost: string | null,
  isHostNetwork: boolean = false,
): { url: string | null; publicPort: number | null; hasPortMapping: boolean } {
  if (!ports || ports.length === 0) {
    return { url: null, publicPort: null, hasPortMapping: false };
  }

  // Common web ports, sorted by priority
  const WEB_PORTS = [80, 443, 8096, 8080, 8443, 3000, 5000, 8000, 8920];

  // Collect all available ports
  const availablePorts: Array<{ port: number; isHttps: boolean }> = [];

  for (const p of ports) {
    let port: number | undefined;

    if (isHostNetwork) {
      // Host mode: use PrivatePort directly
      port = p.PrivatePort;
    } else {
      // Bridge mode: use PublicPort
      port = p.PublicPort;
    }

    if (port) {
      availablePorts.push({
        port,
        isHttps: port === 443 || port === 8443 || port === 8920,
      });
    }
  }

  if (availablePorts.length === 0) {
    return { url: null, publicPort: null, hasPortMapping: false };
  }

  // Prioritize common web ports
  const preferred = availablePorts.find(p => WEB_PORTS.includes(p.port));
  const chosen = preferred || availablePorts[0];

  const protocol = chosen.isHttps ? 'https' : 'http';

  return {
    url: nasHost ? `${protocol}://${nasHost}:${chosen.port}` : null,
    publicPort: chosen.port,
    hasPortMapping: true,
  };
}

/**
 * Derive an icon slug from an image reference.
 *
 * "nextcloud:latest" -> "nextcloud"
 * "ghcr.io/user/myapp:v1" -> "myapp"
 */
function imageToIcon(image: string): string | null {
  const noTag = image.replace(/[:@].*$/, "");
  const parts = noTag.split("/");
  return parts[parts.length - 1] || null;
}

function readLanboardLabels(
  labels: Record<string, string>,
): ContainerInfo["lanboard"] {
  const maybe = (k: string) => {
    const v = labels[k];
    return v ? v.trim() : null;
  };

  const enableRaw = labels["lanboard.enable"];
  const enable: boolean | null =
    enableRaw === "true"
      ? true
      : enableRaw === "false"
        ? false
        : null;

  return {
    enable,
    name: maybe("lanboard.name"),
    icon: maybe("lanboard.icon"),
    category: maybe("lanboard.category"),
    url: maybe("lanboard.url"),
  };
}

function dockerErrorToUserMessage(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes("eacces") || msg.includes("permission denied")) {
      return "Access denied to Docker socket. Check the LANBOARD_DOCKER_ENABLED permission hint.";
    }
    if (msg.includes("enoent") || msg.includes("cannot connect")) {
      return "Docker socket not found at /var/run/docker.sock. Mount it into the container.";
    }
    if (msg.includes("econnrefused")) {
      return "Docker daemon is not reachable at /var/run/docker.sock.";
    }
    return err.message;
  }
  return "Unknown Docker error.";
}
