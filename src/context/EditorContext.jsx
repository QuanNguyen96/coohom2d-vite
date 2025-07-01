import React, { createContext, useContext, useState } from 'react';

const EditorContext = createContext();

export const EditorProvider = ({ children }) => {
  const [mode, setMode] = useState(null); // wall | door | null
  const [walls, setWalls] = useState([]);
  const [doors, setDoors] = useState([]);
  const [selectedWall, setSelectedWall] = useState(null); // 👈 THÊM DÒNG NÀY
  const [vertices, setVertices] = useState([]); // ✅ Thêm dòng này
  const [wallChange, setWallChange] = useState([]); // ✅ Thêm dòng này
  const [gridLayout3d, setGridLayout3d] = useState([1000,1000]); // ✅ Thêm dòng này

  return (
    <EditorContext.Provider
      value={{
        mode,
        setMode,
        walls,
        setWalls,
        doors,
        setDoors,
        selectedWall,      // 👈 THÊM DÒNG NÀY
        setSelectedWall,    // 👈 THÊM DÒNG NÀY
        vertices, setVertices,  // ✅ Thêm dòng này
        wallChange, setWallChange,
        gridLayout3d, setGridLayout3d
      }}
    >
      {children}
    </EditorContext.Provider>
  );
};

export const useEditor = () => useContext(EditorContext);
