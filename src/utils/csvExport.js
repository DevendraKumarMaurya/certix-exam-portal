import toast from "react-hot-toast";

export function convertToCSV(data) {
  if (!data || data.length === 0) return "";

  const headers = Object.keys(data[0]).join(",");
  const rows = data.map((row) =>
    Object.values(row)
      .map((val) =>
        typeof val === "string" && val.includes(",") ? `"${val}"` : val,
      )
      .join(","),
  );

  return [headers, ...rows].join("\n");
}

export function exportToCSV(data, filename) {
  try {
    const csv = convertToCSV(data);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    toast.success("Report exported successfully");
  } catch (error) {
    console.error("Error exporting CSV:", error);
    toast.error("Failed to export report");
  }
}
