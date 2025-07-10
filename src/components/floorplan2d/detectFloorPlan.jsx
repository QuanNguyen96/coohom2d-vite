import { useSelector, useDispatch } from 'react-redux'
import { storeSliceActions as detectImg2dAction } from '../../store/floorplan2d/detectImg2d'
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
import { Stage, Layer, Rect, Group, Circle, Text, Image, Transformer } from "react-konva";
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
  const dispatch = useDispatch()
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
    pixelImgDetectPerMeter, setPixelImgDetectPerMeter,
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
  const canvasDetectImg = useRef()
  const canvasbase64ImgDetect = useRef()
  const [konvaImage] = useImage(base64ImgDetect?.imgbase64 || '', 'anonymous');
  const [scaleImgToCanvas, setScaleImgToCanvas] = useState(0.01);
  const RULER_DEFAULT = {
    x: 100,
    y: 100,
    rotation: 0,
    lengthPx: 200,
    height: 20,
    label: `${2 ? (2 * 100 * 0.01).toFixed(2) : 0}`
  }
  const [rulerKonva, setRulerKonva] = useState(RULER_DEFAULT);



  // -------------------------watch-------------------------------------------
  useEffect(() => {
  }, [rulerKonva])

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

  function getWallVerticesAndCenterAndAngleFromBox(polygonOrigin) {
    const polygon = _.cloneDeep(polygonOrigin)
    if (!polygon || polygon.length !== 4) return null;

    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

    // Cạnh đối: [0-1] và [2-3], hoặc [1-2] và [3-0]
    const mid01 = {
      x: (polygon[0].x + polygon[1].x) / 2,
      y: (polygon[0].y + polygon[1].y) / 2,
    };
    const mid23 = {
      x: (polygon[2].x + polygon[3].x) / 2,
      y: (polygon[2].y + polygon[3].y) / 2,
    };

    const mid12 = {
      x: (polygon[1].x + polygon[2].x) / 2,
      y: (polygon[1].y + polygon[2].y) / 2,
    };
    const mid30 = {
      x: (polygon[3].x + polygon[0].x) / 2,
      y: (polygon[3].y + polygon[0].y) / 2,
    };

    const len1 = dist(mid01, mid23);
    const len2 = dist(mid12, mid30);

    let v1, v2;
    if (len1 >= len2) {
      v1 = mid01;
      v2 = mid23;
    } else {
      v1 = mid12;
      v2 = mid30;
    }

    const center = {
      x: (v1.x + v2.x) / 2,
      y: (v1.y + v2.y) / 2,
    };

    const dx = v2.x - v1.x;
    const dy = v2.y - v1.y;
    const length = Math.hypot(dx, dy);
    const angleRad = Math.atan2(dy, dx);
    const angleDeg = 360 - (angleRad * 180) / Math.PI;

    const nx = -dy / length;
    const ny = dx / length;

    // Tính thickness bằng khoảng cách giữa 2 cạnh đối vuông góc với v1–v2
    const thickness = Math.abs(
      (polygon[0].x - polygon[2].x) * nx + (polygon[0].y - polygon[2].y) * ny
    );

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
  const getVertexById = (id) => vertices.find((v) => v.id === id);



  function getPolygonCenter(polygon) {
    const sum = polygon.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / polygon.length, y: sum.y / polygon.length };
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
    const originalThickness = doorInfo.thickness;
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
    if (!doorInfo2) return door;
    const thicknessDoorNow = doorInfo2.thickness;

    if (thicknessDoorNow > thickness) {
      const ratio = thickness / originalThickness; // so với độ dày cửa gốc
      const center = doorInfo2.center;

      innerPolygon = innerPolygon.map(p => {
        const dx = p.x - center.x;
        const dy = p.y - center.y;

        const proj = dx * normal.x + dy * normal.y;
        const tangent = dx * wallDir.x + dy * wallDir.y;

        const scaledProj = proj * ratio;

        return {
          x: center.x + wallDir.x * tangent + normal.x * scaledProj,
          y: center.y + wallDir.y * tangent + normal.y * scaledProj,
        };
      });
    }

    // outerPolygon đúng hướng cửa sau khi đã xoay
    const outerPolygon = makeDoorOuterPolygonFromV1V2(
      doorInfo2.v1,
      doorInfo2.v2,
      normal,
      thickness
    );

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
    for (const door of predictedDoor) {
      let targetWall = null;
      let wallInfo = null;
      let minDist = Infinity;
      for (const wall of wallArr) {
        const intersects = polygonsIntersect(door.polygon, wall.polygon);

        if (!intersects) continue;
        const snap = getSnapPointToWall(door, wall, snapRadius);
        if (!snap) continue; // không đủ gần thì bỏ qua luôn
        // ✅ Nếu có giao thì chọn (ưu tiên cái gần nhất)
        // if (snap.distance < minDist) {
        //   minDist = snap.distance;
        //   targetWall = wall;
        //   wallInfo = snap;
        // }
        minDist = snap.distance;
        targetWall = wall;
        wallInfo = snap;
        if (targetWall) {
          break;
        }
      }

      if (!targetWall || !wallInfo) continue;

      // 3. Biến đổi cửa để trùng hướng tường, đặt tại vị trí snap
      let newDoor = transformDoorToWall(_.cloneDeep(door), _.cloneDeep(wallInfo));

      // // 4. Kiểm tra cửa có nằm trong polygon tường theo chiều dài (bỏ qua độ dày)
      // if (!isPolygonInsideWithoutThickness(newDoor.polygon, targetWall.polygon)) continue;


      // // 5. Kiểm tra cửa không chạm cửa đã đặt
      // if (intersectsAny(newDoor.polygon, validDoors.map(d => d.polygon))) continue;

      // // 6. Gán thông tin và thêm vào validDoors


      newDoor.wallId = targetWall.id;
      newDoor.dataOrigin = door
      validDoors.push(newDoor);
    }

    return validDoors;
  }

  useEffect(() => {
    // console.log("✅ vertices cập nhật xong:", vertices);

  }, [vertices]);
  async function updateDataHouse() {
    const unitPixelToThreeT = unitMToPixelCanvas * pixelImgDetectPerMeter;
    const detectedResTemp = _.cloneDeep(detectedRes)
    const predictions = detectedResTemp?.predictions.filter(item => {

      item.x = Math.ceil(item.x * unitPixelToThreeT);
      item.y = Math.ceil(item.y * unitPixelToThreeT);
      item.width = Math.ceil(item.width * unitPixelToThreeT);
      item.height = Math.ceil(item.height * unitPixelToThreeT);
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
      const predictionDoorTest = [predictionDoor[0]]
      const wallsTest = [wallArr[3]]
      const doorsRequired = adjustPredictedDoorsToWalls({
        // doors: predictionDoorTest,
        // walls: wallsTest,
        doors: predictionDoor,
        walls: wallArr,
        snapRadius: SNAP_DISTANCE, // hoặc tùy chỉnh khoảng cách snap
        existingDoors: [] // nếu muốn tránh đè lên cửa có sẵn
      });
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
      setWindows(windowsArr);
    }
    console.log("clickclickUploadImageDetect")
    dispatch(detectImg2dAction.UPDATE_CLICK_UPDATE_FLOORPLAN_2d()); // ← phải có ()
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
      if (responseFM && responseFM.data) {
        setdetectedRes(responseFM.data)
      }
    } catch { }

  }
  useEffect(() => {
    let scale = 1
    try {
      if (konvaImage) {
        const fixedHeight = 500;
        const imgHeight = konvaImage?.naturalHeight || 1;
        const imgWidth = konvaImage?.naturalWidth || 1;
        scale = fixedHeight / imgHeight;
      }
    } catch { }
    setScaleImgToCanvas(scale)
    setRulerKonva((prev) => ({
      ...prev,
      lengthPx: 200,
      label: `${(200 * pixelImgDetectPerMeter * (1 / scale)).toFixed(2)}`,
    }));
  }, [konvaImage])
  const imgDetect = () => {
    if (konvaImage && showImgDetect) {
      const fixedHeight = 500;
      const imgHeight = konvaImage?.naturalHeight || 1;
      const imgWidth = konvaImage?.naturalWidth || 1;
      const scale = fixedHeight / imgHeight;
      const scaledWidth = imgWidth * scale;
      // const fixedHeight = imgHeight * scale;
      return (<Image
        image={konvaImage}
        width={scaledWidth}
        height={fixedHeight}
      />)

    }
    return
  }


  function RulerKonvaTransformer({ ruler, setRuler, stageRef }) {
    const groupRef = useRef();
    const rectRef = useRef();
    const textRef = useRef();
    const trRef = useRef();
    const [selected, setSelected] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [editingText, setEditingText] = useState(false);

    useEffect(() => {
      if (trRef.current && groupRef.current) {
        trRef.current.nodes([groupRef.current]);
        trRef.current.getLayer()?.batchDraw();
      }
    }, [ruler]);
    useEffect(() => {
      if (selected && trRef.current && groupRef.current) {
        trRef.current.nodes([groupRef.current]);
        trRef.current.getLayer()?.batchDraw();
      }
    }, [selected]);

    const handleEditText = () => {
      if (!stageRef?.current || !textRef?.current) return;

      setEditingText(true);
      textRef.current.hide();
      trRef.current.hide();

      const textPos = textRef.current.getAbsolutePosition();
      const stageBox = stageRef.current.container().getBoundingClientRect();

      const areaPosition = {
        x: stageBox.left + textPos.x,
        y: stageBox.top + textPos.y,
      };

      const textarea = document.createElement('input');
      textarea.type = 'number';
      textarea.step = '0.01';
      document.body.appendChild(textarea);

      textarea.value = ruler.label || '';
      textarea.style.position = 'absolute';
      textarea.style.top = areaPosition.y + 'px';
      textarea.style.left = areaPosition.x + 'px';
      textarea.style.width = textRef.current.width() + 'px';
      textarea.style.height = textRef.current.height() + 'px';
      textarea.style.fontSize = textRef.current.fontSize() + 'px';
      textarea.style.border = '1px solid #ccc';
      textarea.style.padding = '2px';
      textarea.style.background = 'white';
      textarea.style.outline = 'none';
      textarea.style.resize = 'none';
      textarea.style.lineHeight = textRef.current.lineHeight();
      textarea.style.fontFamily = textRef.current.fontFamily();
      textarea.style.zIndex = 1000;

      textarea.focus();

      const removeTextarea = () => {
        let pixelToM = 0.01;
        try {
          const lenghInputT = textarea && textarea.value ? Number(textarea.value) : 200 * pixelImgDetectPerMeter;
          const lengthPxT = ruler && ruler.lengthPx ? Number(ruler.lengthPx) * (1 / scaleImgToCanvas) : 200 * (1 / scaleImgToCanvas);
          pixelToM = lenghInputT / lengthPxT
        } catch { }

        setPixelImgDetectPerMeter(pixelToM)
        setRuler((prev) => ({
          ...prev,
          label: textarea.value,
        }));

        if (document.body.contains(textarea)) {
          document.body.removeChild(textarea);
        }
        try {
          textRef.current.show();
          trRef.current.show();
          textRef.current.getLayer()?.batchDraw();
        } catch { }
        setEditingText(false);
      };

      textarea.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          removeTextarea();
        } else if (e.key === 'Escape') {
          if (document.body.contains(textarea)) {
            document.body.removeChild(textarea);
          }
          try {
            textRef.current.show();
            trRef.current.show();
            textRef.current.getLayer()?.batchDraw();
          } catch { }
          setEditingText(false);
        }
      });

      setTimeout(() => {
        window.addEventListener('click', function handleOutsideClick(e) {
          if (e.target !== textarea) {
            removeTextarea();
            window.removeEventListener('click', handleOutsideClick);
          }
        });
      });
    };

    return (
      <Layer>
        <Group
          ref={groupRef}
          x={ruler.x}
          y={ruler.y}
          rotation={ruler.rotation}
          draggable
          onMouseDown={(e) => {
            setIsDragging(false);
          }}
          onDragStart={() => {
            setIsDragging(true);
          }}
          onDragEnd={(e) => {
            setIsDragging(false);
            setRuler((prev) => ({
              ...prev,
              x: e.target.x(),
              y: e.target.y(),
            }));
          }}
          onClick={(e) => {
            if (!isDragging) {
              setSelected(true);
            }
          }}
          onTransformEnd={(e) => {
            const node = groupRef.current;
            const scaleX = node.scaleX();
            const rotation = node.rotation();
            const newX = node.x();
            const newY = node.y();

            const newLength = ruler.lengthPx * scaleX;

            node.scaleX(1);
            node.rotation(0);
            node.x(0);
            node.y(0);

            setRuler((prev) => ({
              ...prev,
              lengthPx: newLength,
              label: `${(newLength * pixelImgDetectPerMeter * (1 / scaleImgToCanvas)).toFixed(2)}`,
              rotation,
              x: newX,
              y: newY,
            }));
          }}
        >
          {/* 🟢 Thêm lại Rect và Text vào đây */}
          <Rect
            ref={rectRef}
            x={0}
            y={0}
            width={ruler.lengthPx}
            height={ruler.height}
            fill="#ddd"
            stroke="black"
          />
          <Text
            ref={textRef}
            text={`${ruler.label} m` || '0.00 m'}
            fontSize={16}
            fill="black"
            x={(ruler.lengthPx - 60) / 2}
            y={(ruler.height - 16) / 2}
            width={60}
            height={18}
            align="center"
            verticalAlign="middle"
            rotation={0}
            onDblClick={handleEditText}
          />
        </Group>




        {/* <Transformer
          ref={trRef}
          enabledAnchors={['middle-left', 'middle-right']}
          rotateEnabled
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 30) return oldBox;
            return newBox;
          }}
        /> */}
        {selected && (
          <Transformer
            ref={trRef}
            enabledAnchors={['middle-left', 'middle-right']}
            rotateEnabled
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 30) return oldBox;
              return newBox;
            }}
          />
        )}
      </Layer>
    );
  }
  function clickUploadImageDetect() {
    refselectImgDetect.current?.click();
    setScaleImgToCanvas(1);
    setRulerKonva(RULER_DEFAULT)
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
                <Button size='small' variant="contained" onClick={clickUploadImageDetect}>Chọn Ảnh</Button>
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
                  <Stage width={500} ref={canvasDetectImg} height={500} className="absolute top-0 left-0 z-[1]">
                    <Layer>
                      {imgDetect()}
                    </Layer>
                    {drawPredictionsCanvasConverted()}
                    {showRuler && (
                      <RulerKonvaTransformer
                        ruler={rulerKonva}
                        setRuler={setRulerKonva}
                        stageRef={canvasDetectImg}
                      />
                    )}

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