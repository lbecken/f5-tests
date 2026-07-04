import { useState } from 'react'
import '../puzzles/puzzles.css'

interface MazeNode { id: string; x: number; y: number; label: string }
interface MazePanelProps {
  prompt: string
  nodes: MazeNode[]
  edges: [string, string][]
  startId: string
  endId: string
}

/** Pathfinding puzzle: click connected nodes from start to end; the labels
 * collected along your chosen route spell out the answer. */
export function MazePanel({ prompt, nodes, edges, startId, endId }: MazePanelProps) {
  const [path, setPath] = useState<string[]>([startId])

  const adjacency = (id: string) =>
    edges.filter(([a, b]) => a === id || b === id).map(([a, b]) => (a === id ? b : a))

  const onNodeClick = (id: string) => {
    const last = path[path.length - 1]
    if (path.includes(id)) {
      if (id === last && path.length > 1) setPath(path.slice(0, -1))
      return
    }
    if (adjacency(last).includes(id)) setPath([...path, id])
  }

  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]))

  return (
    <div className="puzzle-widget">
      <p className="puzzle-prompt">{prompt}</p>
      <svg viewBox="0 0 300 200" className="maze-svg">
        {edges.map(([a, b], i) => (
          <line key={i} x1={byId[a].x} y1={byId[a].y} x2={byId[b].x} y2={byId[b].y} stroke="#8884" strokeWidth={2} />
        ))}
        {path.slice(1).map((id, i) => (
          <line
            key={`p${i}`}
            x1={byId[path[i]].x} y1={byId[path[i]].y}
            x2={byId[id].x} y2={byId[id].y}
            stroke="var(--accent)" strokeWidth={3}
          />
        ))}
        {nodes.map((n) => (
          <g
            key={n.id}
            className={`maze-node ${path.includes(n.id) ? 'visited' : ''} ${n.id === startId ? 'start' : ''} ${n.id === endId ? 'end' : ''}`}
            onClick={() => onNodeClick(n.id)}
          >
            <circle cx={n.x} cy={n.y} r={14} fill="#fff" stroke="#333" strokeWidth={1.5} />
            <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize={11} fill="#222">{n.label}</text>
          </g>
        ))}
      </svg>
      <p className="symbol-tally">Path so far: {path.map((id) => byId[id].label).join(' → ')}</p>
    </div>
  )
}
