/// <reference lib="webworker" />
// Service worker for push notifications
// This file is processed by vite-plugin-pwa with injectManifest strategy

// @ts-expect-error - Workbox types not available
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching"

// Vite PWA injects this
declare const __WB_MANIFEST: unknown[]

// Precache all assets
precacheAndRoute(__WB_MANIFEST)
cleanupOutdatedCaches()

// Handle push events - display notification
self.addEventListener("push", (event: PushEvent) => {
  console.log("[SW] Push event received")

  let data = {
    title: "OpenCode",
    body: "You have a new notification",
    icon: "/web-app-manifest-192x192.png",
    badge: "/favicon-96x96.png",
    data: {} as Record<string, unknown>,
  }

  if (event.data) {
    try {
      const payload = event.data.json()
      data = { ...data, ...payload }
    } catch {
      // If not JSON, treat as text
      data.body = event.data.text()
    }
  }

  const promiseChain = self.registration.showNotification(data.title, {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    data: data.data,
    requireInteraction: false,
    silent: false,
  })

  event.waitUntil(promiseChain)
})

// Handle notification click - navigate to relevant page
self.addEventListener("notificationclick", (event: NotificationEvent) => {
  console.log("[SW] Notification click received")

  event.notification.close()

  // Get the URL to open from notification data
  const urlToOpen = (event.notification.data as { href?: string })?.href || "/"

  // Focus existing window or open new one
  const promiseChain = self.clients
    .matchAll({
      type: "window",
      includeUncontrolled: true,
    })
    .then((windowClients) => {
      // Check if there's already a window open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          // Navigate to the URL and focus
          if ("navigate" in client) {
            ;(client as WindowClient).navigate(urlToOpen)
          }
          return client.focus()
        }
      }
      // No window open, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen)
      }
    })

  event.waitUntil(promiseChain)
})

// Handle push subscription change
self.addEventListener("pushsubscriptionchange", (event: Event) => {
  console.log("[SW] Push subscription changed")

  // In a real app, you'd want to send the new subscription to your server
  const subscription = (event as PushSubscriptionChangeEvent).newSubscription
  if (subscription) {
    console.log("[SW] New subscription:", subscription.endpoint)
    // TODO: Send new subscription to server via fetch
  }
})

export {}
