const API_BASE_URL = "https://it-assets-backend.onrender.com/api/v1/assets";

// Get all assets with pagination, search, and filter support
export const getAllAssets = async (options = {}) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      order = "desc",
      search = "",
      companyName = "",
      device = "",
      branch = "",
      department = "",
      status = "",
      createdBy = ""
    } = options;

    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      sortBy,
      order,
      _t: Date.now().toString()
    });

    // Add optional filter parameters
    if (search && search.trim()) {
      params.append("search", search.trim());
    }
    if (companyName) {
      params.append("companyName", companyName);
    }
    if (device) {
      params.append("device", device);
    }
    if (branch) {
      params.append("branch", branch);
    }
    if (department) {
      params.append("department", department);
    }
    if (status) {
      params.append("status", status);
    }
    if (createdBy) {
      params.append("createdBy", createdBy);
    }

    const response = await fetch(`${API_BASE_URL}?${params}`);
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

// Get filter options from backend
export const getFilterOptions = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/filters?_t=${Date.now()}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching filter options:", error);
    throw error;
  }
};

// Get asset counts (total and by device type) with optional company filter
export const getAssetCounts = async (companyName = "") => {
  try {
    const baseParams = {
      page: 1,
      limit: 1,
      sortBy: "createdAt",
      order: "desc"
    };

    // Build query params for each count request
    const buildParams = (device = "") => {
      const params = new URLSearchParams({
        ...baseParams,
        _t: Date.now().toString()
      });
      if (companyName) params.append("companyName", companyName);
      if (device) params.append("device", device);
      return params;
    };

    // Fetch all counts in parallel
    const [totalRes, laptopRes, desktopRes, printerRes] = await Promise.all([
      fetch(`${API_BASE_URL}?${buildParams()}`),
      fetch(`${API_BASE_URL}?${buildParams("Laptop")}`),
      fetch(`${API_BASE_URL}?${buildParams("Desktop")}`),
      fetch(`${API_BASE_URL}?${buildParams("Printer")}`)
    ]);

    const extractCount = async (response) => {
      if (!response.ok) return 0;
      const data = await response.json();
      return data?.data?.pagination?.totalItems || 0;
    };

    const [total, laptops, desktops, printers] = await Promise.all([
      extractCount(totalRes),
      extractCount(laptopRes),
      extractCount(desktopRes),
      extractCount(printerRes)
    ]);

    return { total, laptops, desktops, printers };
  } catch (error) {
    console.error("Error fetching asset counts:", error);
    return { total: 0, laptops: 0, desktops: 0, printers: 0 };
  }
};

// Upload Excel file for bulk import
export const uploadExcel = async (file, createdBy) => {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("createdBy", createdBy);

    console.log("Uploading to:", `${API_BASE_URL}/upload-excel`);
    console.log("File:", file.name, "Size:", file.size, "Type:", file.type);
    console.log("CreatedBy:", createdBy);

    const response = await fetch(`${API_BASE_URL}/upload-excel`, {
      method: "POST",
      body: formData,
      // Note: Don't set Content-Type header - browser will set it with boundary for multipart/form-data
    });

    const responseData = await response.json().catch(() => ({}));
    console.log("Backend response:", response.status, responseData);

    if (!response.ok) {
      // Show detailed error from backend
      const errorMsg = responseData.message || responseData.error || `HTTP error! status: ${response.status}`;
      console.error("Backend error details:", responseData);
      throw new Error(errorMsg);
    }

    return responseData;
  } catch (error) {
    console.error("Error uploading Excel:", error);
    throw error;
  }
};

// Export assets to Excel (server-side)
export const exportAssets = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    if (filters.companyName) params.append("companyName", filters.companyName);
    if (filters.device) params.append("device", filters.device);
    if (filters.search) params.append("search", filters.search);

    const response = await fetch(`${API_BASE_URL}/export?${params}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const blob = await response.blob();
    return blob;
  } catch (error) {
    console.error("Error exporting assets:", error);
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

// Create new asset (serialNumber is auto-generated by backend)
export const createAsset = async (assetData) => {
  try {
    // Remove serialNumber if empty - backend will generate it
    const { serialNumber, ...cleanData } = assetData;
    const dataToSend = serialNumber ? assetData : cleanData;
    
    console.log("Creating asset with data:", dataToSend);
    
    const response = await fetch(API_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(dataToSend),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Backend error:", errorData);
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log("Asset created:", data);
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

// Bulk create assets (for Excel import)
export const bulkCreateAssets = async (assetsArray) => {
  try {
    console.log(`Bulk creating ${assetsArray.length} assets...`);
    const response = await fetch(`${API_BASE_URL}/bulk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ assets: assetsArray }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Bulk create failed: ${response.status}`, errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log(`Bulk create response:`, data);
    return data;
  } catch (error) {
    console.error("Error bulk creating assets:", error);
    throw error;
  }
};

// Parse Excel date (handles Excel serial numbers and various date formats)
export const parseExcelDate = (value) => {
  if (!value) return "";
  
  // If it's already a string in DD-MM-YYYY or similar format, return as is
  if (typeof value === "string") {
    // Check if it's already in DD-MM-YYYY format
    const ddmmyyyyMatch = value.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (ddmmyyyyMatch) {
      const [, day, month, year] = ddmmyyyyMatch;
      return `${day.padStart(2, "0")}-${month.padStart(2, "0")}-${year}`;
    }
    
    // Check if it's in YYYY-MM-DD format
    const yyyymmddMatch = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (yyyymmddMatch) {
      const [, year, month, day] = yyyymmddMatch;
      return `${day.padStart(2, "0")}-${month.padStart(2, "0")}-${year}`;
    }
    
    // Return original string if can't parse
    return value;
  }
  
  // If it's a number (Excel serial date), convert it
  if (typeof value === "number") {
    // Excel serial date starts from 1899-12-30
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }
  
  return String(value);
};
