// Change the BASE_URL to local development server
export const BASE_URL = "http://127.0.0.1:5000"; // Updated to use local backend and now exported

export async function registerUser(
  email: string,
  password: string,
  name: string,
  contactName: string,
  contactEmail: string
) {
  try {
    const res = await fetch(`${BASE_URL}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        name,
        emergency_contact: {
          name: contactName,
          email: contactEmail
        }
      })
    });

    const data = await res.json();
    
    // Improved error handling based on status code
    if (!res.ok) {
      if (res.status === 409) {
        throw new Error("User already exists");
      } else {
        throw new Error(data.error || data.detail || "Signup failed");
      }
    }
    
    localStorage.setItem("token", data.token);
    return data;
  } catch (error) {
    console.error("Registration error:", error);
    throw error;
  }
}

export async function loginUser(email: string, password: string) {
  try {
    const res = await fetch(`${BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    
    // Improved error handling
    if (!res.ok) {
      throw new Error(data.error || data.detail || "Login failed");
    }
    
    localStorage.setItem("token", data.token);
    return data;
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
}

// Shape of the user returned by the backend /me route.
export interface AuthUser {
  id: string;
  email: string;
}

export async function onAuthChanged(callback: (user: AuthUser | null) => void) {
  const token = localStorage.getItem("token");
  if (!token) return callback(null);

  try {
    const res = await fetch(`${BASE_URL}/me`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log('Auth check response status:', res.status);

    if (res.ok) {
      const user = await res.json();
      callback(user);
    } else {
      console.error('Auth check failed with status:', res.status);
      callback(null);
    }
  } catch (error) {
    console.error("Auth check error:", error);
    callback(null);
  }
}

export async function updateUserProfile(
  email: string,
  contactName: string,
  contactEmail: string
) {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("No authentication token found");

  console.log("Updating profile with:", { email, contactName, contactEmail });
  
  try {
    // First, update local storage immediately (optimistic update)
    const userData = JSON.parse(localStorage.getItem('safeStrideUser') || '{}');
    const updatedUserData = {
      ...userData,
      email,
      emergency_contact: {
        name: contactName,
        email: contactEmail
      }
    };
    
    // Update local storage right away
    localStorage.setItem('safeStrideUser', JSON.stringify(updatedUserData));
    
    // Create request options with mode: 'no-cors' to handle CORS issues
    const requestOptions = {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        email,
        emergency_contact: {
          name: contactName,
          email: contactEmail
        }
      })
    };

    console.log("Using URL:", `${BASE_URL}/update_profile`);
    console.log("Request options:", requestOptions);
    
    const res = await fetch(`${BASE_URL}/update_profile`, requestOptions);
    
    console.log("Profile update response status:", res.status);
    
    // Check if the response is JSON
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || data.detail || "Failed to update profile");
      }
      
      return data;
    } else {
      // Handle non-JSON responses
      const textResponse = await res.text();
      console.log("Non-JSON response:", textResponse);
      
      if (!res.ok) {
        throw new Error(`Failed to update profile: ${res.status} ${res.statusText}`);
      }
      
      return { message: "Profile updated successfully" };
    }
  } catch (error) {
    console.error("Profile update error:", error);
    
    // Even if the backend request failed, we've already updated localStorage
    // So the UI will still reflect the changed data
    
    // Only rethrow if it's not a network error that might be due to CORS
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      console.warn("Network error occurred, but profile was updated locally");
      return { message: "Profile updated locally. Server update failed, but your changes are saved in this browser.", localOnly: true };
    }
    
    throw error;
  }
}

// Add a new function to get the emergency contact email
export async function getEmergencyContactEmail(): Promise<string | null> {
  try {
    // Try to get from localStorage first (fastest)
    const userData = JSON.parse(localStorage.getItem('safeStrideUser') || '{}');
    if (userData?.emergency_contact?.email) {
      return userData.emergency_contact.email;
    }
    
    // If not in localStorage, try to fetch from API
    const token = localStorage.getItem("token");
    if (!token) return null;
    
    const res = await fetch(`${BASE_URL}/me`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    if (res.ok) {
      const user = await res.json();
      if (user?.emergency_contact?.email) {
        return user.emergency_contact.email;
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error getting emergency contact:", error);
    return null;
  }
}
