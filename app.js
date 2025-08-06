class Graph {
    constructor() {
        this.vertices = [];
        this.edges = [];
        this.periphery = [];
        this.selectedVertices = [];
        this.hoveredVertex = -1;
        this.manualMode = false;
        this.showIndices = false;
        this.maxVertexId = 0;
        
        // Initialize with basic triangle
        this.initializeTriangle();
    }
    
    initializeTriangle() {
        this.vertices = [
            { x: 0, y: -100, visible: true, id: 1 },
            { x: -87, y: 50, visible: true, id: 2 },
            { x: 87, y: 50, visible: true, id: 3 }
        ];
        this.edges = [[0, 1], [1, 2], [2, 0]];
        this.periphery = [0, 1, 2];
        this.selectedVertices = [];
        this.hoveredVertex = -1;
        this.maxVertexId = 3;
    }
    
    addVertex(x, y) {
        if (this.vertices.length >= 10000) {
            return { success: false, message: "Maximum vertex limit reached (10,000)" };
        }
        
        const newVertex = { x, y, visible: true, id: ++this.maxVertexId };
        const newIndex = this.vertices.length;
        
        // Validate position
        const validation = this.validateVertexPosition(x, y, newIndex);
        if (!validation.success) {
            return validation;
        }
        
        this.vertices.push(newVertex);
        
        // Add edges to selected periphery vertices
        for (const vertexIndex of this.selectedVertices) {
            const newEdge = [vertexIndex, newIndex];
            // Always add edge between new vertex and selected periphery vertices
            this.edges.push(newEdge);
        }
        
        // Update periphery
        this.updatePeriphery();
        this.selectedVertices = [];
        
        return { success: true, message: `Vertex ${this.maxVertexId} added successfully` };
    }
    
    validateVertexPosition(x, y, excludeIndex = -1) {
        // Check minimum distance to other vertices
        for (let i = 0; i < this.vertices.length; i++) {
            if (i === excludeIndex) continue;
            const dist = this.distance({ x, y }, this.vertices[i]);
            if (dist < 44) { // minVertexDistance
                return { success: false, message: "Too close to existing vertex" };
            }
        }
        
        // Check minimum distance to edges
        for (const [i, j] of this.edges) {
            if (i === excludeIndex || j === excludeIndex) continue;
            const dist = this.pointToLineDistance({ x, y }, this.vertices[i], this.vertices[j]);
            if (dist < 22) { // minEdgeDistance
                return { success: false, message: "Too close to existing edge" };
            }
        }
        
        // Check if outside current graph
        if (!this.isOutsideGraph(x, y)) {
            return { success: false, message: "Vertex must be placed outside current graph" };
        }
        
        return { success: true };
    }
    
    isOutsideGraph(x, y) {
        // Check if point is outside the convex hull of current vertices
        const hull = this.getConvexHull();
        return !this.pointInPolygon({ x, y }, hull);
    }
    
    getConvexHull() {
        // Use Graham scan algorithm
        const points = [...this.vertices];
        if (points.length < 3) return points;
        
        // Find bottom-most point (and leftmost if tie)
        let start = 0;
        for (let i = 1; i < points.length; i++) {
            if (points[i].y > points[start].y || 
                (points[i].y === points[start].y && points[i].x < points[start].x)) {
                start = i;
            }
        }
        
        // Sort points by polar angle with respect to start point
        const startPoint = points[start];
        const sortedPoints = points.filter((_, i) => i !== start).sort((a, b) => {
            const angleA = Math.atan2(a.y - startPoint.y, a.x - startPoint.x);
            const angleB = Math.atan2(b.y - startPoint.y, b.x - startPoint.x);
            return angleA - angleB;
        });
        
        const hull = [startPoint];
        for (const point of sortedPoints) {
            while (hull.length > 1 && this.ccw(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) {
                hull.pop();
            }
            hull.push(point);
        }
        
        return hull;
    }
    
    pointInPolygon(point, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            if (((polygon[i].y > point.y) !== (polygon[j].y > point.y)) &&
                (point.x < (polygon[j].x - polygon[i].x) * (point.y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) {
                inside = !inside;
            }
        }
        return inside;
    }
    
    wouldCauseIntersection(newEdge) {
        const [i, j] = newEdge;
        const p1 = this.vertices[i];
        const p2 = this.vertices[j];
        
        for (const [k, l] of this.edges) {
            if (k === i || k === j || l === i || l === j) continue;
            
            const p3 = this.vertices[k];
            const p4 = this.vertices[l];
            
            if (this.segmentsIntersect(p1, p2, p3, p4)) {
                return true;
            }
        }
        return false;
    }
    
    segmentsIntersect(p1, p2, p3, p4) {
        const ccw = (A, B, C) => (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
        return (ccw(p1, p3, p4) !== ccw(p2, p3, p4)) && (ccw(p1, p2, p3) !== ccw(p1, p2, p4));
    }
    
    ccw(A, B, C) {
        return (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
    }
    
    distance(p1, p2) {
        return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
    }
    
    pointToLineDistance(point, lineStart, lineEnd) {
        const A = lineEnd.x - lineStart.x;
        const B = lineEnd.y - lineStart.y;
        const C = point.x - lineStart.x;
        const D = point.y - lineStart.y;
        
        const dot = A * C + B * D;
        const lenSq = A * A + B * B;
        
        if (lenSq === 0) return this.distance(point, lineStart);
        
        let param = Math.max(0, Math.min(1, dot / lenSq));
        const closest = {
            x: lineStart.x + param * A,
            y: lineStart.y + param * B
        };
        
        return this.distance(point, closest);
    }
    
    updatePeriphery() {
        // Find convex hull and maintain clockwise order
        const hull = this.getConvexHull();
        this.periphery = hull.map(vertex => this.vertices.indexOf(vertex));
        
        // Ensure clockwise order
        this.ensureClockwiseOrder();
    }
    
    ensureClockwiseOrder() {
        if (this.periphery.length < 3) return;
        
        // Calculate signed area to check orientation
        let area = 0;
        for (let i = 0; i < this.periphery.length; i++) {
            const j = (i + 1) % this.periphery.length;
            const vi = this.vertices[this.periphery[i]];
            const vj = this.vertices[this.periphery[j]];
            area += (vj.x - vi.x) * (vj.y + vi.y);
        }
        
        // If counter-clockwise, reverse
        if (area < 0) {
            this.periphery.reverse();
        }
    }
    
    findOptimalPosition(selectedIndices) {
        // Calculate centroid of selected vertices
        let cx = 0, cy = 0;
        for (const index of selectedIndices) {
            cx += this.vertices[index].x;
            cy += this.vertices[index].y;
        }
        cx /= selectedIndices.length;
        cy /= selectedIndices.length;
        
        // Calculate graph center
        let gx = 0, gy = 0;
        for (const vertex of this.vertices) {
            gx += vertex.x;
            gy += vertex.y;
        }
        gx /= this.vertices.length;
        gy /= this.vertices.length;
        
        // Direction vector from graph center to centroid
        const dx = cx - gx;
        const dy = cy - gy;
        const len = Math.sqrt(dx * dx + dy * dy);
        
        if (len === 0) {
            // Fallback: use perpendicular to first edge
            const v1 = this.vertices[selectedIndices[0]];
            const v2 = this.vertices[selectedIndices[1] || selectedIndices[0]];
            const edgeDx = v2.x - v1.x;
            const edgeDy = v2.y - v1.y;
            const perpDx = -edgeDy;
            const perpDy = edgeDx;
            const perpLen = Math.sqrt(perpDx * perpDx + perpDy * perpDy);
            
            return {
                x: cx + (perpDx / perpLen) * 100,
                y: cy + (perpDy / perpLen) * 100
            };
        }
        
        // Normalize direction
        const ndx = dx / len;
        const ndy = dy / len;
        
        // Try positions at increasing distances
        for (let dist = 60; dist <= 200; dist += 20) {
            const candidate = {
                x: cx + ndx * dist,
                y: cy + ndy * dist
            };
            
            const validation = this.validateVertexPosition(candidate.x, candidate.y);
            if (validation.success) {
                return candidate;
            }
        }
        
        return null;
    }
}

class GraphRenderer {
    constructor(canvas, graph) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.graph = graph;
        
        // Viewport properties
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        
        // Colors
        this.colors = {
            vertex: '#3498db',
            periphery: '#e74c3c',
            edge: '#2c3e50',
            peripheryEdge: '#f39c12',
            selected: '#9b59b6',
            hover: '#1abc9c',
            background: '#ffffff'
        };
        
        this.setupCanvas();
    }
    
    setupCanvas() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        this.render();
    }
    
    worldToScreen(x, y) {
        const centerX = this.canvas.width / (2 * window.devicePixelRatio);
        const centerY = this.canvas.height / (2 * window.devicePixelRatio);
        
        return {
            x: centerX + (x + this.panX) * this.zoom,
            y: centerY + (y + this.panY) * this.zoom
        };
    }
    
    screenToWorld(x, y) {
        const centerX = this.canvas.width / (2 * window.devicePixelRatio);
        const centerY = this.canvas.height / (2 * window.devicePixelRatio);
        
        return {
            x: (x - centerX) / this.zoom - this.panX,
            y: (y - centerY) / this.zoom - this.panY
        };
    }
    
    render() {
        const ctx = this.ctx;
        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Draw edges
        this.drawEdges();
        
        // Draw periphery outline
        this.drawPeripheryOutline();
        
        // Draw vertices
        this.drawVertices();
    }
    
    drawEdges() {
        const ctx = this.ctx;
        
        for (const [i, j] of this.graph.edges) {
            const v1 = this.graph.vertices[i];
            const v2 = this.graph.vertices[j];
            
            if (!v1.visible || !v2.visible) continue;
            
            const p1 = this.worldToScreen(v1.x, v1.y);
            const p2 = this.worldToScreen(v2.x, v2.y);
            
            const isPeripheryEdge = this.isPeripheryEdge(i, j);
            
            ctx.strokeStyle = isPeripheryEdge ? this.colors.peripheryEdge : this.colors.edge;
            ctx.lineWidth = Math.max(1, this.zoom * 1.5);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        }
    }
    
    drawPeripheryOutline() {
        if (this.graph.periphery.length < 3) return;
        
        const ctx = this.ctx;
        ctx.strokeStyle = this.colors.peripheryEdge;
        ctx.lineWidth = Math.max(2, this.zoom * 2);
        ctx.setLineDash([5, 5]);
        
        ctx.beginPath();
        for (let i = 0; i < this.graph.periphery.length; i++) {
            const vertex = this.graph.vertices[this.graph.periphery[i]];
            if (!vertex.visible) continue;
            
            const p = this.worldToScreen(vertex.x, vertex.y);
            if (i === 0) {
                ctx.moveTo(p.x, p.y);
            } else {
                ctx.lineTo(p.x, p.y);
            }
        }
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
    }
    
    drawVertices() {
        const ctx = this.ctx;
        const radius = Math.max(8, this.zoom * 12);
        
        for (let i = 0; i < this.graph.vertices.length; i++) {
            const vertex = this.graph.vertices[i];
            if (!vertex.visible) continue;
            
            const p = this.worldToScreen(vertex.x, vertex.y);
            
            // Determine color
            let color = this.colors.vertex;
            if (i === this.graph.hoveredVertex) {
                color = this.colors.hover;
            } else if (this.graph.selectedVertices.includes(i)) {
                color = this.colors.selected;
            } else if (this.graph.periphery.includes(i)) {
                color = this.colors.periphery;
            }
            
            // Draw vertex
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, radius, 0, 2 * Math.PI);
            ctx.fill();
            
            // Draw border
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = Math.max(1, this.zoom);
            ctx.stroke();
            
            // Draw label
            if (this.graph.showIndices || this.zoom > 0.5) {
                ctx.fillStyle = '#ffffff';
                ctx.font = `bold ${Math.max(10, this.zoom * 12)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(vertex.id.toString(), p.x, p.y);
            }
        }
    }
    
    isPeripheryEdge(i, j) {
        const iIdx = this.graph.periphery.indexOf(i);
        const jIdx = this.graph.periphery.indexOf(j);
        
        if (iIdx === -1 || jIdx === -1) return false;
        
        const diff = Math.abs(iIdx - jIdx);
        return diff === 1 || diff === this.graph.periphery.length - 1;
    }
    
    centerAndFit() {
        if (this.graph.vertices.length === 0) return;
        
        // Calculate bounding box
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        for (const vertex of this.graph.vertices) {
            if (!vertex.visible) continue;
            minX = Math.min(minX, vertex.x);
            maxX = Math.max(maxX, vertex.x);
            minY = Math.min(minY, vertex.y);
            maxY = Math.max(maxY, vertex.y);
        }
        
        // Center on bounding box
        this.panX = -(minX + maxX) / 2;
        this.panY = -(minY + maxY) / 2;
        
        // Fit to view
        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;
        const graphWidth = maxX - minX;
        const graphHeight = maxY - minY;
        
        if (graphWidth > 0 && graphHeight > 0) {
            const scaleX = (width * 0.8) / graphWidth;
            const scaleY = (height * 0.8) / graphHeight;
            this.zoom = Math.min(scaleX, scaleY, 2);
        } else {
            this.zoom = 1;
        }
        
        this.render();
    }
    
    getVertexAt(screenX, screenY) {
        const worldPos = this.screenToWorld(screenX, screenY);
        const radius = Math.max(15, this.zoom * 20);
        
        for (let i = 0; i < this.graph.vertices.length; i++) {
            const vertex = this.graph.vertices[i];
            if (!vertex.visible) continue;
            
            const dist = this.graph.distance(worldPos, vertex);
            if (dist * this.zoom <= radius) {
                return i;
            }
        }
        return -1;
    }
}

class GraphApp {
    constructor() {
        this.graph = new Graph();
        this.renderer = null;
        this.isDragging = false;
        this.lastMousePos = { x: 0, y: 0 };
        
        this.initializeUI();
        this.setupEventListeners();
        this.showMessage('Welcome! Start with a triangle and add vertices.', 'info');
    }
    
    initializeUI() {
        const canvas = document.getElementById('graphCanvas');
        this.renderer = new GraphRenderer(canvas, this.graph);
        this.renderer.centerAndFit();
        this.updateUI();
    }
    
    setupEventListeners() {
        // Button event listeners with proper binding
        document.getElementById('startTriangle').addEventListener('click', (e) => {
            e.preventDefault();
            this.startTriangle();
        });
        
        document.getElementById('addRandom').addEventListener('click', (e) => {
            e.preventDefault();
            this.addRandomVertex();
        });
        
        document.getElementById('manualMode').addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleManualMode();
        });
        
        document.getElementById('centerGraph').addEventListener('click', (e) => {
            e.preventDefault();
            this.centerGraph();
        });
        
        document.getElementById('zoomIn').addEventListener('click', (e) => {
            e.preventDefault();
            this.zoom(1.2);
        });
        
        document.getElementById('zoomOut').addEventListener('click', (e) => {
            e.preventDefault();
            this.zoom(0.8);
        });
        
        document.getElementById('toggleDisplay').addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleDisplay();
        });
        
        document.getElementById('redrawOptimize').addEventListener('click', (e) => {
            e.preventDefault();
            this.redrawOptimize();
        });
        
        document.getElementById('goToBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.goToVertex();
        });
        document.getElementById('clearSelection').addEventListener('click', (e) => {
            e.preventDefault(); this.clearSelection();
        });
        
        // Canvas event listeners
        const canvas = document.getElementById('graphCanvas');
        canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Keyboard event listeners
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        // Go to vertex input
        document.getElementById('goToVertex').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.goToVertex();
        });
    }
    
    startTriangle() {
        this.graph.initializeTriangle();
        this.graph.manualMode = false;
        this.updateManualModeUI();
        this.renderer.centerAndFit();
        this.updateUI();
        this.showMessage('Triangle reset successfully', 'success');
    }
    
    addRandomVertex() {
        if (this.graph.periphery.length < 2) {
            this.showMessage('Need at least 2 periphery vertices', 'error');
            return;
        }
        
        // Select 2-3 contiguous periphery vertices randomly
        const numToSelect = Math.min(3, Math.max(2, Math.floor(Math.random() * 3) + 2));
        const startIdx = Math.floor(Math.random() * this.graph.periphery.length);
        
        const selectedIndices = [];
        for (let i = 0; i < numToSelect; i++) {
            const idx = (startIdx + i) % this.graph.periphery.length;
            selectedIndices.push(this.graph.periphery[idx]);
        }
        
        this.graph.selectedVertices = selectedIndices;
        const position = this.graph.findOptimalPosition(selectedIndices);
        
        if (!position) {
            this.showMessage('Could not find valid position for new vertex', 'error');
            this.graph.selectedVertices = [];
            this.renderer.render();
            this.updateUI();
            return;
        }
        
        const result = this.graph.addVertex(position.x, position.y);
        this.showMessage(result.message, result.success ? 'success' : 'error');
        this.renderer.render();
        this.updateUI();
    }
    
    toggleManualMode() {
        this.graph.manualMode = !this.graph.manualMode;
        this.graph.selectedVertices = [];
        this.updateManualModeUI();
        this.updateUI();
        
        if (this.graph.manualMode) {
            this.showMessage('Manual mode: Click two periphery vertices', 'info');
        } else {
            this.showMessage('Manual mode disabled', 'info');
        }
        
        this.renderer.render();
    }
    
    clearSelection() {
        this.graph.selectedVertices = [];
        this.graph.segmentVertices = [];
        this.renderer.render();
        this.updateUI();
        this.showMessage('Selection cleared', 'info');
    }
    
    updateManualModeUI() {
        const canvas = document.getElementById('graphCanvas');
        const button = document.getElementById('manualMode');
        
        if (this.graph.manualMode) {
            canvas.classList.add('manual-mode');
            button.classList.add('manual-mode-active');
        } else {
            canvas.classList.remove('manual-mode');
            button.classList.remove('manual-mode-active');
        }

        // Update cursor style
        canvas.style.cursor = this.graph.manualMode ? 'crosshair' : 'grab';
        document.body.style.cursor = this.graph.manualMode ? 'crosshair' : 'default';
        document.getElementById('currentMode').textContent = 
            this.graph.manualMode ? 
            `Manual Mode (${this.graph.selectedVertices.length}/2 selected)` :
            'Normal Mode';
        document.getElementById('mouseCoords').textContent = '(0, 0)';
        document.getElementById('vertexCount').textContent = this.graph.vertices.filter(v => v.visible).length;
        document.getElementById('edgeCount').textContent = this.graph.edges.length;
        document.getElementById('peripheryCount').textContent = this.graph.periphery.length;
        document.getElementById('zoomLevel').textContent = `Zoom: ${Math.round(this.renderer.zoom * 100)}%`;
        document.getElementById('goToVertex').value = '';
        document.getElementById('goToVertex').disabled = this.graph.manualMode;
        document.getElementById('goToBtn').disabled = this.graph.manualMode;
        document.getElementById('toggleDisplay').disabled = this.graph.manualMode;
        document.getElementById('redrawOptimize').disabled = this.graph.manualMode;
        document.getElementById('startTriangle').disabled = this.graph.manualMode;
        document.getElementById('addRandom').disabled = this.graph.manualMode;
        document.getElementById('centerGraph').disabled = this.graph.manualMode;    
    }
    
    centerGraph() {
        this.renderer.centerAndFit();
        this.updateUI();
        this.showMessage('Graph centered and fitted', 'success');
    }
    
    zoom(factor) {
        const oldZoom = this.renderer.zoom;
        this.renderer.zoom *= factor;
        this.renderer.zoom = Math.max(0.1, Math.min(5, this.renderer.zoom));
        
        if (oldZoom !== this.renderer.zoom) {
            this.renderer.render();
            this.updateUI();
            
            // Visual feedback for zoom
            const zoomBtn = factor > 1 ? document.getElementById('zoomIn') : document.getElementById('zoomOut');
            zoomBtn.classList.add('btn--active');
            setTimeout(() => zoomBtn.classList.remove('btn--active'), 150);
        }
    }
    
    toggleDisplay() {
        this.graph.showIndices = !this.graph.showIndices;
        this.renderer.render();
        this.showMessage(`Display mode: ${this.graph.showIndices ? 'Indices' : 'Colors'}`, 'info');
    }
    
    redrawOptimize() {
        this.graph.updatePeriphery();
        this.renderer.render();
        this.updateUI();
        this.showMessage('Graph optimized', 'success');
    }
    
    goToVertex() {
        const input = document.getElementById('goToVertex');
        const vertexNum = parseInt(input.value);
        
        if (isNaN(vertexNum) || vertexNum < 1) {
            this.showMessage('Please enter a valid vertex number', 'error');
            return;
        }
        
        // Hide vertices with id > vertexNum
        for (const vertex of this.graph.vertices) {
            vertex.visible = vertex.id <= vertexNum;
        }
        
        this.renderer.render();
        this.updateUI();
        this.showMessage(`Showing vertices 1 to ${vertexNum}`, 'info');
    }
    
    handleMouseDown(e) {
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const vertexIndex = this.renderer.getVertexAt(x, y);
        
        if (this.graph.manualMode && vertexIndex !== -1 && this.graph.periphery.includes(vertexIndex)) {
            // Manual mode vertex selection
            if (this.graph.selectedVertices.includes(vertexIndex)) {
                // Deselect
                this.graph.selectedVertices = this.graph.selectedVertices.filter(i => i !== vertexIndex);
            } else if (this.graph.selectedVertices.length < 2) {
                // Select
                this.graph.selectedVertices.push(vertexIndex);
            }
            
            // If we have 2 selected vertices, try to add new vertex
            if (this.graph.selectedVertices.length === 2) {
                const position = this.graph.findOptimalPosition(this.graph.selectedVertices);
                if (position) {
                    const result = this.graph.addVertex(position.x, position.y);
                    this.showMessage(result.message, result.success ? 'success' : 'error');
                    this.updateUI();
                } else {
                    this.showMessage('Could not find valid position', 'error');
                    this.graph.selectedVertices = [];
                }
            }
            
            this.renderer.render();
        } else {
            // Start dragging
            this.isDragging = true;
            this.lastMousePos = { x, y };
            e.target.style.cursor = 'grabbing';
        }
    }
    
    handleMouseMove(e) {
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (this.isDragging) {
            // Pan the view
            const dx = x - this.lastMousePos.x;
            const dy = y - this.lastMousePos.y;
            
            this.renderer.panX += dx / this.renderer.zoom;
            this.renderer.panY += dy / this.renderer.zoom;
            
            this.lastMousePos = { x, y };
            this.renderer.render();
        } else {
            // Update hover state
            const vertexIndex = this.renderer.getVertexAt(x, y);
            if (vertexIndex !== this.graph.hoveredVertex) {
                this.graph.hoveredVertex = vertexIndex;
                this.renderer.render();
            }
            
            // Update mouse coordinates display
            const worldPos = this.renderer.screenToWorld(x, y);
            document.getElementById('mouseCoords').textContent = 
                `(${Math.round(worldPos.x)}, ${Math.round(worldPos.y)})`;
        }
    }
    
    handleMouseUp(e) {
        this.isDragging = false;
        e.target.style.cursor = this.graph.manualMode ? 'crosshair' : 'grab';
    }
    
    handleWheel(e) {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        this.zoom(factor);
    }
    
    handleKeyDown(e) {
        // Only handle if not typing in input field
        if (e.target.tagName === 'INPUT') return;
        
        switch (e.key.toLowerCase()) {
            case 's': 
                e.preventDefault();
                this.startTriangle(); 
                break;
            case 'r': 
                e.preventDefault();
                this.addRandomVertex(); 
                break;
            case 'a': 
                e.preventDefault();
                this.toggleManualMode(); 
                break;
            case 'c': 
                e.preventDefault();
                this.centerGraph(); 
                break;
            case 't': 
                e.preventDefault();
                this.toggleDisplay(); 
                break;
            case '+': 
            case '=': 
                e.preventDefault();
                this.zoom(1.2); 
                break;
            case '-': 
                e.preventDefault();
                this.zoom(0.8); 
                break;
        }
    }
    
    updateUI() {
        // Update statistics immediately
        const visibleVertices = this.graph.vertices.filter(v => v.visible).length;
        document.getElementById('vertexCount').textContent = visibleVertices;
        document.getElementById('edgeCount').textContent = this.graph.edges.length;
        document.getElementById('peripheryCount').textContent = this.graph.periphery.length;
        
        // Update mode display
        const mode = this.graph.manualMode ? 
            `Manual Mode (${this.graph.selectedVertices.length}/2 selected)` : 'Normal Mode';
        document.getElementById('currentMode').textContent = mode;
        
        // Update zoom display
        document.getElementById('zoomLevel').textContent = `Zoom: ${Math.round(this.renderer.zoom * 100)}%`;
    }
    
    showMessage(text, type = 'info') {
        const container = document.getElementById('messageContainer');
        const message = document.createElement('div');
        message.className = `message message--${type}`;
        message.textContent = text;
        
        container.appendChild(message);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (message && message.parentNode) {
                message.parentNode.removeChild(message);
            }
        }, 5000);
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.graphApp = new GraphApp();
});