"use client";

import { useRouter } from "next/navigation";

import { logoutUser } from "./auth/authApi";
import { useAppDispatch, useAppSelector } from "./hooks";

// Shared by the app shell's quick-logout and the full profile page (C19) so
// the actual logout action (dispatch + redirect) lives in exactly one place.
export function useLogout() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const refreshToken = useAppSelector((state) => state.auth.user?.data?.refreshToken);

  return async () => {
    if (!refreshToken) {
      window.alert("Refresh token not found");
      return;
    }
    const result = await dispatch(logoutUser({ refreshToken }));
    if (logoutUser.fulfilled.match(result)) {
      router.replace("/login");
    } else {
      const payload = result.payload;
      window.alert(typeof payload === "string" ? payload : "Something went wrong");
    }
  };
}
