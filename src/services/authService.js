const API_BASE_URL = "http://localhost:5000/api/v1/auth";

// Login user
export const loginUser = async (username, password) => {
  try {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || "Login failed");
    }
    
    return data;
  } catch (error) {
    console.error("Error logging in:", error);
    throw error;
  }
};

// Signup user
export const signupUser = async (userData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || "Signup failed");
    }
    
    return data;
  } catch (error) {
    console.error("Error signing up:", error);
    throw error;
  }
};

// Reset password
export const resetPassword = async (username, oldPassword, newPassword) => {
  try {
    const response = await fetch(`${API_BASE_URL}/reset-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, oldPassword, newPassword }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || "Password reset failed");
    }
    
    return data;
  } catch (error) {
    console.error("Error resetting password:", error);
    throw error;
  }
};
