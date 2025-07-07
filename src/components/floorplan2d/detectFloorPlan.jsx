import { Rnd } from 'react-rnd';
import _ from 'lodash'
import polygonClipping from 'polygon-clipping';
import { useEditor } from "../../context/EditorContext";
import React, {
  useEffect,
  useRef,
  useState,
} from "react";
import Transition from '../common/Transition'
import {
  TextareaAutosize,
  Checkbox,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Dialog,
  Switch,
  FormControlLabel,
  Modal,
  Box,
  Button,
  Slider,
  Typography,
  Slide,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  useForkRef,
  patch,
} from "@mui/material";
import useImage from 'use-image';
import { Stage, Layer, Rect, Group, Circle, Text, Image } from "react-konva";
import { v4 as uuidv4 } from 'uuid';
import { RiDragMove2Fill } from "react-icons/ri";

const modelNameYolo = ['wall-detection-xi9ox', 'wall-window-door-detection-zltye', 'walldetector2', 'wall-window-door-detection', 'test-nsycv', 'segmentation-wall-door-window-yeaua']

const MINOR_DIVISIONS = 10;
const MINOR_GRID_SIZE = 30;
const MAJOR_GRID_SIZE = MINOR_GRID_SIZE * MINOR_DIVISIONS //300;
const TOTAL_MAJOR_CELLS = 24;
const HALF_MAJOR = TOTAL_MAJOR_CELLS / 2;
const gridExtent = HALF_MAJOR * MAJOR_GRID_SIZE; // 12 * 300 = 3600
const WALL_WIDTH = 10;
const SNAP_DISTANCE = 50;
const InitComponent = () => {
  const {
    showFormDetect, setshowFormDetect,
    gridLayout3d, setGridLayout3d,
    unitThreeToMM, setUnitThreeToMM,
    unitMToPixelCanvas, setUnitMToPixelCanvas,
    doors, setDoors,
    windows, setWindows,
    walls, setWalls,
    vertices, setVertices,
    canvasLayout2dRef,
    pixelPerMeter, setPixelPerMeter,
  } = useEditor();

  const DOOR_CONFIG = {
    width: 1.2 * unitMToPixelCanvas,
    height: 0.1 * unitMToPixelCanvas,
    // widthThree: 70,
    // height: 10,
    // pivot cũng tính từ dưới lên
    pivot: { x: 1.2 * unitMToPixelCanvas / 2, y: 0.1 * unitMToPixelCanvas / 2 }, // gốc phải dưới
    renderSVG: (color = "black") => (
      <svg
        width={1.2 * unitMToPixelCanvas}
        height={0.1 * unitMToPixelCanvas}
        viewBox={`0 0 ${1.2 * unitMToPixelCanvas} ${0.1 * unitMToPixelCanvas}`}
        fill="none"
        stroke={color}
        strokeWidth="1"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="0"
          y="0"
          width={1.2 * unitMToPixelCanvas}
          height={0.1 * unitMToPixelCanvas}
          stroke={color}
          strokeWidth="1"
          fill="none"
          strokeDasharray="4 2"
        />
        {/* <path d="M1 71L1 79L72 79V71M1 71L72 71M1 71C1 32.3401 32.3401 1 71 1H72V71" /> */}
      </svg>
    ),
  };
  const refselectImgDetect = useRef()
  const [base64ImgDetect, setbase64ImgDetect] = useState({});
  const [detectedRes, setdetectedRes] = useState()
  const [confidenceThreshold, setconfidenceThreshold] = useState(30);
  const [modeShowCanvasDetect, setmodeShowCanvasDetect] = useState('Draw Confidence')
  const [showImgDetect, setshowImgDetect] = useState(true)
  const [showRuler, setshowRuler] = useState(false)
  const [overlapThreshold, setoverlapThreshold] = useState(50);
  const [modelSelected, setmodelSelected] = useState('wall-window-door-detection');
  const canvasbase64ImgDetect = useRef()
  const canvasRulerRef = useRef()
  const [konvaImage] = useImage(base64ImgDetect?.imgbase64 || '', 'anonymous');
  const [ruler, setRuler] = useState({
    x: 100,
    y: 100,
    lengthPx: 150,
    height: 20,
    rotation: 0,
  });
  const [isResizing, setIsResizing] = useState(false);


  // -------------------------watch-------------------------------------------

  function drawPredictionsCanvasConverted() {
    const predictions = detectedRes?.predictions?.filter(
      (item) => item.confidence != null && item.confidence >= confidenceThreshold / 100
    ) || [];

    let predictions_wall = [];
    let predictions_window_door = [];

    predictions.forEach((p) => {
      if (p.class === 'wall') {
        predictions_wall.push(p);
      }
      if (p.class === 'window' || p.class === 'door') {
        predictions_window_door.push(p);
      }
    });

    const renderGroup = (predictionList) => {
      const fixedHeight = 500;
      const scale = konvaImage?.naturalHeight
        ? fixedHeight / konvaImage.naturalHeight
        : 1;

      const scaledWidth = konvaImage?.naturalWidth
        ? konvaImage.naturalWidth * scale
        : 500;
      const elements = [];

      predictionList.forEach((p, idx) => {
        const x = (p.x - p.width / 2) * scale;
        const y = (p.y - p.height / 2) * scale;
        const w = p.width * scale;
        const h = p.height * scale;

        let strokeColor = 'red';
        if (p.class === 'door') strokeColor = 'green';
        if (p.class === 'window') strokeColor = 'yellow';

        if (modeShowCanvasDetect !== 'Censor Predictions') {
          elements.push(
            <Rect
              key={`rect-${p.class}-${idx}`}
              x={x}
              y={y}
              width={w}
              height={h}
              stroke={strokeColor}
              strokeWidth={2}
            />
          );
        }

        if (modeShowCanvasDetect === 'Draw Labels') {
          elements.push(
            <Text
              key={`label-${p.class}-${idx}`}
              x={x + 4}
              y={y - 6}
              text={`${p.class || p.name || 'label'} ${Math.round(p.confidence * 100)}%`}
              fontSize={14}
              fill="blue"
            />
          );
        }

        if (modeShowCanvasDetect === 'Draw Confidence') {
          elements.push(
            <Text
              key={`conf-${p.class}-${idx}`}
              x={x + 4}
              y={y + h + 14}
              text={`${Math.round(p.confidence * 100)}%`}
              fontSize={14}
              fill="blue"
            />
          );
        }

        if (modeShowCanvasDetect === 'Censor Predictions') {
          elements.push(
            <Rect
              key={`censor-${p.class}-${idx}`}
              x={x}
              y={y}
              width={w}
              height={h}
              fill="#add123"
            />
          );
        }
      });

      return elements;
    };


    return (
      <>
        <Layer listening={false}>
          {renderGroup(predictions_wall)}
        </Layer>
        <Layer listening={false}>
          {renderGroup(predictions_window_door)}
        </Layer>
      </>
    );
  }

  // useEffect(() => {
  //   if (!base64ImgDetect?.imgbase64) return;

  //   const canvas = canvasbase64ImgDetect.current;
  //   const ctx = canvas.getContext("2d");
  //   const img = new Image();

  //   img.onload = () => {
  //     // Set canvas size = container (hoặc ảnh gốc nếu không giới hạn)
  //     const fixedHeight = 500;
  //     const scale = fixedHeight / img.height;
  //     const scaledWidth = img.width * scale;

  //     canvas.width = scaledWidth;
  //     canvas.height = fixedHeight;

  //     ctx.clearRect(0, 0, canvas.width, canvas.height);
  //     if (showImgDetect) {
  //       ctx.drawImage(img, 0, 0, scaledWidth, fixedHeight);
  //     }
  //     const predictions = detectedRes?.predictions.filter(item => item.confidence != null && item.confidence >= confidenceThreshold / 100)
  //     // Vẽ box
  //     let predictions_wall = []
  //     let predictions_window_door = []
  //     if (predictions && predictions.length) {
  //       predictions.map(p => {
  //         if (p.class == 'wall') {
  //           predictions_wall.push(p)
  //         }
  //         if (p.class == 'window' || p.class == 'door') {
  //           predictions_window_door.push(p)
  //         }
  //       })
  //       if (predictions_wall.length) {
  //         predictions_wall.forEach((p) => {
  //           const x = (p.x - p.width / 2) * scale;
  //           const y = (p.y - p.height / 2) * scale;
  //           const boxW = p.width * scale;
  //           const boxH = p.height * scale;
  //           if (modeShowCanvasDetect !== 'Censor Predictions') {
  //             // VẼ BOX luôn cho cả 3 mode còn lại
  //             if (p.class == 'door') {
  //               ctx.strokeStyle = "green";
  //             } else if (p.class == 'window') {
  //               ctx.strokeStyle = "yellow";
  //             } else {
  //               ctx.strokeStyle = "red";
  //             }

  //             ctx.lineWidth = 2;
  //             ctx.strokeRect(x, y, boxW, boxH);
  //           }

  //           if (modeShowCanvasDetect === 'Draw Labels') {
  //             const label = `${p.class || p.name || "label"} ${Math.round(p.confidence * 100)}%`;
  //             ctx.fillStyle = "blue";
  //             ctx.font = "14px Arial";
  //             ctx.fillText(label, x + 4, y - 6);
  //           }

  //           if (modeShowCanvasDetect === 'Draw Confidence') {
  //             const confidence = `${Math.round(p.confidence * 100)}%`;
  //             ctx.fillStyle = "blue";
  //             ctx.font = "14px Arial";
  //             ctx.fillText(confidence, x + 4, y + boxH + 14);
  //           }

  //           if (modeShowCanvasDetect === 'Censor Predictions') {
  //             ctx.fillStyle = "#add123";
  //             ctx.fillRect(x, y, boxW, boxH);
  //           }
  //         });
  //       }
  //       if (predictions_window_door.length) {
  //         predictions_window_door.forEach((p) => {
  //           const x = (p.x - p.width / 2) * scale;
  //           const y = (p.y - p.height / 2) * scale;
  //           const boxW = p.width * scale;
  //           const boxH = p.height * scale;
  //           if (modeShowCanvasDetect !== 'Censor Predictions') {
  //             // VẼ BOX luôn cho cả 3 mode còn lại
  //             if (p.class == 'door') {
  //               ctx.strokeStyle = "green";
  //             } else if (p.class == 'window') {
  //               ctx.strokeStyle = "yellow";
  //             } else {
  //               ctx.strokeStyle = "red";
  //             }

  //             ctx.lineWidth = 2;
  //             ctx.strokeRect(x, y, boxW, boxH);
  //           }

  //           if (modeShowCanvasDetect === 'Draw Labels') {
  //             const label = `${p.class || p.name || "label"} ${Math.round(p.confidence * 100)}%`;
  //             ctx.fillStyle = "blue";
  //             ctx.font = "14px Arial";
  //             ctx.fillText(label, x + 4, y - 6);
  //           }

  //           if (modeShowCanvasDetect === 'Draw Confidence') {
  //             const confidence = `${Math.round(p.confidence * 100)}%`;
  //             ctx.fillStyle = "blue";
  //             ctx.font = "14px Arial";
  //             ctx.fillText(confidence, x + 4, y + boxH + 14);
  //           }

  //           if (modeShowCanvasDetect === 'Censor Predictions') {
  //             ctx.fillStyle = "#add123";
  //             ctx.fillRect(x, y, boxW, boxH);
  //           }
  //         });
  //       }

  //     }

  //   };

  //   img.src = base64ImgDetect.imgbase64;
  // }, [base64ImgDetect, detectedRes, confidenceThreshold, modeShowCanvasDetect, showImgDetect]);

  // -----------------------End--watch-------------------------------------------



  function handleSelectImgDetect(e) {
    const file = e.target.files[0];
    if (!file) return;
    setdetectedRes(null)
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result; // dạng: "data:image/jpeg;base64,..."
      setbase64ImgDetect({
        imgbase64: result,
        file: file
      })
    };

    reader.readAsDataURL(file);
  }
  const toWorldCoords = (ref, point) => {
    try {
      const transform = ref.getAbsoluteTransform().copy().invert();
      return transform.point(point);
    } catch { }
  };
  function getWallVerticesFromBox(polygon) {
    if (polygon.length !== 4) return null;

    const [p1, p2, p3, p4] = polygon;

    // Tính trung điểm của các cạnh đối nhau
    const c1 = {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
    };
    const c2 = {
      x: (p3.x + p4.x) / 2,
      y: (p3.y + p4.y) / 2,
    };

    const c3 = {
      x: (p1.x + p4.x) / 2,
      y: (p1.y + p4.y) / 2,
    };
    const c4 = {
      x: (p2.x + p3.x) / 2,
      y: (p2.y + p3.y) / 2,
    };

    // Chọn cặp có khoảng cách lớn nhất
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const pairs = [
      [c1, c2],
      [c3, c4],
    ];
    const [v1, v2] = pairs.reduce((maxPair, pair) =>
      dist(pair[0], pair[1]) > dist(maxPair[0], maxPair[1]) ? pair : maxPair
    );

    return [v1, v2];
  }
  // function getWallVerticesAndCenterAndAngleFromBox(polygon) {
  //   if (!polygon || polygon.length !== 4) return null;

  //   const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  //   const edges = [
  //     [polygon[0], polygon[1]],
  //     [polygon[1], polygon[2]],
  //     [polygon[2], polygon[3]],
  //     [polygon[3], polygon[0]],
  //   ];

  //   // Tìm cạnh dài nhất
  //   const [v1, v2] = edges.reduce((longest, current) =>
  //     dist(...current) > dist(...longest) ? current : longest
  //   );

  //   const center = {
  //     x: (v1.x + v2.x) / 2,
  //     y: (v1.y + v2.y) / 2,
  //   };

  //   const dx = v2.x - v1.x;
  //   const dy = v2.y - v1.y;
  //   const angleRad = Math.atan2(dy, dx);
  //   const angleDeg = 360 - (angleRad * 180) / Math.PI;
  //   return { center, angleDeg, v1, v2 };
  // }
  function getWallVerticesAndCenterAndAngleFromBox(polygon) {
    if (!polygon || polygon.length !== 4) return null;

    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

    const edges = [
      [polygon[0], polygon[1]],
      [polygon[1], polygon[2]],
      [polygon[2], polygon[3]],
      [polygon[3], polygon[0]],
    ];

    // Tìm cặp cạnh dài nhất (v1-v2 là trục dài của tường)
    const [v1, v2] = edges.reduce((longest, current) =>
      dist(...current) > dist(...longest) ? current : longest
    );

    // Tính center
    const center = {
      x: (v1.x + v2.x) / 2,
      y: (v1.y + v2.y) / 2,
    };

    // Tính angle
    const dx = v2.x - v1.x;
    const dy = v2.y - v1.y;
    const length = Math.hypot(dx, dy);
    const angleRad = Math.atan2(dy, dx);
    const angleDeg = 360 - (angleRad * 180) / Math.PI;

    // Tính độ dày: khoảng cách giữa 2 điểm không thuộc v1-v2
    const otherPoints = polygon.filter(
      (p) => (p.x !== v1.x || p.y !== v1.y) && (p.x !== v2.x || p.y !== v2.y)
    );

    // Vector pháp tuyến (vuông góc với tường)
    const nx = -dy / length;
    const ny = dx / length;

    // Tính thickness bằng cách chiếu vector nối otherPoints[0] → v1 lên pháp tuyến
    const thickness = Math.abs(
      (otherPoints[0].x - v1.x) * nx + (otherPoints[0].y - v1.y) * ny
    ) * 2; // nhân 2 vì là nửa chiều dày

    console.log("thickness của tường=", thickness)

    return {
      center,
      angleDeg,
      angleRad,
      v1,
      v2,
      thickness,
      dir: { x: dx / length, y: dy / length },
      normal: { x: nx, y: ny },
    };
  }



  function isPolygonOverlap(polyA, polyB) {
    const polys = [polyA, polyB];

    for (let i = 0; i < polys.length; i++) {
      const polygon = polys[i];

      for (let i1 = 0; i1 < polygon.length; i1++) {
        const i2 = (i1 + 1) % polygon.length;
        const p1 = polygon[i1];
        const p2 = polygon[i2];

        const normal = {
          x: p2.y - p1.y,
          y: p1.x - p2.x,
        };

        let minA = null;
        let maxA = null;
        for (const p of polyA) {
          const projected = p.x * normal.x + p.y * normal.y;
          if (minA === null || projected < minA) minA = projected;
          if (maxA === null || projected > maxA) maxA = projected;
        }

        let minB = null;
        let maxB = null;
        for (const p of polyB) {
          const projected = p.x * normal.x + p.y * normal.y;
          if (minB === null || projected < minB) minB = projected;
          if (maxB === null || projected > maxB) maxB = projected;
        }

        if (maxA < minB || maxB < minA) {
          return false; // Có trục phân tách → không giao
        }
      }
    }
    return true; // Không có trục phân tách → giao nhau
  }
  function getClosestPointOnLineSegment(a, b, p) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;

    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const closest = {
      x: a.x + t * dx,
      y: a.y + t * dy,
    };

    const dist = Math.hypot(p.x - closest.x, p.y - closest.y);
    return { closestPoint: closest, distance: dist };
  }
  function findNearestWallWithSnap(point, walls, vertices, snapRadius) {
    let bestWall = null;
    let bestPoint = null;
    let minDist = Infinity;

    for (const wall of walls) {
      const v1 = getVertexById(wall.startId);
      const v2 = getVertexById(wall.endId);
      if (!v1 || !v2) continue;

      const { closestPoint, distance } = getClosestPointOnLineSegment(v1, v2, point);
      if (distance < minDist && distance <= snapRadius) {
        bestWall = wall;
        bestPoint = closestPoint;
        minDist = distance;
      }
    }

    return bestWall ? { wall: bestWall, point: bestPoint } : null;
  }
  const getVertexById = (id) => vertices.find((v) => v.id === id);
  function filterValidDetectedDoorsOptimized22({
    detectedDoors,
    walls,
    vertices,
    existingDoors,
    existingWindows,
    snapRadius,
    config
  }) {
    const DOOR_WIDTH = config?.width ?? 90;
    const DOOR_HEIGHT = config?.height ?? 10;
    const unitMToPixelCanvas = config?.unitMToPixelCanvas ?? 100;
    const results = [];
    for (const door of detectedDoors) {
      // console.log("door=", door)
      if (!door || !Array.isArray(door.polygon) || door.polygon.length < 3) continue;
      const doorPoly = door.polygon;
      if (!doorPoly || doorPoly.length < 3) continue;

      // Ưu tiên tường đã giao với polygon của cửa
      let wallCandidates = walls.filter(w => {
        return w.polygon && isPolygonOverlap(doorPoly, w.polygon);
      });

      // Nếu không giao tường nào → tìm tường gần nhất trong bán kính snap
      if (wallCandidates.length === 0) {
        const nearest = findNearestWallWithSnap(door, walls, vertices, snapRadius);
        if (nearest) wallCandidates = [nearest.wall];
      }

      let accepted = false;
      for (const wall of wallCandidates) {
        const v1 = getVertexById(wall.startId);
        const v2 = getVertexById(wall.endId);
        if (!v1 || !v2) continue;

        const { point: center, distance } = getClosestPointOnLineSegment(v1, v2, {
          x: door.x + door.width / 2,
          y: door.y + door.height / 2,
        });

        const dx = v2.x - v1.x;
        const dy = v2.y - v1.y;
        const wallLength = Math.hypot(dx, dy);
        const angleRad = Math.atan2(dy, dx);
        const angleDeg = (angleRad * 180) / Math.PI;

        const offset = ((center.x - v1.x) * dx + (center.y - v1.y) * dy) / wallLength;
        if (offset < DOOR_WIDTH / 2 || offset > wallLength - DOOR_WIDTH / 2) continue;

        const wallThickness = wall.thickness ?? 20;
        const dir = { x: Math.cos(angleRad), y: Math.sin(angleRad) };
        const perp = { x: -dir.y, y: dir.x };

        const halfLen = DOOR_WIDTH / 2 + 4;
        const halfThick = wallThickness / 2 + 4;

        const testPolygon = [
          { x: center.x - dir.x * halfLen - perp.x * halfThick, y: center.y - dir.y * halfLen - perp.y * halfThick },
          { x: center.x + dir.x * halfLen - perp.x * halfThick, y: center.y + dir.y * halfLen - perp.y * halfThick },
          { x: center.x + dir.x * halfLen + perp.x * halfThick, y: center.y + dir.y * halfLen + perp.y * halfThick },
          { x: center.x - dir.x * halfLen + perp.x * halfThick, y: center.y - dir.y * halfLen + perp.y * halfThick },
        ];

        let overlaps = false;
        for (const d of existingDoors) {
          if (d.wallId === wall.id && isPolygonOverlap(testPolygon, d.outerPolygon)) {
            overlaps = true;
            break;
          }
        }
        if (!overlaps) {
          for (const w of existingWindows) {
            if (w.wallId === wall.id && isPolygonOverlap(testPolygon, w.outerPolygon)) {
              overlaps = true;
              break;
            }
          }
        }

        if (!overlaps) {
          results.push({
            originalDoor: door,
            snapInfo: {
              wallId: wall.id,
              wall,
              point: center,
              angle: angleDeg,
              center,
            },
          });
          accepted = true;
          break; // ✅ Ưu tiên tường đầu tiên hợp lệ → không cần kiểm tiếp
        }
      }
    }

    return results;
  }



  function wallToPolygon(v1, v2, thickness) {
    const dx = v2.x - v1.x;
    const dy = v2.y - v1.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return [];

    const nx = -dy / len;
    const ny = dx / len;

    const t = thickness / 2;
    return [
      { x: v1.x + nx * t, y: v1.y + ny * t },
      { x: v1.x - nx * t, y: v1.y - ny * t },
      { x: v2.x - nx * t, y: v2.y - ny * t },
      { x: v2.x + nx * t, y: v2.y + ny * t },
    ];
  }

  function filterValidDetectedDoorsOptimized({
    detectedDoors,
    walls,
    vertices,
    existingDoors,
    existingWindows,
    snapRadius,
    config,
  }) {
    const validDoors = [];

    for (const door of detectedDoors) {
      const doorPoly = door.polygon;

      if (!doorPoly || doorPoly.length < 3) continue;
      // console.log("voi door=", doorPoly)
      let bestWall = null;

      for (const wall of walls) {
        const v1 = getVertexById(wall.startId);
        const v2 = getVertexById(wall.endId);
        if (!v1 || !v2) continue;

        const wallPoly = wallToPolygon(v1, v2, wall.thickness ?? 10);
        const overlap = isPolygonOverlap(doorPoly, wallPoly);
        // console.log(`voi wall=${wall.startId} overlap=${overlap}`)

        if (overlap) {
          bestWall = wall;
          break; // ✅ đã có tường khớp đầu tiên → ưu tiên giữ
        }
      }

      if (bestWall) {
        validDoors.push({
          ...door,
          wallId: bestWall.id,
        });
      }
    }

    return validDoors;
  }


  function adjustDoorsWindowsToFitWalls(doors, walls) {
    const adjustedDoors = [];
    console.log("doors=", doors)
    console.log("walls=", walls)
    doors.forEach((door, idx) => {
      const dx1 = door.x;
      const dx2 = door.x + door.width;
      const dy1 = door.y;
      const dy2 = door.y + door.height;

      let bestIoU = 0;
      let bestWall = null;

      console.log("voi door=", door)


      walls.forEach((wall) => {

        const wx1 = wall.x;
        const wx2 = wall.x + wall.width;
        const wy1 = wall.y;
        const wy2 = wall.y + wall.height;

        const ix1 = Math.max(dx1, wx1);
        const ix2 = Math.min(dx2, wx2);
        const iy1 = Math.max(dy1, wy1);
        const iy2 = Math.min(dy2, wy2);
        const iw = Math.max(0, ix2 - ix1);
        const ih = Math.max(0, iy2 - iy1);
        const intersectionArea = iw * ih;

        const unionArea = door.width * door.height + wall.width * wall.height - intersectionArea;

        const iou = intersectionArea / unionArea;

        if (iou > bestIoU) {
          bestIoU = iou;
          bestWall = wall;
        }
      });

      if (bestWall) {
        console.log("tim thay wall", bestWall)
        const wallIsHorizontal = bestWall.width >= bestWall.height;
        const adjustedDoor = { ...door };
        // console.log("bestWall", bestWall)
        adjustedDoor.wallId = bestWall.id
        adjustedDoor.dataOrigin = door

        if (wallIsHorizontal) {
          // Căn lại theo trục OY
          adjustedDoor.y = bestWall.y; // bám mép
          adjustedDoor.height = bestWall.height; // dày khít với tường
        } else {
          // Căn lại theo trục OX
          adjustedDoor.x = bestWall.x;
          adjustedDoor.width = bestWall.width;
        }

        adjustedDoors.push(adjustedDoor);
      }
    });

    return adjustedDoors;
  }
  function getPolygonCenter(polygon) {
    const sum = polygon.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / polygon.length, y: sum.y / polygon.length };
  }
  function distancePointToLine(point, lineStart, lineEnd) {
    const { x: x0, y: y0 } = point;
    const { x: x1, y: y1 } = lineStart;
    const { x: x2, y: y2 } = lineEnd;

    const dx = x2 - x1;
    const dy = y2 - y1;

    if (dx === 0 && dy === 0) {
      // Đoạn thẳng suy biến thành điểm
      const dx0 = x0 - x1;
      const dy0 = y0 - y1;
      return Math.sqrt(dx0 * dx0 + dy0 * dy0);
    }

    const numerator = Math.abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1);
    const denominator = Math.sqrt(dx * dx + dy * dy);

    return numerator / denominator;
  }

  function getWallThickness(wall) {
    const [p1, p2, p3] = wall.polygon;
    return distancePointToLine(p3, p1, p2); // chiều dày là khoảng cách điểm thứ 3 đến cạnh dài
  }

  function getLongDirection(polygon) {
    const v0 = polygon[0];
    const v1 = polygon[1];
    return normalize({ x: v1.x - v0.x, y: v1.y - v0.y });
  }

  function getShortDirection(polygon) {
    const v0 = polygon[0];
    const v3 = polygon[3];
    return normalize({ x: v3.x - v0.x, y: v3.y - v0.y });
  }

  function normalize(v) {
    const len = Math.hypot(v.x, v.y);
    return { x: v.x / len, y: v.y / len };
  }

  function getDistance(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
  }

  function rotatePointAround(p, center, angle) {
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos
    };
  }

  function getPolygonRotation(polygon) {
    const p0 = polygon[0], p1 = polygon[1];
    return Math.atan2(p1.y - p0.y, p1.x - p0.x);
  }
  function rotatePolygon(polygon, angleRad, center = { x: 0, y: 0 }) {
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    return polygon.map(p => {
      const dx = p.x - center.x;
      const dy = p.y - center.y;

      return {
        x: center.x + dx * cos - dy * sin,
        y: center.y + dx * sin + dy * cos,
      };
    });
  }

  // function transformDoorToWall(door, wallInfo) {
  //   const { center: wallCenter, angleRad, thickness, dir } = wallInfo;

  //   const doorCenter = getPolygonCenter(door.polygon);
  //   const dx = wallCenter.x - doorCenter.x;
  //   const dy = wallCenter.y - doorCenter.y;

  //   // Dịch door đến center tường
  //   let translated = door.polygon.map(p => ({
  //     x: p.x + dx,
  //     y: p.y + dy
  //   }));

  //   // Xoay cùng hướng tường
  //   let rotated = rotatePolygon(translated, angleRad, wallCenter);

  //   // Tính lại thickness
  //   const newDoor = {
  //     ...door,
  //     polygon: rotated,
  //     center: wallCenter,
  //     angle: angleRad,
  //     thickness: thickness
  //   };

  //   return newDoor;
  // }
  function expandPolygonAlongNormal(polygon, normal, offset) {
    const { x: nx, y: ny } = normal;

    // Dịch từng điểm ra 2 phía theo pháp tuyến để tạo polygon dày
    const front = polygon.map(p => ({
      x: p.x + nx * offset,
      y: p.y + ny * offset,
    }));
    const back = polygon.slice().reverse().map(p => ({
      x: p.x - nx * offset,
      y: p.y - ny * offset,
    }));

    return [...front, ...back];
  }
  function makeDoorOuterPolygonFromV1V2(v1, v2, normal, thickness) {
    const half = thickness / 2;
    const nx = normal.x;
    const ny = normal.y;

    // Mở rộng vuông góc (đúng theo chiều dày)
    const p1 = { x: v1.x + nx * half, y: v1.y + ny * half };
    const p2 = { x: v2.x + nx * half, y: v2.y + ny * half };
    const p3 = { x: v2.x - nx * half, y: v2.y - ny * half };
    const p4 = { x: v1.x - nx * half, y: v1.y - ny * half };

    return [p1, p2, p3, p4]; // đúng thứ tự, theo chiều kim đồng hồ
  }

  function transformDoorToWall(door, wallInfo) {
    console.log("wallInfowallInfo=", wallInfo)
    const { center: wallCenter, angleRad, thickness, dir: wallDir, normal, skeleton } = wallInfo;

    const doorCenter = getPolygonCenter(door.polygon);
    const dx = wallCenter.x - doorCenter.x;
    const dy = wallCenter.y - doorCenter.y;

    // Dịch polygon về đúng vị trí center của tường
    let translated = door.polygon.map(p => ({
      x: p.x + dx,
      y: p.y + dy
    }));

    // === NEW: Kiểm tra hướng cửa ===
    const doorInfo = getWallVerticesAndCenterAndAngleFromBox(door.polygon);
    if (!doorInfo) return door; // bỏ qua nếu lỗi

    const doorDir = doorInfo.dir;

    // Tính dot product giữa 2 vector hướng
    const dot = doorDir.x * wallDir.x + doorDir.y * wallDir.y;
    const cosThreshold = Math.cos(Math.PI / 36); // ≈ 5 độ

    let innerPolygon = translated;
    if (Math.abs(dot) < cosThreshold) {
      // Khác hướng: mới xoay
      innerPolygon = rotatePolygon(translated, angleRad, wallCenter);
    }

    // === Tính outerPolygon bằng cách mở rộng polygon theo vector pháp tuyến ===
    // 👉 Tính lại v1, v2 từ innerPolygon đã xoay
    const doorInfo2 = getWallVerticesAndCenterAndAngleFromBox(_.cloneDeep(innerPolygon));
    console.log("doorInfo2", doorInfo2)
    console.log("thickness", thickness)
    if (!doorInfo2) return door;

    // outerPolygon đúng hướng cửa sau khi đã xoay
    const outerPolygon = makeDoorOuterPolygonFromV1V2(
      doorInfo.v1,
      doorInfo.v2,
      normal,
      thickness
    );
    console.log("innerPolygon", innerPolygon)
    console.log("outerPolygon", outerPolygon)

    const newDoor = {
      ...door,
      polygon: door.polygon,
      innerPolygon: innerPolygon,
      outerPolygon: outerPolygon,
      center: wallCenter,
      angle: angleRad,
      thickness: thickness,
    };

    return newDoor;
  }


  function getClosestPointOnLine(point, lineStart, lineEnd) {
    const { x: x1, y: y1 } = lineStart;
    const { x: x2, y: y2 } = lineEnd;
    const { x: px, y: py } = point;

    const dx = x2 - x1;
    const dy = y2 - y1;

    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) return { x: x1, y: y1 }; // đoạn thẳng suy biến

    // Tính hệ số t để nội suy
    let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t)); // giới hạn trong đoạn thẳng

    return {
      x: x1 + t * dx,
      y: y1 + t * dy,
    };
  }
  // 👉 Hàm phụ
  function distance(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
  }
  function getSnapPointToWall22(door, wall, snapRadius = 50) {
    const doorCenter = getPolygonCenter(door.polygon);

    let minDist = Infinity;
    let closest = null;
    let angleRad = 0;
    let dir = null;

    for (let i = 0; i < wall.polygon.length; i++) {
      const a = wall.polygon[i];
      const b = wall.polygon[(i + 1) % wall.polygon.length];

      const pt = getClosestPointOnLine(doorCenter, a, b);
      const dist = Math.hypot(doorCenter.x - pt.x, doorCenter.y - pt.y);

      if (dist < minDist) {
        minDist = dist;
        closest = pt;

        const wallDir = { x: b.x - a.x, y: b.y - a.y };
        const wallLength = Math.hypot(wallDir.x, wallDir.y);
        dir = { x: wallDir.x / wallLength, y: wallDir.y / wallLength };
        angleRad = Math.atan2(dir.y, dir.x);
      }
    }

    if (minDist > snapRadius) return null;

    const thickness = Math.min(
      distance(wall.polygon[0], wall.polygon[3]),
      distance(wall.polygon[1], wall.polygon[2])
    );

    return {
      center: closest,
      angleRad,
      thickness,
      dir,
      distance: minDist,
    };
  }
  // function getSnapPointToWall(door, wall, snapRadius = 50) {
  //   const poly = wall.polygon;
  //   if (!poly || poly.length !== 4) return null;

  //   // Xác định 2 cặp cạnh đối
  //   const d01 = distance(poly[0], poly[1]);
  //   const d12 = distance(poly[1], poly[2]);
  //   const d23 = distance(poly[2], poly[3]);
  //   const d30 = distance(poly[3], poly[0]);

  //   // Tìm cặp đối nhau có chiều dài lớn hơn => là chiều dài tường
  //   const isHorizontal = d01 > d30;

  //   // Chọn 2 điểm để xác định trục chính tường
  //   const edgeA = isHorizontal ? poly[0] : poly[0];
  //   const edgeB = isHorizontal ? poly[1] : poly[3];
  //   const edgeC = isHorizontal ? poly[3] : poly[1];
  //   const edgeD = isHorizontal ? poly[2] : poly[2];

  //   // Trung điểm 2 cạnh: tạo trục chính nằm ở giữa
  //   const mid1 = midpoint(edgeA, edgeC);
  //   const mid2 = midpoint(edgeB, edgeD);

  //   // Hướng và góc
  //   const dirVec = { x: mid2.x - mid1.x, y: mid2.y - mid1.y };
  //   const length = Math.hypot(dirVec.x, dirVec.y);
  //   const dir = { x: dirVec.x / length, y: dirVec.y / length };
  //   const angleRad = Math.atan2(dir.y, dir.x);

  //   // Tâm cửa
  //   const doorCenter = getPolygonCenter(door.polygon);

  //   // Tính điểm gần nhất trên trục chính
  //   const closest = getClosestPointOnLine(doorCenter, mid1, mid2);
  //   const dist = Math.hypot(doorCenter.x - closest.x, doorCenter.y - closest.y);

  //   if (dist > snapRadius) return null;

  //   // Độ dày tường là khoảng cách giữa 2 cặp cạnh ngắn hơn
  //   const thickness = Math.min(d01, d12, d23, d30);

  //   return {
  //     center: closest,
  //     angleRad,
  //     thickness,
  //     dir,
  //     distance: dist,
  //   };
  // }

  // Helper
  function distance(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
  }

  function midpoint(p1, p2) {
    return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  }

  function getSnapPointToWall(door, wall, snapRadius = 50) {
    const polygon = wall.polygon;
    if (!polygon || polygon.length !== 4) return null;
    if (!wall.skeleton || !wall.skeleton.v1 || !wall.skeleton.v2) return null;

    const v1 = wall.skeleton.v1;
    const v2 = wall.skeleton.v2;

    // vector xương tường
    const dx = v2.x - v1.x;
    const dy = v2.y - v1.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return null;

    const dir = { x: dx / len, y: dy / len }; // hướng
    const angleRad = Math.atan2(dir.y, dir.x);

    // Tâm cửa
    const doorCenter = getPolygonCenter(door.polygon);

    // vector vuông góc (normal)
    const normal = { x: -dir.y, y: dir.x };

    // Tạo đường qua tâm cửa theo hướng vuông góc
    const p3 = {
      x: doorCenter.x - normal.x * 1000,
      y: doorCenter.y - normal.y * 1000,
    };
    const p4 = {
      x: doorCenter.x + normal.x * 1000,
      y: doorCenter.y + normal.y * 1000,
    };

    // Tính giao điểm giữa v1-v2 và p3-p4
    const center = getLineIntersection(v1, v2, p3, p4);
    if (!center) return null;

    const dist = Math.hypot(center.x - doorCenter.x, center.y - doorCenter.y);
    if (dist > snapRadius) return null;

    // const thickness = getWallThicknessFromPolygon(polygon); // hoặc bạn truyền sẵn
    console.log("getSnapPointToWall wall", wall)
    return {
      thickness: wall.thickness || WALL_WIDTH,
      normal: wall.normal,
      center,
      angleRad,
      dir,
      distance: dist,
      skeleton: wall.skeleton,
    };
  }
  function getLineIntersection(p1, p2, p3, p4) {
    const A1 = p2.y - p1.y;
    const B1 = p1.x - p2.x;
    const C1 = A1 * p1.x + B1 * p1.y;

    const A2 = p4.y - p3.y;
    const B2 = p3.x - p4.x;
    const C2 = A2 * p3.x + B2 * p3.y;

    const det = A1 * B2 - A2 * B1;
    if (Math.abs(det) < 1e-6) return null;

    return {
      x: (B2 * C1 - B1 * C2) / det,
      y: (A1 * C2 - A2 * C1) / det,
    };
  }
  // function getSnapPointToWall(door, wall, snapRadius = 50) {
  //   const polygon = wall.polygon;
  //   if (!polygon || polygon.length !== 4) return null;

  //   // Dùng hàm đã có để lấy xương tường và các thông tin liên quan
  //   const wallData = getWallVerticesAndCenterAndAngleFromBox(polygon);
  //   if (!wallData) return null;

  //   const { v1, v2, dir, angleRad, thickness } = wallData;
  //   console.log("wallData",wallData)

  //   // Tính tâm cửa
  //   const doorCenter = getPolygonCenter(door.polygon);

  //   // Vector pháp tuyến với tường (vuông góc với xương)
  //   const normal = { x: -dir.y, y: dir.x };

  //   // Tạo đường đi qua tâm cửa theo hướng pháp tuyến
  //   const p3 = {
  //     x: doorCenter.x - normal.x * 1000,
  //     y: doorCenter.y - normal.y * 1000,
  //   };
  //   const p4 = {
  //     x: doorCenter.x + normal.x * 1000,
  //     y: doorCenter.y + normal.y * 1000,
  //   };

  //   // Giao điểm giữa xương tường (v1–v2) và đường vuông góc qua tâm cửa
  //   const snapPoint = getLineIntersection(v1, v2, p3, p4);
  //   if (!snapPoint) return null;

  //   // Khoảng cách từ tâm cửa đến điểm snap (có thể dùng để ưu tiên hoặc kiểm tra)
  //   const dist = Math.hypot(snapPoint.x - doorCenter.x, snapPoint.y - doorCenter.y);
  //   if (dist > snapRadius) return null;

  //   return {
  //     center: snapPoint,   // điểm để đặt lại tâm polygon cửa
  //     angleRad,            // góc để xoay polygon cửa
  //     dir,                 // hướng tường (unit vector)
  //     thickness,           // độ dày tường
  //     distance: dist       // khoảng cách để sắp xếp ưu tiên
  //   };
  // }








  function polygonsIntersect(polyA, polyB) {
    // Dữ liệu đầu vào dạng [[[x1, y1], [x2, y2], ...]]
    const shapeA = [polyA.map(p => [p.x, p.y])];
    const shapeB = [polyB.map(p => [p.x, p.y])];

    const result = polygonClipping.intersection(shapeA, shapeB);
    return result.length > 0;
  }
  function adjustPredictedDoorsToWalls({ doors,
    walls,
    snapRadius = SNAP_DISTANCE,
    existingDoors
  }) {
    const predictedDoor = _.cloneDeep(doors) || []
    const wallArr = _.cloneDeep(walls) || []

    const validDoors = [];

    let walljsonarr = []
    for (const wall of wallArr) {
      walljsonarr.push(wall.polygon)
    }
    // console.log("walljsonarr=", JSON.stringify(walljsonarr))
    for (const door of predictedDoor) {
      let targetWall = null;
      let wallInfo = null;
      let minDist = Infinity;
      console.log("voi door=", door)
      for (const wall of wallArr) {
        const intersects = polygonsIntersect(door.polygon, wall.polygon);
        console.log("intersects=", intersects)

        if (!intersects) continue;
        const snap = getSnapPointToWall(door, wall, snapRadius);
        if (!snap) continue; // không đủ gần thì bỏ qua luôn
        // ✅ Nếu có giao thì chọn (ưu tiên cái gần nhất)
        // if (snap.distance < minDist) {
        //   minDist = snap.distance;
        //   targetWall = wall;
        //   wallInfo = snap;
        //   console.log(">>> Tường GIAO, snap:", snap);
        // }
        console.log("snap=", snap)
        minDist = snap.distance;
        targetWall = wall;
        wallInfo = snap;
        if (targetWall) {
          break;
        }
      }

      console.log("tim thay targetWall=", targetWall)
      console.log("tim thay wallInfo=", wallInfo)
      if (!targetWall || !wallInfo) continue;

      // 3. Biến đổi cửa để trùng hướng tường, đặt tại vị trí snap
      let newDoor = transformDoorToWall(_.cloneDeep(door), _.cloneDeep(wallInfo));

      // // 4. Kiểm tra cửa có nằm trong polygon tường theo chiều dài (bỏ qua độ dày)
      // if (!isPolygonInsideWithoutThickness(newDoor.polygon, targetWall.polygon)) continue;

      // console.log("ko va cham voi cua theo chieu dai")

      // // 5. Kiểm tra cửa không chạm cửa đã đặt
      // if (intersectsAny(newDoor.polygon, validDoors.map(d => d.polygon))) continue;

      // // 6. Gán thông tin và thêm vào validDoors


      console.log("newDoorsffd=", newDoor)

      newDoor.wallId = targetWall.id;
      newDoor.thickness = getWallThickness(targetWall); // hoặc wallInfo.thickness nếu có
      newDoor.dataOrigin = door
      validDoors.push(newDoor);
    }

    return validDoors;
  }

  useEffect(() => {
    console.log("✅ vertices cập nhật xong:", vertices);

  }, [vertices]);
  async function updateDataHouse() {

    const predictions = detectedRes?.predictions.filter(item => {
      // item.x = Math.ceil(item.x * unitPixelToThree);
      // item.y = Math.ceil(item.y * unitPixelToThree);
      // item.width = Math.ceil(item.width * unitPixelToThree);
      // item.height = Math.ceil(item.height * unitPixelToThree);
      return item.confidence != null && item.confidence >= confidenceThreshold / 100
    })
    let predictionDoor = [];
    let predictionWindow = [];
    let predictWall = [];
    let minX = 0, minY = 0;
    let maxX = -0, maxY = -0;
    let offsetXGrid = 0
    try {
      offsetXGrid = -(window.innerWidth / 2 - gridExtent)
    } catch { }
    let offsetYGrid = 0
    try {
      offsetYGrid = -(window.innerHeight / 2 - gridExtent)
    } catch { }
    if (predictions) {
      predictions.map(p => {
        const x_start = p.x - p.width / 2;
        const y_start = p.y - p.height / 2;
        const x_start_offset = x_start + offsetXGrid;
        const x_end_offset = x_start + p.width + offsetXGrid;
        const y_start_offset = y_start + offsetYGrid;
        const y_end_offset = y_start + p.height + offsetYGrid;
        let wallId = uuidv4();
        let dataT = {
          ...p,
          id: wallId,
          x: x_start,
          y: y_start,
          polygon: [
            { x: x_start_offset, y: y_start_offset },         // top-left
            { x: x_start_offset, y: y_end_offset },        // top-right
            { x: x_end_offset, y: y_end_offset },        // bottom-right
            { x: x_end_offset, y: y_start_offset },         // bottom-left
          ]
        };

        if (dataT.class == 'door') {
          predictionDoor.push(dataT)
        }
        if (dataT.class == 'window') {
          predictionWindow.push(dataT)
        }
        if (dataT.class == 'wall') {
          predictWall.push(dataT)
        }
        return dataT
      });
    }
    let verticesArr = []
    let wallArr = []
    if (predictWall && predictWall.length) {
      for (let i = 0; i < predictWall.length; i++) {
        if (predictWall[i].polygon && predictWall[i].polygon.length && predictWall[i].polygon.length >= 3) {
          const { v1, v2, thickness, normal } = getWallVerticesAndCenterAndAngleFromBox(_.cloneDeep(predictWall[i].polygon));
          const v1_vertice = _.merge(v1, {
            id: uuidv4() + Math.random(),
            x: v1.x,
            y: v1.y,
          })
          const v2_vertice = _.merge(v2, {
            id: uuidv4() + Math.random(),
            x: v2.x,
            y: v2.y,
          })
          verticesArr = [...verticesArr, v1_vertice, v2_vertice]

          let newWallId = uuidv4();
          const newWalls = {
            id: predictWall[i].id || newWallId,
            startId: v1_vertice.id,
            endId: v2_vertice.id,
            thickness: thickness || WALL_WIDTH,
            height: 2.4 * unitMToPixelCanvas,
            polygon: predictWall[i].polygon || [],
            type: "wall",
            name: "Wall",
            skeleton: { v1, v2 },
            normal: normal,
          }
          wallArr = [...wallArr, newWalls]

        }
      }
      setVertices(verticesArr);
      setWalls(wallArr);
    }

    let doorsArr = []
    if (predictionDoor && predictionDoor.length) {
      // const doorsRequired = adjustDoorsWindowsToFitWalls(predictionDoor, predictWall);
      const predictionDoorTest = [predictionDoor[4]]
      const wallsTest = [wallArr[3]]
      const doorsRequired = adjustPredictedDoorsToWalls({
        // doors: predictionDoorTest,
        // walls: wallsTest,
        doors: predictionDoor,
        walls: wallArr,
        snapRadius: SNAP_DISTANCE, // hoặc tùy chỉnh khoảng cách snap
        existingDoors: [] // nếu muốn tránh đè lên cửa có sẵn
      });
      console.log("doorsRequired", doorsRequired)
      if (doorsRequired && doorsRequired.length) {
        for (let i = 0; i < doorsRequired.length; i++) {
          const p = doorsRequired[i]
          const doorOrigin = p.dataOrigin
          const x_start = p.x - p.width / 2;
          const y_start = p.y - p.height / 2;
          const x_start_offset = x_start + offsetXGrid;
          const x_end_offset = x_start + p.width + offsetXGrid;
          const y_start_offset = y_start + offsetYGrid;
          const y_end_offset = y_start + p.height + offsetYGrid;

          const { center, angleDeg, v1, v2 } = getWallVerticesAndCenterAndAngleFromBox(doorOrigin.polygon);
          const v1_vertice = _.merge(v1, {
            id: uuidv4() + Math.random(),
            x: v1.x,
            y: v1.y,
          })
          const v2_vertice = _.merge(v2, {
            id: uuidv4() + Math.random(),
            x: v2.x,
            y: v2.y,
          })
          // verticesArr = [...verticesArr, v1_vertice, v2_vertice]
          // setVertices(verticesArr);

          const doorData = {
            id: uuidv4(),
            wallId: p.wallId,
            x: v1_vertice.x,
            y: v2_vertice.y,
            angle: angleDeg,
            center: center,
            height: 1.8 * unitMToPixelCanvas,
            type: "door",
            rect: {
              x: v1_vertice.x,
              y: v2_vertice.y,
              width: p.width,
              height: p.height,
            },
            // outerPolygon: doorOrigin.polygon,
            // innerPolygon: doorOrigin.polygon,
            outerPolygon: p.outerPolygon,
            innerPolygon: p.innerPolygon,
          };
          doorsArr = [...doorsArr, doorData]
        }

      }
      console.log("doorsArr=", doorsArr)
      setDoors(doorsArr);
    }
    let windowsArr = []
    if (predictionWindow && predictionWindow.length) {
      const windowRequired = adjustPredictedDoorsToWalls({
        doors: predictionWindow,
        walls: wallArr,
        snapRadius: SNAP_DISTANCE, // hoặc tùy chỉnh khoảng cách snap
        existingDoors: [] // nếu muốn tránh đè lên cửa có sẵn
      });
      if (windowRequired && windowRequired.length) {
        for (let i = 0; i < windowRequired.length; i++) {
          const p = windowRequired[i]
          const windowOrigin = p.dataOrigin

          const { center, angleDeg, v1, v2 } = getWallVerticesAndCenterAndAngleFromBox(windowOrigin.polygon);

          const v1_vertice = _.merge(v1, {
            id: uuidv4() + Math.random(),
            x: v1.x,
            y: v1.y,
          })
          const v2_vertice = _.merge(v2, {
            id: uuidv4() + Math.random(),
            x: v2.x,
            y: v2.y,
          })
          const windowdata = {
            id: uuidv4(),
            wallId: p.wallId,
            x: v1_vertice.x,
            y: v2_vertice.y,
            angle: angleDeg,
            center: center,
            height: 1.2 * unitMToPixelCanvas,
            offsetY: 1 * unitMToPixelCanvas,
            type: "window",
            rect: {
              x: v1_vertice.x,
              y: v2_vertice.y,
              width: p.width,
              height: p.height,
            },
            outerPolygon: p.outerPolygon,
            innerPolygon: p.innerPolygon,
          };
          windowsArr = [...windowsArr, windowdata]

        }

      }
      // console.log("windowsArr=", windowsArr)
      setWindows(windowsArr);
    }
  }
  async function detectWallDoor() {
    const file = base64ImgDetect.file;
    const modelName = modelSelected
    if (!modelName || !file) return
    let versionModel = 1;
    if (modelName == 'wall-detection-xi9ox') {
      versionModel = 2
    }
    if (modelName == 'floor-plan-walls') {
      versionModel = 5
    }
    if (modelName == 'wall-window-door-detection-zltye') {
      versionModel = 3
    }
    if (modelName == 'floor-plan-walls-wlx1j') {
      versionModel = 2
    }


    try {
      const formData = new FormData();
      formData.append('image', file); // 'image' là tên field backend mong đợi
      formData.append('modelVersion', versionModel); // 'image' là tên field backend mong đợi
      formData.append('modelName', modelName); // 'image' là tên field backend mong đợi
      formData.append('confidenceThreshold', confidenceThreshold); // 'image' là tên field backend mong đợi
      formData.append('overlapThreshold', overlapThreshold); // 'image' là tên field backend mong đợi
      const response = await fetch('http://127.0.0.1:8000/detect-wall-door', {
        method: 'POST',
        body: formData,
      });
      const responseFM = await response.json();
      // console.log("responseFM=", responseFM)
      if (responseFM && responseFM.data) {
        setdetectedRes(responseFM.data)
      }
    } catch { }

  }


  return (
    <>
      {showFormDetect ? (
        <Rnd
          default={{
            x: 120,
            y: 10,
            width: '748px',
            height: '600px',
          }}
          minWidth={200}
          minHeight={200}
          bounds="window"
          style={{
            background: '#ccc',
            border: '1px solid #999',
            padding: 0,
            overflow: 'hidden',
            zIndex: 10,
          }}
          dragHandleClassName="drag-handle"
        >

          <div className="hidden">
            <input className="hidden" type="file" ref={refselectImgDetect} onInput={handleSelectImgDetect} />
          </div>
          <div className="fixed left-[0px] top-[0px] z-[9]">

            <div className="absolute top-[0px] left-[0px] border p-4 bg-[white]">
              <button className='!p-0 cursor-move drag-handle absolute top-0 left-0'><RiDragMove2Fill size={20} /></button>
              <div className='flex items-center'>
                <Button size='small' variant="contained" onClick={() => { refselectImgDetect.current?.click() }}>Chọn Ảnh</Button>
                <input className="hidden" type="file" ref={refselectImgDetect} onInput={handleSelectImgDetect} />
                <FormControl fullWidth className="ml-2 max-w-[150px]" size="small">
                  <InputLabel id="demo-simple-select-label">Model</InputLabel>
                  <Select
                    labelId="demo-simple-select-label"
                    id="demo-simple-select"
                    value={modelSelected}
                    label="Model"
                    onChange={(e) => { setmodelSelected(e.target.value) }}
                    MenuProps={{
                      container: () => document.body,
                    }}
                  >
                    <MenuItem value=''></MenuItem>
                    {modelNameYolo.map((name) => (
                      <MenuItem key={name} value={name}>
                        {name}
                      </MenuItem>
                    ))}

                  </Select>
                </FormControl>
                <Button size='small' variant="contained" onClick={detectWallDoor}>Detection</Button>
                <Button size='small' variant="contained" onClick={updateDataHouse}>Update House</Button>
                <div>
                  <FormControlLabel
                    control={<Checkbox checked={showRuler}
                      onChange={(e) => setshowRuler(e.target.checked)} />}
                    label="Show Ruler:"
                    labelPlacement="start" // ← Label nằm bên trái
                  />
                </div>
              </div>
              <div className="flex items-start justify-between">
                <div className="relative predict-img min-w-[500px] h-[500px] border mr-4 p-2">
                  {/* <img src={base64ImgDetect?.imgbase64} /> */}
                  {/* <canvas className="absolute top-0 left-0 z-[1]" ref={canvasbase64ImgDetect} width="500" height="500" /> */}
                  {/* Canvas thước đo tương tác */}
                  <Stage width={500} height={500} className="absolute top-0 left-0 z-[1]">
                    <Layer>
                      {konvaImage && showImgDetect && (
                        <Image image={konvaImage} width={500} height={500} />
                      )}

                      {/* Boxes */}
                    </Layer>
                    {drawPredictionsCanvasConverted()}
                  </Stage>

                </div>
                <div className="predict-container-1 border  p-2">
                  <div className="predict-container-param1">
                    <label>Confidence Threshold:</label> <br />
                    <Slider
                      valueLabelDisplay="on"
                      aria-label="Temperature"
                      defaultValue={30}
                      value={confidenceThreshold}
                      onChange={(e, newVal) => { setconfidenceThreshold(newVal) }}
                      // getAriaValueText={valuetext}
                      color="secondary"
                    />
                  </div>
                  <div className="predict-container-param2">
                    <label>Overlap Threshold:</label> <br />
                    <Slider
                      valueLabelDisplay="on"
                      aria-label="Temperature"
                      defaultValue={30}
                      value={overlapThreshold}
                      onChange={(e, newVal) => { setoverlapThreshold(newVal) }}
                      // getAriaValueText={valuetext}
                      color="secondary"
                    />
                  </div>
                  <div>
                    <FormControlLabel
                      control={<Checkbox checked={showImgDetect}
                        onChange={(e) => setshowImgDetect(e.target.checked)} />}
                      label="Show Image:"
                      labelPlacement="start" // ← Label nằm bên trái
                    />
                  </div>
                  <FormControl fullWidth className="ml-2 max-w-[150px]" size="small">
                    <InputLabel id="demo-simple-select-label">Mode show</InputLabel>
                    <Select
                      labelId="demo-simple-select-label"
                      id="demo-simple-select"
                      value={modeShowCanvasDetect}
                      label="Model"
                      onChange={(e) => { setmodeShowCanvasDetect(e.target.value) }}
                    >
                      <MenuItem value='Draw Confidence'>Draw Confidence</MenuItem>
                      <MenuItem value='Draw Labels'>Draw Labels</MenuItem>
                      <MenuItem value='Draw Boxes'>Draw Boxes</MenuItem>
                      <MenuItem value='Censor Predictions'>Censor Predictions</MenuItem>

                    </Select>
                  </FormControl>


                  <div className="predict-container-response mt-4">
                    <TextareaAutosize
                      className="!boder p-2"
                      aria-label="minimum height"
                      minRows={5}
                      maxRows={12}
                      placeholder=""
                      value={detectedRes && detectedRes.predictions ? JSON.stringify(detectedRes?.predictions) : ''}
                      style={{
                        maxWidth: 200,
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        padding: '8px',
                        outline: 'none',
                        fontFamily: 'inherit',
                        fontSize: '14px',
                        whiteSpace: 'pre-wrap', // giữ định dạng xuống dòng
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Rnd>
      ) : ''}
    </>
  );
};

export default InitComponent;