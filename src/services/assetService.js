const API_BASE_URL = "http://localhost:5000/api/v1/assets";

// Get all assets (with cache-busting timestamp)
export const getAllAssets = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}?_t=${Date.now()}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching assets:", error);
    throw error;
  }
};

// Get single asset by ID (with cache-busting timestamp)
export const getAssetById = async (id) => {
  try {
    const response = await fetch(`${API_BASE_URL}/${id}?_t=${Date.now()}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching asset:", error);
    throw error;
  }
};

// Create new asset
export const createAsset = async (assetData) => {
  try {
    const response = await fetch(API_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(assetData),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error creating asset:", error);
    throw error;
  }
};

// Update asset
export const updateAsset = async (id, assetData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(assetData),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error updating asset:", error);
    throw error;
  }
};

// Delete asset
export const deleteAsset = async (id) => {
  try {
    const response = await fetch(`${API_BASE_URL}/${id}`, {
      method: "DELETE"
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error deleting asset:", error);
    throw error;
  }
};
