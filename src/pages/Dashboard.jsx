import { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import Navbar from "../components/Navbar";
import AssetTable from "../components/AssetTable";
import AssetFormModal from "../components/AssetFormModal";
import { companies } from "../data/assets";
import { useAuth } from "../context/AuthContext";
import {
  getAllAssets,
  createAsset,
  updateAsset,
  deleteAsset,
  uploadExcel,
  getFilterOptions,
  getAssetCounts,
} from "../services/assetService";

const Dashboard = () => {
  const { user } = useAuth();
  const [assets, setAssets] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [viewMode, setViewMode] = useState("all"); // "all" or "my"
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedDeviceType, setSelectedDeviceType] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Search state (moved from AssetTable for server-side search)
  const [searchTerm, setSearchTerm] = useState("");

  // Pagination state
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 20,
    hasNextPage: false,
    hasPrevPage: false,
  });

  // Excel Import states
  const [showImportModal, setShowImportModal] = useState(false);
  const [importProgress, setImportProgress] = useState({
    current: 0,
    total: 0,
    status: "",
  });
  const [importError, setImportError] = useState(null);
  const [isImporting, setIsImporting] = useState(false);

  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportCounts, setExportCounts] = useState({
    total: 0,
    laptops: 0,
    desktops: 0,
    printers: 0,
    tgl: 0,
    omtrax: 0,
    omtrans: 0,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [isLoadingExportCounts, setIsLoadingExportCounts] = useState(false);

  // Check if user is admin
  const isAdmin = user?.role === "admin";

  // Track myAssetCount separately (from server when querying user's assets)
  const [myAssetCount, setMyAssetCount] = useState(0);

  // Device counts from server (for summary cards)
  const [deviceCounts, setDeviceCounts] = useState({
    total: 0,
    laptops: 0,
    desktops: 0,
    printers: 0,
  });

  // Ref for debounce timer
  const searchDebounceRef = useRef(null);

  // Format date to DD-MM-YYYY format
  const formatDateForExport = (dateString) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return dateString;
    }
  };

  // Sort assets by createdAt descending (newest first)
  const sortAssetsByCreatedAt = (assets) => {
    return [...assets].sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA; // Newest first
    });
  };

  // Fetch assets from API with pagination, search, and filters
  const fetchAssets = useCallback(
    async (options = {}) => {
      const {
        page = 1,
        search = searchTerm,
        companyName = selectedCompany,
        device = selectedDeviceType,
        createdBy = "",
        showLoading = true,
      } = options;

      try {
        if (showLoading) setIsLoading(true);
        setError(null);
        const response = await getAllAssets({
          page,
          limit: 20,
          sortBy: "createdAt",
          order: "desc",
          search,
          companyName,
          device,
          createdBy,
        });

        // Extract assets from API response
        let assetData = [];
        if (response?.data?.assets) {
          assetData = response.data.assets;
        } else if (Array.isArray(response?.data)) {
          assetData = response.data;
        } else if (Array.isArray(response)) {
          assetData = response;
        }

        // Update pagination state from API response
        if (response?.data?.pagination) {
          setPagination({
            currentPage: response.data.pagination.currentPage || 1,
            totalPages: response.data.pagination.totalPages || 1,
            totalItems: response.data.pagination.totalItems || assetData.length,
            itemsPerPage: response.data.pagination.itemsPerPage || 20,
            hasNextPage: response.data.pagination.hasNextPage || false,
            hasPrevPage: response.data.pagination.hasPrevPage || false,
          });

          // Update myAssetCount when fetching user's assets
          if (createdBy && response.data.pagination.totalItems !== undefined) {
            setMyAssetCount(response.data.pagination.totalItems);
          }
        }

        // Sort assets by createdAt descending (newest first)
        const sortedAssets = sortAssetsByCreatedAt(assetData);
        setAssets(sortedAssets);
      } catch (err) {
        console.error("Error fetching assets:", err);
        setError(
          "Failed to load assets. Please check if the API server is running.",
        );
        setAssets([]);
      } finally {
        if (showLoading) setIsLoading(false);
      }
    },
    [searchTerm, selectedCompany, selectedDeviceType],
  );

  // Handle page change (maintain current filters including createdBy for Mine view)
  const handlePageChange = useCallback(
    (newPage) => {
      const createdByFilter = (!isAdmin || viewMode === "my") ? user?._id : "";
      fetchAssets({ page: newPage, createdBy: createdByFilter });
    },
    [fetchAssets, viewMode, user?._id, isAdmin],
  );

  // Handle search change - server-side search with debounce
  const handleSearch = useCallback(
    (term) => {
      setSearchTerm(term);
      
      // Clear any existing debounce timer
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
      
      // Debounce the API call - wait 400ms after user stops typing
      searchDebounceRef.current = setTimeout(() => {
        const createdByFilter = (!isAdmin || viewMode === "my") ? user?._id : "";
        fetchAssets({ page: 1, search: term, createdBy: createdByFilter });
      }, 400);
    },
    [fetchAssets, viewMode, user?._id, isAdmin],
  );

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  // Handle company filter change
  const handleCompanyFilter = useCallback(
    (company) => {
      setSelectedCompany(company);
      const createdByFilter = (!isAdmin || viewMode === "my") ? user?._id : "";
      fetchAssets({
        page: 1,
        companyName: company,
        createdBy: createdByFilter,
      });
    },
    [fetchAssets, viewMode, user?._id, isAdmin],
  );

  // Handle device type filter change
  const handleDeviceTypeFilter = useCallback(
    (device) => {
      setSelectedDeviceType(device);
      const createdByFilter = (!isAdmin || viewMode === "my") ? user?._id : "";
      fetchAssets({ page: 1, device: device, createdBy: createdByFilter });
    },
    [fetchAssets, viewMode, user?._id, isAdmin],
  );

  // Initial fetch of user's asset count for "Mine" badge
  // Note: Main asset fetch is handled by the viewMode effect below to ensure proper role-based filtering
  useEffect(() => {
    const fetchMyAssetCount = async () => {
      try {
        const response = await getAllAssets({
          page: 1,
          limit: 1,
          createdBy: user?._id,
        });
        if (response?.data?.pagination?.totalItems !== undefined) {
          setMyAssetCount(response.data.pagination.totalItems);
        }
      } catch (err) {
        console.error("Error fetching my asset count:", err);
      }
    };
    if (user?._id) {
      fetchMyAssetCount();
    }
  }, [user?._id]);

  // Fetch device counts from server (updates when company filter changes)
  // Regular users see only their own counts
  useEffect(() => {
    const fetchDeviceCounts = async () => {
      try {
        const createdByFilter = !isAdmin ? user?._id : "";
        const counts = await getAssetCounts(selectedCompany, createdByFilter);
        setDeviceCounts(counts);
      } catch (err) {
        console.error("Error fetching device counts:", err);
      }
    };
    fetchDeviceCounts();
  }, [selectedCompany, isAdmin, user?._id]);

  // Handle viewMode change - refetch with appropriate filter
  // Regular users always see only their own entries
  useEffect(() => {
    if (!isAdmin) {
      // Regular users always filter by their own createdBy
      if (user?._id) {
        fetchAssets({ page: 1, createdBy: user._id });
      }
    } else if (viewMode === "my" && user?._id) {
      fetchAssets({ page: 1, createdBy: user._id });
    } else if (viewMode === "all") {
      fetchAssets({ page: 1, createdBy: "" });
    }
  }, [viewMode, user?._id, isAdmin]);

  // Get filtered assets based on role and view mode
  // Note: With server-side pagination, filtering should ideally be done on the backend
  // Client-side filters here only affect the current page view
  const getFilteredAssets = () => {
    let filtered = assets;

    // Apply company filter (client-side, affects current page only)
    if (selectedCompany) {
      filtered = filtered.filter((a) => a.companyName === selectedCompany);
    }

    // Apply device type filter (client-side, affects current page only)
    if (selectedDeviceType) {
      filtered = filtered.filter((a) => a.device === selectedDeviceType);
    }

    return filtered;
  };

  const displayedAssets = getFilteredAssets();

  // Use server-side counts (already fetched via getAssetCounts)
  const counts = deviceCounts;

  // Fetch export counts when export modal opens
  // Regular users see only their own counts
  const fetchExportCounts = async () => {
    setIsLoadingExportCounts(true);
    try {
      const API_BASE_URL = "https://it-assets-backend.onrender.com/api/v1/assets";
      const createdByFilter = !isAdmin ? user?._id : "";
      const buildParams = (filters = {}) => {
        const params = new URLSearchParams({
          page: "1",
          limit: "1",
          sortBy: "createdAt",
          order: "desc",
          _t: Date.now().toString(),
        });
        if (filters.device) params.append("device", filters.device);
        if (filters.companyName) params.append("companyName", filters.companyName);
        if (createdByFilter) params.append("createdBy", createdByFilter);
        return params;
      };

      const extractCount = async (response) => {
        if (!response.ok) return 0;
        const data = await response.json();
        return data?.data?.pagination?.totalItems || 0;
      };

      const [totalRes, laptopRes, desktopRes, printerRes, tglRes, omtraxRes, omtransRes] = await Promise.all([
        fetch(`${API_BASE_URL}?${buildParams()}`),
        fetch(`${API_BASE_URL}?${buildParams({ device: "Laptop" })}`),
        fetch(`${API_BASE_URL}?${buildParams({ device: "Desktop" })}`),
        fetch(`${API_BASE_URL}?${buildParams({ device: "Printer" })}`),
        fetch(`${API_BASE_URL}?${buildParams({ companyName: "TGL" })}`),
        fetch(`${API_BASE_URL}?${buildParams({ companyName: "OmTrax" })}`),
        fetch(`${API_BASE_URL}?${buildParams({ companyName: "OmTrans" })}`),
      ]);

      const [total, laptops, desktops, printers, tgl, omtrax, omtrans] = await Promise.all([
        extractCount(totalRes),
        extractCount(laptopRes),
        extractCount(desktopRes),
        extractCount(printerRes),
        extractCount(tglRes),
        extractCount(omtraxRes),
        extractCount(omtransRes),
      ]);

      setExportCounts({ total, laptops, desktops, printers, tgl, omtrax, omtrans });
    } catch (error) {
      console.error("Error fetching export counts:", error);
    } finally {
      setIsLoadingExportCounts(false);
    }
  };

  // Open export modal and fetch counts
  const handleOpenExportModal = () => {
    setShowExportModal(true);
    fetchExportCounts();
  };

  // Export data based on selection
  // Regular users export only their own data
  const handleExportData = async (exportType) => {
    setIsExporting(true);
    try {
      const API_BASE_URL = "https://it-assets-backend.onrender.com/api/v1/assets";
      const params = new URLSearchParams({
        page: "1",
        limit: "10000", // Fetch all records
        sortBy: "createdAt",
        order: "desc",
        _t: Date.now().toString(),
      });

      // Regular users can only export their own data
      if (!isAdmin && user?._id) {
        params.append("createdBy", user._id);
      }

      let fileName = "IT_Assets";
      switch (exportType) {
        case "laptops":
          params.append("device", "Laptop");
          fileName = "IT_Assets_Laptops";
          break;
        case "desktops":
          params.append("device", "Desktop");
          fileName = "IT_Assets_Desktops";
          break;
        case "printers":
          params.append("device", "Printer");
          fileName = "IT_Assets_Printers";
          break;
        case "tgl":
          params.append("companyName", "TGL");
          fileName = "IT_Assets_TGL";
          break;
        case "omtrax":
          params.append("companyName", "OmTrax");
          fileName = "IT_Assets_OmTrax";
          break;
        case "omtrans":
          params.append("companyName", "OmTrans");
          fileName = "IT_Assets_OmTrans";
          break;
        default:
          fileName = "IT_Assets_All";
      }

      const response = await fetch(`${API_BASE_URL}?${params}`);
      if (!response.ok) throw new Error("Failed to fetch assets");
      
      const data = await response.json();
      let assetData = data?.data?.assets || data?.data || data || [];

      if (!assetData.length) {
        alert("No data to export");
        return;
      }

      const exportData = assetData.map((asset) => ({
        "Serial Number": asset.serialNumber || "",
        Company: asset.companyName || "",
        Branch: asset.branch || "",
        Department: asset.department || "",
        User: asset.userName || "",
        Brand: asset.brand || "",
        Device: asset.device || "",
        "Device S.No": asset.deviceSerialNo || "",
        "Operating System": asset.operatingSystem || "",
        "Purchase Date": formatDateForExport(asset.dateOfPurchase),
        Remark: asset.remark || "",
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "IT Assets");
      XLSX.writeFile(workbook, `${fileName}.xlsx`);

      setShowExportModal(false);
    } catch (error) {
      console.error("Error exporting data:", error);
      alert("Failed to export data. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  // Export currently displayed assets to Excel (admin only)
  const handleExportToExcel = () => {
    if (!isAdmin || !displayedAssets.length) return;

    const exportData = displayedAssets.map((asset) => ({
      Company: asset.companyName || "",
      Branch: asset.branch || "",
      Department: asset.department || "",
      User: asset.userName || "",
      Brand: asset.brand || "",
      Device: asset.device || "",
      "Device S.No": asset.deviceSerialNo || "",
      "Operating System": asset.operatingSystem || "",
      "Purchase Date": formatDateForExport(asset.dateOfPurchase),
      Remark: asset.remark || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "IT Assets");
    XLSX.writeFile(workbook, "IT_Assets.xlsx");
  };

  // Handle Excel file import - Server-side processing
  const handleImportFromExcel = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-excel", // .xls
      "text/csv", // .csv
    ];
    const validExtensions = [".xlsx", ".xls", ".csv"];
    const fileExtension = file.name
      .substring(file.name.lastIndexOf("."))
      .toLowerCase();

    if (
      !validTypes.includes(file.type) &&
      !validExtensions.includes(fileExtension)
    ) {
      setImportError(
        "Invalid file type. Please upload an Excel file (.xlsx, .xls) or CSV file.",
      );
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setImportError("File too large. Maximum file size is 10MB.");
      return;
    }

    setIsImporting(true);
    setImportError(null);
    setImportProgress({ current: 0, total: 100, status: "Reading file..." });

    try {
      // First, let's read and preview the Excel file to debug
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      console.log("Excel sheet name:", sheetName);
      console.log(
        "Excel columns:",
        jsonData.length > 0 ? Object.keys(jsonData[0]) : "No data",
      );
      console.log("First row data:", jsonData[0]);
      console.log("Total rows:", jsonData.length);

      if (jsonData.length === 0) {
        throw new Error("Excel file is empty or has no data rows");
      }

      setImportProgress({
        current: 0,
        total: 100,
        status: "Uploading file to server...",
      });
      console.log(`Uploading file: ${file.name}, size: ${file.size} bytes`);

      // Upload file to server for processing
      const result = await uploadExcel(file, user?._id);

      console.log("Upload result:", result);

      if (result.success) {
        const imported = result.data?.imported || result.data?.created || 0;
        const failed = result.data?.failed || 0;
        const total = imported + failed;

        setImportProgress({
          current: imported,
          total: total,
          status: `Complete! ${imported} records imported${failed > 0 ? `, ${failed} failed` : ""}.`,
        });

        // Show errors if any
        if (result.data?.errors && result.data.errors.length > 0) {
          console.log("Import errors:", result.data.errors);
        }

        // Refresh the assets list from page 1 (respecting current view mode)
        const createdByFilter = (!isAdmin || viewMode === "my") ? user?._id : "";
        await fetchAssets({ page: 1, createdBy: createdByFilter });

        // Update myAssetCount with imported records
        if (imported > 0) {
          setMyAssetCount((prev) => prev + imported);
        }

        // Refresh server-side counts
        const updatedCounts = await getAssetCounts(selectedCompany);
        setDeviceCounts(updatedCounts);
      } else {
        throw new Error(result.message || "Upload failed");
      }

      // Close modal after short delay to show completion
      setTimeout(() => {
        setShowImportModal(false);
        setIsImporting(false);
        setImportProgress({ current: 0, total: 0, status: "" });
      }, 2000);
    } catch (err) {
      console.error("Error importing Excel:", err);
      setImportError(err.message || "Failed to import Excel file");
      setIsImporting(false);
    }

    // Reset file input
    event.target.value = "";
  };

  // Download sample Excel template
  const downloadSampleTemplate = () => {
    const sampleData = [
      {
        Company: "OmTrans",
        Branch: "Delhi H.O",
        Department: "IT",
        User: "John Doe",
        Brand: "Dell",
        Device: "Laptop",
        "Device S.No": "ABC123XYZ",
        "Operating System": "Windows 11",
        "Purchase Date": "2024-01-15",
        Remark: "New device",
      },
      {
        Company: "TGL",
        Branch: "Mumbai",
        Department: "Finance",
        User: "Jane Smith",
        Brand: "HP",
        Device: "Desktop",
        "Device S.No": "HP456DEF",
        "Operating System": "Windows 10",
        "Purchase Date": "2023-06-20",
        Remark: "",
      },
      {
        Company: "OmTrax",
        Branch: "Kolkata",
        Department: "Operations",
        User: "Mike Wilson",
        Brand: "Lenovo",
        Device: "Laptop",
        "Device S.No": "LN789GHI",
        "Operating System": "Windows 11",
        "Purchase Date": "2024-12-05",
        Remark: "Upgraded model",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sample Assets");
    XLSX.writeFile(workbook, "IT_Assets_Import_Template.xlsx");
  };

  const deviceTabs = [
    {
      id: "",
      label: "Total",
      count: counts.total,
      icon: "grid",
      gradient: "from-blue-500 to-blue-600",
      bg: "bg-blue-50",
      text: "text-blue-700",
      ring: "ring-blue-500",
    },
    {
      id: "Laptop",
      label: "Laptops",
      count: counts.laptops,
      icon: "laptop",
      gradient: "from-emerald-500 to-emerald-600",
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      ring: "ring-emerald-500",
    },
    {
      id: "Desktop",
      label: "Desktops",
      count: counts.desktops,
      icon: "desktop",
      gradient: "from-violet-500 to-violet-600",
      bg: "bg-violet-50",
      text: "text-violet-700",
      ring: "ring-violet-500",
    },
    {
      id: "Printer",
      label: "Printers",
      count: counts.printers,
      icon: "printer",
      gradient: "from-amber-500 to-amber-600",
      bg: "bg-amber-50",
      text: "text-amber-700",
      ring: "ring-amber-500",
    },
  ];

  // Icon components for tabs
  const getTabIcon = (iconName, isActive) => {
    const iconClass = `h-5 w-5 ${isActive ? "text-white" : "text-gray-500"}`;
    switch (iconName) {
      case "grid":
        return (
          <svg
            className={iconClass}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
            />
          </svg>
        );
      case "laptop":
        return (
          <svg
            className={iconClass}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
        );
      case "desktop":
        return (
          <svg
            className={iconClass}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        );
      case "printer":
        return (
          <svg
            className={iconClass}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
            />
          </svg>
        );
      default:
        return null;
    }
  };

  // Refresh device counts from server
  // Regular users see only their own counts
  const refreshCounts = useCallback(async () => {
    try {
      const createdByFilter = !isAdmin ? user?._id : "";
      const counts = await getAssetCounts(selectedCompany, createdByFilter);
      setDeviceCounts(counts);
    } catch (err) {
      console.error("Error refreshing counts:", err);
    }
  }, [selectedCompany, isAdmin, user?._id]);

  // Handle adding new asset
  const handleAddAsset = async (formData) => {
    try {
      setError(null);
      setSuccessMessage(null);
      // If admin provided a serial number, include it; otherwise backend will auto-generate
      const assetData = {
        ...formData,
        createdBy: user?._id,
      };
      // Remove empty serialNumber so backend generates it
      if (
        !assetData.serialNumber ||
        assetData.serialNumber.trim() === "" ||
        assetData.serialNumber === "Will be generated on save"
      ) {
        delete assetData.serialNumber;
      }
      const response = await createAsset(assetData);
      const createdByFilter = (!isAdmin || viewMode === "my") ? user?._id : "";
      await fetchAssets({ page: 1, createdBy: createdByFilter });
      setIsModalOpen(false);

      // Show success message with generated serial number
      const newSerialNumber =
        response?.data?.serialNumber || response?.serialNumber || "Generated";
      setSuccessMessage(
        `Asset created successfully! Serial Number: ${newSerialNumber}`,
      );
      // Auto-hide success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);

      // Update myAssetCount since we added a new asset
      setMyAssetCount((prev) => prev + 1);
      // Refresh server-side counts
      refreshCounts();
    } catch (err) {
      console.error("Error creating asset:", err);
      setError("Failed to create asset. Please try again.");
    }
  };

  // Handle editing asset
  const handleEditAsset = async (formData) => {
    try {
      setError(null);
      const assetId = editingAsset._id || editingAsset.id;
      await updateAsset(assetId, formData);
      // Refresh the asset list from API to ensure we have the correct data
      const createdByFilter = (!isAdmin || viewMode === "my") ? user?._id : "";
      await fetchAssets({
        page: pagination.currentPage,
        createdBy: createdByFilter,
      });
      setEditingAsset(null);
      setIsModalOpen(false);
      // Refresh server-side counts (device type might have changed)
      refreshCounts();
    } catch (err) {
      console.error("Error updating asset:", err);
      setError("Failed to update asset. Please try again.");
    }
  };

  // Handle delete asset
  const handleDeleteAsset = async (assetId) => {
    try {
      setError(null);
      await deleteAsset(assetId);
      const createdByFilter = (!isAdmin || viewMode === "my") ? user?._id : "";
      await fetchAssets({
        page: pagination.currentPage,
        createdBy: createdByFilter,
      });
      setShowDeleteConfirm(null);
      // Update myAssetCount since we deleted an asset
      setMyAssetCount((prev) => Math.max(0, prev - 1));
      // Refresh server-side counts
      refreshCounts();
    } catch (err) {
      console.error("Error deleting asset:", err);
      setError("Failed to delete asset. Please try again.");
    }
  };

  // Open edit modal
  const openEditModal = (asset) => {
    setEditingAsset(asset);
    setIsModalOpen(true);
  };

  // Open add modal
  const openAddModal = () => {
    setEditingAsset(null);
    setIsModalOpen(true);
  };

  // Close modal
  const closeModal = () => {
    setIsModalOpen(false);
    setEditingAsset(null);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <svg
                className="h-5 w-5 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-green-700 font-medium">
                {successMessage}
              </span>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-green-500 hover:text-green-700"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <svg
                className="h-5 w-5 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-red-700">{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Manage and track your organization's IT assets
            </p>
          </div>
          <div className="flex items-center space-x-3 mt-4 sm:mt-0">
            <button
              onClick={async () => {
                setSearchTerm("");
                const createdByFilter = !isAdmin ? user?._id : (viewMode === "my" ? user?._id : "");
                await fetchAssets({
                  page: 1,
                  search: "",
                  createdBy: createdByFilter,
                });
                // Also refresh counts
                const countsFilter = !isAdmin ? user?._id : "";
                const counts = await getAssetCounts(selectedCompany, countsFilter);
                setDeviceCounts(counts);
              }}
              disabled={isLoading}
              className="inline-flex items-center px-4 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-colors border border-gray-300"
              title="Refresh assets"
            >
              <svg
                className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
            <button
              onClick={openAddModal}
              className="inline-flex items-center px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors shadow-md"
            >
              <svg
                className="h-5 w-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add Entry
            </button>
            <button
              onClick={handleOpenExportModal}
              disabled={isLoading}
              className="inline-flex items-center px-5 py-2.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
              title="Export assets to Excel"
            >
                <svg
                  className="h-5 w-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M8 12l4 4m0 0l4-4m-4 4V4"
                  />
                </svg>
                Export
              </button>
            {/* Import Button Hide
            {isAdmin && (
              <button
                onClick={() => setShowImportModal(true)}
                disabled={isLoading}
                className="inline-flex items-center px-5 py-2.5 bg-violet-600 text-white font-medium rounded-lg hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 transition-colors shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                title="Import assets from Excel file"
              >
                <svg
                  className="h-5 w-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M16 8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
                Import
              </button>
            )}  */}
          </div>
        </div>

        {/* Asset Summary Cards & Filters */}
        <div className="mb-6">
          {/* Device Type Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {deviceTabs.map((tab) => {
              const isActive = selectedDeviceType === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedDeviceType(tab.id)}
                  className={`relative group p-4 rounded-xl border-2 transition-all duration-200 ${
                    isActive
                      ? `border-transparent bg-gradient-to-br ${tab.gradient} shadow-lg scale-[1.02]`
                      : `border-gray-200 bg-white hover:border-gray-300 hover:shadow-md`
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`p-2 rounded-lg ${isActive ? "bg-white/20" : tab.bg}`}
                    >
                      {getTabIcon(tab.icon, isActive)}
                    </div>
                    {isActive && (
                      <div className="absolute top-2 right-2">
                        <svg
                          className="h-4 w-4 text-white/80"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="mt-3">
                    <p
                      className={`text-2xl font-bold ${isActive ? "text-white" : "text-gray-900"}`}
                    >
                      {tab.count}
                    </p>
                    <p
                      className={`text-sm font-medium ${isActive ? "text-white/80" : "text-gray-500"}`}
                    >
                      {tab.label}
                    </p>
                  </div>
                  {!isActive && (
                    <div
                      className={`absolute inset-0 rounded-xl ring-2 ${tab.ring} opacity-0 group-hover:opacity-20 transition-opacity`}
                    ></div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Filters Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            {/* Company Filter */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-gray-600">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                <span className="text-sm font-medium">Company</span>
              </div>
              <div className="relative">
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="appearance-none pl-4 pr-10 py-2 text-sm font-medium bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all cursor-pointer hover:bg-gray-100"
                >
                  <option value="">All Companies</option>
                  {companies.map((company) => (
                    <option key={company} value={company}>
                      {company}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg
                    className="h-4 w-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>
              {selectedCompany && (
                <button
                  onClick={() => setSelectedCompany("")}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Clear filter"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>

            {/* View Mode Toggle - Only for admin users */}
            {isAdmin ? (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-600">View</span>
                <div className="inline-flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode("all")}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${
                      viewMode === "all"
                        ? "bg-white text-blue-600 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    All
                    <span
                      className={`px-1.5 py-0.5 text-xs rounded-full ${
                        viewMode === "all"
                          ? "bg-blue-100 text-blue-600"
                          : "bg-gray-200 text-gray-500"
                      }`}
                    >
                      {pagination.totalItems}
                    </span>
                  </button>
                  <button
                    onClick={() => setViewMode("my")}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${
                      viewMode === "my"
                        ? "bg-white text-emerald-600 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    Mine
                    <span
                      className={`px-1.5 py-0.5 text-xs rounded-full ${
                        viewMode === "my"
                          ? "bg-emerald-100 text-emerald-600"
                          : "bg-gray-200 text-gray-500"
                      }`}
                    >
                      {myAssetCount}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200">
                <svg
                  className="h-4 w-4 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                <span className="text-sm text-gray-600">My Entries</span>
                <span className="px-1.5 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-600">
                  {myAssetCount}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Asset Table Section */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center space-y-4">
              <svg
                className="animate-spin h-10 w-10 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <p className="text-gray-500">Loading assets...</p>
            </div>
          </div>
        ) : (
          <AssetTable
            assets={displayedAssets}
            currentUser={user?._id}
            onEdit={openEditModal}
            onDelete={(asset) => setShowDeleteConfirm(asset._id || asset.id)}
            viewMode={viewMode}
            isAdmin={isAdmin}
            pagination={pagination}
            onPageChange={handlePageChange}
            searchTerm={searchTerm}
            onSearch={handleSearch}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-gray-500 text-sm">
            © 2026 IT Asset Manager. Built by OmTrans Logisitcs Ltd.
          </p>
        </div>
      </footer>

      {/* Asset Form Modal */}
      <AssetFormModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSubmit={editingAsset ? handleEditAsset : handleAddAsset}
        editingAsset={editingAsset}
        currentUser={user?._id}
        isAdmin={isAdmin}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setShowDeleteConfirm(null)}
          ></div>
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
                Delete Asset
              </h3>
              <p className="text-gray-600 text-center mb-6">
                Are you sure you want to delete this asset? This action cannot
                be undone.
              </p>
              <div className="flex space-x-4">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteAsset(showDeleteConfirm)}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-emerald-600">
              <h2 className="text-lg font-semibold text-white">Export Data</h2>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-white/80 hover:text-white"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            
            <div className="p-4">
              {isLoadingExportCounts ? (
                <div className="flex items-center justify-center py-6">
                  <svg className="animate-spin h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                </div>
              ) : (
                <>
                  {/* All/My Assets - Full width */}
                  <button
                    onClick={() => handleExportData("total")}
                    disabled={isExporting || exportCounts.total === 0}
                    className="w-full flex items-center justify-between px-3 py-2.5 mb-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-blue-200"
                  >
                    <span className="font-medium text-blue-700">{isAdmin ? "All Assets" : "My Assets"}</span>
                    <span className="text-xs font-bold text-blue-600 bg-blue-200 px-2 py-0.5 rounded-full">{exportCounts.total}</span>
                  </button>

                  {/* Device Types Grid */}
                  <p className="text-xs text-gray-500 mb-2 font-medium">By Device</p>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <button
                      onClick={() => handleExportData("laptops")}
                      disabled={isExporting || exportCounts.laptops === 0}
                      className="flex flex-col items-center px-2 py-2.5 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed border"
                    >
                      <span className="text-xs font-medium text-gray-700">Laptops</span>
                      <span className="text-xs text-gray-500 mt-0.5">{exportCounts.laptops}</span>
                    </button>
                    <button
                      onClick={() => handleExportData("desktops")}
                      disabled={isExporting || exportCounts.desktops === 0}
                      className="flex flex-col items-center px-2 py-2.5 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed border"
                    >
                      <span className="text-xs font-medium text-gray-700">Desktops</span>
                      <span className="text-xs text-gray-500 mt-0.5">{exportCounts.desktops}</span>
                    </button>
                    <button
                      onClick={() => handleExportData("printers")}
                      disabled={isExporting || exportCounts.printers === 0}
                      className="flex flex-col items-center px-2 py-2.5 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed border"
                    >
                      <span className="text-xs font-medium text-gray-700">Printers</span>
                      <span className="text-xs text-gray-500 mt-0.5">{exportCounts.printers}</span>
                    </button>
                  </div>

                  {/* Company Grid */}
                  <p className="text-xs text-gray-500 mb-2 font-medium">By Company</p>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleExportData("tgl")}
                      disabled={isExporting || exportCounts.tgl === 0}
                      className="flex flex-col items-center px-2 py-2.5 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed border border-orange-200"
                    >
                      <span className="text-xs font-medium text-orange-700">TGL</span>
                      <span className="text-xs text-orange-500 mt-0.5">{exportCounts.tgl}</span>
                    </button>
                    <button
                      onClick={() => handleExportData("omtrax")}
                      disabled={isExporting || exportCounts.omtrax === 0}
                      className="flex flex-col items-center px-2 py-2.5 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed border border-teal-200"
                    >
                      <span className="text-xs font-medium text-teal-700">OmTrax</span>
                      <span className="text-xs text-teal-500 mt-0.5">{exportCounts.omtrax}</span>
                    </button>
                    <button
                      onClick={() => handleExportData("omtrans")}
                      disabled={isExporting || exportCounts.omtrans === 0}
                      className="flex flex-col items-center px-2 py-2.5 bg-cyan-50 hover:bg-cyan-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed border border-cyan-200"
                    >
                      <span className="text-xs font-medium text-cyan-700">OmTrans</span>
                      <span className="text-xs text-cyan-500 mt-0.5">{exportCounts.omtrans}</span>
                    </button>
                  </div>

                  {isExporting && (
                    <div className="flex items-center justify-center mt-3 py-2 text-emerald-600">
                      <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      <span className="text-sm font-medium">Exporting...</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => !isImporting && setShowImportModal(false)}
          ></div>
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-violet-100 rounded-lg">
                    <svg
                      className="h-6 w-6 text-violet-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Import from Excel
                    </h3>
                    <p className="text-sm text-gray-500">
                      Upload an Excel file to import assets
                    </p>
                  </div>
                </div>
                {!isImporting && (
                  <button
                    onClick={() => setShowImportModal(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>

              {/* Error Message */}
              {importError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
                  <svg
                    className="h-5 w-5 text-red-500 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-red-600 text-sm">{importError}</span>
                </div>
              )}

              {/* Import Progress */}
              {isImporting ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center">
                    <svg
                      className="animate-spin h-10 w-10 text-violet-600"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-700">
                      {importProgress.status}
                    </p>
                    {importProgress.total > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        {importProgress.current} of {importProgress.total}{" "}
                        records
                      </p>
                    )}
                  </div>
                  {importProgress.total > 0 && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-violet-600 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${(importProgress.current / importProgress.total) * 100}%`,
                        }}
                      ></div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Expected Columns Info */}
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Required Excel column headers:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "Company",
                        "Branch",
                        "Department",
                        "User",
                        "Brand",
                        "Device",
                        "Device S.No",
                        "Operating System",
                        "Purchase Date",
                        "Remark",
                      ].map((col) => (
                        <span
                          key={col}
                          className="px-2 py-1 bg-white text-xs text-gray-600 rounded border border-gray-300"
                        >
                          {col}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-3">
                      <strong>Note:</strong> Serial Number (S.No) will be
                      auto-generated. Date format: YYYY-MM-DD or DD-MM-YYYY
                    </p>
                  </div>

                  {/* Download Template */}
                  <button
                    onClick={downloadSampleTemplate}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors border border-gray-300"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M8 12l4 4m0 0l4-4m-4 4V4"
                      />
                    </svg>
                    <span>Download Sample Template</span>
                  </button>

                  {/* File Upload */}
                  <label className="block">
                    <div className="flex items-center justify-center w-full h-32 px-4 border-2 border-dashed border-violet-300 rounded-lg cursor-pointer bg-violet-50 hover:bg-violet-100 transition-colors">
                      <div className="text-center">
                        <svg
                          className="mx-auto h-10 w-10 text-violet-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                        <p className="mt-2 text-sm text-violet-600 font-medium">
                          Click to upload file
                        </p>
                        <p className="text-xs text-gray-500">
                          .xlsx, .xls, .csv files supported
                        </p>
                      </div>
                    </div>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleImportFromExcel}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
