const API_BASE_URL = "https://it-assets-backend.onrender.com/api/v1/branches";

// Get all branches from database
export const getAllBranches = async () => {
  try {
    const response = await fetch(API_BASE_URL);
    if (!response.ok) {
      // If API doesn't exist yet, return empty array
      if (response.status === 404) {
        return { data: [] };
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching branches:", error);
    // Return empty array if API is not available
    return { data: [] };
  }
};

// Create new branch
export const createBranch = async (branchName) => {
  try {
    const response = await fetch(API_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: branchName }),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error creating branch:", error);
    throw error;
  }
};

// Delete branch
export const deleteBranch = async (id) => {
  try {
    const response = await fetch(`${API_BASE_URL}/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error deleting branch:", error);
    throw error;
  }
};
