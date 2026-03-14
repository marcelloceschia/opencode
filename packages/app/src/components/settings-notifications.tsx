// kilocode_change - new file
import { Component } from "solid-js"
import { useLanguage } from "@/context/language"
import { PushNotificationSettings } from "./push-notification-settings"

export const SettingsNotifications: Component = () => {
  const language = useLanguage()

  return (
    <div class="flex flex-col gap-6 p-6">
      <div class="flex flex-col gap-1">
        <h2 class="text-16-medium">{language.t("settings.notifications.title")}</h2>
        <p class="text-13-regular text-text-weak">{language.t("settings.notifications.description")}</p>
      </div>
      <PushNotificationSettings />
    </div>
  )
}
