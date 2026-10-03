import { VAPID_PUBLIC_KEY } from "@/lib/env";
import { getSupabase } from "@/lib/supabase/client";

export type PushState = "on" | "off" | "denied" | "unsupported" | "needs-install";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function isIosBrowserNotInstalled() {
  if (typeof window === "undefined") return false;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

export async function getPushState(): Promise<PushState> {
  if (typeof window === "undefined") return "unsupported";
  if (isIosBrowserNotInstalled()) return "needs-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window) || !VAPID_PUBLIC_KEY) {
    return "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  return subscription && Notification.permission === "granted" ? "on" : "off";
}

export async function enablePush(): Promise<PushState> {
  const state = await getPushState();
  if (state === "unsupported" || state === "needs-install" || state === "denied") return state;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";

  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }));

  const json = subscription.toJSON();
  const { error } = await getSupabase().rpc("register_push_subscription", {
    p_endpoint: json.endpoint!,
    p_p256dh: json.keys!.p256dh,
    p_auth: json.keys!.auth,
    p_user_agent: navigator.userAgent,
  });
  if (error) throw error;
  return "on";
}

export async function disablePush(): Promise<PushState> {
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await getSupabase().from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
    await subscription.unsubscribe();
  }
  return "off";
}
