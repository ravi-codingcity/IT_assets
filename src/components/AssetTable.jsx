import { useState, useEffect } from "react";

// Format date to user-friendly format (DD-MM-YYYY)
const formatDate = (dateString) => {
  if (!dateString) return "-";
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

const AssetTable = ({ 
  assets, 
  currentUser, 
  onEdit, 
  onDelete, 
  viewMode, 
  isAdmin,
  pagination,
  onPageChange,
  searchTerm = "",
  onSearch
}) => {
  // Local search input state for controlled input
  const [localSearch, setLocalSearch] = useState(searchTerm);

  // Sync local search with external searchTerm prop
  useEffect(() => {
    setLocalSearch(searchTerm);
  }, [searchTerm]);

  // Check if the current user owns an asset
  // Handle both cases: createdBy as string ID or as populated user object
  const canEditAsset = (asset) => {
    if (!asset.createdBy || !currentUser) return false;
    // If createdBy is an object (populated), compare _id
    if (typeof asset.createdBy === 'object') {
      return asset.createdBy._id === currentUser;
    }
    // Otherwise compare directly as string
    return asset.createdBy === currentUser;
  };

  // Determine if Action column should be shown
  // - Admin in "All" view: No action column (read-only view of all data)
  // - Admin in "Mine" view: Show action column with edit/delete for their own entries
  // - Regular users: Always show action column (they only see their own data)
  const showActionColumn = isAdmin ? viewMode === "my" : true;

  // Client-side search filter (fallback when backend doesn't support search)
  // This filters the current page's assets only
  const filteredAssets = localSearch.trim() 
    ? assets.filter((asset) => {
        const search = localSearch.toLowerCase();
        return (
          asset.serialNumber?.toLowerCase().includes(search) ||
          asset.companyName?.toLowerCase().includes(search) ||
          asset.branch?.toLowerCase().includes(search) ||
          asset.department?.toLowerCase().includes(search) ||
          asset.userName?.toLowerCase().includes(search) ||
          asset.brand?.toLowerCase().includes(search) ||
          asset.device?.toLowerCase().includes(search) ||
          asset.deviceSerialNo?.toLowerCase().includes(search)
        );
      })
    : assets;

  // Use server pagination values
  const { currentPage, totalPages, totalItems, itemsPerPage, hasNextPage, hasPrevPage } = pagination || {
    currentPage: 1,
    totalPages: 1,
    totalItems: assets.length,
    itemsPerPage: 20,
    hasNextPage: false,
    hasPrevPage: false
  };

  // Calculate display range
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

  // Handle search change - client-side filtering
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setLocalSearch(value);
    
    // Notify parent of search change (for tracking state)
    if (onSearch) {
      onSearch(value);
    }
  };

  // Handle page navigation
  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages && onPageChange) {
      onPageChange(page);
    }
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push("...");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Search Bar */}
      <div className="p-3 border-b border-gray-200 bg-gray-50">
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
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
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search by name, serial, branch, department..."
            value={localSearch}
            onChange={handleSearchChange}
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">
                S.No
              </th>
              <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">
                Company
              </th>
              <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">
                Branch
              </th>
              <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">
                Dept
              </th>
              <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">
                User
              </th>
              <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">
                Brand
              </th>
              <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">
                Device
              </th>
              <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">
                Device S.No
              </th>
              <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">
                OS
              </th>
              <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">
                Purchase Date
              </th>
              <th className="px-2 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">
                Remark
              </th>
              {showActionColumn && (
                <th className="px-2 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAssets.length > 0 ? (
              filteredAssets.map((asset, index) => (
                <tr
                  key={asset._id || asset.id}
                  className={`hover:bg-blue-50 transition-colors ${
                    index % 2 === 0 ? "bg-white" : "bg-gray-50"
                  }`}
                >
                  <td className="px-2 py-2 text-xs text-blue-700 font-medium whitespace-nowrap">
                    {asset.serialNumber}
                  </td>
                  <td className="px-2 py-2 text-xs text-gray-900 whitespace-nowrap">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getCompanyColor(asset.companyName)}`}>
                      {asset.companyName}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-xs text-gray-600 whitespace-nowrap" title={asset.branch}>
                    {asset.branch?.length > 15 ? asset.branch.substring(0, 15) + "..." : asset.branch}
                  </td>
                  <td className="px-2 py-2 text-xs text-gray-600 whitespace-nowrap" title={asset.department}>
                    {asset.department?.length > 15 ? asset.department.substring(0, 15) + "..." : asset.department}
                  </td>
                  <td className="px-2 py-2 text-xs text-gray-900 whitespace-nowrap" title={asset.userName}>
                    {asset.userName?.length > 20 ? asset.userName.substring(0, 20) + "..." : asset.userName}
                  </td>
                  <td className="px-2 py-2 text-xs text-gray-600 whitespace-nowrap">
                    {asset.brand}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getDeviceColor(asset.device)}`}>
                      {asset.device}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-xs text-gray-600 font-mono whitespace-nowrap" title={asset.deviceSerialNo}>
                    {asset.deviceSerialNo?.length > 14 ? asset.deviceSerialNo.substring(0, 14) + "..." : asset.deviceSerialNo}
                  </td>
                  <td className="px-2 py-2 text-xs text-gray-600 whitespace-nowrap" title={asset.operatingSystem}>
                    {asset.operatingSystem?.length > 12 ? asset.operatingSystem.substring(0, 12) + "..." : asset.operatingSystem}
                  </td>
                  <td className="px-2 py-2 text-xs text-gray-600 whitespace-nowrap">
                    {formatDate(asset.dateOfPurchase)}
                  </td>
                  <td className="px-2 py-2 text-xs text-gray-500 whitespace-nowrap" title={asset.remark}>
                    {asset.remark?.length > 15 ? asset.remark.substring(0, 15) + "..." : asset.remark}
                  </td>
                  {showActionColumn && (
                    <td className="px-2 py-2 text-center whitespace-nowrap">
                      {canEditAsset(asset) ? (
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => onEdit(asset)}
                            className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                            title="Edit"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => onDelete(asset)}
                            className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                            title="Delete"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={showActionColumn ? 12 : 11}
                  className="px-3 py-8 text-center"
                >
                  <div className="flex flex-col items-center">
                    <svg
                      className="h-8 w-8 text-gray-400 mb-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="text-gray-500 text-sm">No assets found</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer with Pagination */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Showing info */}
          <p className="text-sm text-gray-600">
            Showing{" "}
            <span className="font-medium text-gray-900">
              {totalItems > 0 ? startIndex + 1 : 0}
            </span>{" "}
            to{" "}
            <span className="font-medium text-gray-900">
              {endIndex}
            </span>{" "}
            of{" "}
            <span className="font-medium text-gray-900">{totalItems}</span>{" "}
            entries
            {totalPages > 1 && (
              <span className="text-gray-500"> (Page {currentPage} of {totalPages})</span>
            )}
          </p>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <nav className="flex items-center space-x-1" aria-label="Pagination">
              {/* First Button */}
              <button
                onClick={() => goToPage(1)}
                disabled={!hasPrevPage}
                className="px-2 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="First page"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>

              {/* Previous Button */}
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={!hasPrevPage}
                className="px-2 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Previous page"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Page Numbers */}
              {getPageNumbers().map((page, idx) => (
                page === "..." ? (
                  <span key={`ellipsis-${idx}`} className="px-2 py-1 text-gray-400">...</span>
                ) : (
                  <button
                    key={page}
                    onClick={() => goToPage(page)}
                    className={`min-w-[36px] px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      currentPage === page
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-gray-600 bg-white border border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {page}
                  </button>
                )
              ))}

              {/* Next Button */}
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={!hasNextPage}
                className="px-2 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Next page"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Last Button */}
              <button
                onClick={() => goToPage(totalPages)}
                disabled={!hasNextPage}
                className="px-2 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Last page"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            </nav>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper function to get color based on company
const getCompanyColor = (company) => {
  const colors = {
    OmTrans: "bg-blue-100 text-blue-700",
    TGL: "bg-purple-100 text-purple-700",
    OmTrax: "bg-green-100 text-green-700",
  };
  return colors[company] || "bg-gray-100 text-gray-700";
};

// Helper function to get color based on device type
const getDeviceColor = (device) => {
  const colors = {
    Laptop: "bg-emerald-100 text-emerald-700",
    Desktop: "bg-indigo-100 text-indigo-700",
    Printer: "bg-orange-100 text-orange-700",
  };
  return colors[device] || "bg-gray-100 text-gray-700";
};

export default AssetTable;
