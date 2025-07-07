import React, { createContext, useContext, useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
const EditorContext = createContext();

export const EditorProvider = ({ children }) => {
  const [mode, setMode] = useState(null); // wall | door | null
  const [walls, setWalls] = useState([]);
  const [doors, setDoors] = useState([]);
  const [windows, setWindows] = useState([]);
  const [selectedWall, setSelectedWall] = useState(null); // 👈 THÊM DÒNG NÀY
  const [vertices, setVertices] = useState([]); // ✅ Thêm dòng này
  const [wallChange, setWallChange] = useState([]); // ✅ Thêm dòng này
  const [gridLayout3d, setGridLayout3d] = useState([1000, 1000]); // ✅ Thêm dòng này
  // trong lưới 1 ô nhỏ đang là 30*30 (đơn vị threejs)
  // trên cohom 1 ô là 0.5m=50cm nên tạm quy  định 1 đơn vị three = 600/30=2mm
  const [unitThreeToMM, setUnitThreeToMM] = useState(2)
  // 100 px = 1 mét = 1000mm
  const [unitMToPixelCanvas, setUnitMToPixelCanvas] = useState(100)
  const modelThreeCommonRef = useRef({});
  const [showFormDetect, setshowFormDetect] = useState(true)
  const canvasLayout2dRef = useRef()
  const [pixelPerMeter, setPixelPerMeter] = useState(100);

  return (
    <EditorContext.Provider
      value={{
        mode,
        setMode,
        walls,
        setWalls,
        doors,
        setDoors,
        windows, setWindows,
        selectedWall,      // 👈 THÊM DÒNG NÀY
        setSelectedWall,    // 👈 THÊM DÒNG NÀY
        vertices, setVertices,  // ✅ Thêm dòng này
        wallChange, setWallChange,
        gridLayout3d, setGridLayout3d,
        unitThreeToMM, setUnitThreeToMM,
        unitMToPixelCanvas, setUnitMToPixelCanvas,
        modelThreeCommonRef,
        showFormDetect, setshowFormDetect,
        canvasLayout2dRef,
        pixelPerMeter, setPixelPerMeter,

      }}
    >
      {children}
    </EditorContext.Provider>
  );
};

export const useEditor = () => useContext(EditorContext);
