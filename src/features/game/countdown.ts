/** El plazo usa el reloj del servidor; el transcurso local usa performance.now(). */
export function createCountdownDeadline(endsAt: number | null, serverNow: number, receivedAt: number): number | null {
  return endsAt === null ? null : receivedAt + Math.max(0, endsAt - serverNow);
}

export function remainingSeconds(deadline: number | null, monotonicNow: number): number {
  return deadline === null ? 0 : Math.max(0, Math.ceil((deadline - monotonicNow) / 1000));
}
