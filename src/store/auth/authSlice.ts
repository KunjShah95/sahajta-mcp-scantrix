import { createSlice, PayloadAction } from "@reduxjs/toolkit";

import {
  registerUser,
  verifyRegisterOtp,
  resendRegisterOtp,
  loginUser,
  logoutUser,
  updateProfileIcon,
  updateUserProfile,
  googleLogin,
  appleLogin,
  microsoftLogin,
  forgotPassword,
  resetPassword,
} from "./authApi";

interface AuthState {
  loading: boolean;
  user: any;
  error: any;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  loading: false,
  user: null,
  error: null,
  isAuthenticated: false,
};

const authSlice = createSlice({
  name: "auth",

  initialState,

  reducers: {
    // =========================
    // RESTORE USER
    // =========================

    restoreUser: (
      state,
      action: PayloadAction<any>
    ) => {
      state.user = action.payload;

      state.isAuthenticated =
        !!action.payload;
    },

    // =========================
    // CLEAR USER
    // =========================

    clearUser: (state) => {
      state.user = null;

      state.isAuthenticated = false;
    },
  },

  extraReducers: (builder) => {
    builder

      // =========================
      // REGISTER
      // =========================

      .addCase(registerUser.pending, (state) => {
        state.loading = true;

        state.error = null;
      })

      .addCase(
        registerUser.fulfilled,
        (state, action) => {
          state.loading = false;

          state.user = action.payload;

          state.isAuthenticated = true;
        }
      )

      .addCase(
        registerUser.rejected,
        (state, action) => {
          state.loading = false;

          state.error = action.payload;
        }
      )

      // =========================
      // VERIFY REGISTER OTP
      // =========================

      .addCase(verifyRegisterOtp.pending, (state) => {
        state.loading = true;

        state.error = null;
      })

      .addCase(
        verifyRegisterOtp.fulfilled,
        (state, action) => {
          state.loading = false;

          // Same structure as loginUser — UI depends on response.data
          state.user = action.payload;

          state.isAuthenticated = true;
        }
      )

      .addCase(
        verifyRegisterOtp.rejected,
        (state, action) => {
          state.loading = false;

          state.error = action.payload;

          state.isAuthenticated = false;
        }
      )

      // =========================
      // RESEND REGISTER OTP
      // =========================

      .addCase(resendRegisterOtp.pending, (state) => {
        state.error = null;
      })

      .addCase(resendRegisterOtp.fulfilled, (state) => {
        state.error = null;
      })

      .addCase(
        resendRegisterOtp.rejected,
        (state, action) => {
          state.error = action.payload;
        }
      )

      // =========================
      // LOGIN
      // =========================

      .addCase(loginUser.pending, (state) => {
        state.loading = true;

        state.error = null;
      })

      .addCase(
        loginUser.fulfilled,
        (state, action) => {
          state.loading = false;

          // KEEP OLD STRUCTURE
          // because UI depends on it

          state.user = action.payload;

          state.isAuthenticated = true;
        }
      )

      .addCase(
        loginUser.rejected,
        (state, action) => {
          state.loading = false;

          state.error = action.payload;

          state.isAuthenticated = false;
        }
      )

      // =========================
      // UPDATE PROFILE ICON
      // =========================

      .addCase(
        updateProfileIcon.pending,
        (state) => {
          state.loading = true;

          state.error = null;
        }
      )

      .addCase(
        updateProfileIcon.fulfilled,
        (state, action) => {
          state.loading = false;

          const updatedIcon =
            action.payload?.data?.icon ||
            action.payload?.icon;

          if (
            state.user?.data?.user &&
            updatedIcon
          ) {
            state.user.data.user.icon =
              updatedIcon;
          }
        }
      )

      .addCase(
        updateProfileIcon.rejected,
        (state, action) => {
          state.loading = false;

          state.error = action.payload;
        }
      )

      // =========================
      // UPDATE USER PROFILE
      // =========================

      .addCase(updateUserProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })

      .addCase(updateUserProfile.fulfilled, (state, action) => {
        state.loading = false;

        const updatedUser = action.payload?.data;
        if (state.user?.data?.user && updatedUser) {
          state.user.data.user = { ...state.user.data.user, ...updatedUser };
        }
      })

      .addCase(updateUserProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // =========================
      // LOGOUT
      // =========================

      .addCase(logoutUser.pending, (state) => {
        state.loading = true;
      })

      .addCase(
        logoutUser.fulfilled,
        (state) => {
          state.loading = false;

          state.user = null;

          state.error = null;

          state.isAuthenticated = false;
        }
      )

      .addCase(
        logoutUser.rejected,
        (state, action) => {
          state.loading = false;

          state.error = action.payload;
        }
      )

      // =========================
      // FORGOT PASSWORD
      // =========================

      .addCase(forgotPassword.pending, (state) => {
        state.loading = true;
        state.error = null;
      })

      .addCase(forgotPassword.fulfilled, (state) => {
        state.loading = false;
        state.error = null;
      })

      .addCase(
        forgotPassword.rejected,
        (state, action) => {
          state.loading = false;
          state.error = action.payload;
        }
      )

      // =========================
      // RESET PASSWORD
      // =========================

      .addCase(resetPassword.pending, (state) => {
        state.loading = true;
        state.error = null;
      })

      .addCase(resetPassword.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;

        // Backend logs the user in on a successful reset (same shape as
        // loginUser) — reflect that here instead of leaving them stuck
        // signed-out after they just proved account ownership via OTP.
        state.user = action.payload;
        state.isAuthenticated = true;
      })

      .addCase(
        resetPassword.rejected,
        (state, action) => {
          state.loading = false;
          state.error = action.payload;
        }
      )

      // =========================
// GOOGLE LOGIN
// =========================
.addCase(googleLogin.pending, (state) => {
  state.loading = true;
  state.error = null;
})
.addCase(
  googleLogin.fulfilled,
  (state, action) => {
    state.loading = false;
    // Same structure as loginUser — UI depends on response.data
    state.user = action.payload;
    state.isAuthenticated = true;
  }
)
.addCase(
  googleLogin.rejected,
  (state, action) => {
    state.loading = false;
    state.error = action.payload;
    state.isAuthenticated = false;
  }
)

.addCase(
  appleLogin.pending,
  (state) => {
    state.loading = true;
    state.error = null;
  }
)

.addCase(
  appleLogin.fulfilled,
  (state, action) => {
    state.loading = false;
    state.user = action.payload;
    state.isAuthenticated = true;
  }
)

.addCase(
  appleLogin.rejected,
  (state, action) => {
    state.loading = false;
    state.error = action.payload;
    state.isAuthenticated = false;
  }
)

// =========================
// MICROSOFT LOGIN
// =========================
.addCase(microsoftLogin.pending, (state) => {
  state.loading = true;
  state.error = null;
})
.addCase(
  microsoftLogin.fulfilled,
  (state, action) => {
    state.loading = false;
    // Same structure as loginUser/googleLogin — UI depends on response.data
    state.user = action.payload;
    state.isAuthenticated = true;
  }
)
.addCase(
  microsoftLogin.rejected,
  (state, action) => {
    state.loading = false;
    state.error = action.payload;
    state.isAuthenticated = false;
  }
)


;},
});

export const {
  restoreUser,
  clearUser,
} = authSlice.actions;

export default authSlice.reducer;
