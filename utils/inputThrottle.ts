export interface ThrottleGate {
  (): boolean;
  cancel: () => void;
}

export function createThrottle(intervalMs: number): ThrottleGate {
  let lastAccepted = 0;
  const gate = (() => {
    const now = Date.now();
    if (lastAccepted > 0 && now - lastAccepted < intervalMs) return false;
    lastAccepted = now;
    return true;
  }) as ThrottleGate;
  gate.cancel = () => {
    lastAccepted = 0;
  };
  return gate;
}
