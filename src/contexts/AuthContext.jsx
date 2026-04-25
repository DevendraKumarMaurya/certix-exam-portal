/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  onAuthStateChanged,
  updateProfile,
  setPersistence,
  browserSessionPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../firebase/config";
import toast from "react-hot-toast";
import { getAppBaseUrl } from "../utils/appUrl";

export const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [mustActivateAccount, setMustActivateAccount] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch user role from Firestore
  async function fetchUserRole(uid) {
    try {
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUserRole(userData.role);
        setUserProfile(userData);
        return userData;
      } else {
        console.error("User document not found in Firestore");
        // Clear auth tokens and redirect to user not found page
        localStorage.removeItem("authExpiry");
        sessionStorage.removeItem("authExpiry");
        await signOut(auth);
        setUserRole(null);
        setUserProfile(null);
        setMustActivateAccount(false);
        // Use window.location to redirect outside React Router
        window.location.href = "/user-not-found";
        return null;
      }
    } catch (error) {
      console.error("Error fetching user role:", error);

      // Check if error is caused by ad blocker or browser extension
      if (
        error.message &&
        (error.message.includes("ERR_BLOCKED_BY_CLIENT") ||
          error.message.includes("Failed to fetch"))
      ) {
        toast.error(
          "Connection blocked by browser extension. Please disable ad blocker and refresh the page.",
          {
            duration: 8000,
            icon: "🚫",
          },
        );
      } else if (error.code === "unavailable") {
        toast.error(
          "Unable to connect to database. Please check your internet connection.",
          {
            duration: 6000,
          },
        );
      } else {
        toast.error("Failed to load user profile. Please refresh the page.", {
          duration: 5000,
        });
      }

      setUserRole(null);
      setUserProfile(null);
      setMustActivateAccount(false);
      return null;
    }
  }

  // Set auth persistence based on remember me
  async function setAuthPersistence(rememberMe = false) {
    try {
      if (rememberMe) {
        // Local persistence - survives browser restart
        await setPersistence(auth, browserLocalPersistence);
        // Set expiry to 30 days from now
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);
        localStorage.setItem("authExpiry", expiryDate.toISOString());
      } else {
        // Session persistence - cleared when tab closes
        await setPersistence(auth, browserSessionPersistence);
        // Set expiry to 24 hours from now
        const expiryDate = new Date();
        expiryDate.setHours(expiryDate.getHours() + 24);
        sessionStorage.setItem("authExpiry", expiryDate.toISOString());
      }
    } catch (error) {
      console.error("Error setting persistence:", error);
    }
  }

  // Check if auth token is expired
  function isAuthExpired() {
    const localExpiry = localStorage.getItem("authExpiry");
    const sessionExpiry = sessionStorage.getItem("authExpiry");
    const expiryStr = localExpiry || sessionExpiry;

    if (!expiryStr) return false;

    const expiryDate = new Date(expiryStr);
    const now = new Date();

    if (now > expiryDate) {
      // Token expired, clear it
      localStorage.removeItem("authExpiry");
      sessionStorage.removeItem("authExpiry");
      return true;
    }

    return false;
  }

  // Login user
  async function resolveLoginEmail(identifier) {
    const cleaned = identifier?.trim();

    if (!cleaned) return null;

    if (cleaned.includes("@")) {
      return cleaned.toLowerCase();
    }

    const enrollmentId = cleaned.toUpperCase();
    const loginDoc = await getDoc(doc(db, "loginIndex", enrollmentId));

    if (!loginDoc.exists()) {
      return null;
    }

    const userData = loginDoc.data();
    if (userData.authEmail) {
      return userData.authEmail;
    }

    const usersRef = collection(db, "users");
    const usersQuery = query(usersRef, where("enrollmentNumber", "==", enrollmentId));
    const usersSnapshot = await getDocs(usersQuery);
    const matchedUser = usersSnapshot.docs[0]?.data();

    return matchedUser?.authEmail || matchedUser?.email || null;
  }

  async function login(identifier, password, rememberMe = false) {
    // Set persistence before login
    await setAuthPersistence(rememberMe);

    try {
      const email = await resolveLoginEmail(identifier);

      if (!email) {
        toast.error("No account found with this enrollment number or email");
        throw new Error("Login identifier not found");
      }

      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const user = userCredential.user;

      // Fetch user role from Firestore
      const userData = await fetchUserRole(user.uid);

      if (!userData || !userData.isActive) {
        await signOut(auth);
        toast.error(
          "Your account is pending admin approval. Please wait for activation or contact support.",
          {
            duration: 7000,
          },
        );
        throw new Error("Account inactive");
      }

      const requiresActivation =
        userData.role !== "admin" &&
        (!userData.email || !userData.emailVerified || userData.pendingSetup);
      setMustActivateAccount(requiresActivation);

      if (!requiresActivation && userData.pendingSetup) {
        await setDoc(
          doc(db, "users", user.uid),
          {
            pendingSetup: false,
            emailVerified: true,
          },
          { merge: true },
        );
      }

      toast.success(`Welcome back, ${user.displayName || "User"}!`);
      return user;
    } catch (error) {
      console.error("Login error:", error);

      // User-friendly error messages
      if (error.code === "auth/user-not-found") {
        toast.error("No account found with this enrollment number or email");
      } else if (error.code === "auth/wrong-password") {
        toast.error("Incorrect password");
      } else if (error.code === "auth/invalid-email") {
        toast.error("Use admin email or enrollment number to login");
      } else if (error.code === "auth/too-many-requests") {
        toast.error("Too many failed attempts. Please try again later.");
      } else if (
        error.message !== "Account inactive" &&
        error.message !== "Login identifier not found"
      ) {
        toast.error("Login failed. Please try again.");
      }
      throw error;
    }
  }

  // Logout user
  async function logout() {
    try {
      // Clear auth expiry tokens
      localStorage.removeItem("authExpiry");
      sessionStorage.removeItem("authExpiry");
      await signOut(auth);
      setUserRole(null);
      setUserProfile(null);
      setMustActivateAccount(false);
      toast.success("Logged out successfully");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Logout failed. Please try again.");
      throw error;
    }
  }

  // Reset password
  async function resetPassword(email) {
    try {
      const actionCodeSettings = {
        url: `${getAppBaseUrl()}/auth/action`,
        handleCodeInApp: false,
      };

      await sendPasswordResetEmail(auth, email, actionCodeSettings);
      toast.success("Password reset email sent! Check your inbox.");
    } catch (error) {
      console.error("Password reset error:", error);

      if (error.code === "auth/user-not-found") {
        toast.error("No account found with this email");
      } else if (error.code === "auth/invalid-email") {
        toast.error("Invalid email address");
      } else {
        toast.error("Failed to send reset email. Please try again.");
      }
      throw error;
    }
  }

  // Send email verification
  async function sendVerificationEmail(user = currentUser) {
    try {
      if (!user) {
        toast.error("No user logged in");
        return;
      }

      const actionCodeSettings = {
        url: `${getAppBaseUrl()}/auth/action`,
        handleCodeInApp: false,
      };

      await sendEmailVerification(user, actionCodeSettings);
      toast.success("Verification email sent! Check your inbox.");
    } catch (error) {
      console.error("Email verification error:", error);

      if (error.code === "auth/too-many-requests") {
        toast.error("Too many requests. Please try again later.");
      } else {
        toast.error("Failed to send verification email. Please try again.");
      }
      throw error;
    }
  }

  // Update user profile
  async function updateUserProfile(updates) {
    try {
      if (currentUser) {
        // Update in Firebase Auth
        if (updates.displayName) {
          await updateProfile(currentUser, {
            displayName: updates.displayName,
          });
        }

        // Update in Firestore
        await setDoc(doc(db, "users", currentUser.uid), updates, {
          merge: true,
        });

        toast.success("Profile updated successfully");
      }
    } catch (error) {
      console.error("Profile update error:", error);
      toast.error("Failed to update profile");
      throw error;
    }
  }

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (user) {
        // Check if auth token is expired
        if (isAuthExpired()) {
          console.log("Auth token expired, logging out");
          // Clear tokens silently without showing toast
          localStorage.removeItem("authExpiry");
          sessionStorage.removeItem("authExpiry");
          await signOut(auth);
          setUserRole(null);
          setUserProfile(null);
          setMustActivateAccount(false);
          return;
        }

        // Fetch user role when user is authenticated
        try {
          const userData = await fetchUserRole(user.uid);

          if (userData) {
            const requiresActivation =
              userData.role !== "admin" &&
              (!userData.email || !userData.emailVerified || userData.pendingSetup);
            setMustActivateAccount(requiresActivation);
          }
        } catch (error) {
          // Error already handled in fetchUserRole
          console.error(
            "Failed to fetch user role on auth state change:",
            error,
          );
        }
      } else {
        setUserRole(null);
        setUserProfile(null);
        setMustActivateAccount(false);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userRole,
    userProfile,
    mustActivateAccount,
    loading,
    login,
    logout,
    resetPassword,
    sendVerificationEmail,
    updateUserProfile,
    fetchUserRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
