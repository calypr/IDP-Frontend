import type { NavPageLayoutProps } from '@gen3/frontend';
import { NavPageLayout } from '@gen3/frontend';
import { defineSamplePageLoader } from '@/lib/content/pageLoader';
import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import {
  Upload,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Info,
} from 'lucide-react';
import Papa from 'papaparse';

interface UMAPPoint {
  id: string;
  x: number;
  y: number;
  metadata: Record<string, string | number | boolean | null | undefined>;
}

interface FileInfo {
  name: string;
  cells: number;
  xCol: string;
  yCol: string;
  idCol: string;
}

interface DetectedColumns {
  xCol: string | null;
  yCol: string | null;
  idCol: string;
  metadataCols: string[];
}

const UMAPViewer = ({ headerProps, footerProps, pageProblems }: NavPageLayoutProps) => {
  // State variables with defined types
  const [data, setData] = useState<UMAPPoint[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [colorByColumn, setColorByColumn] = useState<string | null>(null);
  const [uniqueValues, setUniqueValues] = useState<(string | number)[]>([]); // Values from the selected color column
  const [selectedValue, setSelectedValue] = useState<'all' | string | number>(
    'all',
  );
  const [hoveredCell, setHoveredCell] = useState<UMAPPoint | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);

  // Ref types
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const colorPalettes = useMemo(
    () => ({
      categorical: [
        '#e74c3c',
        '#3498db',
        '#2ecc71',
        '#f39c12',
        '#9b59b6',
        '#1abc9c',
        '#e67e22',
        '#34495e',
        '#95a5a6',
        '#c0392b',
        '#16a085',
        '#27ae60',
        '#2980b9',
        '#8e44ad',
        '#f1c40f',
        '#e8672e',
        '#d35400',
        '#c0392b',
        '#7f8c8d',
        '#2c3e50',
      ],
    }),
    [],
  );

  // Changed to useCallback for memoization and proper typing
  const getColor = useCallback(
    (_: string | number, index: number): string => {
      return colorPalettes.categorical[
        index % colorPalettes.categorical.length
      ];
    },
    [colorPalettes],
  );

  // Added return type and non-null assertion for headers
  const detectColumns = (headers: string[] | undefined): DetectedColumns => {
    const safeHeaders = headers || [];
    const h = safeHeaders.map((col) => col.toLowerCase().trim());

    // Try to detect UMAP coordinate columns
    let xCol: string | null = null;
    let yCol: string | null = null;

    // Patterns for X coordinate
    const xPatterns = ['x_umap_1', 'umap_1', 'umap1', 'x_umap', 'umap_x', 'x'];
    for (const pattern of xPatterns) {
      const idx = h.findIndex(
        (col) => col === pattern || col.includes(pattern),
      );
      if (idx !== -1) {
        xCol = safeHeaders[idx];
        break;
      }
    }

    // Patterns for Y coordinate
    const yPatterns = ['x_umap_2', 'umap_2', 'umap2', 'y_umap', 'umap_y', 'y'];
    for (const pattern of yPatterns) {
      const idx = h.findIndex(
        (col) => col === pattern || col.includes(pattern),
      );
      if (idx !== -1) {
        yCol = safeHeaders[idx];
        break;
      }
    }

    // Detect ID column
    let idCol: string = safeHeaders[0] || ''; // Default to first column or empty string
    const idPatterns = ['cellid', 'cell_id', 'id', 'barcode', 'cell'];
    for (const pattern of idPatterns) {
      const idx = h.findIndex((col) => col.includes(pattern));
      if (idx !== -1) {
        idCol = safeHeaders[idx] || '';
        break;
      }
    }

    // Find metadata columns (exclude coordinates and ID)
    const metadataCols = safeHeaders.filter(
      (col) => col !== xCol && col !== yCol && col !== idCol,
    );

    return { xCol, yCol, idCol, metadataCols };
  };

  // Explicitly typed event
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; // Use optional chaining
    if (!file) return;

    // PapaParse typing is tricky, but results structure can be typed
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results: Papa.ParseResult<Record<string, unknown>>) => {
        const headers = results.meta.fields;
        const detected = detectColumns(headers);

        if (!detected.xCol || !detected.yCol) {
          alert(
            'Could not detect UMAP coordinate columns. Please ensure your CSV has columns like "X_umap_1" and "X_umap_2"',
          );
          return;
        }

        // Use detected column names and map data to UMAPPoint[]
        const xColName = detected.xCol;
        const yColName = detected.yCol;
        const idColName = detected.idCol;

        const parsedData: UMAPPoint[] = results.data
          .map((row: Record<string, unknown>, idx): UMAPPoint | null => {
            const xVal = row[xColName];
            const yVal = row[yColName];

            // Check if coordinates are valid numbers
            const x =
              typeof xVal === 'number' ? xVal : parseFloat(String(xVal));
            const y =
              typeof yVal === 'number' ? yVal : parseFloat(String(yVal));

            if (isNaN(x) || isNaN(y)) return null;

            const point: UMAPPoint = {
              id: String(row[idColName] || `cell_${idx}`),
              x: x,
              y: y,
              metadata: {},
            };

            // Add all metadata
            detected.metadataCols.forEach((col) => {
              point.metadata[col] = row[col] as
                string | number | boolean | null | undefined;
            });

            return point;
          })
          .filter((d): d is UMAPPoint => d !== null); // Filter out invalid points

        setData(parsedData);
        setColumns(detected.metadataCols);

        // Auto-select first categorical column for coloring
        let defaultColorCol: string | null = null;
        for (const col of detected.metadataCols) {
          const values = parsedData.map((d) => d.metadata[col]);
          // Filter null/undefined values and ensure they are compatible with Set
          const uniqueVals = [...new Set(values)].filter(
            (v): v is string | number => v != null,
          );

          if (uniqueVals.length > 1 && uniqueVals.length < 100) {
            // Convert numeric cluster IDs to strings for proper categorical handling
            parsedData.forEach((point) => {
              const val = point.metadata[col];
              if (typeof val === 'number') {
                point.metadata[col] = String(val);
              }
            });
            defaultColorCol = col;
            break;
          }
        }

        if (defaultColorCol) {
          setColorByColumn(defaultColorCol);
          updateUniqueValues(parsedData, defaultColorCol);
        } else {
          // Reset if no suitable column is found
          setColorByColumn(null);
          setUniqueValues([]);
        }

        setFileInfo({
          name: file.name,
          cells: parsedData.length,
          xCol: xColName,
          yCol: yColName,
          idCol: idColName,
        });
      },
    });
  };

  // Added return type and typed arguments
  const updateUniqueValues = (
    dataPoints: UMAPPoint[],
    column: string | null,
  ) => {
    if (!column) {
      setUniqueValues([]);
      return;
    }

    const values = dataPoints.map((d) => d.metadata[column]);
    // Filter out null/undefined values and ensure only string/number are used for uniqueValues
    const unique = [...new Set(values)].filter(
      (v): v is string | number => v != null,
    );

    // Sort: if all values look like numbers, sort numerically, otherwise alphabetically
    const allNumeric = unique.every((v) => !isNaN(Number(v)));
    if (allNumeric) {
      unique.sort((a, b) => Number(a) - Number(b));
    } else {
      unique.sort((a, b) => String(a).localeCompare(String(b)));
    }

    setUniqueValues(unique);
  };

  // Typed argument
  const handleColorByChange = (column: string) => {
    setColorByColumn(column);
    setSelectedValue('all');

    // Convert numeric values to strings for categorical handling
    const processedData = data.map((point) => {
      const value = point.metadata[column];
      return {
        ...point,
        metadata: {
          ...point.metadata,
          [column]: typeof value === 'number' ? String(value) : value,
        },
      };
    });
    // The state setter needs a UMAPPoint[] which is what is created above
    setData(processedData);
    updateUniqueValues(processedData, column);
  };

  // Drawing logic useEffect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (data.length === 0 || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return; // Null check for context

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Calculate bounds
    const xValues = data.map((d) => d.x);
    const yValues = data.map((d) => d.y);
    // Use proper checks for min/max
    if (xValues.length === 0 || yValues.length === 0) return;

    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);

    const xRange = xMax - xMin;
    const yRange = yMax - yMin;
    const maxRange = Math.max(xRange, yRange) || 1; // Avoid division by zero

    const padding = 50;
    const availableSize = Math.min(width - padding * 2, height - padding * 2);
    const scale = (availableSize / maxRange) * zoom;

    // Typed transform function
    const transform = (x: number, y: number): [number, number] => {
      const cx = (x - xMin - xRange / 2) * scale + width / 2 + pan.x;
      const cy = (y - yMin - yRange / 2) * scale + height / 2 + pan.y;
      return [cx, cy];
    };

    // Filter data
    const filteredData =
      selectedValue === 'all'
        ? data
        : data.filter((d) => {
            // Type guard for colorByColumn
            if (!colorByColumn) return true;
            return d.metadata[colorByColumn] === selectedValue;
          });

    // Create color map
    const colorMap: Record<string | number, string> = {};
    uniqueValues.forEach((val, idx) => {
      colorMap[val] = getColor(val, idx);
    });

    // Draw points
    filteredData.forEach((point) => {
      const [cx, cy] = transform(point.x, point.y);

      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);

      let fillStyle = '#3498db'; // Default color

      if (colorByColumn) {
        const metadataValue = point.metadata[colorByColumn];
        // Check if value is in colorMap (which only holds string|number keys)
        if (metadataValue !== null && metadataValue !== undefined) {
          fillStyle = colorMap[metadataValue as string | number] || '#7f8c8d';
        }
      }

      ctx.fillStyle = fillStyle;
      ctx.fill();

      if (hoveredCell && hoveredCell.id === point.id) {
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  }, [
    data,
    zoom,
    pan,
    colorByColumn,
    selectedValue,
    hoveredCell,
    uniqueValues,
    getColor, // Dependency for memoized function
  ]);

  // Typed event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return; // Null check

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    } else if (data.length > 0) {
      const xValues = data.map((d) => d.x);
      const yValues = data.map((d) => d.y);
      if (xValues.length === 0 || yValues.length === 0) return; // Safety check

      const xMin = Math.min(...xValues);
      const yMin = Math.min(...yValues);
      const xRange = Math.max(...xValues) - xMin;
      const yRange = Math.max(...yValues) - yMin;
      const maxRange = Math.max(xRange, yRange) || 1; // Avoid division by zero
      const padding = 50;
      const scale =
        (Math.min(canvas.width - padding * 2, canvas.height - padding * 2) /
          maxRange) *
        zoom;

      const transform = (x: number, y: number): [number, number] => {
        const cx = (x - xMin - xRange / 2) * scale + canvas.width / 2 + pan.x;
        const cy = (y - yMin - yRange / 2) * scale + canvas.height / 2 + pan.y;
        return [cx, cy];
      };

      let found: UMAPPoint | null = null;
      for (const point of data) {
        const [cx, cy] = transform(point.x, point.y);
        const dist = Math.sqrt((mouseX - cx) ** 2 + (mouseY - cy) ** 2);
        if (dist < 5) {
          found = point;
          break;
        }
      }
      setHoveredCell(found);
    }
  };

  const handleMouseUp = () => setIsDragging(false);
  const handleZoomIn = () => setZoom((z) => Math.min(z * 1.2, 10));
  const handleZoomOut = () => setZoom((z) => Math.max(z / 1.2, 0.1));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const exportImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return; // Null check

    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'umap_plot.png';
    link.href = url;
    link.click();
  };

  // Re-calculate colorMap based on state
  const colorMap: Record<string | number, string> = useMemo(() => {
    const map: Record<string | number, string> = {};
    uniqueValues.forEach((val, idx) => {
      map[val] = getColor(val, idx);
    });
    return map;
  }, [uniqueValues, getColor]);

  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      pageProblems={pageProblems}
      headerMetadata={{
        title: 'H5AD UMAP Viewer',
        content: 'Single-cell visualization',
        key: 'h5ad-viewer-page',
      }}
    >
      <div className="w-full h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="bg-white shadow-sm border-b p-4">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">UMAP Viewer</h1>

          <div className="flex items-center gap-4 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()} // Added optional chaining
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              // Disable if no ref is available
              disabled={!fileInputRef.current}
            >
              <Upload size={16} />
              Load CSV
            </button>

            {data.length > 0 && (
              <>
                <select
                  value={colorByColumn || ''}
                  onChange={(e) => handleColorByChange(e.target.value)}
                  className="px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No Coloring</option>
                  {columns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>

                {uniqueValues.length > 0 &&
                  colorByColumn && ( // Added colorByColumn check
                    <select
                      value={selectedValue}
                      onChange={(e) => setSelectedValue(e.target.value)}
                      className="px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Values ({data.length})</option>
                      {uniqueValues.map((val) => (
                        <option key={String(val)} value={val}>
                          {/* Use String(val) for key and display */}
                          {val} (
                          {
                            data.filter(
                              (d) => d.metadata[colorByColumn] === val,
                            ).length
                          }
                          )
                        </option>
                      ))}
                    </select>
                  )}

                <div className="flex gap-2">
                  <button
                    onClick={handleZoomIn}
                    className="p-2 border rounded hover:bg-gray-100"
                  >
                    <ZoomIn size={20} />
                  </button>
                  <button
                    onClick={handleZoomOut}
                    className="p-2 border rounded hover:bg-gray-100"
                  >
                    <ZoomOut size={20} />
                  </button>
                  <button
                    onClick={handleReset}
                    className="p-2 border rounded hover:bg-gray-100"
                  >
                    <RotateCcw size={20} />
                  </button>
                  <button
                    onClick={exportImage}
                    className="p-2 border rounded hover:bg-gray-100"
                  >
                    <Download size={20} />
                  </button>
                </div>

                <span className="text-sm text-gray-600">
                  Zoom: {zoom.toFixed(2)}x
                </span>
              </>
            )}
          </div>

          {fileInfo && (
            <div className="mt-3 text-sm text-gray-600 flex items-center gap-2">
              <Info size={16} />
              <span>
                {fileInfo.name} • {fileInfo.cells.toLocaleString()} cells •
                Coordinates: {fileInfo.xCol}, {fileInfo.yCol}
              </span>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Canvas */}
          <div className="flex-1 relative bg-white m-4 rounded shadow">
            {data.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                <div className="text-center max-w-md">
                  <Upload size={48} className="mx-auto mb-2 opacity-50" />
                  <p className="font-semibold mb-2">
                    Upload a CSV file to visualize UMAP
                  </p>
                  <p className="text-sm">
                    The viewer will automatically detect UMAP coordinate columns
                    (X_umap_1, X_umap_2, etc.) and available metadata for
                    coloring.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <canvas
                  ref={canvasRef}
                  width={1200}
                  height={800}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  className="cursor-grab active:cursor-grabbing"
                  style={{ width: '100%', height: '100%' }}
                />
                {hoveredCell && (
                  <div className="absolute top-4 left-4 bg-white p-3 rounded shadow-lg border max-w-xs">
                    <div className="font-semibold mb-1">
                      Cell: {hoveredCell.id}
                    </div>
                    <div className="text-xs text-gray-600 mb-2">
                      Position: ({hoveredCell.x.toFixed(2)},{' '}
                      {hoveredCell.y.toFixed(2)})
                    </div>
                    {Object.entries(hoveredCell.metadata).map(
                      ([key, value]) => (
                        <div key={key} className="text-sm">
                          <span className="font-medium">{key}:</span>{' '}
                          {String(value)}
                        </div>
                      ),
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Legend */}
          {data.length > 0 && uniqueValues.length > 0 && colorByColumn && (
            <div className="w-64 bg-white m-4 ml-0 p-4 rounded shadow overflow-y-auto">
              <h3 className="font-bold mb-3">{colorByColumn}</h3>
              <div className="space-y-2">
                {uniqueValues.map((val) => (
                  <div key={String(val)} className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded flex-shrink-0"
                      style={{ backgroundColor: colorMap[val] }}
                    />
                    <span className="text-sm truncate">{val}</span>
                    <span className="text-xs text-gray-500 ml-auto flex-shrink-0">
                      {
                        data.filter((d) => d.metadata[colorByColumn] === val)
                          .length
                      }
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </NavPageLayout>
  );
};

export const getServerSideProps = defineSamplePageLoader('HFIVEAD');

export default UMAPViewer;
