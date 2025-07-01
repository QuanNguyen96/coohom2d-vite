import { Rnd } from 'react-rnd';
import _ from 'lodash';
import { CSG } from 'three-csg-ts';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { useEditor } from '../context/EditorContext';
import * as THREE from 'three';
import { useEffect, useState, useMemo, useRef } from 'react';
import { DoubleSide } from 'three';

function Box() {
  return (
    <mesh rotation={[0.4, 0.2, 0]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="orange" />
    </mesh>
  );
}


export default function ResizableMovableBox() {
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
    gridLayout3d, setGridLayout3d,
  } = useEditor();

  const cameraRef = useRef()
  const [positionGrid, setPositionGrid] = useState({ startX: 0, startZ: 0, endX: 500, endZ: 500 })

  function usePrevious(value) {
    const ref = useRef();
    useEffect(() => {
      ref.current = value;
    }, [value]);
    return ref.current;
  }
  const wallsRefOld = usePrevious(walls);
  useEffect(() => {
    console.log("wallsRefOld=", wallsRefOld)
  }, [wallsRefOld])
  useEffect(() => {
    try {
      if (!walls || !walls.length) return;
      let polygons = []
      let gridMinX = Infinity;
      let gridMaxX = -Infinity;
      let gridMinZ = Infinity;
      let gridMaxZ = -Infinity;
      console.log("wall", walls)
      let allPoints = []
      for (let i = 0; i < walls.length; i++) {
        if (walls[i].polygon && walls[i].polygon.length) {
          polygons = _.union(polygons, walls[i].polygon)
          allPoints = allPoints.concat(walls[i].polygon); // gom tất cả điểm lại thành 1 mảng phẳng
        }
      }
      gridMinX = _.minBy(allPoints, 'x')?.x ?? 0;
      gridMaxX = _.maxBy(allPoints, 'x')?.x ?? 0;
      gridMinZ = _.minBy(allPoints, 'y')?.y ?? 0;
      gridMaxZ = _.maxBy(allPoints, 'y')?.y ?? 0;
      if (gridMinX == Infinity || gridMaxX == -Infinity || gridMinZ == Infinity || gridMaxZ == -Infinity) return;
      console.log(`gridMinX=${gridMinX} gridMaxX=${gridMaxX} gridMinZ=${gridMinZ} gridMaxZ=${gridMaxZ}`)
      let gridSizeX = Math.abs(gridMinX - gridMaxX) + 20
      let gridSizeZ = Math.abs(gridMinZ - gridMaxZ) + 20
      gridSizeX = gridSizeX <= 500 ? 500 : gridSizeX
      gridSizeZ = gridSizeZ <= 500 ? 500 : gridSizeZ
      setGridLayout3d([gridSizeX, gridSizeZ])
      const startX = gridMinX - 10;
      let endX = gridMaxX + 10;
      endX = Math.abs(endX - startX) < 500 ? startX + 500 : endX
      const startZ = gridMinZ - 10;
      let endZ = gridMaxZ + 10;
      endZ = Math.abs(endZ - startZ) < 500 ? startZ + 500 : endZ
      setPositionGrid({ startX: startX, startZ: startZ, endX: endX, endZ: endZ })

      // console.log("bat dau tu diem", [startX, 100, startZ])
      // console.log("nhin vao diem", new THREE.Vector3(centerX, 0, centerZ))
      console.log("wallsRefOld=", wallsRefOld)
      if (walls && walls.length && (!wallsRefOld || !wallsRefOld.length) && cameraRef.current) {
        const camera = cameraRef.current
        const centerX = (startX + endX) / 2;
        const centerZ = (startZ + endZ) / 2;
        console.log("lan dau update camera vao day nhe")
        camera.position.set(endX, 100, endZ);
        camera.lookAt(new THREE.Vector3(centerX, 0, centerZ));
        camera.updateProjectionMatrix();
      }

    } catch { }
  }, [walls])

  function RectGrid({
    startX = 0,
    endX = 100,
    startZ = 0,
    endZ = 100,
    stepX = 10,
    stepZ = 10,
    color = '#888',
  }) {
    const lines = useMemo(() => {
      const geometry = new THREE.BufferGeometry();
      const positions = [];

      for (let z = startZ; z <= endZ; z += stepZ) {
        positions.push(startX, 0, z, endX, 0, z);
      }

      for (let x = startX; x <= endX; x += stepX) {
        positions.push(x, 0, startZ, x, 0, endZ);
      }

      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      return geometry;
    }, [startX, endX, startZ, endZ, stepX, stepZ]);

    return (
      <lineSegments geometry={lines}>
        <lineBasicMaterial color={color} />
      </lineSegments>
    );
  }

  const renderWallFunc = () => {
    if (!walls || !walls.length) return
    let objDoors = {}
    console.log("doors", doors)
    if (doors && doors.length) {
      for (let i = 0; i < doors.length; i++) {
        const door = doors[i]
        const shape = new THREE.Shape();

        const points = door.outerPolygon.map(p => ({
          x: p.x,
          y: -p.y, // 👈 đảo trục y để ra đúng Z trong Three.js
        }));

        shape.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          shape.lineTo(points[i].x, points[i].y);
        }
        shape.lineTo(points[0].x, points[0].y);
        const geometry = new THREE.ExtrudeGeometry(shape, {
          depth: door.height || 30,
          bevelEnabled: false,
        });
        // Chuyển từ mặt OXY → OXZ
        geometry.rotateX(-Math.PI / 2);
        const mesh = new THREE.Mesh(
          geometry,
          new THREE.MeshBasicMaterial({ color: 'red', visible: false }) // hoặc dùng visible: true để debug
        );

        objDoors[door.id] = mesh;
      }
    }
    return walls
      .filter(wall => Array.isArray(wall.polygon) && wall.polygon.length >= 3)
      .map((wall) => {
        const shape = new THREE.Shape();

        const points = wall.polygon.map(p => ({
          x: p.x,
          y: -p.y, // 👈 đảo trục y để ra đúng Z trong Three.js
        }));

        shape.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          shape.lineTo(points[i].x, points[i].y);
        }
        shape.lineTo(points[0].x, points[0].y);

        const geometry = new THREE.ExtrudeGeometry(shape, {
          // depth: 30,
          depth: wall.height || 30,
          bevelEnabled: false,
        });

        // Tạo mesh từ geometry tường
        let wallMesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
        wallMesh.rotateX(-Math.PI / 2);

        // Cắt các cửa
        try {
          for (let kd in objDoors) {
            const doorMesh = objDoors[kd];
            wallMesh.updateMatrix();
            wallMesh = CSG.subtract(wallMesh, doorMesh);
          }
        } catch (err) {
          console.error("CSG error:", err);
        }

        return (
          <primitive
            key={wall.id}
            object={wallMesh}
            dispose={null}
          />
          // <mesh
          //   key={wall.id}
          //   geometry={geometry}
          //   rotation={[-Math.PI / 2, 0, 0]} // đưa từ OXY → OXZ
          // >
          //   <meshStandardMaterial color="lightgray" side={THREE.DoubleSide} />
          // </mesh>
        );
      });
  };
  const renderDoorFunc = () => {
    if (!doors || !doors.length) return
    return doors
      .filter(door => Array.isArray(door.outerPolygon) && door.outerPolygon.length >= 3)
      .map((door) => {
        const shape = new THREE.Shape();

        const points = door.outerPolygon.map(p => ({
          x: p.x,
          y: -p.y, // 👈 đảo trục y để ra đúng Z trong Three.js
        }));

        shape.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          shape.lineTo(points[i].x, points[i].y);
        }
        shape.lineTo(points[0].x, points[0].y);

        const geometry = new THREE.ExtrudeGeometry(shape, {
          // depth: 30,
          depth: door.height || 30,
          bevelEnabled: false,
        });

        return (
          <mesh
            key={door.id}
            geometry={geometry}
            rotation={[-Math.PI / 2, 0, 0]} // đưa từ OXY → OXZ
          >
            <meshStandardMaterial color="red" side={THREE.DoubleSide} />
          </mesh>
        );
      });
  };




  function Axes() {
    const { scene } = useThree();
    const axesRef = useRef();

    useEffect(() => {
      // X: đỏ
      const xAxis = new THREE.ArrowHelper(
        new THREE.Vector3(1, 0, 0), // hướng
        new THREE.Vector3(0, 0, 0), // gốc
        20, // độ dài
        0xff0000, // màu đỏ
        0.3, // chiều dài đầu mũi tên
        0.2 // chiều rộng đầu mũi tên
      );

      // Y: xanh lá
      const yAxis = new THREE.ArrowHelper(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, 0, 0),
        20,
        0x00ff00,
        0.3,
        0.2
      );

      // Z: xanh dương
      const zAxis = new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0, 0),
        20,
        0x0000ff,
        0.3,
        0.2
      );

      axesRef.current = new THREE.Group();
      axesRef.current.add(xAxis);
      axesRef.current.add(yAxis);
      axesRef.current.add(zAxis);

      scene.add(axesRef.current);

      // Cleanup khi unmount
      return () => {
        scene.remove(axesRef.current);
      };
    }, [scene]);

    return null; // không render gì vì đã thêm trực tiếp vào scene
  }

  function SetupCamera() {
    const { scene, camera, size } = useThree();
    cameraRef.current = camera;
    useEffect(() => {
      // Set các thông số camera
      let positionGridFirst = positionGrid;
      camera.fov = 90;
      camera.aspect = size.width / size.height;
      camera.near = 0.1;
      camera.far = 2000;
      camera.position.set(positionGridFirst.endX, 100, positionGridFirst.endZ);
      camera.lookAt(new THREE.Vector3(positionGridFirst.endX / 2, 0, positionGridFirst.endZ / 2));
      camera.updateProjectionMatrix();
    }, [camera, size]);

    return null;
  }
  function getInitialPositionDefault() {

  }
  return (
    <Rnd
      default={{
        x: 820,
        y: 20,
        width: 320,
        height: 320,
      }}
      // default={getInitialPositionDefault()}
      minWidth={200}
      minHeight={200}
      bounds="window"
      style={{
        background: '#eee',
        border: '1px solid #999',
        padding: 0,
        overflow: 'hidden',
      }}
      dragHandleClassName="drag-handle"
    >
      <button className='cursor-move drag-handle'>drag</button>
      <Canvas style={{ width: '100%', height: '100%' }} camera={{ position: [3, 3, 3] }}
      >
        <SetupCamera /> {/* 👈 Add camera helper */}
        <Text
          position={[20, 0, 0]}
          fontSize={3}
          color="red"
          anchorX="center"
          anchorY="middle"
        >
          X
        </Text>
        <Text
          position={[0, 20, 0]}
          fontSize={3}
          color="green"
          anchorX="center"
          anchorY="middle"
        >
          Y
        </Text>
        <Text
          position={[0, 0, 20]}
          fontSize={3}
          color="blue"
          anchorX="center"
          anchorY="middle"
        >
          Z
        </Text>

        <ambientLight intensity={0.5} />
        <pointLight
          position={[(positionGrid.startX+positionGrid.endX)/2, 100, (positionGrid.startZ+positionGrid.endZ)/2]} // gần vùng render
          intensity={1.2}            // tăng cường độ sáng
          distance={1000}             // khoảng cách ảnh hưởng
          decay={2}                  // giảm sáng dần
          castShadow
        />
        <Axes />
        <Box />
        <OrbitControls />
        <RectGrid stepX={20} stepZ={10}
          startX={positionGrid.startX}
          endX={positionGrid.endX}
          startZ={positionGrid.startZ}
          endZ={positionGrid.endZ}
          width={gridLayout3d[0]} height={gridLayout3d[1]}
        />
        {renderWallFunc()}
        {/* {renderDoorFunc()} */}
      </Canvas>
    </Rnd>
  );
}
