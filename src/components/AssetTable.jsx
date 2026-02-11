import { useState } from "react";

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

const AssetTable = ({ assets, currentUser, onEdit, onDelete, viewMode, isAdmin }) => {
  const [searchTerm, setSearchTerm] = useState("");

  // Check if the current user owns an asset
  const canEditAsset = (asset) => {
    return asset.createdBy === currentUser;
  };

  // Determine if Action column should be shown
  // - Admin in "All" view: No action column (read-only view of all data)
  // - Admin in "Mine" view: Show action column with edit/delete for their own entries
  // - Regular users: Always show action column (they only see their own data)
  const showActionColumn = isAdmin ? viewMode === "my" : true;

  // Filter assets based on search only (type and company filters moved to Dashboard)
  const filteredAssets = assets.filter((asset) => {
    const matchesSearch =
      asset.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.branch?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.device?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.deviceSerialNo?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

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
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
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
                    {asset.department?.length > 12 ? asset.department.substring(0, 12) + "..." : asset.department}
                  </td>
                  <td className="px-2 py-2 text-xs text-gray-900 whitespace-nowrap" title={asset.userName}>
                    {asset.userName?.length > 12 ? asset.userName.substring(0, 12) + "..." : asset.userName}
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

      {/* Table Footer */}
      <div className="px-3 py-2 bg-gray-50 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Showing{" "}
          <span className="font-medium text-gray-700">
            {filteredAssets.length}
          </span>{" "}
          of <span className="font-medium text-gray-700">{assets.length}</span>{" "}
          assets
        </p>
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
