import * as ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import html2canvas from "html2canvas";

export type ChartImage = {
  element: HTMLElement;
  sheetName: string;
  position: { col: number; row: number; width: number; height: number };
};


// Helper function to add a styled header row
const addHeaderRow = (worksheet: ExcelJS.Worksheet, headers: string[], startCol = 1, startRow = 1) => {
  headers.forEach((header, index) => {
    const cell = worksheet.getCell(startRow, startCol + index);
    cell.value = header;
    cell.font = { bold: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' } // Light gray background
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });
  return startRow + 1; // Return the next row number
};

// Type definitions for count objects
type CountMap = { [key: string]: number };

// Helper function to add data rows
// (Removed unused function)

export const exportToExcel = async (
  data: any[],
  columns: { header: string; key: string; width?: number }[],
  fileName: string,
  charts: ChartImage[] = []
) => {
  const workbook = new ExcelJS.Workbook();
  
  // Add main data sheet with styling
  const dataWorksheet = workbook.addWorksheet("Data");
  
  // Add headers with styling
  dataWorksheet.columns = columns.map(col => ({
    header: col.header,
    key: col.key,
    width: col.width || 15,
    style: { font: { bold: true } }
  }));
  
  // Add data with alternating row colors
  data.forEach((row, index) => {
    const dataRow = dataWorksheet.addRow(row);
    
    // Apply alternating row colors
    if (index % 2 === 0) {
      dataRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF5F5F5' } // Very light gray
      };
    }
    
    // Add borders
    dataRow.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  // Add chart sheets with data tables
  for (const chart of charts) {
    try {
      // Create a new worksheet for each chart
      const chartWorksheet = workbook.addWorksheet(chart.sheetName);
      
      // Add the chart image to the worksheet
      const chartImage = await captureElementAsBase64(chart.element);
      
      // Get chart data based on chart type
      let chartData: { headers: string[]; rows: any[][] } | null = null;
      
      if (chart.sheetName === 'Status Distribution') {
        // Extract status distribution data
        const statusCounts: CountMap = {};
        data.forEach(item => {
          const status = (item as any)['Status'] || 'Unknown';
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        });
        
        chartData = {
          headers: ['Status', 'Count', 'Percentage'],
          rows: Object.entries(statusCounts).map(([status, count]) => [
            status,
            count,
            { formula: `B${chart.position.row + 2}/SUM(B${chart.position.row + 2}:B${chart.position.row + 1 + Object.keys(statusCounts).length})`, 
              result: (count as number) / data.length * 100 }
          ])
        };
      } else if (chart.sheetName === 'Category Distribution') {
        // Extract category distribution data
        const categoryCounts: CountMap = {};
        data.forEach(item => {
          const category = (item as any)['Category'] || 'Uncategorized';
          categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        });
        
        chartData = {
          headers: ['Category', 'Count', 'Percentage'],
          rows: Object.entries(categoryCounts).map(([category, count]) => [
            category,
            count,
            { formula: `B${chart.position.row + 2}/SUM(B${chart.position.row + 2}:B${chart.position.row + 1 + Object.keys(categoryCounts).length})`,
              result: (count as number) / data.length * 100 }
          ])
        };
      } else if (chart.sheetName === 'Posts Over Time') {
        // Extract posts over time data
        const dailyCounts: CountMap = {};
        data.forEach(item => {
          const createdAt = (item as any)['Created At'];
          const date = typeof createdAt === 'string' ? createdAt.split(' ')[0] : 'Unknown';
          dailyCounts[date] = (dailyCounts[date] || 0) + 1;
        });
        
        // Sort dates
        const sortedDates = Object.keys(dailyCounts).sort();
        
        chartData = {
          headers: ['Date', 'Number of Posts'],
          rows: sortedDates.map(date => [date, dailyCounts[date] || 0])
        };
      }
      
      // Add chart data table if available
      if (chartData) {
        // Add title
        const titleRow = chart.position.row;
        chartWorksheet.getCell(titleRow, 1).value = `${chart.sheetName} - Data Table`;
        chartWorksheet.getCell(titleRow, 1).font = { bold: true, size: 14 };
        
        // Add data table
        const dataStartRow = titleRow + 2;
        addHeaderRow(chartWorksheet, chartData.headers, 1, dataStartRow - 1);
        
        // Add data rows with proper formatting
        chartData.rows.forEach((row, rowIndex) => {
          row.forEach((cellValue, colIndex) => {
            const cell = chartWorksheet.getCell(dataStartRow + rowIndex, 1 + colIndex);
            
            // Handle formula or direct value
            if (typeof cellValue === 'object' && cellValue !== null && 'formula' in cellValue) {
              cell.value = { formula: cellValue.formula, result: cellValue.result };
            } else {
              cell.value = cellValue;
            }
            
            // Format percentages
            if (chartData?.headers[colIndex] === 'Percentage') {
              cell.numFmt = '0.00%';
            }
            
            // Add borders
            cell.border = {
              left: { style: 'thin' },
              right: { style: 'thin' },
              top: rowIndex === 0 ? { style: 'thin' } : undefined,
              bottom: { style: 'thin' }
            };
            
            // Add alternating row colors
            if (rowIndex % 2 === 0) {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF5F5F5' }
              };
            }
          });
        });
        
        // Auto-fit columns
        chartData.headers.forEach((_, index) => {
          chartWorksheet.getColumn(index + 1).width = Math.max(
            15,
            chartData ? Math.min(
              Math.max(...chartData.rows.map(row => String(row[index]).length), 
              chartData.headers[index].length) + 2, 30) : 15
          );
        });
        
        // Adjust chart position to be below the data table
        chart.position.row = dataStartRow + chartData.rows.length + 3;
      }
      
      // Add the chart image
      if (chartImage) {
        const imageId = workbook.addImage({
          base64: chartImage,
          extension: 'png',
        });
        
        chartWorksheet.addImage(imageId, {
          tl: { col: chart.position.col, row: chart.position.row },
          ext: { width: chart.position.width, height: chart.position.height },
        });
      }
    } catch (error) {
      console.warn(`Failed to add chart '${chart.sheetName}' to Excel:`, error);
    }
  }

  // Auto-fit columns in the data sheet
  dataWorksheet.columns?.forEach((column) => {
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

  // Save the file
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${fileName}-${new Date().toISOString().split('T')[0]}.xlsx`
  );
};

export const captureElementAsBase64 = async (element: HTMLElement): Promise<string | null> => {
  try {
    const canvas = await html2canvas(element, {
      scale: 2, // Higher quality
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });
    return canvas.toDataURL('image/png').split(',')[1];
  } catch (error) {
    console.error('Error capturing element:', error);
    return null;
  }
};

export const captureChartAsImage = async (chartRef: React.RefObject<HTMLDivElement>) => {
  if (!chartRef.current) return null;
  return captureElementAsBase64(chartRef.current);
};
