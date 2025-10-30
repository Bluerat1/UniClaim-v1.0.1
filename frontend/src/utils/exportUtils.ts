import * as ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import html2canvas from "html2canvas";

// Helper function to validate base64 strings
const isValidBase64 = (str: string): boolean => {
  try {
    // Check if the string is a valid base64
    return btoa(atob(str)) === str;
  } catch (e) {
    return false;
  }
};

export const exportToExcel = async (
  data: any[],
  columns: { header: string; key: string; width?: number }[],
  fileName: string,
  chartImage?: string
) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Data");

  // Add headers
  worksheet.columns = columns;

  // Add data
  worksheet.addRows(data);

  // Add chart image if provided and valid
  if (chartImage && isValidBase64(chartImage)) {
    try {
      const imageId = workbook.addImage({
        base64: chartImage,
        extension: 'png',
      });

      worksheet.addImage(imageId, {
        tl: { col: columns.length + 2, row: 0 },
        ext: { width: 600, height: 300 },
      });
    } catch (error) {
      console.warn('Failed to add chart image to Excel:', error);
      // Continue without the chart image
    }
  }

  // Auto-fit columns
  worksheet.columns?.forEach((column) => {
    if (!column || column.width) return;
    
    let maxLength = 0;
    // Safely handle eachCell which might be undefined
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const cellValue = cell?.value;
      const cellText = cellValue ? String(cellValue) : '';
      maxLength = Math.max(maxLength, cellText.length);
    });
    
    // Set column width with reasonable min/max bounds
    column.width = Math.min(Math.max((maxLength || 10) + 2, 10), 50);
  });

  // Generate Excel file
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], { type: 'application/octet-stream' }),
    `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`
  );
};

export const captureChartAsImage = async (chartRef: React.RefObject<HTMLDivElement>) => {
  if (!chartRef.current) return null;

  // Create a clone of the chart to avoid affecting the original
  const chartDiv = chartRef.current.cloneNode(true) as HTMLDivElement;
  chartDiv.style.position = 'absolute';
  chartDiv.style.left = '-9999px';
  chartDiv.style.top = '-9999px';
  chartDiv.style.width = '800px';
  chartDiv.style.height = '400px';
  chartDiv.style.backgroundColor = 'white';
  document.body.appendChild(chartDiv);

  try {
    const canvas = await html2canvas(chartDiv, {
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      scale: 1,
    });

    return canvas.toDataURL('image/png').split(',')[1]; // Remove data URL prefix
  } catch (error) {
    console.error('Error capturing chart:', error);
    return null;
  } finally {
    document.body.removeChild(chartDiv);
  }
};
