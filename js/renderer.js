// ═══════════════════════════════════════════════
//  WORLD CAPITALS — D3 Map Renderer
// ═══════════════════════════════════════════════

const MAP_PALETTE = [
  "#4a7fa5","#c97b4b","#5ea87a","#9b63a8",
  "#b8a030","#4a8fa8","#a85050","#6a9a6a",
  "#7070b0","#b07840","#40a888","#a06080"
];

const Renderer = {
  svg: null,
  g: null,
  zoom: null,
  currentMapDef: null,
  loadedTopoCache: {},
  featuresInMap: [],
  onClickEntity: null,

  async renderMap(mapDef, onClickEntity) {
    this.currentMapDef = mapDef;
    this.featuresInMap = [];
    this.onClickEntity = onClickEntity;

    const svgEl  = document.getElementById("map-svg");
    const loading = document.getElementById("map-loading");
    loading.style.display = "flex";

    d3.select(svgEl).selectAll("*").remove();

    const width  = svgEl.clientWidth  || svgEl.parentElement.clientWidth;
    const height = svgEl.clientHeight || svgEl.parentElement.clientHeight;

    this.svg = d3.select(svgEl)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("overflow", "hidden");

    // Ocean
    const oceanColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--map-ocean").trim() || "#0d1e3a";
    this.svg.append("rect")
      .attr("width", width).attr("height", height)
      .style("fill", oceanColor);

    this.g = this.svg.append("g").attr("class", "map-root");

    // Zoom / pan
    this.zoom = d3.zoom()
      .scaleExtent([0.5, 16])
      .on("zoom", (event) => this.g.attr("transform", event.transform));
    this.svg.call(this.zoom);
    this.svg.on("dblclick.zoom", null);

    try {
      const topo = await this._loadTopo(mapDef.topoUrl);

      if (mapDef.isUSStates) {
        this._renderUSStates(topo, width, height);
      } else if (mapDef.showContext) {
        this._renderWithContext(topo, mapDef, width, height);
      } else {
        this._renderWorld(topo, mapDef, width, height);
      }

      loading.style.display = "none";
    } catch(e) {
      loading.innerHTML = `<p style="color:var(--rose-l)">Failed to load map. Check your internet connection.</p>`;
      console.error(e);
    }
  },

  async _loadTopo(url) {
    if (this.loadedTopoCache[url]) return this.loadedTopoCache[url];
    const topo = await d3.json(url);
    this.loadedTopoCache[url] = topo;
    return topo;
  },

  // ─── FULL WORLD (no filter) ─────────────────
  _renderWorld(topo, mapDef, width, height) {
    const obj         = topo.objects[mapDef.topoObject];
    const allFeatures = topojson.feature(topo, obj).features;
    const neighbors   = topojson.neighbors(obj.geometries);
    const colorMap    = this._greedyColor(allFeatures, allFeatures, neighbors);

    const projection = d3.geoNaturalEarth1();
    const pathGen    = d3.geoPath().projection(projection);
    projection.fitExtent([[10,10],[width-10,height-10]],
      { type:"FeatureCollection", features: allFeatures });

    // Graticule
    this.g.append("path")
      .datum(d3.geoGraticule()())
      .attr("d", pathGen)
      .attr("fill", "none")
      .style("stroke", "var(--map-grat)")
      .attr("stroke-width", 0.5);

    this.featuresInMap = allFeatures.map(f => String(f.id));

    this.g.selectAll(".country-path")
      .data(allFeatures)
      .join("path")
        .attr("class", "country-path")
        .attr("id",    d => `country-${d.id}`)
        .attr("d",     pathGen)
        .attr("fill",  d => MAP_PALETTE[(colorMap[String(d.id)] || 0) % MAP_PALETTE.length])
        .on("click",    (e,d) => { e.stopPropagation(); this.onClickEntity?.(String(d.id)); })
        .on("touchend", (e,d) => { e.preventDefault(); e.stopPropagation(); this.onClickEntity?.(String(d.id)); });
  },

  // ─── REGION WITH FULL WORLD CONTEXT ─────────
  _renderWithContext(topo, mapDef, width, height) {
    const obj         = topo.objects[mapDef.topoObject];
    const allFeatures = topojson.feature(topo, obj).features;
    const neighbors   = topojson.neighbors(obj.geometries);

    const isActive  = f => mapDef.filter ? mapDef.filter(String(f.id)) : true;
    const active    = allFeatures.filter(isActive);
    const bg        = allFeatures.filter(f => !isActive(f));
    const colorMap  = this._greedyColor(active, allFeatures, neighbors);

    // Projection fitted to the active region
    const projection = d3.geoNaturalEarth1();
    const pathGen    = d3.geoPath().projection(projection);
    const padding    = 40;
    projection.fitExtent(
      [[padding, padding], [width - padding, height - padding]],
      { type: "FeatureCollection", features: active }
    );

    this.featuresInMap = active.map(f => String(f.id));

    // ── SVG filter: blur + dim for background ──
    const defs = this.svg.insert("defs", ":first-child");
    const filter = defs.append("filter")
      .attr("id", "ctx-dim")
      .attr("x", "-20%").attr("y", "-20%")
      .attr("width", "140%").attr("height", "140%");
    filter.append("feGaussianBlur")
      .attr("in", "SourceGraphic")
      .attr("stdDeviation", "1.5")
      .attr("result", "blur");
    filter.append("feColorMatrix")
      .attr("in", "blur")
      .attr("type", "saturate")
      .attr("values", "0.15")
      .attr("result", "desaturated");
    filter.append("feBlend")
      .attr("in", "desaturated")
      .attr("in2", "SourceGraphic")
      .attr("mode", "normal");

    // ── Background (rest of world) ─────────────
    const dimColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--map-dim").trim() || "#1e2035";

    this.g.append("g")
      .attr("class", "bg-countries")
      .attr("filter", "url(#ctx-dim)")
      .selectAll("path")
      .data(bg)
      .join("path")
        .attr("d", pathGen)
        .style("fill", dimColor)
        .style("opacity", "0.55")
        .attr("stroke", "rgba(0,0,0,0.25)")
        .attr("stroke-width", 0.35);

    // ── Active region (coloured, interactive) ──
    this.g.append("g")
      .attr("class", "fg-countries")
      .selectAll(".country-path")
      .data(active)
      .join("path")
        .attr("class", "country-path")
        .attr("id",    d => `country-${d.id}`)
        .attr("d",     pathGen)
        .attr("fill",  d => MAP_PALETTE[(colorMap[String(d.id)] || 0) % MAP_PALETTE.length])
        .on("click",    (e,d) => { e.stopPropagation(); this.onClickEntity?.(String(d.id)); })
        .on("touchend", (e,d) => { e.preventDefault(); e.stopPropagation(); this.onClickEntity?.(String(d.id)); });

    // Subtle border between active region and bg
    this.g.append("g")
      .attr("class", "fg-borders")
      .selectAll("path")
      .data(active)
      .join("path")
        .attr("d", pathGen)
        .attr("fill", "none")
        .attr("stroke", "rgba(255,255,255,0.18)")
        .attr("stroke-width", 0.6);
  },

  // ─── US STATES ──────────────────────────────
  _renderUSStates(topo, width, height) {
    const obj       = topo.objects[this.currentMapDef.topoObject];
    const features  = topojson.feature(topo, obj).features;
    const neighbors = topojson.neighbors(obj.geometries);
    const colorMap  = this._greedyColor(features, features, neighbors, f => String(+f.id));

    const projection = d3.geoAlbersUsa();
    const pathGen    = d3.geoPath().projection(projection);
    projection.fitExtent([[20,20],[width-20,height-20]],
      { type:"FeatureCollection", features });

    this.featuresInMap = features.map(f => String(+f.id));

    this.g.selectAll(".us-state-path")
      .data(features)
      .join("path")
        .attr("class", "us-state-path")
        .attr("id",    d => `country-${+d.id}`)
        .attr("d",     pathGen)
        .attr("fill",  d => MAP_PALETTE[(colorMap[String(+d.id)] || 0) % MAP_PALETTE.length])
        .on("click",    (e,d) => { e.stopPropagation(); this.onClickEntity?.(String(+d.id)); })
        .on("touchend", (e,d) => { e.preventDefault(); e.stopPropagation(); this.onClickEntity?.(String(+d.id)); });
  },

  // ─── GREEDY GRAPH COLORING ──────────────────
  // colorFeatures: features to colour; allFeatures: full list for index lookup
  _greedyColor(colorFeatures, allFeatures, neighbors, idFn) {
    idFn = idFn || (f => String(f.id));
    const idxMap = {};
    allFeatures.forEach((f, i) => { idxMap[idFn(f)] = i; });

    const colorMap = {};
    colorFeatures.forEach(f => {
      const fid  = idFn(f);
      const idx  = idxMap[fid];
      if (idx === undefined) return;
      const used = new Set(
        (neighbors[idx] || [])
          .map(j => colorMap[idFn(allFeatures[j])])
          .filter(c => c !== undefined)
      );
      let c = 0;
      while (used.has(c)) c++;
      colorMap[fid] = c;
    });
    return colorMap;
  },

  // ─── HIGHLIGHT / MARK ───────────────────────
  highlightEntity(id, type) {
    const el = document.getElementById(`country-${id}`);
    if (!el) return;
    el.classList.remove("correct","wrong","dimmed","highlighted");
    if (type !== "reset") el.classList.add(type);
  },

  markStudied(id) {
    const el = document.getElementById(`country-${id}`);
    if (el) el.classList.add("studied");
  },

  resetAllHighlights() {
    this.svg && this.svg.selectAll(".country-path, .us-state-path")
      .classed("correct", false).classed("wrong", false)
      .classed("dimmed",  false).classed("highlighted", false);
  },

  getFeatureIds() { return this.featuresInMap; }
};

