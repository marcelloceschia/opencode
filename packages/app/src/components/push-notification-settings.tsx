import { createSignal, createEffect, onMount, Show } from "solid-js"
import { Button } from "@opencode-ai/ui/button"
import { usePlatform } from "@/context/platform"
import {
  isPushSupported,
  getPushState,
  subscribeToPush,
  unsubscribeFromPush,
  type PushNotificationState,
} from "@/utils/push-notifications"

/**
 * Push notification settings component
 * Allows users to subscribe/unsubscribe from push notifications
 * On iOS/Safari, the app must be added to Home Screen for push to work
 */
export function PushNotificationSettings() {
  const platform = usePlatform()
  const [state, setState] = createSignal<PushNotificationState>({
    isSupported: false,
    isSubscribed: false,
    permission: "not-supported",
    subscription: null,
  })
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  // Get server URL from platform or use default
  const getServerUrl = () => {
    // Try to get from current location
    if (typeof window !== "undefined") {
      return window.location.origin
    }
    return "http://localhost:4096"
  }

  // Load push state on mount
  onMount(async () => {
    const pushState = await getPushState()
    setState(pushState)
  })

  // Handle subscribe
  const handleSubscribe = async () => {
    setLoading(true)
    setError(null)

    const result = await subscribeToPush(getServerUrl())

    if (result.success) {
      setState((prev) => ({
        ...prev,
        isSubscribed: true,
        subscription: result.subscription || null,
        permission: "granted",
      }))
    } else {
      setError(result.error || "Failed to subscribe")
    }

    setLoading(false)
  }

  // Handle unsubscribe
  const handleUnsubscribe = async () => {
    setLoading(true)
    setError(null)

    const result = await unsubscribeFromPush(getServerUrl())

    if (result.success) {
      setState((prev) => ({
        ...prev,
        isSubscribed: false,
        subscription: null,
      }))
    } else {
      setError(result.error || "Failed to unsubscribe")
    }

    setLoading(false)
  }

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-medium">Push Notifications</h3>
          <p class="text-xs text-muted-foreground">
            Get notified when your AI agent completes a task
          </p>
        </div>
        <Show
          when={state().isSupported}
          fallback={
            <span class="text-xs text-muted-foreground">Not supported in this browser</span>
          }
        >
          <Show
            when={state().isSubscribed}
            fallback={
              <Button
                size="small"
                variant="secondary"
                onClick={handleSubscribe}
                disabled={loading() || state().permission === "denied"}
              >
                {loading() ? "Enabling..." : "Enable"}
              </Button>
            }
          >
            <Button
              size="small"
              variant="secondary"
              onClick={handleUnsubscribe}
              disabled={loading()}
            >
              {loading() ? "Disabling..." : "Disable"}
            </Button>
          </Show>
        </Show>
      </div>

      {/* iOS/Safari notice */}
      <Show when={state().isSupported && state().permission === "default"}>
        <div class="rounded-md bg-muted p-3 text-xs text-muted-foreground">
          <strong>iOS/Safari:</strong> Add this app to your Home Screen for push notifications
          to work when the app is closed.
        </div>
      </Show>

      {/* Permission denied notice */}
      <Show when={state().permission === "denied"}>
        <div class="rounded-md bg-destructive/10 p-3 text-xs text-destructive">
          Notifications are blocked. Please enable them in your browser settings.
        </div>
      </Show>

      {/* Error message */}
      <Show when={error()}>
        <div class="rounded-md bg-destructive/10 p-3 text-xs text-destructive">
          {error()}
        </div>
      </Show>

      {/* Status */}
      <Show when={state().isSubscribed}>
        <div class="flex items-center gap-2 text-xs text-muted-foreground">
          <div class="h-2 w-2 rounded-full bg-green-500" />
          Push notifications enabled
        </div>
      </Show>
    </div>
  )
}
