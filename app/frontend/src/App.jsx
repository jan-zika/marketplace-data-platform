import { useEffect, useRef, useState, useMemo } from 'react'
import { fetchCities, fetchRoutes } from './api.js'
import BrazilMap from './components/BrazilMap.jsx'
import useIsMobile from './useIsMobile.js'

export default function App() {
  const mobile                            = useIsMobile()
  const [menuOpen, setMenuOpen]           = useState(false)
  const [cities, setCities]               = useState([])
  const [routes, setRoutes]               = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  // ordered array of keys — newest first
  const [selectedOrder, setSelectedOrder] = useState([])
  const [activeLayer, setActiveLayer]     = useState('seller_order_count')
  const [showAllRoutes, setShowAllRoutes]  = useState(false)
  const showAllRoutesRef = useRef(false)
  const [topRoutes, setTopRoutes]         = useState(50)
  const [routesPerCity, setRoutesPerCity]  = useState(50)
  const [routesShown, setRoutesShown]     = useState(0)
  const [visibleRouteData, setVisibleRouteData] = useState([])
  const [viewMode, setViewMode]           = useState('seller')
  const [searchTerm, setSearchTerm]       = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [panelWidth, setPanelWidth]       = useState(280)
  const draggingRef                       = useRef(false)
  const searchRef                         = useRef(null)

  useEffect(() => {
    Promise.all([fetchCities(), fetchRoutes()])
      .then(([c, r]) => {
        const enriched = c.map(city => ({
          ...city,
          both_order_count: (city.seller_order_count || 0) + (city.buyer_order_count || 0),
          both_gmv:         (city.seller_revenue     || 0) + (city.buyer_spend        || 0),
        }))
        setCities(enriched)
        setRoutes(r)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const cityKey = (c) => c.city_key || `${c.city}|${c.state}`
  const selectedKeys = useMemo(() => new Set(selectedOrder), [selectedOrder])

  const addCity = (city) => {
    const k = cityKey(city)
    setSelectedOrder(prev => {
      if (prev.includes(k)) return prev          // already selected, no change
      return [k, ...prev]                        // newest first
    })
  }

  const removeCity = (city) => {
    const k = cityKey(city)
    setSelectedOrder(prev => prev.filter(x => x !== k))
  }

  const exitShowAll = () => {
    showAllRoutesRef.current = false
    setShowAllRoutes(false)
    setVisibleRouteData([])
    setSelectedOrder([])
  }

  const toggleCity = (city) => {
    const k = cityKey(city)
    if (showAllRoutesRef.current) {
      // exit show-all and select only this city in one step
      showAllRoutesRef.current = false
      setShowAllRoutes(false)
      setVisibleRouteData([])
      setSelectedOrder([k])
      return
    }
    setSelectedOrder(prev =>
      prev.includes(k) ? prev.filter(x => x !== k) : [k, ...prev]
    )
  }

  // Search dropdown matches
  const searchMatches = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q || q.length < 1) return []
    return cities
      .filter(c => c.city?.toLowerCase().includes(q))
      .slice(0, 8)
  }, [searchTerm, cities])

  const handleSearchSelect = (city) => {
    const k = cityKey(city)
    setSearchTerm('')
    setSearchFocused(false)
    if (showAllRoutesRef.current) {
      showAllRoutesRef.current = false
      setShowAllRoutes(false)
      setVisibleRouteData([])
      setSelectedOrder([k])
    } else {
      setSelectedOrder(prev => prev.includes(k) ? prev : [k, ...prev])
    }
  }

  const handleShowAll = () => {
    showAllRoutesRef.current = true
    setShowAllRoutes(true)
    setSelectedOrder([])
  }

  // When show-all fires and we get visible routes back, populate panel with those cities
  useEffect(() => {
    if (!showAllRoutesRef.current || visibleRouteData.length === 0) return
    const keys = new Set()
    for (const r of visibleRouteData) {
      const sk = r.seller_key   || `${r.seller_city}|${r.seller_state}`.toLowerCase()
      const ck = r.customer_key || `${r.customer_city}|${r.customer_state}`.toLowerCase()
      keys.add(sk); keys.add(ck)
    }
    const involved = cities.filter(c => keys.has(cityKey(c)))
    // sort by activeLayer descending, newest-first semantics: highest value = top
    const sorted = [...involved].sort((a, b) => (b[activeLayer] ?? 0) - (a[activeLayer] ?? 0))
    setSelectedOrder(sorted.map(cityKey))
  }, [showAllRoutes, visibleRouteData])

  const handleClear = () => {
    showAllRoutesRef.current = false
    setShowAllRoutes(false)
    setSelectedOrder([])
    setVisibleRouteData([])
  }

  const layerDefs = {
    seller: [
      { key: 'seller_order_count',  label: 'Order count',  color: 'var(--color-blue)' },
      { key: 'seller_revenue',      label: 'Order value',  color: 'var(--color-green)' },
      { key: 'seller_avg_distance', label: 'Avg distance', color: 'var(--color-orange)' },
      { key: 'seller_avg_freight',  label: 'Avg freight',  color: 'var(--color-purple)' },
    ],
    buyer: [
      { key: 'buyer_order_count',   label: 'Order count',  color: 'var(--color-blue)' },
      { key: 'buyer_spend',         label: 'Order value',  color: 'var(--color-green)' },
      { key: 'buyer_avg_distance',  label: 'Avg distance', color: 'var(--color-orange)' },
      { key: 'buyer_avg_freight',   label: 'Avg freight',  color: 'var(--color-purple)' },
    ],
    both: [
      { key: 'both_order_count',    label: 'Order count',  color: 'var(--color-blue)' },
      { key: 'both_gmv',            label: 'Order value',  color: 'var(--color-green)' },
    ],
  }

  const handleViewMode = (mode) => {
    const oldSlot = layerDefs[viewMode].findIndex(l => l.key === activeLayer)
    const newLayers = layerDefs[mode]
    setViewMode(mode)
    setActiveLayer(newLayers[Math.min(oldSlot < 0 ? 0 : oldSlot, newLayers.length - 1)].key)
  }

  const layers = layerDefs[viewMode]
  const selCount = selectedOrder.length

  // Ordered selected cities (newest first = selectedOrder order)
  const cityMap = useMemo(() => {
    const m = {}
    for (const c of cities) m[cityKey(c)] = c
    return m
  }, [cities])
  const selectedCities = selectedOrder.map(k => cityMap[k]).filter(Boolean)

  // Divider drag
  const onDividerMouseDown = (e) => {
    e.preventDefault()
    draggingRef.current = true
    const onMove = (ev) => {
      if (!draggingRef.current) return
      setPanelWidth(Math.max(180, Math.min(ev.clientX, window.innerWidth - 300)))
    }
    const onUp = () => {
      draggingRef.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const fmt  = (n) => n != null ? Number(n).toLocaleString() : '—'
  const fmtR = (n) => n != null ? `R$ ${Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'

  // Phone and tablet sizes: text never below 12 px, controls at least 44 px tall (useIsMobile.js).
  const fs  = (px) => mobile ? Math.max(px, 12) : px
  const tap = mobile ? { minHeight: 44 } : null
  const activeLayerLabel = layers.find(l => l.key === activeLayer)?.label
  const viewLabel = { seller: 'Seller', buyer: 'Buyer', both: 'Both' }[viewMode]

  const statusText = loading ? 'Loading…' : error ? `Error: ${error}` : `${cities.length} cities · ${routes.length} routes`
  const dataCredit = (
    <span style={{ color: 'var(--color-muted)', fontSize: fs(11) }} title="Brazilian e-commerce public dataset, 2016 to 2018, CC BY-NC-SA 4.0">Data: Olist public dataset</span>
  )
  const logoLink = (
    <a href="https://df1.io" title="Built by DF1" aria-label="df1.io, built by DF1"
      style={{ display: 'flex', alignItems: 'center', ...(mobile ? { minHeight: 44, flexShrink: 0 } : null) }}>
      <img src="/logo/df1-io-logo-compact-dark.svg" alt="df1.io" width="63" height="26" style={{ display: 'block' }} />
    </a>
  )

  const viewModeControl = (
    <div style={{ display: 'flex', gap: '4px', background: 'var(--color-border)', borderRadius: '6px', padding: '2px' }}>
      {[['seller', 'Seller'], ['buyer', 'Buyer'], ['both', 'Both']].map(([mode, label]) => (
        <button key={mode} className={viewMode === mode ? 'active' : ''} aria-pressed={viewMode === mode}
          onClick={() => handleViewMode(mode)}
          style={mobile ? { flex: 1, fontSize: '14px', ...tap } : { fontSize: '11px', padding: '2px 10px' }}>
          {label}
        </button>
      ))}
    </div>
  )

  const layerControl = (
    <div style={mobile
      ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }
      : { display: 'flex', gap: '6px' }}>
      {layers.map(l => (
        <button key={l.key} className={activeLayer === l.key ? 'active' : ''} aria-pressed={activeLayer === l.key}
          onClick={() => setActiveLayer(l.key)}
          style={{
            borderColor: activeLayer === l.key ? l.color : undefined, color: activeLayer === l.key ? l.color : undefined,
            ...(mobile ? { fontSize: '14px', ...tap } : null),
          }}>
          {l.label}
        </button>
      ))}
    </div>
  )

  const routesPerCitySlider = selCount > 0 && !showAllRoutes && (
    <span style={{ display: 'flex', alignItems: 'center', gap: mobile ? '10px' : '5px', fontSize: mobile ? '13px' : '12px', ...(mobile ? { ...tap, marginBottom: 8 } : null) }}>
      <span style={{ color: 'var(--color-muted)', flexShrink: 0 }}>Routes per city:</span>
      <input type="range" min={5} max={500} step={5} value={routesPerCity} aria-label="Routes per city"
        onChange={e => setRoutesPerCity(Number(e.target.value))}
        style={mobile ? { flex: 1, minWidth: 0, height: 44, accentColor: 'var(--color-accent)' } : { width: '70px', accentColor: 'var(--color-blue)' }} />
      <span style={mobile ? { color: 'var(--color-text)', minWidth: '28px', textAlign: 'right' } : { color: 'var(--color-text)', minWidth: '24px' }}>{routesPerCity}</span>
    </span>
  )

  const panelControls = (
    <div style={{ padding: mobile ? '12px 16px' : '8px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>

      {/* Show top routes + Clear */}
      <div style={{ display: 'flex', gap: mobile ? '8px' : '6px', marginBottom: '8px' }}>
        <button
          onClick={handleShowAll}
          className={showAllRoutes ? 'active' : ''}
          style={{ flex: 1, fontSize: mobile ? '14px' : '11px', ...tap }}
        >
          Show top routes
        </button>
        {showAllRoutes && (
          <>
            <input type="range" min={10} max={100} step={10} value={topRoutes} aria-label="Number of top routes"
              onChange={e => setTopRoutes(Number(e.target.value))}
              style={mobile ? { width: '96px', height: 44, accentColor: 'var(--color-accent)' } : { width: '60px', accentColor: 'var(--color-blue)' }} />
            <span style={{ color: 'var(--color-text)', fontSize: fs(11), minWidth: '24px', alignSelf: 'center' }}>{topRoutes}</span>
          </>
        )}
        <button
          onClick={handleClear}
          disabled={selCount === 0 && !showAllRoutes}
          style={{ fontSize: mobile ? '14px' : '11px', ...(mobile ? { ...tap, minWidth: 72 } : null) }}
        >
          Clear
        </button>
      </div>

      {mobile && routesPerCitySlider}

      {/* Search with dropdown */}
      <div style={{ position: 'relative' }} ref={searchRef}>
        <input
          type="text"
          value={searchTerm}
          onChange={e => { setSearchTerm(e.target.value); setSearchFocused(true) }}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
          placeholder="Search and add city…"
          aria-label="Search and add city"
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'var(--color-bg)', border: '1px solid var(--color-border)',
            borderRadius: '4px', color: 'var(--color-text)', padding: mobile ? '10px 12px' : '5px 8px',
            // 16 px on phones keeps iOS Safari from zooming in on focus
            fontSize: mobile ? '16px' : '12px', fontFamily: 'inherit', ...tap,
          }}
        />
        {searchFocused && searchMatches.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderTop: 'none', borderRadius: '0 0 4px 4px',
            maxHeight: mobile ? '264px' : '200px', overflowY: 'auto',
          }}>
            {searchMatches.map(c => (
              <div
                key={cityKey(c)}
                onMouseDown={() => handleSearchSelect(c)}
                style={{
                  padding: mobile ? '0 12px' : '6px 10px', cursor: 'pointer', fontSize: mobile ? '14px' : '12px',
                  borderBottom: '1px solid var(--color-border)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...tap,
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-border)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span>{c.city}</span>
                <span style={{ color: 'var(--color-muted)', fontSize: fs(11) }}>{c.state}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  const statRow = (label, value, last) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: last ? 0 : (mobile ? 4 : 2) }}>
      <span style={{ color: 'var(--color-muted)' }}>{label}</span>{value}
    </div>
  )

  const tiles = (
    <div style={mobile
      ? { padding: '12px 16px 24px', fontSize: '13px' }
      : { flex: 1, overflowY: 'auto', padding: '8px', fontSize: '12px' }}>
      {selectedCities.length === 0 ? (
        <span style={{ color: 'var(--color-muted)' }}>
          {mobile ? 'Tap a city on the map, search above, or show the top routes.' : 'Select cities on the map or search above.'}
        </span>
      ) : (
        selectedCities.map(c => {
          const hasSeller = c.seller_order_count > 0
          const hasBuyer  = c.buyer_order_count  > 0
          const k = cityKey(c)
          return (
            <div key={k} style={{
              background: 'var(--color-bg)', borderRadius: '8px', marginBottom: '8px',
              border: '1px solid var(--color-border)', overflow: 'hidden',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: mobile ? '0 0 0 12px' : '7px 10px', borderBottom: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
              }}>
                <span style={{ fontWeight: 700, fontSize: mobile ? 14 : 13 }}>
                  {c.city} <span style={{ color: 'var(--color-muted)', fontWeight: 400, fontSize: fs(11) }}>{c.state}</span>
                </span>
                <button
                  onClick={() => removeCity(c)}
                  title="Deselect"
                  aria-label={`Deselect ${c.city}`}
                  style={{
                    border: 'none', background: 'transparent', cursor: 'pointer',
                    color: 'var(--color-muted)', padding: '2px 4px', fontSize: 14, lineHeight: 1, borderRadius: 4,
                    ...(mobile ? { width: 44, height: 44 } : null),
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--color-alert)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--color-muted)'}
                >🗑</button>
              </div>
              <div style={{ padding: mobile ? '10px 12px' : '8px 10px' }}>
                {(viewMode === 'seller' || viewMode === 'both') && hasSeller && <>
                  {viewMode === 'both' && <div style={{ color: 'var(--color-seller)', fontSize: fs(10), marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>As seller</div>}
                  {statRow('Order count', <strong>{fmt(c.seller_order_count)}</strong>)}
                  {statRow('Order value', <span>{fmtR(c.seller_revenue)}</span>)}
                  {statRow('Avg freight', <span>{fmtR(c.seller_avg_freight)}</span>)}
                  {statRow('Avg distance', <span>{fmt(c.seller_avg_distance)} km</span>, true)}
                </>}
                {(viewMode === 'buyer' || viewMode === 'both') && hasBuyer && <>
                  {viewMode === 'both' && <div style={{ color: 'var(--color-buyer)', fontSize: fs(10), marginTop: 8, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>As buyer</div>}
                  {statRow('Order count', <strong>{fmt(c.buyer_order_count)}</strong>)}
                  {statRow('Order value', <span>{fmtR(c.buyer_spend)}</span>)}
                  {statRow('Avg freight', <span>{fmtR(c.buyer_avg_freight)}</span>)}
                  {statRow('Avg distance', <span>{fmt(c.buyer_avg_distance)} km</span>, true)}
                </>}
              </div>
            </div>
          )
        })
      )}
    </div>
  )

  const mapArea = (
    <>
      {!loading && !error && (
        <BrazilMap
          cities={cities}
          routes={routes}
          selectedKeys={selectedKeys}
          selectedOrder={selectedOrder}
          onCityClick={toggleCity}
          activeLayer={activeLayer}
          showAllRoutes={showAllRoutes}
          topRoutes={topRoutes}
          routesPerCity={routesPerCity}
          onRoutesShown={setRoutesShown}
          onVisibleRoutes={setVisibleRouteData}
          viewMode={viewMode}
          isShowAllActive={showAllRoutes}
          mobile={mobile}
        />
      )}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-muted)' }}>
          Loading data…
        </div>
      )}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-alert)' }}>
          {error}
        </div>
      )}
    </>
  )

  // ── Phone and tablet: one column (header, map, city panel); the page scrolls, controls collapse ──
  if (mobile) {
    return (
      <div className="app-mobile" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

        <header style={{
          position: 'sticky', top: 0, zIndex: 1100,
          padding: '4px 16px 8px', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {logoLink}
            <h1 style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Marketplace trade routes
            </h1>
            <button onClick={() => setMenuOpen(o => !o)} aria-expanded={menuOpen} aria-controls="map-options"
              aria-label={menuOpen ? 'Close map options' : 'Map options'} title="Map options"
              className={menuOpen ? 'active' : ''}
              style={{ width: 44, height: 44, padding: 0, flexShrink: 0, fontSize: 20, lineHeight: 1 }}>
              <span aria-hidden="true">{menuOpen ? '✕' : '☰'}</span>
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: '10px', rowGap: 2, fontSize: '12px', color: 'var(--color-muted)' }}>
            <span>{statusText}</span>
            <span>{viewLabel} · {activeLayerLabel}{routesShown > 0 ? ` · ${routesShown} routes shown` : ''}</span>
          </div>

          {menuOpen && (
            <div id="map-options" style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '10px' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>Cities as</span>
              {viewModeControl}
              <span style={{ fontSize: '12px', color: 'var(--color-muted)', marginTop: 4 }}>Size and color by</span>
              {layerControl}
              <div style={{ marginTop: 4 }}>{dataCredit}</div>
            </div>
          )}
        </header>

        <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="map-mobile">{mapArea}</div>
          <section aria-label="Selected cities" style={{ flex: 1, background: 'var(--color-surface)' }}>
            {panelControls}
            {tiles}
            {!menuOpen && <div style={{ padding: '0 16px 24px' }}>{dataCredit}</div>}
          </section>
        </main>
      </div>
    )
  }

  // ── Desktop (1024 px and up): header bar, resizable side panel, map ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>

      {/* Header */}
      <div style={{
        padding: '6px 16px', background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0, flexWrap: 'wrap',
      }}>
        {logoLink}
        <span style={{ fontWeight: 700, fontSize: '15px' }}>Marketplace trade routes</span>
        {dataCredit}
        <span style={{ color: 'var(--color-muted)', fontSize: '12px' }}>{statusText}</span>

        {/* View mode */}
        {viewModeControl}

        {/* Layer toggle */}
        {layerControl}

        {/* Route controls (per-city slider only) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
          {routesPerCitySlider}
          {routesShown > 0 && <span style={{ color: 'var(--color-muted)', fontSize: '12px' }}>{routesShown} routes shown</span>}
        </div>
      </div>

      {/* Body: panel + divider + map */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left panel */}
        <div style={{
          width: panelWidth, flexShrink: 0, display: 'flex', flexDirection: 'column',
          background: 'var(--color-surface)', borderRight: '1px solid var(--color-border)',
          overflow: 'hidden',
        }}>
          {/* Panel controls: fixed, not scrollable */}
          {panelControls}

          {/* Scrollable tiles */}
          {tiles}
        </div>

        {/* Divider */}
        <div
          onMouseDown={onDividerMouseDown}
          style={{ width: '5px', flexShrink: 0, cursor: 'col-resize', background: 'var(--color-border)', transition: 'background 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--color-blue)'}
          onMouseLeave={e => { if (!draggingRef.current) e.currentTarget.style.background = 'var(--color-border)' }}
        />

        {/* Map */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {mapArea}
        </div>
      </div>
    </div>
  )
}
