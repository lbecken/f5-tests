import { useState } from 'react'
import type { ThemeManifest } from '../types'
import './objectTray.css'

interface ObjectTrayProps {
  theme: ThemeManifest
  inventory: string[]
}

export function ObjectTray({ theme, inventory }: ObjectTrayProps) {
  const [examine, setExamine] = useState<string | null>(null)
  const item = examine ? theme.objects[examine] : null
  const Detail = item?.detail

  return (
    <div className="object-tray">
      <h3 className="object-tray-title display-font">Items</h3>
      {inventory.length === 0 ? (
        <p className="object-tray-empty">Nothing collected yet.</p>
      ) : (
        <div className="object-tray-row">
          {inventory.map((id) => {
            const obj = theme.objects[id]
            if (!obj) return null
            const Icon = obj.icon
            return (
              <button key={id} className="object-chip" onClick={() => setExamine(id)} title={obj.name}>
                <Icon />
                <span>{obj.name}</span>
              </button>
            )
          })}
        </div>
      )}

      {item && (
        <div className="deck-modal-overlay" onClick={() => setExamine(null)}>
          <div className="panel object-examine" onClick={(e) => e.stopPropagation()}>
            <div className="object-examine-header">
              <h2 className="display-font">{item.name}</h2>
              <button className="btn secondary" onClick={() => setExamine(null)}>Close</button>
            </div>
            <div className="object-examine-art"><item.icon /></div>
            <p>{item.description}</p>
            {Detail && (
              <div className="object-examine-detail">
                <Detail />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
