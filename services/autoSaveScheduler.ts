/** 周期只随偏好变化；tick 内由会话读取最新状态，编辑不会重置倒计时。 */
export function scheduleAutoSave(tick: () => Promise<void>, intervalMinutes: number): () => void {
    const minutes = Number.isFinite(intervalMinutes) ? Math.max(1, intervalMinutes) : 1;
    const timer = setInterval(() => { void tick(); }, minutes * 60_000);
    return () => clearInterval(timer);
}
