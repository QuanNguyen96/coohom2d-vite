// === src/components/CanvasGridKonva.jsx ===
import React, { useRef, useEffect, useState } from "react";
import "konva/lib/shapes/Rect";
import {
  Stage,
  Layer,
  Line,
  Circle,
  Rect,
  Shape,
  Text,
  Group,
  Arc,
} from "react-konva";
import { useEditor } from "../../context/EditorContext";
import SnapDoorToWall from "./SnapDoorToWall";
import SnapWindowToWall from "./SnapWindowToWall";
import { v4 as uuidv4 } from 'uuid';
import JSZip from "jszip";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader"; // Nếu dùng nén
import Background from "three/src/renderers/common/Background.js";
import * as THREE from 'three';

const MINOR_DIVISIONS = 10;
const MINOR_GRID_SIZE = 30;
const MAJOR_GRID_SIZE = MINOR_GRID_SIZE * MINOR_DIVISIONS //300;
const TOTAL_MAJOR_CELLS = 24;
const HALF_MAJOR = TOTAL_MAJOR_CELLS / 2;
const gridSize = TOTAL_MAJOR_CELLS * MAJOR_GRID_SIZE;
const gridExtent = HALF_MAJOR * MAJOR_GRID_SIZE; // 12 * 300 = 3600
const INITIAL_SCALE = 1;
const WALL_WIDTH = 10;
const SNAP_DISTANCE = 10;
const CLICK_THRESHOLD = 300;
const DOOR_CONFIG = {
  width: 70,
  height: 10,
  // pivot cũng tính từ dưới lên
  pivot: { x: 35, y: 6 }, // gốc phải dưới
  renderSVG: (color = "black") => (
    <svg
      width="70"
      height="12"
      viewBox="0 0 70 12"
      fill="none"
      stroke={color}
      strokeWidth="1"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="0"
        y="0"
        width="70"
        height="12"
        stroke={color}
        strokeWidth="1"
        fill="none"
        strokeDasharray="4 2"
      />
      {/* <path d="M1 71L1 79L72 79V71M1 71L72 71M1 71C1 32.3401 32.3401 1 71 1H72V71" /> */}
    </svg>
  ),
};


