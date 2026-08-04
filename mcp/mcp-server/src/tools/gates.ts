export interface GateResult {
  ok: boolean;
  message?: string;
}

export const requireConfirm = (args: { confirm?: boolean }, action: string): GateResult => {
  if (args.confirm !== true) {
    return {
      ok: false,
      message:
        `Action "${action}" is destructive and requires explicit confirmation. ` +
        `State what you are about to do, then call the same tool again with "confirm": true.`,
    };
  }
  return { ok: true };
};
