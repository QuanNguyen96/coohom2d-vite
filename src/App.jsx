import React from 'react';
import LeftToolbar from './components/LeftToolbar';
import CanvasGrid2d from './components/floorplan2d/CanvasGrid2d';
import { EditorProvider } from './context/EditorContext';
import WallSettingsPanel from './components/WallSettingsPanel';
import Layout3d from './components/floorplan3d/Layout3d';
import DetectFloorPlan from './components/floorplan2d/detectFloorPlan';

function App() {
  return (
    <EditorProvider>
      <div style={{ display: 'flex', height: '100vh' }}>
        <DetectFloorPlan />
        <LeftToolbar />
        <CanvasGrid2d />
        <WallSettingsPanel />
        <Layout3d />
      </div>
    </EditorProvider>
  );
}

export default App;

