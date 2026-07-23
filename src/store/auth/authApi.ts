import { createAsyncThunk } from "@reduxjs/toolkit";

import api from "../../lib/api";

import {
  saveAccessToken,
  saveRefreshToken,
  saveUser,
  clearStorage,
} from "../../lib/storage";



// ================================
// REGISTER USER
// ================================

interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  userType: string;
}

export const registerUser = createAsyncThunk(
  "auth/registerUser",

  async (
    userData: RegisterPayload,
    thunkAPI
  ) => {
    try {
      console.log(
        "========== API REQUEST =========="
      );

      console.log(
        "POST /auth/register"
      );

      console.log("Request Body:");

      console.log(
        JSON.stringify(
          userData,
          null,
          2
        )
      );

      const response = await api.post(
        "/auth/register",
        userData
      );

      console.log(
        "========== API SUCCESS RESPONSE =========="
      );

      console.log(
        JSON.stringify(
          response.data,
          null,
          2
        )
      );

      return response.data;
    } catch (error: any) {
      console.log(
        "========== API ERROR =========="
      );

      console.log(error);

      const errorMessage =
        error?.response?.data
          ?.message ||
        error?.response?.data
          ?.error ||
        error?.message ||
        "Something went wrong";

      return thunkAPI.rejectWithValue(
        errorMessage
      );
    }
  }
);



// ================================
// VERIFY REGISTER OTP
// ================================

interface VerifyRegisterOtpPayload {
  email: string;
  otp: string;
}

export const verifyRegisterOtp = createAsyncThunk(
  "auth/verifyRegisterOtp",

  async (
    data: VerifyRegisterOtpPayload,
    thunkAPI
  ) => {
    try {
      console.log(
        "========== VERIFY REGISTER OTP API REQUEST =========="
      );

      console.log(
        "POST /auth/verify-register"
      );

      console.log(
        JSON.stringify(data, null, 2)
      );

      const response = await api.post(
        "/auth/verify-register",
        data
      );

      console.log(
        "========== VERIFY REGISTER OTP API SUCCESS =========="
      );

      console.log(
        JSON.stringify(response.data, null, 2)
      );

      // ==============================
      // EXTRACT DATA
      // ==============================

      const accessToken =
        response.data?.data?.accessToken;

      const refreshToken =
        response.data?.data?.refreshToken;

      // Save FULL response — same pattern as loginUser,
      // because app UI uses: user.data.user

      const user = response.data;

      // ==============================
      // SAVE TOKENS + USER
      // ==============================

      if (accessToken) {
        await saveAccessToken(accessToken);
      }

      if (refreshToken) {
        await saveRefreshToken(refreshToken);
      }

      if (user) {
        await saveUser(user);
      }

      return response.data;
    } catch (error: any) {
      console.log(
        "========== VERIFY REGISTER OTP API ERROR =========="
      );

      console.log(error);

      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "OTP verification failed";

      return thunkAPI.rejectWithValue(errorMessage);
    }
  }
);



// ================================
// RESEND REGISTER OTP
// ================================

interface ResendRegisterOtpPayload {
  email: string;
}

export const resendRegisterOtp = createAsyncThunk(
  "auth/resendRegisterOtp",

  async (
    data: ResendRegisterOtpPayload,
    thunkAPI
  ) => {
    try {
      console.log(
        "========== RESEND REGISTER OTP API REQUEST =========="
      );

      console.log(
        JSON.stringify(data, null, 2)
      );

      const response = await api.post(
        "/auth/resend-register-otp",
        data
      );

      console.log(
        "========== RESEND REGISTER OTP API SUCCESS =========="
      );

      console.log(
        JSON.stringify(response.data, null, 2)
      );

      return response.data;
    } catch (error: any) {
      console.log(
        "========== RESEND REGISTER OTP API ERROR =========="
      );

      console.log(error);

      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Could not resend OTP";

      return thunkAPI.rejectWithValue(errorMessage);
    }
  }
);



// ================================
// LOGIN USER
// ================================

interface LoginPayload {
  email: string;
  password: string;
}

export const loginUser = createAsyncThunk(
  "auth/loginUser",

  async (
    userData: LoginPayload,
    thunkAPI
  ) => {
    try {
      console.log(
        "========== LOGIN API REQUEST =========="
      );

      console.log(
        "POST /auth/login"
      );

      console.log("Request Body:");

      console.log(
        JSON.stringify(
          userData,
          null,
          2
        )
      );

      const response = await api.post(
        "/auth/login",
        userData
      );

      console.log(
        "========== LOGIN API SUCCESS =========="
      );

      console.log(
        JSON.stringify(
          response.data,
          null,
          2
        )
      );

      // ==============================
      // EXTRACT DATA
      // ==============================

      const accessToken =
        response.data?.data
          ?.accessToken;

      const refreshToken =
        response.data?.data
          ?.refreshToken;

      // IMPORTANT:
      // save FULL response
      // because app UI uses:
      // user.data.user

      const user =
        response.data;

      // ==============================
      // SAVE TOKENS + USER
      // ==============================

      if (accessToken) {
        await saveAccessToken(
          accessToken
        );
      }

      if (refreshToken) {
        await saveRefreshToken(
          refreshToken
        );
      }

      if (user) {
        await saveUser(user);
      }

      return response.data;
    } catch (error: any) {
      console.log(
        "========== LOGIN API ERROR =========="
      );

      console.log(error);

      const errorMessage =
        error?.response?.data
          ?.message ||
        error?.response?.data
          ?.error ||
        error?.message ||
        "Login failed";

      return thunkAPI.rejectWithValue(
        errorMessage
      );
    }
  }
);



