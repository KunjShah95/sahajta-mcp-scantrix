"use client";

import { useRouter } from "next/navigation";
import { updateProfile } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { ChangeEvent, useMemo, useRef, useState } from "react";

import { auth, db } from "@/lib/firebase/config";
import { showToast } from "@/lib/dialogManager";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { updateProfileIcon } from "@/store/auth/authApi";

function normalizePhotoURL(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return "";
  return trimmed;
}

export function EditProfileContent() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reduxUser = useAppSelector((state) => state.auth.user);
  const apiUser = reduxUser?.data?.user;
  const accessToken: string | undefined = reduxUser?.data?.accessToken;

  const [name, setName] = useState(apiUser?.firstName || auth.currentUser?.displayName || "");
  const [email] = useState(apiUser?.email || auth.currentUser?.email || "");
  const [photoURL, setPhotoURL] = useState(normalizePhotoURL(apiUser?.icon || auth.currentUser?.photoURL || ""));
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  const initials = useMemo(() => (name.trim() || email.trim() || "U").charAt(0).toUpperCase(), [name, email]);
  const hasPhoto = !!normalizePhotoURL(photoURL) && !imageLoadFailed;
  const canSave = !isSaving && !isUploadingPhoto;

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const userId = apiUser?._id;
    if (!userId || !accessToken) {
      showToast("User ID or access token not found", "error");
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const result = await dispatch(updateProfileIcon({ file, userId, accessToken }));
      if (!updateProfileIcon.fulfilled.match(result)) {
        const payload = result.payload;
        showToast(typeof payload === "string" ? payload : "Could not upload profile photo.", "error");
        return;
      }
      const payload = result.payload as { data?: { icon?: string; user?: { icon?: string } }; icon?: string };
      const uploadedImage = payload?.data?.icon || payload?.icon || payload?.data?.user?.icon;
      if (!uploadedImage) {
        showToast("Image URL not returned from API", "error");
        return;
      }
      const finalImage = normalizePhotoURL(uploadedImage);
      setPhotoURL(finalImage);
      setImageLoadFailed(false);
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { photoURL: finalImage });
      }
      showToast("Profile photo updated successfully.", "success");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = () => setPhotoURL("");

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const trimmedName = name.trim();
      const finalName = trimmedName || email.split("@")[0] || "User";
      const finalPhotoURL = normalizePhotoURL(photoURL);

      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: finalName, photoURL: finalPhotoURL || null });
      }
      if (auth.currentUser?.uid) {
        await setDoc(
          doc(db, "users", auth.currentUser.uid),
          { uid: auth.currentUser.uid, email, displayName: finalName, photoURL: finalPhotoURL, updatedAt: serverTimestamp() },
          { merge: true },
        );
      }
      showToast("Your profile has been updated.", "success");
      router.back();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Something went wrong while updating your profile.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg p-[var(--space-lg)]">
      <h1 className="text-h2 font-bold text-trust-navy">Edit Profile</h1>

      <div className="mt-[var(--space-lg)] rounded-2xl bg-white p-[var(--space-lg)] shadow-sm">
        <h2 className="mb-[var(--space-md)] text-h3 font-bold text-text-primary">Profile Photo</h2>
        <div className="flex flex-col items-center">
          <div className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-primary/10">
            {hasPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoURL}
                alt="Profile"
                className="h-full w-full object-cover"
                onError={() => setImageLoadFailed(true)}
                onLoad={() => setImageLoadFailed(false)}
              />
            ) : (
              <span className="text-4xl font-bold text-primary">{initials}</span>
            )}
          </div>

          <div className="mt-[var(--space-md)] w-full">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingPhoto || isSaving}
              className="h-12 w-full rounded-md bg-primary font-bold text-white disabled:opacity-60"
            >
              {isUploadingPhoto ? "Uploading…" : hasPhoto ? "Change Photo" : "Upload Photo"}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

            {hasPhoto && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                disabled={isUploadingPhoto || isSaving}
                className="mt-[var(--space-sm)] h-11 w-full rounded-md bg-error/10 font-bold text-error disabled:opacity-60"
              >
                Remove Photo
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-[var(--space-md)] rounded-2xl bg-white p-[var(--space-lg)] shadow-sm">
        <h2 className="mb-[var(--space-md)] text-h3 font-bold text-text-primary">Basic Info</h2>

        <label className="text-body-sm font-semibold text-text-primary">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
          disabled={isSaving || isUploadingPhoto}
          className="mb-[var(--space-md)] mt-[var(--space-xs)] h-12 w-full rounded-md border border-border px-[var(--space-md)] text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
        />

        <label className="text-body-sm font-semibold text-text-primary">Email</label>
        <input
          value={email}
          disabled
          className="mt-[var(--space-xs)] h-12 w-full rounded-md border border-border bg-background-alt px-[var(--space-md)] text-body text-text-secondary"
        />
      </div>

      <button
        type="button"
        onClick={handleSaveProfile}
        disabled={!canSave}
        className="mt-[var(--space-lg)] h-[54px] w-full rounded-md bg-primary font-bold text-white disabled:opacity-55"
      >
        {isSaving ? "Saving…" : "Save Changes"}
      </button>
    </div>
  );
}
