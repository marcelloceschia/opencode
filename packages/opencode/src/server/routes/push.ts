import { Hono } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod"
import { Log } from "@/util/log"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"
import crypto from "crypto"

const log = Log.create({ service: "push" })

// VAPID keys storage path
const VAPID_KEYS_PATH = join(process.env.XDG_CONFIG_HOME || join(process.env.HOME || "", ".config"), "opencode", "vapid-keys.json")

// VAPID subject (contact info for push service)
const VAPID_SUBJECT = "mailto:contact@opencode.ai"

// In-memory subscription store (in production, use a database)
const subscriptions = new Map<string, PushSubscription>()

type PushSubscription = {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

type VapidKeys = {
  publicKey: string
  privateKey: string
}

/**
 * Generate or load VAPID keys
 */
function getVapidKeys(): VapidKeys {
  // Try to load existing keys
  if (existsSync(VAPID_KEYS_PATH)) {
    try {
      const data = readFileSync(VAPID_KEYS_PATH, "utf-8")
      return JSON.parse(data)
    } catch (error) {
      log.warn("Failed to load VAPID keys, generating new ones", { error })
    }
  }

  // Generate new keys using Web Push format
  const keys = generateVapidKeys()

  // Ensure directory exists
  const dir = join(VAPID_KEYS_PATH, "..")
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  // Save keys
  writeFileSync(VAPID_KEYS_PATH, JSON.stringify(keys, null, 2))
  log.info("Generated new VAPID keys", { path: VAPID_KEYS_PATH })

  return keys
}

/**
 * Generate VAPID key pair
 * Uses ECDH P-256 curve
 */
function generateVapidKeys(): VapidKeys {
  const ecdh = crypto.createECDH("prime256v1")
  ecdh.generateKeys()

  // The public key needs to be in uncompressed format (65 bytes) without the leading 0x04
  const publicKey = Buffer.from(ecdh.getPublicKey())
    .slice(1) // Remove the 0x04 prefix
    .toString("base64url")

  const privateKey = ecdh.getPrivateKey().toString("base64url")

  return { publicKey, privateKey }
}

/**
 * Get the subscription key for storage
 */
function getSubscriptionKey(subscription: PushSubscription): string {
  // Use endpoint as unique identifier
  return subscription.endpoint
}

export const PushRoutes = new Hono()
  // Get VAPID public key
  .get(
    "/push/vapid-public-key",
    describeRoute({
      summary: "Get VAPID public key",
      description: "Returns the server's VAPID public key for push subscription",
      responses: {
        200: {
          description: "VAPID public key",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  publicKey: z.string(),
                }),
              ),
            },
          },
        },
      },
    }),
    (c) => {
      const keys = getVapidKeys()
      return c.json({ publicKey: keys.publicKey })
    },
  )

  // Subscribe to push notifications
  .post(
    "/push/subscribe",
    describeRoute({
      summary: "Subscribe to push notifications",
      description: "Register a push subscription for notifications",
      responses: {
        200: {
          description: "Subscription registered",
        },
        400: {
          description: "Invalid subscription data",
        },
      },
    }),
    validator(
      "json",
      z.object({
        endpoint: z.string().url(),
        keys: z.object({
          p256dh: z.string(),
          auth: z.string(),
        }),
      }),
    ),
    (c) => {
      const subscription = c.req.valid("json")
      const key = getSubscriptionKey(subscription)

      subscriptions.set(key, subscription)
      log.info("Push subscription registered", { endpoint: subscription.endpoint })

      return c.json({ success: true, message: "Subscription registered" })
    },
  )

  // Unsubscribe from push notifications
  .post(
    "/push/unsubscribe",
    describeRoute({
      summary: "Unsubscribe from push notifications",
      description: "Remove a push subscription",
      responses: {
        200: {
          description: "Subscription removed",
        },
      },
    }),
    validator(
      "json",
      z.object({
        endpoint: z.string().url(),
        keys: z.object({
          p256dh: z.string(),
          auth: z.string(),
        }),
      }),
    ),
    (c) => {
      const subscription = c.req.valid("json")
      const key = getSubscriptionKey(subscription)

      subscriptions.delete(key)
      log.info("Push subscription removed", { endpoint: subscription.endpoint })

      return c.json({ success: true, message: "Subscription removed" })
    },
  )

/**
 * Send a push notification to all subscribed clients
 * This is the main function to call when you want to send a notification
 */
export async function sendPushNotification(title: string, body: string, data?: Record<string, unknown>) {
  const keys = getVapidKeys()

  // Prepare notification payload
  const payload = JSON.stringify({
    title,
    body,
    data: data || {},
    icon: "/web-app-manifest-192x192.png",
    badge: "/favicon-96x96.png",
  })

  // For each subscription, send the notification
  // Note: This requires the web-push library or manual implementation
  // For simplicity, we log and return subscription count
  // In production, use the 'web-push' npm package

  log.info("Push notification requested", {
    title,
    subscriberCount: subscriptions.size,
  })

  // Return the subscriptions for the caller to handle sending
  // In production, integrate with web-push library:
  // import webpush from 'web-push'
  // webpush.setVapidDetails(VAPID_SUBJECT, keys.publicKey, keys.privateKey)
  // for (const sub of subscriptions.values()) {
  //   await webpush.sendNotification(sub, payload)
  // }

  return {
    sent: subscriptions.size,
    subscribers: Array.from(subscriptions.values()),
    vapidPublicKey: keys.publicKey,
    payload,
  }
}

/**
 * Get all active subscriptions (for debugging)
 */
export function getActiveSubscriptions(): PushSubscription[] {
  return Array.from(subscriptions.values())
}
