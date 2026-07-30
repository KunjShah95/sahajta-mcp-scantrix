import { isAnyOf } from "@reduxjs/toolkit";

import { appleLogin, googleLogin, loginUser, logoutUser, verifyRegisterOtp } from "./auth/authApi";

// Every action that starts or ends a session on this browser. Any slice that
// holds session-scoped data (QB connection info, invoices, vendors,
// subscription/billing, ...) must reset to its own initialState on all of
// these — otherwise a previous session's data can survive into the next one
// on a shared browser, since only `auth` itself is guaranteed to be
// overwritten by these actions' own reducers.
//
// verifyRegisterOtp is the register flow's own session-establishment point
// (see ASSUMPTIONS.md C13 — it saves tokens/marks isAuthenticated exactly
// like loginUser, no separate login step follows it), so it belongs in this
// list alongside loginUser/googleLogin/appleLogin/logoutUser. Add any future
// session-establishing thunk here — every slice below picks it up for free.
export const isSessionBoundary = isAnyOf(
  logoutUser.fulfilled,
  logoutUser.rejected,
  loginUser.fulfilled,
  googleLogin.fulfilled,
  appleLogin.fulfilled,
  verifyRegisterOtp.fulfilled,
);
