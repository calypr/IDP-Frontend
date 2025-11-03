import { getNavPageLayoutPropsFromConfig } from '@gen3/frontend';
import type { NavPageLayoutProps } from '@gen3/frontend';
import type { GetServerSideProps } from 'next';
import { NavPageLayout } from '@gen3/frontend';
import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Info,
} from 'lucide-react';
import Papa from 'papaparse';

const UMAPViewer = ({ headerProps, footerProps }: NavPageLayoutProps) => {
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [colorByColumn, setColorByColumn] = useState(null);
  const [uniqueValues, setUniqueValues] = useState([]);
  const [selectedValue, setSelectedValue] = useState('all');
  const [hoveredCell, setHoveredCell] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [fileInfo, setFileInfo] = useState(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const colorPalettes = {
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
  };

  const getColor = (value, index) => {
    return colorPalettes.categorical[index % colorPalettes.categorical.length];
  };

  const detectColumns = (headers) => {
    const h = headers.map((h) => h.toLowerCase().trim());

    // Try to detect UMAP coordinate columns
    let xCol = null,
      yCol = null;

    // Patterns for X coordinate
    const xPatterns = ['x_umap_1', 'umap_1', 'umap1', 'x_umap', 'umap_x', 'x'];
    for (const pattern of xPatterns) {
      const idx = h.findIndex(
        (col) => col === pattern || col.includes(pattern),
      );
      if (idx !== -1) {
        xCol = headers[idx];
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
        yCol = headers[idx];
        break;
      }
    }

    // Detect ID column
    let idCol = headers[0]; // Default to first column
    const idPatterns = ['cellid', 'cell_id', 'id', 'barcode', 'cell'];
    for (const pattern of idPatterns) {
      const idx = h.findIndex((col) => col.includes(pattern));
      if (idx !== -1) {
        idCol = headers[idx];
        break;
      }
    }

    // Find metadata columns (exclude coordinates and ID)
    const metadataCols = headers.filter(
      (col) => col !== xCol && col !== yCol && col !== idCol,
    );

    return { xCol, yCol, idCol, metadataCols };
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields;
        const detected = detectColumns(headers);

        if (!detected.xCol || !detected.yCol) {
          alert(
            'Could not detect UMAP coordinate columns. Please ensure your CSV has columns like "X_umap_1" and "X_umap_2"',
          );
          return;
        }

        // Parse data
        const parsedData = results.data
          .map((row, idx) => {
            const point = {
              id: row[detected.idCol] || `cell_${idx}`,
              x: parseFloat(row[detected.xCol]),
              y: parseFloat(row[detected.yCol]),
              metadata: {},
            };

            // Add all metadata
            detected.metadataCols.forEach((col) => {
              point.metadata[col] = row[col];
            });

            return point;
          })
          .filter((d) => !isNaN(d.x) && !isNaN(d.y));

        setData(parsedData);
        setColumns(detected.metadataCols);

        // Auto-select first categorical column for coloring
        let defaultColorCol = null;
        for (const col of detected.metadataCols) {
          const values = parsedData.map((d) => d.metadata[col]);
          const uniqueVals = [...new Set(values)].filter((v) => v != null);
          if (uniqueVals.length > 1 && uniqueVals.length < 100) {
            // Convert numeric cluster IDs to strings for proper categorical handling
            parsedData.forEach((point) => {
              if (typeof point.metadata[col] === 'number') {
                point.metadata[col] = String(point.metadata[col]);
              }
            });
            defaultColorCol = col;
            break;
          }
        }

        if (defaultColorCol) {
          setColorByColumn(defaultColorCol);
          updateUniqueValues(parsedData, defaultColorCol);
        }

        setFileInfo({
          name: file.name,
          cells: parsedData.length,
          xCol: detected.xCol,
          yCol: detected.yCol,
          idCol: detected.idCol,
        });
      },
    });
  };

  const updateUniqueValues = (dataPoints, column) => {
    if (!column) {
      setUniqueValues([]);
      return;
    }

    const values = dataPoints.map((d) => d.metadata[column]);
    const unique = [...new Set(values)].filter((v) => v != null);

    // Sort: if all values look like numbers, sort numerically, otherwise alphabetically
    const allNumeric = unique.every((v) => !isNaN(Number(v)));
    if (allNumeric) {
      unique.sort((a, b) => Number(a) - Number(b));
    } else {
      unique.sort();
    }

    setUniqueValues(unique);
  };

  const handleColorByChange = (column) => {
    setColorByColumn(column);
    setSelectedValue('all');

    // Convert numeric values to strings for categorical handling
    const processedData = data.map((point) => ({
      ...point,
      metadata: {
        ...point.metadata,
        [column]:
          typeof point.metadata[column] === 'number'
            ? String(point.metadata[column])
            : point.metadata[column],
      },
    }));
    setData(processedData);
    updateUniqueValues(processedData, column);
  };

  useEffect(() => {
    if (data.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Calculate bounds
    const xValues = data.map((d) => d.x);
    const yValues = data.map((d) => d.y);
    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);

    const xRange = xMax - xMin;
    const yRange = yMax - yMin;
    const maxRange = Math.max(xRange, yRange);

    const padding = 50;
    const scale =
      (Math.min(width - padding * 2, height - padding * 2) / maxRange) * zoom;

    const transform = (x, y) => {
      const cx = (x - xMin - xRange / 2) * scale + width / 2 + pan.x;
      const cy = (y - yMin - yRange / 2) * scale + height / 2 + pan.y;
      return [cx, cy];
    };

    // Filter data
    const filteredData =
      selectedValue === 'all'
        ? data
        : data.filter((d) => d.metadata[colorByColumn] === selectedValue);

    // Create color map
    const colorMap = {};
    uniqueValues.forEach((val, idx) => {
      colorMap[val] = getColor(val, idx);
    });

    // Draw points
    filteredData.forEach((point) => {
      const [cx, cy] = transform(point.x, point.y);

      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);

      if (colorByColumn && point.metadata[colorByColumn]) {
        ctx.fillStyle = colorMap[point.metadata[colorByColumn]] || '#7f8c8d';
      } else {
        ctx.fillStyle = '#3498db';
      }

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
  ]);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
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
      const xMin = Math.min(...xValues);
      const yMin = Math.min(...yValues);
      const xRange = Math.max(...xValues) - xMin;
      const yRange = Math.max(...yValues) - yMin;
      const maxRange = Math.max(xRange, yRange);
      const padding = 50;
      const scale =
        (Math.min(canvas.width - padding * 2, canvas.height - padding * 2) /
          maxRange) *
        zoom;

      const transform = (x, y) => {
        const cx = (x - xMin - xRange / 2) * scale + canvas.width / 2 + pan.x;
        const cy = (y - yMin - yRange / 2) * scale + canvas.height / 2 + pan.y;
        return [cx, cy];
      };

      let found = null;
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
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'umap_plot.png';
    link.href = url;
    link.click();
  };

  const colorMap = {};
  uniqueValues.forEach((val, idx) => {
    colorMap[val] = getColor(val, idx);
  });

  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
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
              onClick={() => fileInputRef.current.click()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
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

                {uniqueValues.length > 0 && (
                  <select
                    value={selectedValue}
                    onChange={(e) => setSelectedValue(e.target.value)}
                    className="px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Values ({data.length})</option>
                    {uniqueValues.map((val) => (
                      <option key={val} value={val}>
                        {val} (
                        {
                          data.filter((d) => d.metadata[colorByColumn] === val)
                            .length
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
                          <span className="font-medium">{key}:</span> {value}
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
                  <div key={val} className="flex items-center gap-2">
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

export const getServerSideProps: GetServerSideProps<
  NavPageLayoutProps
> = async () => {
  return {
    props: {
      ...(await getNavPageLayoutPropsFromConfig()),
    },
  };
};

export default UMAPViewer;
