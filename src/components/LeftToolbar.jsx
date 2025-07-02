// === src/components/LeftToolbar.jsx ===
import React from 'react';
import { useEditor } from '../context/EditorContext';
// import { ReactComponent as DoorIcon } from '../assets/icons/icons8/noun-door-736133.svg?react'; // nhớ ?react nếu dùng vite-plugin-svgr

const buttonStyle = (active) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  padding: '10px',
  marginBottom: '10px',
  backgroundColor: active ? '#2ea3f2' : '#f0f0f0',
  color: active ? 'white' : 'black',
  border: '1px solid #ccc',
  borderRadius: '4px',
  cursor: 'pointer',
  fontWeight: active ? 'bold' : 'normal',
  transition: '0.2s',
});

const LeftToolbar = () => {
  const { mode, setMode } = useEditor();

  const toggleMode = (selectedMode) => {
    setMode(mode === selectedMode ? null : selectedMode);
  };

  return (
    <div style={{ width: '100px', padding: '10px', background: '#fff', border: '1px solid #ddd', borderRadius: '6px' }}>
      <button style={buttonStyle(mode === 'wall')} onClick={() => toggleMode('wall')}>
        Wall
      </button>
      <button style={buttonStyle(mode === 'door')} onClick={() => toggleMode('door')}>
        {/* <DoorIcon width={16} height={16} style={{ marginRight: '6px' }} /> */}
        Door
      </button>
      <button style={buttonStyle(mode === 'window')} onClick={() => toggleMode('window')}>
        {/* <DoorIcon width={16} height={16} style={{ marginRight: '6px' }} /> */}
        window
      </button>
    </div>
  );
};

export default LeftToolbar;
