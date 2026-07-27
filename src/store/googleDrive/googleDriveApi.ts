import { createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../lib/api";

// ================================
// CONNECT GOOGLE DRIVE
// ================================
interface ConnectGoogleDrivePayload {
  redirectUri: string;
}

export const connectGoogleDrive = createAsyncThunk(
  "googleDrive/connect",
  async (data: ConnectGoogleDrivePayload, thunkAPI) => {
    try {
      console.log("========== GOOGLE DRIVE CONNECT REQUEST ==========");
      const response = await api.get("/google-drive/connect", {
        params: { redirectUri: data.redirectUri },
      });
      console.log("========== GOOGLE DRIVE CONNECT SUCCESS ==========");
      console.log(JSON.stringify(response.data, null, 2));
      return response.data;
    } catch (error: any) {
      console.log("========== GOOGLE DRIVE CONNECT ERROR ==========");
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Failed to start Google Drive connection";
      return thunkAPI.rejectWithValue({ message, statusCode: error?.response?.status });
    }
  },
);

// ================================
// GET GOOGLE DRIVE STATUS
// ================================
export const getGoogleDriveStatus = createAsyncThunk("googleDrive/status", async (_: void, thunkAPI) => {
  try {
    console.log("========== GOOGLE DRIVE STATUS REQUEST ==========");
    const response = await api.get("/google-drive/status");
    console.log("========== GOOGLE DRIVE STATUS SUCCESS ==========");
    console.log(JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error: any) {
    console.log("========== GOOGLE DRIVE STATUS ERROR ==========");
    const message =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      "Failed to fetch Google Drive status";
    return thunkAPI.rejectWithValue({ message, statusCode: error?.response?.status });
  }
});

// ================================
// DISCONNECT GOOGLE DRIVE
// ================================
export const disconnectGoogleDrive = createAsyncThunk("googleDrive/disconnect", async (_: void, thunkAPI) => {
  try {
    console.log("========== GOOGLE DRIVE DISCONNECT REQUEST ==========");
    const response = await api.delete("/google-drive/disconnect");
    console.log("========== GOOGLE DRIVE DISCONNECT SUCCESS ==========");
    console.log(JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error: any) {
    console.log("========== GOOGLE DRIVE DISCONNECT ERROR ==========");
    const message =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      "Failed to disconnect Google Drive";
    return thunkAPI.rejectWithValue({ message, statusCode: error?.response?.status });
  }
});
