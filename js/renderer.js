// ═══════════════════════════════════════════════
//  WORLD CAPITALS — D3 Map Renderer
// ═══════════════════════════════════════════════

const MAP_PALETTE = [
  "#4a8fb5","#e8a87c","#7ec8a4","#c47ac0",
  "#e8c547","#85b0e8","#e88a8a","#a8d88a",
  "#8ab8e8","#f0a070","#90c8b0","#d090c0"
];

const Renderer = {
  svg: null,
  g: null,
  zoom: null,
  currentMapDef: null,
  loadedTopoCache: {},
  featuresInMap: [],    // currently rendered feature ids

  async renderMap(mapDef, onClickEntity) {
    this.currentMapDef = mapDef;
    this.featuresInMap = [];
    this.onClickEntity = onClickEntity;

    const svgEl = document.getElementById("map-svg");
    const loading = document.getElementById("map-loading");
    loading.style.display = "flex";

    // Clear previous
    d3.select(svgEl).selectAll("*").remove();

    const width  = svgEl.clientWidth  || svgEl.parentElement.clientWidth;
    const height = svgEl.clientHeight || svgEl.parentElement.clientHeight;

    this.svg = d3.select(svgEl)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("overflow", "hidden");

    // Ocean background — respect CSS theme variable
    const oceanColor = getComputedStyle(document.documentElement).getPropertyValue("--map-ocean").trim() || "#0d1e3a";
    this.svg.append("rect")
      .attr("width", width).attr("height", height)
      .attr("fill", oceanColor);

    this.g = this.svg.append("g").attr("class", "map-group");

    // Zoom
    this.zoom = d3.zoom()
      .scaleExtent([0.5, 16])
      .on("zoom", (event) => {
        this.g.attr("transform", event.transform);
      });
    this.svg.call(this.zoom);
    // Prevent zoom from blocking click on mobile
    this.svg.on("dblclick.zoom", null);

    try {
      const topo = await this._loadTopo(mapDef.topoUrl);

      if (mapDef.isUSStates) {
        this._renderUSStates(topo, width, height);
      } else {
        this._renderWorld(topo, mapDef, width, height);
      }

      loading.style.display = "none";
    } catch(e) {
      loading.innerHTML = `<p style="color:var(--red2)">Failed to load map. Check your internet connection.</p>`;
      console.error(e);
    }
  },

  async _loadTopo(url) {
    if (this.loadedTopoCache[url]) return this.loadedTopoCache[url];
    const topo = await d3.json(url);
    this.loadedTopoCache[url] = topo;
    return topo;
  },

  _renderWorld(topo, mapDef, width, height) {
    const obj = topo.objects[mapDef.topoObject];
    const allFeatures = topojson.feature(topo, obj).features;

    // Filter by continent if needed
    const features = mapDef.filter
      ? allFeatures.filter(f => mapDef.filter(String(f.id)))
      : allFeatures;

    // Graph coloring
    const geoAll = topojson.feature(topo, obj);
    const allNeighbors = topojson.neighbors(obj.geometries);

    // Build index: feature id → index in allFeatures
    const idToIdx = {};
    allFeatures.forEach((f, i) => { idToIdx[String(f.id)] = i; });

    // Build color assignments for filtered features
    const filteredIds = new Set(features.map(f => String(f.id)));
    const colorMap = {};

    for (let i = 0; i < allFeatures.length; i++) {
      const fid = String(allFeatures[i].id);
      if (!filteredIds.has(fid)) continue;
      const usedColors = new Set(
        allNeighbors[i]
          .map(j => colorMap[String(allFeatures[j].id)])
          .filter(c => c !== undefined)
      );
      let c = 0;
      while (usedColors.has(c)) c++;
      colorMap[fid] = c;
    }

    // Projection
    let projection;
    if (mapDef.projection === "NaturalEarth1") {
      projection = d3.geoNaturalEarth1();
    } else {
      projection = d3.geoMercator();
    }

    const pathGen = d3.geoPath().projection(projection);
    const fc = { type: "FeatureCollection", features };
    const padding = mapDef.projection === "NaturalEarth1" ? 10 : 20;
    projection.fitExtent([[padding, padding], [width - padding, height - padding]], fc);

    this.featuresInMap = features.map(f => String(f.id));

    // Graticule for world map
    if (mapDef.projection === "NaturalEarth1") {
      const graticule = d3.geoGraticule()();
      this.g.append("path")
        .datum(graticule)
        .attr("d", pathGen)
        .attr("fill", "none")
        .attr("stroke", "rgba(255,255,255,0.04)")
        .attr("stroke-width", 0.5);
    }

    // Render countries
    this.g.selectAll(".country-path")
      .data(features)
      .join("path")
        .attr("class", "country-path")
        .attr("id", d => `country-${d.id}`)
        .attr("d", pathGen)
        .attr("fill", d => MAP_PALETTE[(colorMap[String(d.id)] || 0) % MAP_PALETTE.length])
        .on("click", (event, d) => {
          event.stopPropagation();
          if (this.onClickEntity) this.onClickEntity(String(d.id));
        })
        .on("touchend", (event, d) => {
          event.preventDefault();
          event.stopPropagation();
          if (this.onClickEntity) this.onClickEntity(String(d.id));
        });

    // Country labels for study mode (only on large-ish areas)
    // (skip for performance; info shown in panel)
  },

  _renderUSStates(topo, width, height) {
    const obj = topo.objects[this.currentMapDef.topoObject];
    const features = topojson.feature(topo, obj).features;
    const neighbors = topojson.neighbors(obj.geometries);

    // Color assignment
    const colorMap = {};
    for (let i = 0; i < features.length; i++) {
      const fid = String(+features[i].id);
      const usedColors = new Set(
        neighbors[i]
          .map(j => colorMap[String(+features[j].id)])
          .filter(c => c !== undefined)
      );
      let c = 0;
      while (usedColors.has(c)) c++;
      colorMap[fid] = c;
    }

    const projection = d3.geoAlbersUsa();
    const pathGen = d3.geoPath().projection(projection);
    const fc = { type: "FeatureCollection", features };
    projection.fitExtent([[20, 20], [width - 20, height - 20]], fc);

    this.featuresInMap = features.map(f => String(+f.id));

    this.g.selectAll(".us-state-path")
      .data(features)
      .join("path")
        .attr("class", "us-state-path")
        .attr("id", d => `country-${+d.id}`)
        .attr("d", pathGen)
        .attr("fill", d => MAP_PALETTE[(colorMap[String(+d.id)] || 0) % MAP_PALETTE.length])
        .on("click", (event, d) => {
          event.stopPropagation();
          if (this.onClickEntity) this.onClickEntity(String(+d.id));
        })
        .on("touchend", (event, d) => {
          event.preventDefault();
          event.stopPropagation();
          if (this.onClickEntity) this.onClickEntity(String(+d.id));
        });
  },

  // ─── MARK STUDIED (study mode visited) ────
  markStudied(id) {
    const el = document.getElementById(`country-${id}`);
    if (el) el.classList.add("studied");
  },

  // ─── HIGHLIGHT ENTITY ─────────────────────
  highlightEntity(id, type) {
    // type: "correct" | "wrong" | "selected" | "dimmed" | "reset"
    const el = document.getElementById(`country-${id}`);
    if (!el) return;

    el.classList.remove("correct","wrong","dimmed","highlighted");
    if (type !== "reset") el.classList.add(type);
  },

  resetAllHighlights() {
    this.svg && this.svg.selectAll(".country-path, .us-state-path")
      .classed("correct", false)
      .classed("wrong", false)
      .classed("dimmed", false)
      .classed("highlighted", false);
  },

  dimAllExcept(ids) {
    const set = new Set(ids.map(String));
    this.svg && this.svg.selectAll(".country-path, .us-state-path")
      .each(function(d) {
        const fid = String(d ? (d.id !== undefined ? +d.id : d) : "");
        d3.select(this).classed("dimmed", !set.has(fid));
      });
  },

  getFeatureIds() { return this.featuresInMap; }
};

