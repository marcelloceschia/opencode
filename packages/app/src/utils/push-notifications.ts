// Push notification utilities for PWA
// Works with Safari/iOS 16.4+ when app is added to Home Screen

export type PushSubscriptionData = {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

export type PushNotificationState = {
  isSupported: boolean
  isSubscribed: boolean
  permission: NotificationPermission | "not-supported"
  subscription: PushSubscriptionData | null
}

// VAPID public key - will be generated on server and injected at build time
// For now, this is a placeholder that will be replaced by server-provided key
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ""

/**
 * Check if push notifications are supported
 * Safari/iOS requires the app to be installed (added to Home Screen)
 */
export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window
}

/**
 * Get the current push notification state
 */
export async function getPushState(): Promise<PushNotificationState> {
  if (!isPushSupported()) {
    return {
      isSupported: false,
      isSubscribed: false,
      permission: "not-supported",
      subscription: null,
    }
  }

  const permission = Notification.permission

  if (permission !== "granted") {
    return {
      isSupported: true,
      isSubscribed: false,
      permission,
      subscription: null,
    }
  }

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()

    return {
      isSupported: true,
      isSubscribed: !!subscription,
      permission,
      subscription: subscription ? subscriptionToData(subscription) : null,
    }
  } catch (error) {
    console.error("Failed to get push state:", error)
    return {
      isSupported: true,
      isSubscribed: false,
      permission,
      subscription: null,
    }
  }
}

/**
 * Request permission and subscribe to push notifications
 * On iOS, this must be triggered by a user gesture (click/tap)
 */
export async function subscribeToPush(
  serverUrl: string,
): Promise<{ success: boolean; subscription?: PushSubscriptionData; error?: string }> {
  if (!isPushSupported()) {
    return { success: false, error: "Push notifications not supported" }
  }

  try {
    // Request notification permission
    const permission = await Notification.requestPermission()
    if (permission !== "granted") {
      return { success: false, error: "Notification permission denied" }
    }

    // Wait for service worker to be ready
    const registration = await navigator.serviceWorker.ready

    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    const subscriptionData = subscriptionToData(subscription)

    // Send subscription to server
    const response = await fetch(`${serverUrl}/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscriptionData),
    })

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`)
    }

    return { success: true, subscription: subscriptionData }
  } catch (error) {
    console.error("Failed to subscribe:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(
  serverUrl: string,
): Promise<{ success: boolean; error?: string }> {
  if (!isPushSupported()) {
    return { success: false, error: "Push notifications not supported" }
  }

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()

    if (subscription) {
      // Unsubscribe from push service
      await subscription.unsubscribe()

      // Notify server
      const subscriptionData = subscriptionToData(subscription)
      await fetch(`${serverUrl}/push/unsubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscriptionData),
      })
    }

    return { success: true }
  } catch (error) {
    console.error("Failed to unsubscribe:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Convert PushSubscription to data object
 */
function subscriptionToData(subscription: PushSubscription): PushSubscriptionData {
  const json = subscription.toJSON()
  return {
    endpoint: json.endpoint!,
    keys: {
      p256dh: json.keys!.p256dh!,
      auth: json.keys!.auth!,
    },
  }
}

/**
 * Convert base64 VAPID key to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray.buffer
}
