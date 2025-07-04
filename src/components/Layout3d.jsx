import { Rnd } from 'react-rnd';
import _ from 'lodash';
import { CSG } from 'three-csg-ts';
import { Canvas, useThree, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Text, useHelper, Environment, OrthographicCamera, useGLTF } from '@react-three/drei';
import { useEditor } from '../context/EditorContext';
import * as THREE from 'three';
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { DoubleSide, PointLightHelper } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

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
    windows, setWindows,
    doors,
    setDoors,
    gridLayout3d, setGridLayout3d,
    modelThreeCommonRef,
  } = useEditor();
  const cameraRef = useRef()
  const sceneRef = useRef()
  const [positionGrid, setPositionGrid] = useState({ startX: 0, startZ: 0, endX: 500, endZ: 500 })

  function loadStoreModel() {
    const { scene } = useGLTF('/models/source/window.glb'); // hoặc từ URL
    return <primitive object={scene} />;
  }
  function usePrevious(value) {
    const ref = useRef();
    useEffect(() => {
      ref.current = value;
    }, [value]);
    return ref.current;
  }
  const wallsRefOld = usePrevious(walls);
  useEffect(() => {
    // console.log("wallsRefOld=", wallsRefOld)
  }, [wallsRefOld])
  useEffect(() => {
    try {
      if (!walls || !walls.length) return;
      let polygons = []
      let gridMinX = Infinity;
      let gridMaxX = -Infinity;
      let gridMinZ = Infinity;
      let gridMaxZ = -Infinity;
      // console.log("wall", walls)
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
      // console.log(`gridMinX=${gridMinX} gridMaxX=${gridMaxX} gridMinZ=${gridMinZ} gridMaxZ=${gridMaxZ}`)
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
      // console.log("wallsRefOld=", wallsRefOld)
      if (walls && walls.length && (!wallsRefOld || !wallsRefOld.length) && cameraRef.current) {
        const camera = cameraRef.current
        const centerX = (startX + endX) / 2;
        const centerZ = (startZ + endZ) / 2;
        // console.log("lan dau update camera vao day nhe")
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
  function fitModelToBox(model, box3, angleDeg = null) {
    if (!model || !box3?.isBox3) return null;

    // 1. Bọc model trong group wrapper
    const wrapper = new THREE.Group();
    wrapper.add(model);

    // 2. Reset model transform
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    model.scale.set(1, 1, 1);
    wrapper.position.set(0, 0, 0);
    wrapper.rotation.set(0, 0, 0);
    wrapper.scale.set(1, 1, 1);
    wrapper.updateMatrixWorld(true, true);

    // 3. Tính bounding box và tâm model
    const modelBox = new THREE.Box3().setFromObject(model);
    const modelCenter = new THREE.Vector3();
    modelBox.getCenter(modelCenter);
    const modelSize = new THREE.Vector3();
    modelBox.getSize(modelSize);

    // 4. Đưa model về gốc (center tại 0,0,0)
    model.position.sub(modelCenter);
    wrapper.updateMatrixWorld(true, true);

    // 5. Đặt wrapper vào vị trí center của box3
    const boxCenter = new THREE.Vector3();
    box3.getCenter(boxCenter);
    wrapper.position.copy(boxCenter);
    wrapper.updateMatrixWorld(true, true);

    // 6. Tính scale để khớp với box3 đã xoay về hướng OX
    const targetSize = new THREE.Vector3();
    box3.getSize(targetSize);


    // const targetBox2 = box3.clone(); // box3 là Box3 target
    // // 2. Tạo helper cho cả hai
    // const modelBoxHelper = new THREE.Box3Helper(modelBox, 'pink');   // đỏ: model
    // const targetBoxHelper = new THREE.Box3Helper(targetBox2, 'green'); // xanh: box3 target
    // // 3. Thêm vào scene
    // sceneRef.current.add(modelBoxHelper);
    // sceneRef.current.add(targetBoxHelper);
    const scaleX = targetSize.x / modelSize.x;
    const scaleY = targetSize.y / modelSize.y;
    const scaleZ = targetSize.z / modelSize.z;
    wrapper.scale.set(scaleX, scaleY, scaleZ)
    wrapper.updateMatrixWorld(true, true);
    if (angleDeg) {
      const angleRad = (angleDeg * Math.PI) / 180;
      wrapper.rotation.y = -angleRad
    }
    return wrapper;
  }

  function getAngleFromPolygon(polygon) {
    // Giả định polygon là 4 điểm tạo thành hình chữ nhật
    // Dùng 2 điểm đầu để tính vector theo chiều dài
    const p0 = polygon[0];
    const p1 = polygon[1];

    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;

    const angleRad = Math.atan2(dy, dx); // canvas: x-y, nên dy
    const angleDeg = (angleRad * 180) / Math.PI;

    return angleDeg;
  }

  function getTightBoundingBox(object3D) {
    const box = new THREE.Box3();
    const tempMatrix = new THREE.Matrix4();
    const tempGeo = new THREE.BufferGeometry();

    object3D.updateWorldMatrix(true, true);

    object3D.traverse((child) => {
      if (child.isMesh) {
        const geometry = child.geometry;
        if (!geometry.boundingBox) {
          geometry.computeBoundingBox();
        }

        const worldMatrix = child.matrixWorld;
        const transformedBox = new THREE.Box3();

        // Clone geometry để không phá hỏng gốc
        tempGeo.copy(geometry);
        tempGeo.applyMatrix4(worldMatrix); // chuyển về world-space

        tempGeo.computeBoundingBox();
        transformedBox.copy(tempGeo.boundingBox);
        box.union(transformedBox);
      }
    });

    return box;
  }

  const renderWallFunc = () => {
    // console.log("doors",doors)
    if (!walls || !walls.length) return
    const modelThreeCommonRefT = modelThreeCommonRef.current;
    let modelDoor;
    try {
      modelDoor =
        modelThreeCommonRefT["door"][
        Object.keys(modelThreeCommonRefT["door"])[0]
        ];
    } catch { }
    let modelWindow;
    try {
      modelWindow =
        modelThreeCommonRefT["window"][
        Object.keys(modelThreeCommonRefT["window"])[0]
        ];
    } catch { }
    let objDoors = {}
     let objDoorsModel = {}
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
          new THREE.MeshBasicMaterial({ color: 'red', visible: true }) // hoặc dùng visible: true để debug
        );
        let offsetY = 0;
        mesh.updateMatrixWorld()
        if (modelDoor) {
          // === Clone modelDoor ===
          const doorClone = modelDoor.clone(true);
          doorClone.traverse(child => {
            if (child.isMesh) {
              child.updateMatrixWorld()
              if (child.material.map) {
                child.material.map = null; // Bỏ texture để màu trắng hiện ra
              }
              child.material.color.set(0xffffff)
            }
          });
          let mesh2;
          if (door.innerPolygon && door.innerPolygon.length && !((!door.outerPolygon || (door.outerPolygon.length && door.outerPolygon <= 2)))) {
            const pointsInner = door.innerPolygon.map(p => ({
              x: p.x,
              y: -p.y, // đảo trục Y để đúng với OXZ
            }));
            const shapeInner = new THREE.Shape();
            shapeInner.moveTo(pointsInner[0].x, pointsInner[0].y);
            for (let i = 1; i < pointsInner.length; i++) {
              shapeInner.lineTo(pointsInner[i].x, pointsInner[i].y);
            }
            shapeInner.lineTo(pointsInner[0].x, pointsInner[0].y);

            const geometryInner = new THREE.ExtrudeGeometry(shapeInner, {
              depth: door.height || 30,
              bevelEnabled: false,
            });

            // Xoay từ mặt OXY sang OXZ
            geometryInner.rotateX(-Math.PI / 2);
            mesh2 = new THREE.Mesh(
              geometryInner,
              new THREE.MeshBasicMaterial({ color: 'green', visible: true }) // hoặc dùng visible: true để debug
            );
            mesh2.position.y = offsetY; // nâng theo chiều cao thực
            mesh2.updateMatrixWorld()
          }
          else {
            mesh2 = mesh.clone();
          }

          mesh2.matrixAutoUpdate = true;
          const box = new THREE.Box3().setFromObject(mesh2);
          const center = new THREE.Vector3();
          box.getCenter(center);
          const angleDeg = door?.angle || getAngleFromPolygon(door.innerPolygon);
          const angleRad = (angleDeg * Math.PI) / 180;
          const pivot = new THREE.Object3D();
          pivot.position.copy(center);
          mesh2.position.sub(center);
          pivot.add(mesh2);
          pivot.rotation.y = angleRad;
          pivot.updateMatrixWorld(true);
          // sceneRef.current.add(pivot)
          const tightBox = getTightBoundingBox(pivot);
          const doorGroup = fitModelToBox(doorClone, tightBox, door.angle,);
          if (doorGroup) {
            objDoorsModel[doorGroup.uuid] = doorGroup
          }
        }
        objDoors[mesh.id] = mesh;
      }
    }
    // console.log("objDoors", objDoors)
    let objWindows = {}
    let objWindowsModel = {}
    if (windows && windows.length) {
      for (let i = 0; i < windows.length; i++) {
        const window = windows[i]
        const shape = new THREE.Shape();
        if (!window.outerPolygon || (window.outerPolygon.length && window.outerPolygon <= 2)) break

        const points = window.outerPolygon.map(p => ({
          x: p.x,
          y: -p.y, // 👈 đảo trục y để ra đúng Z trong Three.js
        }));

        shape.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          shape.lineTo(points[i].x, points[i].y);
        }
        shape.lineTo(points[0].x, points[0].y);
        const geometry = new THREE.ExtrudeGeometry(shape, {
          depth: window.height || 30,
          bevelEnabled: false,
        });
        // Chuyển từ mặt OXY → OXZ
        geometry.rotateX(-Math.PI / 2);
        geometry.computeBoundingBox();
        const mesh = new THREE.Mesh(
          geometry,
          new THREE.MeshBasicMaterial({ color: 'green', visible: true }) // hoặc dùng visible: true để debug
        );
        let offsetY = window?.offsetY || 30;
        mesh.position.y = offsetY; // nâng theo chiều cao thực
        mesh.updateMatrixWorld()
        if (modelWindow) {
          // === Clone modelWindow ===
          const windowClone = modelWindow.clone(true);
          windowClone.traverse(child => {
            if (child.isMesh) {
              child.updateMatrixWorld()
              if (child.material.map) {
                child.material.map = null; // Bỏ texture để màu trắng hiện ra
              }
              child.material.color.set(0xffffff)
            }
          });
          let mesh2;
          if (window.innerPolygon && window.innerPolygon.length && !((!window.outerPolygon || (window.outerPolygon.length && window.outerPolygon <= 2)))) {
            const pointsInner = window.innerPolygon.map(p => ({
              x: p.x,
              y: -p.y, // đảo trục Y để đúng với OXZ
            }));
            const shapeInner = new THREE.Shape();
            shapeInner.moveTo(pointsInner[0].x, pointsInner[0].y);
            for (let i = 1; i < pointsInner.length; i++) {
              shapeInner.lineTo(pointsInner[i].x, pointsInner[i].y);
            }
            shapeInner.lineTo(pointsInner[0].x, pointsInner[0].y);

            const geometryInner = new THREE.ExtrudeGeometry(shapeInner, {
              depth: window.height || 30,
              bevelEnabled: false,
            });

            // Xoay từ mặt OXY sang OXZ
            geometryInner.rotateX(-Math.PI / 2);
            mesh2 = new THREE.Mesh(
              geometryInner,
              new THREE.MeshBasicMaterial({ color: 'green', visible: true }) // hoặc dùng visible: true để debug
            );
            mesh2.position.y = offsetY; // nâng theo chiều cao thực
            mesh2.updateMatrixWorld()
          }

          else {
            mesh2 = mesh.clone();
          }

          // // 1. Clone mesh
          // const mesh2 = mesh.clone();
          // console.log("mesh222", mesh2)
          mesh2.matrixAutoUpdate = true;
          // mesh2.material.wireframe = true;
          // 1. Tính bounding box và tâm
          const box = new THREE.Box3().setFromObject(mesh2);
          const center = new THREE.Vector3();
          box.getCenter(center);

          // 2. Tính góc nghiêng hiện tại (dựa vào window.angle hoặc outerPolygon)
          const angleDeg = window?.angle || getAngleFromPolygon(window.innerPolygon);
          const angleRad = (angleDeg * Math.PI) / 180;

          // 3. Tạo pivot tại tâm của mesh
          const pivot = new THREE.Object3D();
          pivot.position.copy(center);

          // 4. Dịch mesh về vị trí tương đối với pivot
          mesh2.position.sub(center);

          // 5. Thêm mesh vào pivot và xoay pivot để làm thẳng tường
          pivot.add(mesh2);
          pivot.rotation.y = angleRad;
          pivot.updateMatrixWorld(true);
          // sceneRef.current.add(pivot)
          const tightBox = getTightBoundingBox(pivot);
          const box3Helper2 = new THREE.Box3Helper(tightBox, 'red');
          // sceneRef.current.add(box3Helper2)
          // sceneRef.current.add(pivot)
          // const windowBox = new THREE.Box3().setFromObject(mesh2); // bounding box của lỗ tường
          // Có thể truyền window.angle nếu có, hoặc để null
          const windowGroup = fitModelToBox(windowClone, tightBox, window.angle);
          if (windowGroup) {
            objWindowsModel[windowGroup.uuid] = windowGroup
          }
        }
        objWindows[mesh.id] = mesh;
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

        // Cắt các cửa chính
        try {
          for (let kd in objDoors) {
            const meshCut = objDoors[kd];
            wallMesh.updateMatrix();
            wallMesh = CSG.subtract(wallMesh, meshCut);
          }
        } catch (err) {
          console.error("CSG error:", err);
        }
        // Cắt các cửa sổ
        try {
          for (let kd in objWindows) {
            const meshCut = objWindows[kd];
            wallMesh.updateMatrix();
            wallMesh = CSG.subtract(wallMesh, meshCut);
          }
        } catch (err) {
          console.error("CSG error:", err);
        }
        return <React.Fragment key={`wall-window-door-${wall.id}`}>
          {/* {Object.entries(objWindows).map(([id, meshCut]) => (
            <primitive key={`window-${meshCut.uuid}`} object={meshCut} />
          ))} */}
          {/* {Object.entries(objDoors).map(([id, meshCut]) => (
            <primitive key={`door-${meshCut.uuid}`} object={meshCut} />
          ))} */}
          
         {Object.entries(objDoorsModel).map(([id, obj]) => (
            <primitive key={`door-${obj.uuid}`} object={obj} />
          ))}
          {Object.entries(objWindowsModel).map(([id, obj]) => (
            <primitive key={`window-${obj.uuid}`} object={obj} />
          ))}
          <primitive
            key={`wall-${wallMesh.uuid}`}
            object={wallMesh}
            dispose={null}
          />
        </React.Fragment>
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
    sceneRef.current = scene
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
  function SceneLights({ position }) {
    const lightRef = useRef();

    // Dùng helper để hiển thị vị trí & phạm vi ảnh hưởng
    useHelper(lightRef, PointLightHelper, 5); // 5 là size của helper

    return (
      <pointLight
        ref={lightRef}
        position={position}
        intensity={200}
        distance={10000}
        decay={1}
        castShadow
      />
    );
  }
  function SceneLights2({ position = [0, 180, 0] }) {
    const dirLightRef = useRef();
    useHelper(dirLightRef, THREE.DirectionalLightHelper, 10); // helper để debug

    return (
      <>
        {/* Ánh sáng môi trường nhẹ */}
        <ambientLight intensity={0.4} />

        {/* Đèn định hướng mạnh */}
        <directionalLight
          ref={dirLightRef}
          position={position}
          intensity={2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-500}
          shadow-camera-right={500}
          shadow-camera-top={500}
          shadow-camera-bottom={-500}
          shadow-camera-near={0.1}
          shadow-camera-far={1000}
        />
      </>
    );
  }
  function AmbientLightDemo() {
    return <ambientLight intensity={0.1} />;
  }
  function DirectionalLightDemo() {
    const lightRef = useRef();

    useEffect(() => {
      if (lightRef.current) {
        const helper = new THREE.DirectionalLightHelper(lightRef.current, 5, 0xff0000);
        lightRef.current.parent.add(helper);

        return () => {
          lightRef.current.parent.remove(helper);
          helper.dispose?.();
        };
      }
    }, []);

    return (
      <directionalLight
        ref={lightRef}
        position={[100, 200, 100]}
        intensity={2}
        castShadow
      />
    );
  }
  function PointLightDemo() {
    const lightRef = useRef();
    useHelper(lightRef, THREE.PointLightHelper, 5);

    return (
      <pointLight
        ref={lightRef}
        position={[
          (positionGrid.startX + positionGrid.endX) / 2,
          30 * 8,
          (positionGrid.startZ + positionGrid.endZ) / 2,
        ]}
        intensity={5}
        distance={2000}
        decay={0.1}
        castShadow
      />
    );
  }
  function SpotLightDemo() {
    const spotRef = useRef();
    useHelper(spotRef, THREE.SpotLightHelper);

    return (
      <spotLight
        ref={spotRef}
        position={[
          (positionGrid.startX + positionGrid.endX) / 2,
          30 * 10,
          (positionGrid.startZ + positionGrid.endZ) / 2,
        ]}
        lookAt={[
          (positionGrid.startX + positionGrid.endX) / 2,
          0,
          (positionGrid.startZ + positionGrid.endZ) / 2,
        ]}
        angle={Math.PI}
        penumbra={0.2}
        intensity={3}
        distance={2000}
        decay={0.2}
        castShadow
      />
    );
  }
  function HemisphereLightDemo() {
    return (
      <hemisphereLight
        skyColor="#ffffff"
        groundColor="#444444"
        intensity={0.4}
      />
    );
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
        background: '#ccc',
        border: '1px solid #999',
        padding: 0,
        overflow: 'hidden',
      }}
      dragHandleClassName="drag-handle"
    >
      <button className='cursor-move drag-handle'>drag</button>
      <Canvas style={{ width: '100%', height: '100%' }} camera={{ position: [3, 3, 3] }}
        shadows
      >
        {/* <loadStoreModel /> */}
        <AmbientLightDemo />
        {/* <HemisphereLightDemo /> */}
        {/* <PointLightDemo /> */}
        {/* <DirectionalLightDemo /> */}
        {/* <SpotLightDemo /> */}
        {/*Environment preset={sunset,sunrise,dawn,night,city,park,forest,lobby,apartment}  */}
        <Environment preset="city"
          background={false} // can be true, false or "only" (which only sets the background) (default: false)
        // backgroundBlurriness={0} // optional blur factor between 0 and 1 (default: 0, only works with three 0.146 and up)
        // backgroundIntensity={1} // optional intensity factor (default: 1, only works with three 0.163 and up)
        // backgroundRotation={[0, Math.PI / 2, 0]} // optional rotation (default: 0, only works with three 0.163 and up)
        // environmentIntensity={1} // optional intensity factor (default: 1, only works with three 0.163 and up)
        // environmentRotation={[0, Math.PI / 2, 0]} // optional rotation (default: 0, only works with three 0.163 and up)
        //         ground={{
        //   height: 0,         // mặt đất ở Y = 0
        //   radius: 10000,     // bán kính ánh sáng phản chiếu
        //   scale: 100000      // kích thước mặt phẳng ánh sáng chiếu
        // }}
        />


        {/* <mesh position={[500, 0, 500]} castShadow receiveShadow>
          <boxGeometry args={[100, 100, 100]} />
          <meshStandardMaterial color="white" />
        </mesh> */}
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

        {/* <ambientLight intensity={0.5} /> */}
        {/* <pointLight
          position={[(positionGrid.startX + positionGrid.endX) / 2, 100, (positionGrid.startZ + positionGrid.endZ) / 2]} // gần vùng render
          intensity={1.2}            // tăng cường độ sáng
          distance={1000}             // khoảng cách ảnh hưởng
          decay={2}                  // giảm sáng dần
          castShadow
        /> */}
        {/* <SceneLights
          position={[
            (positionGrid.startX + positionGrid.endX) / 2,
            30 * 6,
            (positionGrid.startZ + positionGrid.endZ) / 2,
          ]}
        /> */}
        {/* <SceneLights2
          position={[
            (positionGrid.startX + positionGrid.endX) / 2,
            30 * 6,
            (positionGrid.startZ + positionGrid.endZ) / 2,
          ]}
        /> */}
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
