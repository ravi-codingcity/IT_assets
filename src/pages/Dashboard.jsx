import { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import Navbar from "../components/Navbar";
import AssetTable from "../components/AssetTable";
import AssetFormModal from "../components/AssetFormModal";
import { companies } from "../data/assets";
import { useAuth } from "../context/AuthContext";
import { getAllAssets, createAsset, updateAsset, deleteAsset } from "../services/assetService";

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

  // Check if user is admin
  const isAdmin = user?.role === "admin";

  // Fetch assets from API
  const fetchAssets = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setIsLoading(true);
      setError(null);
      const response = await getAllAssets();
      
      // Extract assets from API response
      let assetData = [];
      if (response?.data?.assets) {
        assetData = response.data.assets;
      } else if (Array.isArray(response?.data)) {
        assetData = response.data;
      } else if (Array.isArray(response)) {
        assetData = response;
      }
      
      // Sort by updatedAt (newest first)
      const sortedAssets = [...assetData].sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt || 0);
        const dateB = new Date(b.updatedAt || b.createdAt || 0);
        return dateB - dateA;
      });
      
      setAssets(sortedAssets);
    } catch (err) {
      console.error("Error fetching assets:", err);
      setError("Failed to load assets. Please check if the API server is running.");
      setAssets([]);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  // Initial fetch and auto-refresh every 30 seconds
  useEffect(() => {
    fetchAssets();
    
    // Auto-refresh every 30 seconds for real-time updates
    const refreshInterval = setInterval(() => {
      fetchAssets(false); // Silent refresh without loading spinner
    }, 30000);
    
    return () => clearInterval(refreshInterval);
  }, [fetchAssets]);

  // Get filtered assets based on role and view mode
  const getFilteredAssets = () => {
    let filtered = assets;

    // Role-based filtering:
    // - Admin in "all" mode: sees all assets
    // - Admin in "my" mode: sees only their own assets
    // - Non-admin: always sees only their own assets
    if (isAdmin) {
      if (viewMode === "my") {
        filtered = filtered.filter((a) => a.createdBy === user?._id);
      }
    } else {
      // Non-admin users only see their own entries
      filtered = filtered.filter((a) => a.createdBy === user?._id);
    }

    // Apply company filter
    if (selectedCompany) {
      filtered = filtered.filter((a) => a.companyName === selectedCompany);
    }

    // Apply device type filter
    if (selectedDeviceType) {
      filtered = filtered.filter((a) => a.device === selectedDeviceType);
    }

    return filtered;
  };

  const displayedAssets = getFilteredAssets();

  // Calculate counts based on current view
  const getCountsForCurrentView = () => {
    let baseAssets = assets;

    if (isAdmin && viewMode === "my") {
      baseAssets = assets.filter((a) => a.createdBy === user?._id);
    } else if (!isAdmin) {
      baseAssets = assets.filter((a) => a.createdBy === user?._id);
    }

    if (selectedCompany) {
      baseAssets = baseAssets.filter((a) => a.companyName === selectedCompany);
    }

    return {
      total: baseAssets.length,
      laptops: baseAssets.filter((a) => a.device === "Laptop").length,
      desktops: baseAssets.filter((a) => a.device === "Desktop").length,
      printers: baseAssets.filter((a) => a.device === "Printer").length,
    };
  };

  const counts = getCountsForCurrentView();
  const myAssetCount = assets.filter((a) => a.createdBy === user?._id).length;

  // Export currently displayed assets to Excel (admin only)
  const handleExportToExcel = () => {
    if (!isAdmin || !displayedAssets.length) return;

    const exportData = displayedAssets.map((asset, index) => ({
      "S.No": asset.serialNumber || index + 1,
      "Company": asset.companyName || "",
      "Branch": asset.branch || "",
      "Department": asset.department || "",
      "User": asset.userName || "",
      "Brand": asset.brand || "",
      "Device": asset.device || "",
      "Device S.No": asset.deviceSerialNo || "",
      "Operating System": asset.operatingSystem || "",
      "Purchase Date": asset.dateOfPurchase || "",
      "Remark": asset.remark || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "IT Assets");
    XLSX.writeFile(workbook, "IT_Assets.xlsx");
  };

  const deviceTabs = [
    { id: "", label: "Total", count: counts.total, icon: "grid", gradient: "from-blue-500 to-blue-600", bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-500" },
    { id: "Laptop", label: "Laptops", count: counts.laptops, icon: "laptop", gradient: "from-emerald-500 to-emerald-600", bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-500" },
    { id: "Desktop", label: "Desktops", count: counts.desktops, icon: "desktop", gradient: "from-violet-500 to-violet-600", bg: "bg-violet-50", text: "text-violet-700", ring: "ring-violet-500" },
    { id: "Printer", label: "Printers", count: counts.printers, icon: "printer", gradient: "from-amber-500 to-amber-600", bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-500" },
  ];

  // Icon components for tabs
  const getTabIcon = (iconName, isActive) => {
    const iconClass = `h-5 w-5 ${isActive ? "text-white" : "text-gray-500"}`;
    switch (iconName) {
      case "grid":
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        );
      case "laptop":
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
      case "desktop":
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
      case "printer":
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
        );
      default:
        return null;
    }
  };

  // Handle adding new asset
  const handleAddAsset = async (formData) => {
    try {
      setError(null);
      const assetData = {
        ...formData,
        createdBy: user?._id,
      };
      await createAsset(assetData);
      await fetchAssets();
      setIsModalOpen(false);
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
      await fetchAssets();
      setEditingAsset(null);
      setIsModalOpen(false);
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
      await fetchAssets();
      setShowDeleteConfirm(null);
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
        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span className="text-red-700">{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
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
              onClick={fetchAssets}
              disabled={isLoading}
              className="inline-flex items-center px-4 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-colors border border-gray-300"
              title="Refresh assets"
            >
              <svg
                className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`}
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
            {isAdmin && (
              <button
                onClick={handleExportToExcel}
                disabled={isLoading || !displayedAssets.length}
                className="inline-flex items-center px-5 py-2.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                title="Download current table data as Excel"
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
                Export Excel
              </button>
            )}
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
                    <div className={`p-2 rounded-lg ${isActive ? "bg-white/20" : tab.bg}`}>
                      {getTabIcon(tab.icon, isActive)}
                    </div>
                    {isActive && (
                      <div className="absolute top-2 right-2">
                        <svg className="h-4 w-4 text-white/80" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="mt-3">
                    <p className={`text-2xl font-bold ${isActive ? "text-white" : "text-gray-900"}`}>
                      {tab.count}
                    </p>
                    <p className={`text-sm font-medium ${isActive ? "text-white/80" : "text-gray-500"}`}>
                      {tab.label}
                    </p>
                  </div>
                  {!isActive && (
                    <div className={`absolute inset-0 rounded-xl ring-2 ${tab.ring} opacity-0 group-hover:opacity-20 transition-opacity`}></div>
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
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
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
                  <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              {selectedCompany && (
                <button
                  onClick={() => setSelectedCompany("")}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Clear filter"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    All
                    <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                      viewMode === "all" ? "bg-blue-100 text-blue-600" : "bg-gray-200 text-gray-500"
                    }`}>
                      {assets.length}
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
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Mine
                    <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                      viewMode === "my" ? "bg-emerald-100 text-emerald-600" : "bg-gray-200 text-gray-500"
                    }`}>
                      {myAssetCount}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200">
                <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
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
              <svg className="animate-spin h-10 w-10 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
                Are you sure you want to delete this asset? This action cannot be undone.
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
    </div>
  );
};

export default Dashboard;