// ─── MINI MAP for cards ─────────────────────────
async function renderCardMiniMap(mapDef, containerEl) {
  try {
    const topo = await Renderer._loadTopo(mapDef.topoUrl);
    const obj  = topo.objects[mapDef.topoObject];
    const allFeatures = topojson.feature(topo, obj).features;
    const features = mapDef.filter
      ? allFeatures.filter(f => mapDef.filter(String(f.id)))
      : allFeatures;

    const W = containerEl.offsetWidth  || 188;
    const H = containerEl.offsetHeight || 130;

    // Build SVG on top of the existing bg
    const svg = d3.select(containerEl).append("svg")
      .style("position", "absolute").style("inset", "0").style("z-index", "2")
      .attr("width", W).attr("height", H);

    let projection;
    if (mapDef.isUSStates) projection = d3.geoAlbersUsa();
    else if (mapDef.projection === "NaturalEarth1") projection = d3.geoNaturalEarth1();
    else projection = d3.geoMercator();

    const pathGen = d3.geoPath().projection(projection);
    const fc = { type: "FeatureCollection", features };
    projection.fitExtent([[4, 4], [W - 4, H - 4]], fc);

    // Graph coloring
    const neighbors  = topojson.neighbors(obj.geometries);
    const filteredSet = new Set(features.map(f => String(f.id)));
    const colorMap = {};
    allFeatures.forEach((f, i) => {
      const fid = String(f.id);
      if (!filteredSet.has(fid)) return;
      const used = new Set(neighbors[i].map(j => colorMap[String(allFeatures[j].id)]).filter(c => c !== undefined));
      let c = 0; while (used.has(c)) c++;
      colorMap[fid] = c;
    });

    svg.selectAll("path")
      .data(features)
      .join("path")
        .attr("d", pathGen)
        .attr("fill", d => MAP_PALETTE[(colorMap[String(d.id)] || 0) % MAP_PALETTE.length])
        .attr("fill-opacity", 0.85)
        .attr("stroke", "rgba(0,0,0,0.5)")
        .attr("stroke-width", 0.4);

    // Hide emoji fallback once map renders
    const emoji = containerEl.querySelector(".card-emoji-fallback");
    if (emoji) emoji.style.display = "none";
  } catch(e) {
    // leave emoji fallback visible
  }
}
