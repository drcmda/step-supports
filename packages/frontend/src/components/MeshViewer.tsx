import { useMemo, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Bounds, Edges } from '@react-three/drei'
import * as THREE from 'three'

interface MeshViewerProps {
  modelVertices: Float32Array
  modelFaces: Uint32Array
  supportVertices: Float32Array
  supportFaces: Uint32Array
}

function useParsedGeometry(vertices: Float32Array, faces: Uint32Array) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    g.setIndex(new THREE.Uint32BufferAttribute(faces, 1))
    g.computeVertexNormals()
    return g
  }, [vertices, faces])

  useEffect(() => () => geo.dispose(), [geo])
  return geo
}

function ModelMesh({ vertices, faces }: { vertices: Float32Array; faces: Uint32Array }) {
  const geo = useParsedGeometry(vertices, faces)
  return (
    <mesh geometry={geo} renderOrder={1}>
      <meshStandardMaterial color='#a6accd' transparent opacity={0.15} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

function SupportMesh({ vertices, faces }: { vertices: Float32Array; faces: Uint32Array }) {
  const geo = useParsedGeometry(vertices, faces)
  return (
    <mesh geometry={geo} renderOrder={0}>
      <meshStandardMaterial color='#5de4c7' transparent opacity={0.85} roughness={1} metalness={0.1} />
      <Edges threshold={15} color='white' />
    </mesh>
  )
}

function SetZUp() {
  const { camera } = useThree()
  useEffect(() => {
    camera.up.set(0, 0, 1)
    camera.updateProjectionMatrix()
  }, [camera])
  return null
}

export default function MeshViewer({ modelVertices, modelFaces, supportVertices, supportFaces }: MeshViewerProps) {
  return (
    <div className='w-full aspect-[16/10] rounded-xl overflow-hidden border border-border mb-6'>
      <Canvas camera={{ fov: 45, near: 0.1, far: 100000, up: [0, 0, 1] }} style={{ background: 'transparent' }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 10]} intensity={1} />
        <directionalLight position={[-5, -5, -5]} intensity={0.3} />
        <Bounds fit clip observe margin={1.2}>
          <group>
            <SupportMesh vertices={supportVertices} faces={supportFaces} />
            <ModelMesh vertices={modelVertices} faces={modelFaces} />
          </group>
        </Bounds>
        <SetZUp />
        <OrbitControls makeDefault enableDamping dampingFactor={0.1} />
      </Canvas>
    </div>
  )
}