const CanvasGridKonva = () => {
  const {
    mode,
    setMode,
    setSelectedWall,
    selectedWall,
    vertices,
    setVertices,
    walls,
    setWalls,
    doors,
    setDoors,
    windows, setWindows,
    wallChange, setWallChange,
    modelThreeCommonRef,
    unitMToPixelCanvas, setUnitMToPixelCanvas,
    canvasLayout2dRef,
  } = useEditor();

  const [tempStartPoint, setTempStartPoint] = useState(null);
  const [hoverPoint, setHoverPoint] = useState(null);
  const [hoverVertex, setHoverVertex] = useState(null);
  const [mouseDownVertex, setMouseDownVertex] = useState(null);
  const [dragPreviewVertex, setDragPreviewVertex] = useState(null);
  const [draggedWallPreview, setDraggedWallPreview] = useState(null);
  const [snapTarget, setSnapTarget] = useState(null);
  const [lastCreatedVertexId, setLastCreatedVertexId] = useState(null);
  const [rawMousePoint, setRawMousePoint] = useState(null);
  const [mouseDownTime, setMouseDownTime] = useState(null);
  const [hoverWallId, setHoverWallId] = useState(null);
  const [scale, setScale] = useState(INITIAL_SCALE);

  // tính tọa đô tâm lưới
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  // Khi component mount
  useEffect(() => {
    let kq = HALF_MAJOR * MINOR_DIVISIONS
    setOffset({
      x: window.innerWidth / 2 - gridExtent,
      y: window.innerHeight / 2 - gridExtent,
    });
    console.log(`x=${window.innerWidth / 2 - gridExtent} x=${window.innerHeight / 2 - gridExtent}`)
    loadModelCommons();
  }, []);
  async function createFileFromUrl(
    url,
    filename,
    mimeType = "application/octet-stream"
  ) {
    const res = await fetch(url);
    const blob = await res.blob();
    return new File([blob], filename, { type: mimeType });
  }
  const loadModelCommons = async () => {
    console.log("load file loadModelCommons")
    // load ghe1,
    let modelStore = {
      door: {
        data: [
          // {
          //   path: "/models/source/door1.zip",
          //   name: "door1",
          // },
          {
            path: "/models/source/door2.zip",
            name: "door1",
          }
        ]
      },
      window: {
        data: [
          {
            path: "/models/source/window1.zip",
            name: "window1",
          }
        ]
      }
    }
    let promiseAll = []
    for (let modelName in modelStore) {
      if (modelStore[modelName].data && modelStore[modelName].data.length) {
        for (let i = 0; i < modelStore[modelName].data.length; i++) {
          const promiseC = new Promise(async (resolve) => {
            try {
              let path1 = modelStore[modelName].data[i].path;
              let splitPath = path1.split('/')
              let fileNameT = splitPath[splitPath.length - 1]
              const file = await createFileFromUrl(path1, fileNameT);
              if (!file) return;
              let fileName = file.name;
              let typeFile = fileName.split(".").pop(); // 'txt'
              if (typeFile == "glb") {
                const loader = new GLTFLoader();
                // Optional: DRACO support nếu file nén
                const dracoLoader = new DRACOLoader();
                dracoLoader.setDecoderPath("/js/libs/draco/");
                loader.setDRACOLoader(dracoLoader);
                const reader = new FileReader();
                reader.onload = function (e) {
                  const arrayBuffer = e.target.result;
                  loader.parse(
                    arrayBuffer,
                    "",
                    (gltf) => {
                      try {
                        const model = gltf.scene;
                        if (!modelThreeCommonRef.current[modelName]) {
                          modelThreeCommonRef.current[modelName] = {}
                        }
                        modelThreeCommonRef.current[modelName][model.uuid] = model;
                      } catch { }
                      resolve();
                    },
                    (error) => {
                      resolve();
                      console.error("Lỗi khi parse GLB:", error);
                    }
                  );
                };
                reader.readAsArrayBuffer(file);
              } else if (typeFile == "zip") {
                try {
                  const zip = await JSZip.loadAsync(file);
                  // Tìm file scene.gltf trong zip
                  const gltfEntry = Object.values(zip.files).find((f) =>
                    f.name.endsWith(".gltf")
                  );
                  if (!gltfEntry) {
                    console.error("Không tìm thấy file .gltf trong zip");
                    return;
                  }

                  const gltfText = await gltfEntry.async("string");

                  // Tạo blob URLs cho resource phụ
                  const blobUrlMap = {};
                  await Promise.all(
                    Object.values(zip.files).map(async (file) => {
                      const name = file.name;
                      if (/\.(bin|png|jpg|jpeg|gif|tga|ktx2|txt)$/i.test(name)) {
                        const blob = await file.async("blob");
                        blobUrlMap[name] = URL.createObjectURL(blob);
                      }
                    })
                  );
                  // ✅ Tạo manager và setURLModifier
                  const manager = new THREE.LoadingManager();
                  manager.setURLModifier((url) => {
                    const normalized = url.replace(/^(\.\/|\/)/, ""); // fix đường dẫn có ./ hoặc /
                    return blobUrlMap[normalized] || url;
                  });

                  // ✅ Truyền manager vào loader
                  const loader = new GLTFLoader(manager);

                  // Optional: DRACO support nếu cần
                  const dracoLoader = new DRACOLoader();
                  dracoLoader.setDecoderPath("/js/libs/draco/");
                  loader.setDRACOLoader(dracoLoader);

                  // Load từ gltfText
                  const gltf = await loader.parseAsync(gltfText, ""); // path rỗng vì bạn dùng blob
                  try {
                    const model = gltf.scene;
                    if (!modelThreeCommonRef.current[modelName]) {
                      modelThreeCommonRef.current[modelName] = {}
                    }
                    modelThreeCommonRef.current[modelName][model.uuid] = model;
                    // modelThreeCommonRef.current[modelName][model.uuid] = model;
                  } catch (e) {
                    console.log(e);
                  }
                } catch { }
                resolve();
              }
            } catch (e) {
              console.log("error", e)
            }
          });
          promiseAll.push(promiseC)
        }
      }
    }
    await Promise.all(promiseAll)
  };

  const getVertexById = (id) => vertices.find((v) => v.id === id);
  const getEffectiveVertex = (id) =>
    dragPreviewVertex && mouseDownVertex && id === mouseDownVertex.id
      ? dragPreviewVertex
      : getVertexById(id);


  function computeWallPolygon(v1, v2, wall, walls, getEffectiveVertex, thickness = WALL_WIDTH) {
    const half = thickness / 2;

    const innerLine = getOffsetLine(v1, v2, half);
    const outerLine = getOffsetLine(v1, v2, -half);

    const getJunctionPoint = (v, isStart, useInner) => {
      const connectedWalls = walls.filter(
        (w) => w !== wall && (w.startId === v.id || w.endId === v.id)
      );
      if (connectedWalls.length === 0) return null;

      const baseLine = useInner ? innerLine : outerLine;
      const baseDir = {
        x: baseLine[1].x - baseLine[0].x,
        y: baseLine[1].y - baseLine[0].y,
      };

      let bestAngle = Infinity;
      let bestIntersection = null;

      for (const w2 of connectedWalls) {
        const v2a = getEffectiveVertex(w2.startId);
        const v2b = getEffectiveVertex(w2.endId);
        if (!v2a || !v2b) continue;

        const otherLine = useInner
          ? getOffsetLine(v2a, v2b, half)
          : getOffsetLine(v2a, v2b, -half);

        const dir = {
          x: otherLine[1].x - otherLine[0].x,
          y: otherLine[1].y - otherLine[0].y,
        };

        const dot = baseDir.x * dir.x + baseDir.y * dir.y;
        const mag1 = Math.hypot(baseDir.x, baseDir.y);
        const mag2 = Math.hypot(dir.x, dir.y);
        const angle = Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2))));

        if (angle < bestAngle) {
          const intersection = computeIntersection(
            baseLine[0], baseLine[1], otherLine[0], otherLine[1]
          );
          if (intersection) {
            bestAngle = angle;
            bestIntersection = intersection;
          }
        }
      }

      return bestIntersection || (isStart ? baseLine[0] : baseLine[1]);
    };

    const innerStart = getJunctionPoint(v1, true, true) || innerLine[0];
    const innerEnd = getJunctionPoint(v2, false, true) || innerLine[1];
    const outerEnd = getJunctionPoint(v2, false, false) || outerLine[1];
    const outerStart = getJunctionPoint(v1, true, false) || outerLine[0];

    return [innerStart, innerEnd, outerEnd, outerStart];
  }
  useEffect(() => {
    if (!walls || !vertices) return;

    const newWalls = walls.map(wall => {
      const v1 = getEffectiveVertex(wall.startId);
      const v2 = getEffectiveVertex(wall.endId);
      if (!v1 || !v2) return wall;

      const polygon = computeWallPolygon(v1, v2, wall, walls, getEffectiveVertex, wall.thickness);
      return { ...wall, polygon };
    });

    const isDifferent = JSON.stringify(walls) !== JSON.stringify(newWalls);
    if (isDifferent) setWalls(newWalls);
  }, [walls, vertices]);



  const toWorldCoords = (x, y) => {
    const transform = canvasLayout2dRef.current.getAbsoluteTransform().copy().invert();
    return transform.point({ x, y });
  };

  const computeIntersection = (p1, p2, p3, p4) => {
    if (!p1 || !p2 || !p3 || !p4) return null;
    const a1 = p2.y - p1.y;
    const b1 = p1.x - p2.x;
    const c1 = a1 * p1.x + b1 * p1.y;

    const a2 = p4.y - p3.y;
    const b2 = p3.x - p4.x;
    const c2 = a2 * p3.x + b2 * p3.y;

    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1e-6) return null;
    return {
      x: (b2 * c1 - b1 * c2) / det,
      y: (a1 * c2 - a2 * c1) / det,
    };
  };

  const getOffsetLine = (v1, v2, offset) => {
    const dx = v2.x - v1.x;
    const dy = v2.y - v1.y;
    const len = Math.hypot(dx, dy);
    const ox = (-dy / len) * offset;
    const oy = (dx / len) * offset;
    return [
      { x: v1.x + ox, y: v1.y + oy },
      { x: v2.x + ox, y: v2.y + oy },
    ];
  };

  const renderWallPolygon = (
    v1,
    v2,
    wall,
    key,
    color = "#ccc",
    stroke = "#555",
    thickness = WALL_WIDTH,
    dash = null
  ) => {
    const half = thickness / 2;

    const innerLine = getOffsetLine(v1, v2, half);
    const outerLine = getOffsetLine(v1, v2, -half);

    const getJunctionPoint = (v, isStart, useInner) => {
      const connectedWalls = walls.filter(
        (w) => w !== wall && (w.startId === v.id || w.endId === v.id)
      );
      if (connectedWalls.length === 0) return null;

      const baseLine = useInner
        ? getOffsetLine(v1, v2, half)
        : getOffsetLine(v1, v2, -half);
      const baseDir = {
        x: baseLine[1].x - baseLine[0].x,
        y: baseLine[1].y - baseLine[0].y,
      };

      let bestAngle = Infinity;
      let bestIntersection = null;

      for (const w2 of connectedWalls) {
        const v2a = getEffectiveVertex(w2.startId);
        const v2b = getEffectiveVertex(w2.endId);
        const isStartV2 = w2.startId === v.id;

        const otherLine = useInner
          ? getOffsetLine(v2a, v2b, half)
          : getOffsetLine(v2a, v2b, -half);
        const dir = {
          x: otherLine[1].x - otherLine[0].x,
          y: otherLine[1].y - otherLine[0].y,
        };

        const dot = baseDir.x * dir.x + baseDir.y * dir.y;
        const mag1 = Math.hypot(baseDir.x, baseDir.y);
        const mag2 = Math.hypot(dir.x, dir.y);
        const angle = Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))); // in radians

        if (angle < bestAngle) {
          const intersection = computeIntersection(
            baseLine[0],
            baseLine[1],
            otherLine[0],
            otherLine[1]
          );
          if (intersection) {
            bestAngle = angle;
            bestIntersection = intersection;
          }
        }
      }

      return bestIntersection || (isStart ? baseLine[0] : baseLine[1]);
    };

    const innerStart = getJunctionPoint(v1, true, true) || innerLine[0];
    const innerEnd = getJunctionPoint(v2, false, true) || innerLine[1];
    const outerEnd = getJunctionPoint(v2, false, false) || outerLine[1];
    const outerStart = getJunctionPoint(v1, true, false) || outerLine[0];
    const polygon = [innerStart, innerEnd, outerEnd, outerStart];

    // // Gán lại polygon cho wall hiện tại
    // if (wall && !wall.polygon) {
    //   setWalls((prevWalls) =>
    //     prevWalls.map((w) =>
    //       w.id === wall.id ? { ...w, polygon } : w
    //     )
    //   );
    // }
    return (
      <Shape
        key={key}
        sceneFunc={(ctx, shape) => {
          ctx.beginPath();
          ctx.moveTo(innerStart.x, innerStart.y);
          ctx.lineTo(innerEnd.x, innerEnd.y);
          ctx.lineTo(outerEnd.x, outerEnd.y);
          ctx.lineTo(outerStart.x, outerStart.y);
          ctx.closePath();
          ctx.fillStrokeShape(shape);
        }}
        fill={color}
        stroke={stroke}
        strokeWidth={1}
        dash={dash}
      />
    );
  };

  const renderWall = (
    v1,
    v2,
    key,
    color = "#ccc",
    dash = null,
    borderColor = "#555",
    thickness = WALL_WIDTH
  ) => {
    const wall = walls.find(
      (w) =>
        (w.startId === v1.id && w.endId === v2.id) ||
        (w.endId === v1.id && w.startId === v2.id)
    );
    const dx = v2.x - v1.x;
    const dy = v2.y - v1.y;
    const length = Math.hypot(dx, dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const centerX = (v1.x + v2.x) / 2;
    const centerY = (v1.y + v2.y) / 2;

    const wallIsSelected =
      mode === null &&
      selectedWall &&
      ((selectedWall.startId === v1.id && selectedWall.endId === v2.id) ||
        (selectedWall.endId === v1.id && selectedWall.startId === v2.id));

    return (
      <Group key={key}>
        {/* Vẽ polygon cho tường */}
        {renderWallPolygon(
          v1,
          v2,
          wall,
          key,
          color,
          borderColor,
          thickness,
          dash
        )}

        {/* Hiển thị 2 nút kéo thickness nếu được chọn */}
        {wallIsSelected &&
          [-1, 1].map((side, i) => {
            const rad = (angle * Math.PI) / 180;
            const offsetX = side * (thickness / 2) * Math.sin(-rad);
            const offsetY = side * (thickness / 2) * Math.cos(rad);
            const handleX = centerX + offsetX;
            const handleY = centerY + offsetY;
            return (
              <Rect
                key={`thickness-handle-${key}-${i}`}
                x={handleX}
                y={handleY}
                width={6}
                height={6}
                fill="white"
                stroke="#ccc"
                strokeWidth={1}
                offsetX={3}
                offsetY={3}
                rotation={angle}
                draggable
                // onDragMove={(e) => {
                //   const dx = e.target.x() - centerX;
                //   const dy = e.target.y() - centerY;
                //   const perp = Math.abs(
                //     dx * Math.sin(rad) + dy * Math.cos(rad)
                //   );
                //   const newThickness = Math.max(2, Math.min(500, perp * 2));
                //   setWalls((prev) =>
                //     prev.map((w) =>
                //       (w.startId === v1.id && w.endId === v2.id) ||
                //         (w.startId === v2.id && w.endId === v1.id)
                //         ? { ...w, thickness: newThickness }
                //         : w
                //     )
                //   );
                // }}
                onDragMove={(e) => {
                  const dx = e.target.x() - centerX;
                  const dy = e.target.y() - centerY;
                  const perp = Math.abs(dx * Math.sin(rad) + dy * Math.cos(rad));
                  const newThickness = Math.max(2, Math.min(500, perp * 2));

                  setWalls((prev) =>
                    prev.map((w) =>
                      (w.startId === v1.id && w.endId === v2.id) ||
                        (w.startId === v2.id && w.endId === v1.id)
                        ? { ...w, thickness: newThickness }
                        : w
                    )
                  );
                }}

              />
            );
          })}
      </Group>
    );
  };

  const renderWallDimension = (wall, v1, v2) => {
    if (
      !v1 ||
      !v2 ||
      isNaN(v1.x) ||
      isNaN(v1.y) ||
      isNaN(v2.x) ||
      isNaN(v2.y)
    ) {
      return null;
    }

    const wallThickness = wall.thickness ?? 20;
    const halfThickness = wallThickness / 2;

    const dx = v2.x - v1.x;
    const dy = v2.y - v1.y;
    const centerLength = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    const dirX = dx / centerLength;
    const dirY = dy / centerLength;
    const perpX = -dirY;
    const perpY = dirX;

    const tickSize = 10;
    const textOffset = 15;

    const makeDimensionLine = (side = 1) => {
      // Đẩy v1, v2 ra đúng mép cạnh tường (outer hoặc inner)
      const v1Edge = {
        x: v1.x + perpX * halfThickness * side,
        y: v1.y + perpY * halfThickness * side,
      };
      const v2Edge = {
        x: v2.x + perpX * halfThickness * side,
        y: v2.y + perpY * halfThickness * side,
      };

      // Tiếp tục đẩy ra ngoài để đặt đường đo cách tường
      const offsetX = perpX * textOffset * side;
      const offsetY = perpY * textOffset * side;

      const p1 = { x: v1Edge.x + offsetX, y: v1Edge.y + offsetY };
      const p2 = { x: v2Edge.x + offsetX, y: v2Edge.y + offsetY };
      const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

      const dimLength = Math.sqrt(
        (v2Edge.x - v1Edge.x) ** 2 + (v2Edge.y - v1Edge.y) ** 2
      );

      if ([p1.x, p1.y, p2.x, p2.y].some((val) => isNaN(val))) return null;

      return (
        <Group key={`dim-${wall.startId}-${wall.endId}-${side}`}>
          <Line
            points={[p1.x, p1.y, p2.x, p2.y]}
            stroke="gray"
            strokeWidth={1}
            opacity={0.5}
          />

          {/* Tick p1 */}
          <Line
            points={[
              p1.x - (tickSize / 2) * perpX,
              p1.y - (tickSize / 2) * perpY,
              p1.x + (tickSize / 2) * perpX,
              p1.y + (tickSize / 2) * perpY,
            ]}
            stroke="gray"
            strokeWidth={1}
            opacity={0.5}
          />

          {/* Tick p2 */}
          <Line
            points={[
              p2.x - (tickSize / 2) * perpX,
              p2.y - (tickSize / 2) * perpY,
              p2.x + (tickSize / 2) * perpX,
              p2.y + (tickSize / 2) * perpY,
            ]}
            stroke="gray"
            strokeWidth={1}
            opacity={0.5}
          />

          {/* Text */}
          <Text
            x={mid.x - 20}
            y={mid.y - 10}
            text={`${(dimLength / unitMToPixelCanvas).toFixed(2)}m`}
            fontSize={14}
            fill="blue"
          />
        </Group>
      );
    };
    return (
      <>
        {makeDimensionLine(1) ?? null}
        {makeDimensionLine(-1) ?? null}
      </>
    );
    return (
      <>
        {makeDimensionLine(1)} {/* Mép ngoài */}
        {makeDimensionLine(-1)} {/* Mép trong */}
      </>
    );
  };

  const findSnapTarget = (point) => {
    // Ưu tiên snap vào vertex nếu gần
    for (const v of vertices) {
      if (
        mode === "wall" &&
        Math.hypot(v.x - point.x, v.y - point.y) <= SNAP_DISTANCE
      ) {
        return { type: "vertex", point: v };
      }
    }

    let closest = null;
    let minDist = Infinity; // Để so sánh chính xác theo từng wall
    for (const wall of walls) {
      const v1 = getVertexById(wall.startId);
      const v2 = getVertexById(wall.endId);
      if (!v1 || !v2) continue;

      const dx = v2.x - v1.x;
      const dy = v2.y - v1.y;
      const len2 = dx * dx + dy * dy;
      const t = Math.max(
        0,
        Math.min(1, ((point.x - v1.x) * dx + (point.y - v1.y) * dy) / len2)
      );
      const proj = { x: v1.x + t * dx, y: v1.y + t * dy };
      const dist = Math.hypot(point.x - proj.x, point.y - proj.y);

      const thickness = wall.thickness ?? WALL_WIDTH;
      const snapRange = thickness / 2 + SNAP_DISTANCE;

      if (dist <= snapRange && dist < minDist) {
        minDist = dist;
        closest = { type: "wall", wall, point: proj };
      }
    }

    return closest;
  };

  const mergeVertices = (keepId, removeId) => {
    if (keepId === removeId) return;

    setWalls((prev) => {
      const remapped = prev.map((w) => ({
        ...w,
        startId: w.startId === removeId ? keepId : w.startId,
        endId: w.endId === removeId ? keepId : w.endId,
      }));

      const seen = new Set();
      return remapped.filter((w) => {
        if (w.startId === w.endId) return false; // loại bỏ tường bị ngắn quá (2 điểm trùng)

        const key = `${w.startId}-${w.endId}`; // ❗ giữ hướng đúng
        if (seen.has(key)) return false;

        seen.add(key);
        return true;
      });
    });

    setVertices((prev) => prev.filter((v) => v.id !== removeId));
  };

  const splitWallAtPoint = (wall, point, useExistingVertexId = null) => {
    const newV = useExistingVertexId
      ? { id: useExistingVertexId, x: point.x, y: point.y }
      : { id: Date.now() + Math.random(), x: point.x, y: point.y };

    if (!useExistingVertexId) {
      setVertices((p) => [...p, newV]);
    } else {
      // Cập nhật vị trí điểm đã tồn tại
      setVertices((p) =>
        p.map((v) =>
          v.id === useExistingVertexId ? { ...v, x: point.x, y: point.y } : v
        )
      );
    }

    setWalls((p) => {
      const others = p.filter((w) => w !== wall);
      return [
        ...others,
        {
          startId: wall.startId,
          endId: newV.id,
          thickness: wall.thickness,
          height: wall.height,
          name: wall.name,
          id: uuidv4(),
          type: "wall",
        },
        {
          startId: newV.id,
          endId: wall.endId,
          thickness: wall.thickness,
          height: wall.height,
          name: wall.name,
          id: uuidv4(),
          type: "wall",
        },
      ];
    });

    return newV;
  };

  useEffect(() => {
    if (mode !== null) {
      setSelectedWall(null);
    }
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (mode === "wall") {
          if (lastCreatedVertexId) {
            const inUse = walls.some(
              (w) =>
                w.startId === lastCreatedVertexId ||
                w.endId === lastCreatedVertexId
            );
            if (!inUse)
              setVertices((v) =>
                v.filter((vx) => vx.id !== lastCreatedVertexId)
              );
            setLastCreatedVertexId(null);
          }
          setTempStartPoint(null);
          setHoverPoint(null);
        }
        setHoverVertex(null);
        setMouseDownVertex(null);
        setDraggedWallPreview(null);
        setDragPreviewVertex(null);
        setSnapTarget(null);
        setSelectedWall(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, walls, lastCreatedVertexId]);
  useEffect(() => {
    setTempStartPoint(null);
    setLastCreatedVertexId(null);
    setHoverVertex(null);
    setMouseDownVertex(null);
    setDraggedWallPreview(null);
    setDragPreviewVertex(null);
    setSnapTarget(null);
    setSelectedWall(null);
  }, [mode])
  useEffect(() => {
    // if (!doors || !walls) return;

    // const wallMap = Object.fromEntries(walls.map(w => [w.id, w]));

    // console.log("setdoor2222222222")
    // setDoors(prevDoors =>
    //   prevDoors.map(door => {
    //     const wall = wallMap[door.wallId];
    //     if (!wall || !wall.start || !wall.end) return null;

    //     const dx = wall.end.x - wall.start.x;
    //     const dy = wall.end.y - wall.start.y;
    //     const len = Math.sqrt(dx ** 2 + dy ** 2);
    //     if (len === 0) return null;

    //     const dir = { x: dx / len, y: dy / len };
    //     const perp = { x: -dir.y, y: dir.x };
    //     const center = {
    //       x: wall.start.x + dir.x * door.offset * len,
    //       y: wall.start.y + dir.y * door.offset * len,
    //     };
    //     const halfLen = door.width / 2;
    //     const halfThick = door.height / 2;
    //     const thickness = wall.thickness ?? 10;
    //     return {
    //       ...door,
    //       center,
    //       // id:uuidv4(),
    //       angle: Math.atan2(dir.y, dir.x) * 180 / Math.PI,
    //       height: 30 * 2,
    //       outerPolygon: [
    //         {
    //           x: center.x - dir.x * halfLen - perp.x * (thickness / 2),
    //           y: center.y - dir.y * halfLen - perp.y * (thickness / 2),
    //         },
    //         {
    //           x: center.x + dir.x * halfLen - perp.x * (thickness / 2),
    //           y: center.y + dir.y * halfLen - perp.y * (thickness / 2),
    //         },
    //         {
    //           x: center.x + dir.x * halfLen + perp.x * (thickness / 2),
    //           y: center.y + dir.y * halfLen + perp.y * (thickness / 2),
    //         },
    //         {
    //           x: center.x - dir.x * halfLen + perp.x * (thickness / 2),
    //           y: center.y - dir.y * halfLen + perp.y * (thickness / 2),
    //         },
    //       ],
    //       innerPolygon: [
    //         {
    //           x: center.x - dir.x * halfLen - perp.x * halfThick,
    //           y: center.y - dir.y * halfLen - perp.y * halfThick,
    //         },
    //         {
    //           x: center.x + dir.x * halfLen - perp.x * halfThick,
    //           y: center.y + dir.y * halfLen - perp.y * halfThick,
    //         },
    //         {
    //           x: center.x + dir.x * halfLen + perp.x * halfThick,
    //           y: center.y + dir.y * halfLen + perp.y * halfThick,
    //         },
    //         {
    //           x: center.x - dir.x * halfLen + perp.x * halfThick,
    //           y: center.y - dir.y * halfLen + perp.y * halfThick,
    //         },
    //       ],
    //     };
    //   }).filter(Boolean)
    // );
  }, [walls]); // hoặc [walls, vertices] nếu cần




  const handleMouseDown = (e) => {
    const { x, y } = toWorldCoords(e.evt.layerX, e.evt.layerY);
    console.log(`click x=${x} y=${y}`)
    setMouseDownTime(Date.now());
    const hit = vertices.find((v) => Math.hypot(v.x - x, v.y - y) < 10);
    if (hit) setMouseDownVertex(hit);
    if (!hit && mode === null) {
      const snap = findSnapTarget({ x, y });
      if (snap?.type === "wall") {
        // console.log("tim thay wall", snap.wall)
        setSelectedWall(snap.wall);
      }
      else setSelectedWall(null);
    }
  };

  const handleMouseUp = (e) => {
    // setDraggedWallPreview(null);
    const { x, y } = toWorldCoords(e.evt.layerX, e.evt.layerY);
    // const held = Date.now() - mouseDownTime;
    // const target = snapTarget?.point || { x, y };
    setDraggedWallPreview(null);
    const target = rawMousePoint || toWorldCoords(e.evt.layerX, e.evt.layerY);
    const snapNow = findSnapTarget(target);
    setSnapTarget(snapNow);

    const held = Date.now() - mouseDownTime;

    if (mouseDownVertex && held >= CLICK_THRESHOLD) {
      if (
        snapNow?.type === "vertex" &&
        snapNow.point.id !== mouseDownVertex.id
      ) {
        mergeVertices(snapNow.point.id, mouseDownVertex.id);
      } else if (snapNow?.type === "wall") {
        splitWallAtPoint(snapNow.wall, target, mouseDownVertex.id);
      } else {
        setVertices((p) =>
          p.map((v) => (v.id === mouseDownVertex.id ? { ...v, ...target } : v))
        );
      }
      setMouseDownVertex(null);
      setDragPreviewVertex(null);
      return;
    }
    if (e.evt.button === 0 && mode === "wall" && held < CLICK_THRESHOLD) {
      const target = rawMousePoint; // ✅ dùng điểm snap đã xử lý trục

      const snap = findSnapTarget(target);
      let startV;
      if (snap) {
        startV =
          snap.type === "vertex"
            ? snap.point
            : splitWallAtPoint(snap.wall, snap.point);
      } else {
        startV = { id: Date.now() + Math.random(), x: target.x, y: target.y };
        setVertices((p) => [...p, startV]);
      }

      if (!tempStartPoint) {
        setTempStartPoint(startV);
        setLastCreatedVertexId(startV.id);
      } else {
        const exists = walls.some(
          (w) =>
            (w.startId === tempStartPoint.id && w.endId === startV.id) ||
            (w.endId === tempStartPoint.id && w.startId === startV.id)
        );
        if (!exists) {
          setWalls((p) => [
            ...p,
            {
              id: uuidv4(),
              startId: tempStartPoint.id,
              endId: startV.id,
              thickness: WALL_WIDTH,
              // height: 30 * 3,
              height: 2.4 * unitMToPixelCanvas,
              type: "wall",
              name: "Wall",
            },
          ]);
          let startvercite = getEffectiveVertex(tempStartPoint.id);
          const endtvercite = getEffectiveVertex(startV.id);
          console.log("add wall duy nhất")
          console.log("startvercite", startvercite)
          console.log("endtvercite", endtvercite)
        }
        setTempStartPoint(startV);
        setLastCreatedVertexId(null);
      }
    }

    setMouseDownVertex(null);
    setDragPreviewVertex(null);
    if (mode === null) {
      if (snapTarget?.type === "wall") {
        setSelectedWall(snapTarget.wall);
      } else {
        setSelectedWall(null);
      }
    }
  };

  const handleMouseMove = (e) => {
    const { x, y } = toWorldCoords(e.evt.layerX, e.evt.layerY);
    const snap = findSnapTarget({ x, y });
    setSnapTarget(snap);

    let target = snap?.point || { x, y };
    if (mode == "wall") {
      if (mode === "wall" && tempStartPoint) {
        const dx = Math.abs(target.x - tempStartPoint.x);
        const dy = Math.abs(target.y - tempStartPoint.y);
        if (dx < SNAP_DISTANCE && dx < dy) {
          target.x = tempStartPoint.x;
        } else if (dy < SNAP_DISTANCE && dy < dx) {
          target.y = tempStartPoint.y;
        }
      }
      setRawMousePoint(target);
      if (mouseDownVertex) {
        const updated = { ...mouseDownVertex, ...target };
        setDragPreviewVertex(updated);
        const connected = walls.filter(
          (w) =>
            w.startId === mouseDownVertex.id || w.endId === mouseDownVertex.id
        );
        const previews = connected
          .map((w) => {
            const otherId =
              w.startId === mouseDownVertex.id ? w.endId : w.startId;
            const other = getEffectiveVertex(otherId);
            return other ? { v1: updated, v2: other } : null;
          })
          .filter(Boolean);
        setDraggedWallPreview(previews);
      }

      if (snap?.type === "vertex") {
        setHoverVertex(snap.point);
        setHoverPoint(snap.point);
      } else if (snap?.type === "wall") {
        setHoverVertex(null);
        setHoverPoint(tempStartPoint ? snap.point : null);
      } else {
        setHoverVertex(null);
        setHoverPoint(tempStartPoint ? target : null);
      }

      if (mode === null && snap?.type === "wall")
        setHoverWallId(snap.wall.startId + "-" + snap.wall.endId);
      else setHoverWallId(null);
    }
  };

  const deleteWall = (wall) => {
    setWalls((prev) =>
      prev.filter(
        (w) => !(w.startId === wall.startId && w.endId === wall.endId)
      )
    );
    setSelectedWall(null);

    const isVertexUsed = (vertexId) =>
      walls.some((w) => w.startId === vertexId || w.endId === vertexId);

    setVertices((prev) =>
      prev.filter((v) => {
        if (v.id === wall.startId || v.id === wall.endId) {
          return isVertexUsed(v.id);
        }
        return true;
      })
    );
  };


  const gridLines = [];

  // Vẽ các đường lưới nhỏ (minor grid: màu xám nhạt)
  for (let i = 0; i <= TOTAL_MAJOR_CELLS * MINOR_DIVISIONS; i++) {
    const pos = i * MINOR_GRID_SIZE; // = i * 30
    gridLines.push(
      <Line
        key={`mn-v-${i}`}
        points={[pos, 0, pos, gridSize]}
        stroke="#fff" // hoặc "#f0f0f0"
        opacity={0.8}
        strokeWidth={1 / scale}
      />,
      <Line
        key={`mn-h-${i}`}
        points={[0, pos, gridSize, pos]}
        stroke="#fff"
        opacity={0.8}
        strokeWidth={1 / scale}
      />
    );
  }

  // Vẽ các đường lưới lớn (major grid: màu đậm hơn)
  for (let i = 0; i <= TOTAL_MAJOR_CELLS; i++) {
    const pos = i * MAJOR_GRID_SIZE; // = i * 300
    gridLines.push(
      <Line
        key={`mj-v-${i}`}
        points={[pos, 0, pos, gridSize]}
        stroke="#fff"
        // stroke="#000"
        opacity={0.8}
        strokeWidth={1 / scale}
      />,
      <Line
        key={`mj-h-${i}`}
        points={[0, pos, gridSize, pos]}
        stroke="#fff"
        // stroke="#000"
        opacity={0.8}
        strokeWidth={1 / scale}
      />
    );
  }

  const renderMeasurement = () => {
    if (mode !== "wall" || !tempStartPoint || !rawMousePoint) return null;
    const dx = rawMousePoint.x - tempStartPoint.x;
    const dy = rawMousePoint.y - tempStartPoint.y;
    const length = Math.hypot(dx, dy);
    const angleRad = Math.atan2(dy, dx);
    const angleDeg = (angleRad * 180) / Math.PI;

    const arcRadius = Math.max(30, Math.min(100, length / 2));

    const arcTextX = tempStartPoint.x + arcRadius * Math.cos(angleRad / 2);
    const arcTextY = tempStartPoint.y + arcRadius * Math.sin(angleRad / 2);

    const midX = (tempStartPoint.x + rawMousePoint.x) / 2 + 20;
    const midY = (tempStartPoint.y + rawMousePoint.y) / 2;

    return (
      <Group>
        <Arc
          x={tempStartPoint.x}
          y={tempStartPoint.y}
          innerRadius={arcRadius}
          outerRadius={arcRadius}
          angle={angleDeg}
          rotation={0}
          stroke="gray"
          strokeWidth={1}
        />
        <Line
          points={[
            tempStartPoint.x,
            tempStartPoint.y,
            tempStartPoint.x + length,
            tempStartPoint.y,
          ]}
          stroke="gray"
          strokeWidth={1}
          dash={[4, 4]}
        />
        {/* Trục OX từ tempStartPoint */}
        <Line
          points={[0, tempStartPoint.y, gridSize, tempStartPoint.y]}
          stroke="green"
          strokeWidth={1}
          dash={[4, 4]}
        />
        {/* Trục OY từ tempStartPoint */}
        <Line
          points={[tempStartPoint.x, 0, tempStartPoint.x, gridSize]}
          stroke="green"
          strokeWidth={1}
          dash={[4, 4]}
        />

        {/* Trục OX qua điểm chuột */}
        <Line
          points={[0, rawMousePoint.y, gridSize, rawMousePoint.y]}
          stroke="green"
          strokeWidth={1}
          dash={[4, 4]}
        />
        {/* Trục OY qua điểm chuột */}
        <Line
          points={[rawMousePoint.x, 0, rawMousePoint.x, gridSize]}
          stroke="green"
          strokeWidth={1}
          dash={[4, 4]}
        />
        <Text
          x={arcTextX - 10}
          y={arcTextY - 10}
          text={`${angleDeg.toFixed(1)}°`}
          fontSize={14}
          fill="blue"
        />
        <Text
          x={midX - 10}
          y={midY - 10}
          text={`${(length / unitMToPixelCanvas).toFixed(2)} m`}
          fontSize={14}
          fill="blue"
        />
      </Group>
    );
  };
  // Drag stage bằng middle mouse
  const handleDragStart = (e) => {
    if (!e.evt.ctrlKey) {
      e.cancelBubble = true;
      e.target.stopDrag();
      e.target.position(offset); // Đặt lại vị trí như cũ
      e.target.getStage().batchDraw();
    }
  };
  const handleDragMoveGrid = (e) => {
    if (!e.evt.ctrlKey) {
      e.cancelBubble = true;
      e.target.stopDrag();
      e.target.position(offset);
      e.target.getStage().batchDraw();
      return;
    }
    const stage = e.target.getStage();
    setOffset({
      x: stage.x(),
      y: stage.y(),
    });
  };
  const handleWheelGrid = (e) => {
    // if (!e.evt.ctrlKey) return; // chỉ zoom khi giữ Ctrl
    e.evt.preventDefault();

    const stage = canvasLayout2dRef.current;
    const oldScale = scale;
    const pointer = stage.getPointerPosition();

    const scaleBy = 1.05;
    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;

    // Tính lại vị trí để giữ điểm chuột tại chỗ
    const mousePointTo = {
      x: (pointer.x - offset.x) / oldScale,
      y: (pointer.y - offset.y) / oldScale,
    };

    const newOffset = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    setScale(newScale);
    setOffset(newOffset);
  };
  return (
    <>
      {/* Style CSS trong JSX */}
      <style>{`
      .cursor-door {
        cursor: crosshair; /* dấu + */
      }
    `}</style>
      <div className={mode == "door" || mode == "window" ? "cursor-door" : ""}>
        <Stage
          width={window.innerWidth}
          height={window.innerHeight}
          ref={canvasLayout2dRef}
          scaleX={scale}
          scaleY={scale}
          x={offset.x}
          y={offset.y}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onDragStart={handleDragStart}
          onDragMove={handleDragMoveGrid}
          onWheel={handleWheelGrid}
          draggable
          style={{ background: "#e5e5e5" }}
        >

          <Layer>
            {gridLines}
            {walls.map((w, i) => {
              const v1 = getEffectiveVertex(w.startId);
              const v2 = getEffectiveVertex(w.endId);
              if (
                !v1 ||
                !v2 ||
                isNaN(v1.x) ||
                isNaN(v1.y) ||
                isNaN(v2.x) ||
                isNaN(v2.y)
              )
                return null;

              const wallId = `${w.startId}-${w.endId}`;
              const isHovering = hoverWallId === wallId;

              return (
                <React.Fragment key={`wallgroup-${i}`}>
                  {renderWall(
                    v1,
                    v2,
                    `wall-${i}`,
                    isHovering ? "#2ea3f2" : "#ccc",
                    null,
                    "#555",
                    w.thickness ?? WALL_WIDTH
                  )}
                  {renderWallDimension(w, v1, v2)}
                </React.Fragment>
              );
            })}

            {Array.isArray(draggedWallPreview) &&
              draggedWallPreview.map((preview, i) =>
                renderWall(
                  preview.v1,
                  preview.v2,
                  `preview-${i}`,
                  "#aaa",
                  [6, 4]
                )
              )}
            {vertices.map((pt, i) => {
              if (mouseDownVertex && pt.id === mouseDownVertex.id) return null;

              const isHovered = hoverVertex?.id === pt.id;
              const isSnapTarget =
                snapTarget?.type === "vertex" && snapTarget.point?.id === pt.id;

              if (!isHovered && !isSnapTarget) return null; // ❌ Không hiển thị nếu không hover hoặc snap

              return (
                <Circle
                  key={`vertex-${i}`}
                  x={pt.x}
                  y={pt.y}
                  radius={isHovered ? 8 : 6}
                  fill={isHovered ? "#00f" : "lime"}
                  stroke={isHovered ? "#000" : "green"}
                  strokeWidth={1}
                />
              );
            })}
            {mode === "wall" && snapTarget?.type === "wall" && (
              <Circle
                x={snapTarget.point.x}
                y={snapTarget.point.y}
                radius={6}
                fill="lime"
                stroke="green"
                strokeWidth={2}
              />
            )}
            {tempStartPoint &&
              (hoverPoint || rawMousePoint) &&
              (() => {
                const end = hoverPoint || rawMousePoint;
                return renderWall(
                  tempStartPoint,
                  end,
                  "wall-temp",
                  "#ddd",
                  [6, 4]
                );
              })()}
            {doors.map((door) => (
              <React.Fragment key={door.id}>
                {/* Outer Polygon – tường bị cắt */}
                <Line
                  points={door.outerPolygon.flatMap(p => [p.x, p.y])}
                  fill="#fff"
                  closed
                  stroke="#fff"
                  strokeWidth={1}
                />

                {/* Inner Polygon – cánh cửa */}
                <Line
                  points={door.innerPolygon.flatMap(p => [p.x, p.y])}
                  fill="green"
                  closed
                  stroke="black"
                  strokeWidth={1}
                  shadowBlur={5}
                />
              </React.Fragment>
            ))}
            {windows.map((window) => (
              <React.Fragment key={window.id}>
                {/* Outer Polygon – tường bị cắt */}
                <Line
                  points={window.outerPolygon.flatMap(p => [p.x, p.y])}
                  fill="#fff"
                  closed
                  stroke="#fff"
                  strokeWidth={1}
                />

                {/* Inner Polygon – cánh cửa */}
                <Line
                  points={window.innerPolygon.flatMap(p => [p.x, p.y])}
                  fill="yellow"
                  closed
                  stroke="black"
                  strokeWidth={1}
                  shadowBlur={5}
                />
              </React.Fragment>
            ))}
            {renderMeasurement()}
            {/* {
              (() => {
                const walls = [


                  { x: 3084, y: 3655.5 }
                  ,
                  { x: 3084, y: 3664.5 }
                  ,
                  { x: 3464, y: 3664.5 }
                  ,
                  { x: 3464, y: 3655.5 }
                ];
                return <Line
                  points={walls.flatMap(p => [p.x, p.y])}
                  closed
                  stroke="yellow"
                  strokeWidth={2}
                  fill="rgba(0, 0, 255, 0.2)" // tô màu bên trong
                />
              })()
            } */}
            {/* {
              (() => {
                const doors = [
            {"x":3085.5,"y":3218.5},{"x":3136.5,"y":3218.5},{"x":3136.5,"y":3201.5},{"x":3085.5,"y":3201.5}


                ];
                return <Line
                  points={doors.flatMap(p => [p.x, p.y])}
                  closed
                  stroke="blue"
                  strokeWidth={2}
                  fill="rgba(0, 0, 255, 0.2)" // tô màu bên trong
                />
              })()
            } */}
            {/* {
              (() => {
                const center = [

                  // { x: 3340, y: 3664.5 },


                  { x: 3136.5, y: 3210 },
                  { x: 3085.5, y: 3210 }
                ];
                return center.map((point, index) => (
                  <Circle
                    key={`point-${index}`}
                    x={point.x}
                    y={point.y}
                    radius={5}
                    fill="green"
                    stroke="black"
                    strokeWidth={1}
                  />
                ));
              })()
            } */}
          </Layer>
        </Stage>
        <SnapWindowToWall stageRef={canvasLayout2dRef} />
        <SnapDoorToWall stageRef={canvasLayout2dRef} />

      </div>

    </>
  );
};

export default CanvasGridKonva;
