import { Rnd } from 'react-rnd';
import _ from 'lodash'
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
  const [overlapThreshold, setoverlapThreshold] = useState(50);
  const [modelSelected, setmodelSelected] = useState('wall-window-door-detection');
  const canvasbase64ImgDetect = useRef()



  // -------------------------watch-------------------------------------------
  useEffect(() => {
    if (!base64ImgDetect?.imgbase64) return;

    const canvas = canvasbase64ImgDetect.current;
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      // Set canvas size = container (hoặc ảnh gốc nếu không giới hạn)
      const fixedHeight = 500;
      const scale = fixedHeight / img.height;
      const scaledWidth = img.width * scale;

      canvas.width = scaledWidth;
      canvas.height = fixedHeight;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (showImgDetect) {
        ctx.drawImage(img, 0, 0, scaledWidth, fixedHeight);
      }
      const predictions = detectedRes?.predictions.filter(item => item.confidence != null && item.confidence >= confidenceThreshold / 100)
      // Vẽ box
      if (predictions && predictions.length) {
        predictions.forEach((p) => {
          // const x = (p.x - p.width / 2) * scale;
          // const y = (p.y - p.height / 2) * scale;
          // const boxW = p.width * scale;
          // const boxH = p.height * scale;

          // // Vẽ khung box
          // ctx.strokeStyle = "red";
          // ctx.lineWidth = 2;
          // ctx.strokeRect(x, y, boxW, boxH);

          // // Vẽ nhãn
          // const label = `${p.class || p.name || "label"} (${Math.round(p.confidence * 100)}%)`;
          // ctx.fillStyle = "red";
          // ctx.font = "14px Arial";
          // ctx.fillText(label, x + 4, y - 6);

          const x = (p.x - p.width / 2) * scale;
          const y = (p.y - p.height / 2) * scale;
          const boxW = p.width * scale;
          const boxH = p.height * scale;
          if (modeShowCanvasDetect !== 'Censor Predictions') {
            // VẼ BOX luôn cho cả 3 mode còn lại
            if (p.class == 'door') {
              ctx.strokeStyle = "green";
            } else {
              ctx.strokeStyle = "red";
            }

            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, boxW, boxH);
          }

          if (modeShowCanvasDetect === 'Draw Labels') {
            const label = `${p.class || p.name || "label"} ${Math.round(p.confidence * 100)}%`;
            ctx.fillStyle = "blue";
            ctx.font = "14px Arial";
            ctx.fillText(label, x + 4, y - 6);
          }

          if (modeShowCanvasDetect === 'Draw Confidence') {
            const confidence = `${Math.round(p.confidence * 100)}%`;
            ctx.fillStyle = "blue";
            ctx.font = "14px Arial";
            ctx.fillText(confidence, x + 4, y + boxH + 14);
          }

          if (modeShowCanvasDetect === 'Censor Predictions') {
            ctx.fillStyle = "#add123";
            ctx.fillRect(x, y, boxW, boxH);
          }
        });
      }

    };

    img.src = base64ImgDetect.imgbase64;
  }, [base64ImgDetect, detectedRes, confidenceThreshold, modeShowCanvasDetect, showImgDetect]);

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
  function getWallVerticesAndCenterAndAngleFromBox(polygon) {
    if (!polygon || polygon.length !== 4) return null;

    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

    const edges = [
      [polygon[0], polygon[1]],
      [polygon[1], polygon[2]],
      [polygon[2], polygon[3]],
      [polygon[3], polygon[0]],
    ];

    // Tìm cạnh dài nhất
    const [v1, v2] = edges.reduce((longest, current) =>
      dist(...current) > dist(...longest) ? current : longest
    );

    const center = {
      x: (v1.x + v2.x) / 2,
      y: (v1.y + v2.y) / 2,
    };

    const dx = v2.x - v1.x;
    const dy = v2.y - v1.y;
    const angleRad = Math.atan2(dy, dx);
    const angleDeg = 360 - (angleRad * 180) / Math.PI;

    return { center, angleDeg, v1, v2 };
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
      console.log("door=", door)
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
      console.log("voi door=", doorPoly)
      let bestWall = null;

      for (const wall of walls) {
        const v1 = getVertexById(wall.startId);
        const v2 = getVertexById(wall.endId);
        if (!v1 || !v2) continue;

        const wallPoly = wallToPolygon(v1, v2, wall.thickness ?? 10);
        const overlap = isPolygonOverlap(doorPoly, wallPoly);
        console.log(`voi wall=${wall.startId} overlap=${overlap}`)

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

    doors.forEach((door, idx) => {
      const dx1 = door.x;
      const dx2 = door.x + door.width;
      const dy1 = door.y;
      const dy2 = door.y + door.height;

      let bestIoU = 0;
      let bestWall = null;

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
        const wallIsHorizontal = bestWall.width >= bestWall.height;
        const adjustedDoor = { ...door };
        console.log("bestWall", bestWall)
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
      const predictions_tem = predictions.map(p => {
        const x_start = p.x - p.width / 2;
        const y_start = p.y - p.height / 2;
        const x_start_offset = x_start + offsetXGrid;
        const x_end_offset = x_start + p.width + offsetXGrid;
        const y_start_offset = y_start + offsetYGrid;
        const y_end_offset = y_start + p.height + offsetYGrid;

        let dataT = {
          ...p,
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
          const [v1, v2] = getWallVerticesFromBox(predictWall[i].polygon);
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
          setVertices(verticesArr);
          let wallId = uuidv4();
          predictWall[i].id = wallId;
          const newWalls = {
            id: wallId,
            startId: v1_vertice.id,
            endId: v2_vertice.id,
            thickness: WALL_WIDTH,
            height: 2.4 * unitMToPixelCanvas,
            type: "wall",
            name: "Wall",
          }
          wallArr = [...wallArr, newWalls]
          setWalls(wallArr);
        }
      }
    }
    // if (predictionDoor && predictionDoor.length) {
    //   // let verticesArr = []
    //   // let wallArr = []
    //   for (let i = 0; i < predictionDoor.length; i++) {
    //     // if (predictionDoor[i].polygon && predictionDoor[i].polygon.length && predictionDoor[i].polygon.length >= 3) {
    //     //   const [v1, v2] = getWallVerticesFromBox(predictionDoor[i].polygon);
    //     //   const v1_vertice = _.merge(v1, {
    //     //     id: uuidv4() + Math.random(),
    //     //     x: v1.x,
    //     //     y: v1.y,
    //     //   })
    //     //   const doorData = {
    //     //     id: uuidv4(),
    //     //     wallId: snapInfo.wallId,
    //     //     x: snapInfo.x,
    //     //     y: snapInfo.y,
    //     //     angle: snapInfo.angle,
    //     //     center,
    //     //     height: 1.8 * unitMToPixelCanvas,
    //     //     // height: 1 * unitMToPixelCanvas,
    //     //     type: "door",
    //     //     rect: {
    //     //       x: snapInfo.x,
    //     //       y: snapInfo.y,
    //     //       width: doorLength,
    //     //       height: doorHeight,
    //     //     },
    //     //     outerPolygon,
    //     //     innerPolygon,
    //     //   };
    //     // }
    //   }
    //   console.log("predictionDoor=", predictionDoor)
    //   console.log("wallArr[0]=", wallArr[0])
    //   // const validDoors = filterValidDetectedDoorsOptimized(
    //   //   {
    //   //     detectedDoors: predictionDoor ?? [],
    //   //     walls: wallArr,
    //   //     vertices,
    //   //     existingDoors: [],
    //   //     existingWindows: [],
    //   //     snapRadius: SNAP_DISTANCE,
    //   //     config: DOOR_CONFIG,
    //   //   }
    //   // );

    //   const validDoors = filterValidDetectedDoorsOptimized({
    //     detectedDoors: predictionDoor ?? [],
    //     walls: wallArr,                   // danh sách tường hiện có
    //     vertices,                         // danh sách đỉnh của tường
    //     existingDoors: [],                // nếu chưa có cửa, bạn để mảng rỗng
    //     existingWindows: [],              // tương tự với cửa sổ
    //     snapRadius: SNAP_DISTANCE,        // bán kính snap (ví dụ 50)
    //     config: DOOR_CONFIG,              // cấu hình cửa
    //   });

    //   console.log("validDoors=", validDoors)
    // }
    let doorsArr = []
    if (predictionDoor && predictionDoor.length) {
      const doorsRequired = adjustDoorsWindowsToFitWalls(predictionDoor, predictWall);
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

          let outerPolygon = [
            { x: x_start_offset, y: y_start_offset },         // top-left
            { x: x_start_offset, y: y_end_offset },        // top-right
            { x: x_end_offset, y: y_end_offset },        // bottom-right
            { x: x_end_offset, y: y_start_offset },         // bottom-left
          ]
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
            outerPolygon: doorOrigin.polygon,
            innerPolygon: doorOrigin.polygon,
          };
          doorsArr = [...doorsArr, doorData]

        }

      }
      console.log("doorsArr=", doorsArr)
      setDoors(doorsArr);
    }
    let windowsArr = []
    if (predictionWindow && predictionWindow.length) {
      const doorsRequired = adjustDoorsWindowsToFitWalls(predictionWindow, predictWall);
      if (doorsRequired && doorsRequired.length) {
        for (let i = 0; i < doorsRequired.length; i++) {
          const p = doorsRequired[i]
          const windowOrigin = p.dataOrigin
          const x_start = p.x - p.width / 2;
          const y_start = p.y - p.height / 2;
          const x_start_offset = x_start + offsetXGrid;
          const x_end_offset = x_start + p.width + offsetXGrid;
          const y_start_offset = y_start + offsetYGrid;
          const y_end_offset = y_start + p.height + offsetYGrid;

          let outerPolygon = [
            { x: x_start_offset, y: y_start_offset },         // top-left
            { x: x_start_offset, y: y_end_offset },        // top-right
            { x: x_end_offset, y: y_end_offset },        // bottom-right
            { x: x_end_offset, y: y_start_offset },         // bottom-left
          ]
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
          // verticesArr = [...verticesArr, v1_vertice, v2_vertice]
          // setVertices(verticesArr);

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
            outerPolygon: windowOrigin.polygon,
            innerPolygon: windowOrigin.polygon,
          };
          windowsArr = [...windowsArr, windowdata]

        }

      }
      console.log("windowsArr=", windowsArr)
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
      console.log("responseFM=", responseFM)
      if (responseFM && responseFM.data) {
        setdetectedRes(responseFM.data)
      }
    } catch { }

  }
  const [age, setage] = useState(10)
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
              </div>
              <div className="flex items-start justify-between">
                <div className="predict-img min-w-[500px] h-[500px] border mr-4 p-2">
                  {/* <img src={base64ImgDetect?.imgbase64} /> */}
                  <canvas ref={canvasbase64ImgDetect} width="500" height="500" className="" />
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