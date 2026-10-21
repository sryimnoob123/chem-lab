/**
 * 新手教学的「是否已看过」纯逻辑（可注入 storage，便于单测）。
 *
 * 为什么单独拆：localStorage 在 SSR / 隐私模式下会抛错，
 * 读写的所有兜底集中在这里，组件只调函数。
 */

export const ONBOARDING_KEY = "chem-lab:onboarding-seen:v1";

export type OnboardingStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function hasSeenOnboarding(
  storage: OnboardingStorage | null | undefined,
  key: string = ONBOARDING_KEY,
): boolean {
  try {
    return storage?.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function markOnboardingSeen(
  storage: OnboardingStorage | null | undefined,
  key: string = ONBOARDING_KEY,
): void {
  try {
    storage?.setItem(key, "1");
  } catch {
    /* 隐私模式写不进去就静默：下次还会显示，不影响使用 */
  }
}