// ================================
// LOGOUT USER
// ================================

interface LogoutPayload {
  refreshToken: string;
}

export const logoutUser = createAsyncThunk(
  "auth/logoutUser",

  async (
    data: LogoutPayload,
    thunkAPI
  ) => {
    try {
      console.log(
        "========== LOGOUT API REQUEST =========="
      );

      const response = await api.post(
        "/auth/logout",
        data
      );

      await clearStorage();

      return response.data;
    } catch (error: any) {
      await clearStorage();

      const errorMessage =
        error?.response?.data
          ?.message ||
        error?.message ||
        "Logout failed";

      return thunkAPI.rejectWithValue(
        errorMessage
      );
    }
  }
);



// ================================
// PICK PROFILE IMAGE
// ================================
// TODO(web-port): expo-image-picker has no web equivalent and is not
// installed in this project. Profile image selection on web should be
// implemented in the UI layer with a browser file input
// (<input type="file" accept="image/*">) and its FileList/Blob passed
// directly to updateProfileIcon below — this function is a placeholder
// until that UI is built.

export const pickProfileImage = async (): Promise<string | null> => {
  throw new Error(
    "pickProfileImage is not implemented for web. Use a browser file input in the UI layer instead."
  );
};



// ================================
// UPDATE PROFILE ICON API
// ================================

interface UpdateProfileIconPayload {
  file: File;
  userId: string;
  accessToken: string;
}

export const updateProfileIcon =
  createAsyncThunk(
    "auth/updateProfileIcon",

    async (
      data: UpdateProfileIconPayload,
      thunkAPI
    ) => {
      try {
        // NOTE(web-port fix): same class of bug as invoiceApi.ts's
        // scanInvoice — the version inherited from the logic-layer port
        // appended a React-Native-only {uri, name, type} object to
        // FormData (browsers need a real File/Blob) and manually set a
        // boundary-less multipart Content-Type header (the browser must
        // generate that itself). Fixed to take a browser File directly.
        const formData =
          new FormData();

        formData.append("icon", data.file, data.file.name);

        const response =
          await api.post(
            `/users/${data.userId}/icon`,
            formData,
            {
              headers: {
                Authorization: `Bearer ${data.accessToken}`,
              },
            }
          );

        return response.data;
      } catch (error: any) {
        const errorMessage =
          error?.response
            ?.data
            ?.message ||
          error?.message ||
          "Profile icon update failed";

        return thunkAPI.rejectWithValue(
          errorMessage
        );
      }
    }
  );



  // ================================
// GOOGLE LOGIN
// ================================

interface GoogleLoginPayload {
  idToken: string; // Google ID token from Google Identity Services JS SDK
}

export const googleLogin = createAsyncThunk(
  "auth/googleLogin",

  async (
    data: GoogleLoginPayload,
    thunkAPI
  ) => {
    try {
      console.log(
        "========== GOOGLE LOGIN API REQUEST =========="
      );

      console.log(
        "POST /auth/google-login"
      );

      console.log(
        JSON.stringify(data, null, 2)
      );

      const response = await api.post("/auth/google", data);

      console.log(
        "========== GOOGLE LOGIN API SUCCESS =========="
      );

      console.log(
        JSON.stringify(response.data, null, 2)
      );

      // ==============================
      // EXTRACT DATA
      // ==============================

      const accessToken =
        response.data?.data?.accessToken;

      const refreshToken =
        response.data?.data?.refreshToken;

      // Save FULL response — same pattern as loginUser
      const user = response.data;

      // ==============================
      // SAVE TOKENS + USER
      // ==============================

      if (accessToken) {
        await saveAccessToken(accessToken);
      }

      if (refreshToken) {
        await saveRefreshToken(refreshToken);
      }

      if (user) {
        await saveUser(user);
      }

      return response.data;
    } catch (error: any) {
      console.log(
        "========== GOOGLE LOGIN API ERROR =========="
      );

      console.log(error);

      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Google login failed";

      return thunkAPI.rejectWithValue(errorMessage);
    }
  }
);


interface AppleLoginPayload {
  identityToken: string;
  firstName: string;
  lastName: string;
  email: string;
}


export const appleLogin = createAsyncThunk(
  "auth/appleLogin",

  async (
    data: AppleLoginPayload,
    thunkAPI
  ) => {
    try {
      console.log(
        "========== APPLE LOGIN API REQUEST =========="
      );

      console.log(
        JSON.stringify(data, null, 2)
      );

      const response = await api.post(
        "/auth/apple",
        data
      );

      console.log(
        "========== APPLE LOGIN API SUCCESS =========="
      );

      console.log(
        JSON.stringify(response.data, null, 2)
      );

      const accessToken =
        response.data?.data?.accessToken;

      const refreshToken =
        response.data?.data?.refreshToken;

      const user = response.data;

      if (accessToken) {
        await saveAccessToken(accessToken);
      }

      if (refreshToken) {
        await saveRefreshToken(refreshToken);
      }

      if (user) {
        await saveUser(user);
      }

      return response.data;
    } catch (error: any) {
      console.log(
        "========== APPLE LOGIN API ERROR =========="
      );

      console.log(error);

      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Apple login failed";

      return thunkAPI.rejectWithValue(
        errorMessage
      );
    }
  }
);