// ─── MINI MAP for grid cards (.mg-map / .mg-emoji) ──
async function renderCardMiniMap(mapDef, mapEl) {
  try {
    const topo        = await Renderer._loadTopo(mapDef.topoUrl);
    const obj         = topo.objects[mapDef.topoObject];
    const allFeatures = topojson.feature(topo, obj).features;

    const activeFeatures = mapDef.filter
      ? allFeatures.filter(f => mapDef.filter(String(f.id)))
      : allFeatures;
    const bgFeatures = mapDef.showContext
      ? allFeatures.filter(f => !mapDef.filter(String(f.id)))
      : [];

    // mapEl is the .mg-map div (position:absolute;inset:0 from CSS)
    const W = mapEl.parentElement?.offsetWidth  || 200;
    const H = mapEl.parentElement?.offsetHeight || 150;

    const svg = d3.select(mapEl).append("svg")
      .attr("width", W).attr("height", H)
      .style("display", "block");

    let projection;
    if (mapDef.isUSStates) projection = d3.geoAlbersUsa();
    else                   projection = d3.geoNaturalEarth1();

    const pathGen = d3.geoPath().projection(projection);
    projection.fitExtent([[3,3],[W-3,H-3]],
      { type:"FeatureCollection", features: activeFeatures });

    const neighbors = topojson.neighbors(obj.geometries);
    const colorMap  = Renderer._greedyColor(activeFeatures, allFeatures, neighbors);
    const dimColor  = getComputedStyle(document.documentElement)
      .getPropertyValue("--map-dim").trim() || "#141e30";

    // Dim background countries for context maps
    if (bgFeatures.length) {
      svg.append("g")
        .style("opacity","0.35")
        .style("filter","blur(0.7px)")
        .selectAll("path")
        .data(bgFeatures)
        .join("path")
          .attr("d", pathGen)
          .style("fill", dimColor)
          .attr("stroke","rgba(0,0,0,0.15)")
          .attr("stroke-width",0.3);
    }

    // Active region countries
    svg.selectAll(".mcp")
      .data(activeFeatures)
      .join("path")
        .attr("class","mcp")
        .attr("d", pathGen)
        .attr("fill", d => MAP_PALETTE[(colorMap[String(d.id)]||0) % MAP_PALETTE.length])
        .attr("fill-opacity", 0.9)
        .attr("stroke","rgba(0,0,0,0.5)")
        .attr("stroke-width", 0.4);

    // Hide sibling emoji once map renders
    const emoji = mapEl.parentElement?.querySelector(".mg-emoji");
    if (emoji) emoji.style.opacity = "0";
  } catch(e) { /* leave emoji visible */ }
}
