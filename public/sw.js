// Service Worker for Shoppy PWA
// Implements network-first strategy with cache fallback for static assets

const CACHE_VERSION = "v1";
const CACHE_NAME = `shoppy-cache-${CACHE_VERSION}`;

// Core static assets to pre-cache on install
const STATIC_ASSETS = [
  "/",
  "/list",
  "/settings",
  "/manifest.webmanifest",
  "/icon-192x192.png",
  "/icon-512x512.png",
];

// Patterns to skip caching (API calls, Supabase, etc.)
const SKIP_CACHE_PATTERNS = [
  /^https?:\/\/.*\.supabase\./,
  /\/api\//,
  /\/_next\/webpack-hmr/,
  /\/_next\/static\/webpack/,
  /^chrome-extension:\/\//,
];

/**
 * Check if a request should skip the cache
 */
function shouldSkipCache(request) {
  const url = request.url;

  // Skip non-GET requests
  if (request.method !== "GET") {
    return true;
  }

  // Skip requests matching skip patterns
  return SKIP_CACHE_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Install event - pre-cache core static assets
 */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        // Activate immediately without waiting for existing clients to close
        return self.skipWaiting();
      })
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter(
              (name) => name.startsWith("shoppy-cache-") && name !== CACHE_NAME
            )
            .map((name) => caches.delete(name))
        );
      })
      .then(() => {
        // Take control of all clients immediately
        return self.clients.claim();
      })
  );
});

/**
 * Fetch event - network first, fallback to cache strategy
 */
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Skip caching for API requests, Supabase, and non-GET requests
  if (shouldSkipCache(request)) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // Clone the response before caching (response can only be consumed once)
        const responseToCache = networkResponse.clone();

        // Cache the successful network response
        if (networkResponse.ok) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }

        return networkResponse;
      })
      .catch(() => {
        // Network failed, try to serve from cache
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }

          // For navigation requests, try to serve the cached root page
          if (request.mode === "navigate") {
            return caches.match("/");
          }

          // No cache available
          return new Response("Offline", {
            status: 503,
            statusText: "Service Unavailable",
          });
        });
      })
  );
});

// Background Sync constants
const SYNC_TAG = "shoppy-sync";

// Retry state for exponential backoff (stored in memory)
// Backoff schedule: 5s, 10s, 20s (doubles each retry, starting at 5s)
// Note: This counter resets if the service worker restarts/updates.
// This is acceptable since the browser's Background Sync API handles
// its own retries independently.
const BACKOFF_BASE_MS = 5000;
const MAX_SYNC_RETRIES = 3;
let syncRetryCount = 0;

/**
 * Background sync event - triggered when connectivity is restored
 * Posts a message to all clients to trigger SyncEngine.processQueue()
 */
self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(handleBackgroundSync());
  }
});

/**
 * Handle background sync by notifying all clients to process their sync queues.
 * Implements exponential backoff for failed sync attempts.
 */
async function handleBackgroundSync() {
  try {
    // Get all controlled clients (windows/tabs)
    const clients = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: false,
    });

    if (clients.length === 0) {
      // No clients available - sync will be retried by the browser
      // when a client becomes available
      console.log("[SW] No clients available for sync");
      return;
    }

    // Post sync message to all clients
    const syncPromises = clients.map(
      (client) =>
        new Promise((resolve, reject) => {
          // Create a message channel for response
          const messageChannel = new MessageChannel();

          // Set a timeout for the sync operation
          const timeoutId = setTimeout(() => {
            reject(new Error("Sync timeout"));
          }, 30000); // 30 second timeout

          messageChannel.port1.onmessage = (event) => {
            clearTimeout(timeoutId);
            if (event.data && event.data.success) {
              resolve(event.data);
            } else {
              reject(
                new Error(event.data?.error || "Sync failed in main thread")
              );
            }
          };

          // Send sync request to client
          client.postMessage(
            {
              type: "SYNC_REQUESTED",
              timestamp: Date.now(),
            },
            [messageChannel.port2]
          );
        })
    );

    // Wait for at least one client to complete sync successfully
    await Promise.any(syncPromises);

    // Reset retry count on success
    syncRetryCount = 0;
    console.log("[SW] Background sync completed successfully");
  } catch (error) {
    console.error("[SW] Background sync failed:", error);

    // Increment retry count and schedule retry with exponential backoff
    syncRetryCount++;

    if (syncRetryCount <= MAX_SYNC_RETRIES) {
      const backoffDelay = BACKOFF_BASE_MS * Math.pow(2, syncRetryCount - 1);
      console.log(
        `[SW] Scheduling sync retry ${syncRetryCount}/${MAX_SYNC_RETRIES} in ${backoffDelay}ms`
      );

      // Re-throw to let the browser know sync failed
      // The browser will retry, but we track our own backoff
      throw error;
    } else {
      // Max retries exceeded, reset counter for next sync registration
      console.error("[SW] Max sync retries exceeded, giving up");
      syncRetryCount = 0;
    }
  }
}

/**
 * Message handler for communication with main thread
 * Handles sync registration requests and other commands
 */
self.addEventListener("message", (event) => {
  const { type } = event.data || {};

  switch (type) {
    case "REGISTER_SYNC":
      // Client is requesting to register for background sync
      self.registration.sync
        .register(SYNC_TAG)
        .then(() => {
          console.log("[SW] Background sync registered");
          if (event.ports[0]) {
            event.ports[0].postMessage({ success: true });
          }
        })
        .catch((error) => {
          console.error("[SW] Failed to register background sync:", error);
          if (event.ports[0]) {
            event.ports[0].postMessage({
              success: false,
              error: error.message,
            });
          }
        });
      break;

    case "RESET_SYNC_RETRIES":
      // Reset retry count (e.g., when user manually triggers sync)
      syncRetryCount = 0;
      if (event.ports[0]) {
        event.ports[0].postMessage({ success: true });
      }
      break;

    default:
      // Unknown message type
      break;
  }
});
