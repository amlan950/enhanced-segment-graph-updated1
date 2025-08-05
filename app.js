class Graph {
    constructor() {
        this.vertices = [];
        this.edges = [];
        this.periphery = [];
        this.selectedVertices = [];
        this.segmentVertices = [];
        this.hoveredVertex = -1;
        this.manualMode = false;
        this.showIndices = false;
        this.maxVertexId = 0;
        this.vertexRadius = 15;
        
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
        this.segmentVertices = [];
        this.hoveredVertex = -1;
        this.maxVertexId = 3;
    }
    
    // ROBUST CCW INTERSECTION TEST - Most critical method
    segmentsIntersect(p1, p2, p3, p4) {
        // CCW orientation test - returns true if A->B->C is counter-clockwise
        function ccw(A, B, C) {
            return (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
        }
        
        // Two segments intersect if:
        // 1. Endpoints of first segment are on opposite sides of second segment AND
        // 2. Endpoints of second segment are on opposite sides of first segment
        return (ccw(p1, p3, p4) !== ccw(p2, p3, p4)) && 
               (ccw(p1, p2, p3) !== ccw(p1, p2, p4));
    }
    
    // Check if two edges share a vertex (allowed intersection)
    edgesShareVertex(edge1, edge2) {
        if (!edge1.start || !edge1.end || !edge2.start || !edge2.end) return false;
        
        // For edges with positions, check if any vertex positions match
        const tolerance = 0.001;
        return (
            this.distance(edge1.start, edge2.start) < tolerance ||
            this.distance(edge1.start, edge2.end) < tolerance ||
            this.distance(edge1.end, edge2.start) < tolerance ||
            this.distance(edge1.end, edge2.end) < tolerance
        );
    }
    
    // COMPREHENSIVE EDGE VALIDATION SYSTEM
    validateNewEdges(newVertexPos, segmentVertices) {
        const newEdges = segmentVertices.map(vIdx => ({
            start: newVertexPos,
            end: this.vertices[vIdx]
        }));
        
        // Check EVERY new edge against EVERY existing edge
        for (const newEdge of newEdges) {
            for (const existingEdge of this.edges) {
                const v1 = this.vertices[existingEdge[0]];
                const v2 = this.vertices[existingEdge[1]];
                
                if (!v1.visible || !v2.visible) continue;
                
                // Skip if edges share a vertex (allowed intersection)
                const existingEdgeObj = { start: v1, end: v2 };
                if (this.edgesShareVertex(newEdge, existingEdgeObj)) continue;
                
                // CRITICAL: Test for intersection
                if (this.segmentsIntersect(newEdge.start, newEdge.end, v1, v2)) {
                    return {
                        valid: false,
                        message: `New edge would intersect existing edge V${v1.id}-V${v2.id}`,
                        intersectingEdge: `V${v1.id}-V${v2.id}`
                    };
                }
            }
            
            // Also check new edges against each other
            for (const otherNewEdge of newEdges) {
                if (newEdge === otherNewEdge) continue;
                if (!this.edgesShareVertex(newEdge, otherNewEdge) && 
                    this.segmentsIntersect(newEdge.start, newEdge.end, otherNewEdge.start, otherNewEdge.end)) {
                    return {
                        valid: false,
                        message: 'New edges would intersect each other'
                    };
                }
            }
        }
        
        return { valid: true };
    }
    
    // ENHANCED POSITION FINDING WITH INTERSECTION AVOIDANCE
    findNonIntersectingPosition(segmentVertices) {
        const centroid = this.calculateCentroid(segmentVertices);
        const graphCenter = this.calculateGraphCenter();
        
        // Base direction outward from graph
        let direction = this.normalizeVector({
            x: centroid.x - graphCenter.x,
            y: centroid.y - graphCenter.y
        });
        
        // Try multiple distances and angles
        const baseDistance = 80; // Start further out
        const maxAttempts = 32; // More attempts
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            // Vary both distance and angle
            const distance = baseDistance + (attempt * 20);
            const angleOffset = (attempt % 8) * (Math.PI / 4); // 8 directions
            
            const testDirection = {
                x: direction.x * Math.cos(angleOffset) - direction.y * Math.sin(angleOffset),
                y: direction.x * Math.sin(angleOffset) + direction.y * Math.cos(angleOffset)
            };
            
            const candidate = {
                x: centroid.x + testDirection.x * distance,
                y: centroid.y + testDirection.y * distance
            };
            
            // First check basic constraints (vertex/edge overlaps)
            const basicValidation = this.validateBasicPosition(candidate);
            if (!basicValidation.valid) continue;
            
            // CRITICAL: Check if this position would cause edge intersections
            const intersectionCheck = this.validateNewEdges(candidate, segmentVertices);
            if (intersectionCheck.valid) {
                return candidate;
            }
        }
        
        return null; // No valid position found
    }
    
    calculateCentroid(segmentVertices) {
        let cx = 0, cy = 0;
        for (const vIdx of segmentVertices) {
            const vertex = this.vertices[vIdx];
            cx += vertex.x;
            cy += vertex.y;
        }
        return { x: cx / segmentVertices.length, y: cy / segmentVertices.length };
    }
    
    calculateGraphCenter() {
        let gx = 0, gy = 0;
        const visibleVertices = this.vertices.filter(v => v.visible);
        for (const vertex of visibleVertices) {
            gx += vertex.x;
            gy += vertex.y;
        }
        return { x: gx / visibleVertices.length, y: gy / visibleVertices.length };
    }
    
    normalizeVector(vector) {
        const len = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
        if (len === 0) return { x: 1, y: 0 }; // Default direction
        return { x: vector.x / len, y: vector.y / len };
    }
    
    // MULTI-LAYER VALIDATION SYSTEM
    validateBasicPosition(candidate) {
        // Layer 1: Geometric Constraints
        
        // Minimum vertex-vertex distance: 50px (increased from 44px)
        for (let i = 0; i < this.vertices.length; i++) {
            if (!this.vertices[i].visible) continue;
            const dist = this.distance(candidate, this.vertices[i]);
            if (dist < 50) {
                return { 
                    valid: false, 
                    message: "New vertex would be too close to existing vertex" 
                };
            }
        }
        
        // Minimum vertex-edge distance: 30px (increased from 22px)
        for (const [i, j] of this.edges) {
            if (!this.vertices[i].visible || !this.vertices[j].visible) continue;
            const dist = this.pointToLineDistance(candidate, this.vertices[i], this.vertices[j]);
            if (dist < 30) {
                return { 
                    valid: false, 
                    message: "New vertex too close to existing edge" 
                };
            }
        }
        
        // Outside placement: Must be outside convex hull with margin
        if (!this.isOutsideGraph(candidate.x, candidate.y, 40)) {
            return { 
                valid: false, 
                message: "Vertex must be placed outside current graph with sufficient margin" 
            };
        }
        
        return { valid: true };
    }
    
    // STRESS TESTING SYSTEM - Validate graph integrity
    validateGraphIntegrity() {
        // Check all edge pairs for intersections
        for (let i = 0; i < this.edges.length; i++) {
            for (let j = i + 1; j < this.edges.length; j++) {
                const edge1 = this.edges[i];
                const edge2 = this.edges[j];
                
                // Skip if edges share a vertex
                if (edge1[0] === edge2[0] || edge1[0] === edge2[1] || 
                    edge1[1] === edge2[0] || edge1[1] === edge2[1]) continue;
                
                const v1 = this.vertices[edge1[0]];
                const v2 = this.vertices[edge1[1]];
                const v3 = this.vertices[edge2[0]];
                const v4 = this.vertices[edge2[1]];
                
                if (!v1.visible || !v2.visible || !v3.visible || !v4.visible) continue;
                
                if (this.segmentsIntersect(v1, v2, v3, v4)) {
                    console.error('GRAPH INTEGRITY VIOLATION: Crossing detected!');
                    return {
                        valid: false,
                        message: `Graph integrity error - crossing between V${v1.id}-V${v2.id} and V${v3.id}-V${v4.id}!`
                    };
                }
            }
        }
        return { valid: true };
    }
    
    // Get all vertices in the segment between two periphery indices (inclusive)
    getPeripherySegment(startIdx, endIdx) {
        const segment = [];
        const n = this.periphery.length;
        
        if (startIdx === endIdx) {
            return [this.periphery[startIdx]];
        }
        
        // Handle circular array traversal clockwise
        let current = startIdx;
        while (true) {
            segment.push(this.periphery[current]);
            if (current === endIdx) break;
            current = (current + 1) % n;
        }
        
        return segment;
    }
    
    // Process segment selection and add vertex connecting to ALL segment vertices
    processSegmentSelection() {
        if (this.selectedVertices.length !== 2) {
            return { success: false, message: "Must select exactly 2 periphery vertices" };
        }
        
        const [v1Idx, v2Idx] = this.selectedVertices;
        const p1Idx = this.periphery.indexOf(v1Idx);
        const p2Idx = this.periphery.indexOf(v2Idx);
        
        if (p1Idx === -1 || p2Idx === -1) {
            return { success: false, message: "Selected vertices must be in periphery" };
        }
        
        // Get all vertices in the segment
        this.segmentVertices = this.getPeripherySegment(p1Idx, p2Idx);
        
        if (this.segmentVertices.length < 2) {
            return { success: false, message: "Segment must contain at least 2 vertices" };
        }
        
        // ENHANCED: Find position that avoids ALL intersections
        const newPosition = this.findNonIntersectingPosition(this.segmentVertices);
        if (!newPosition) {
            return { 
                success: false, 
                message: "Cannot find valid position that maintains planarity - no valid placement found after comprehensive search" 
            };
        }
        
        // CRITICAL: Final validation before adding
        const finalValidation = this.validateNewEdges(newPosition, this.segmentVertices);
        if (!finalValidation.valid) {
            return { 
                success: false, 
                message: `Cannot add vertex: ${finalValidation.message}` 
            };
        }
        
        // Add vertex and connect to ALL segment vertices
        const newVertexIdx = this.vertices.length;
        this.vertices.push({ 
            x: newPosition.x, 
            y: newPosition.y, 
            visible: true, 
            id: ++this.maxVertexId 
        });
        
        // Create edges to ALL vertices in the segment
        for (const vIdx of this.segmentVertices) {
            this.edges.push([newVertexIdx, vIdx]);
        }
        
        // Update periphery: replace entire segment with new vertex
        this.updatePeripheryAfterSegmentReplacement(p1Idx, p2Idx, newVertexIdx);
        
        // STRESS TEST: Validate graph integrity after operation
        const integrityCheck = this.validateGraphIntegrity();
        if (!integrityCheck.valid) {
            // Rollback if integrity is compromised
            this.vertices.pop();
            this.edges = this.edges.slice(0, -this.segmentVertices.length);
            this.updatePeriphery();
            return { 
                success: false, 
                message: `Operation rolled back: ${integrityCheck.message}` 
            };
        }
        
        // Clear selections
        this.selectedVertices = [];
        this.segmentVertices = [];
        
        return { 
            success: true, 
            message: `Added vertex V${this.maxVertexId} connecting to segment of ${this.segmentVertices.length} vertices - planarity maintained` 
        };
    }
    
    updatePeripheryAfterSegmentReplacement(startIdx, endIdx, newVertexIdx) {
        // Calculate number of vertices to replace
        const n = this.periphery.length;
        
        // Remove the segment and insert new vertex
        const newPeriphery = [];
        
        if (startIdx <= endIdx) {
            // Simple case: segment doesn't wrap around
            newPeriphery.push(...this.periphery.slice(0, startIdx));
            newPeriphery.push(newVertexIdx);
            newPeriphery.push(...this.periphery.slice(endIdx + 1));
        } else {
            // Segment wraps around the array
            newPeriphery.push(...this.periphery.slice(endIdx + 1, startIdx));
            newPeriphery.push(newVertexIdx);
        }
        
        this.periphery = newPeriphery;
        this.ensureClockwiseOrder();
    }
    
    isOutsideGraph(x, y, margin = 0) {
        const hull = this.getConvexHull();
        if (hull.length < 3) return true;
        
        // Expand hull by margin if specified
        if (margin > 0) {
            const expandedHull = this.expandPolygon(hull, margin);
            return !this.pointInPolygon({ x, y }, expandedHull);
        }
        
        return !this.pointInPolygon({ x, y }, hull);
    }
    
    expandPolygon(polygon, margin) {
        // Simple polygon expansion by moving each vertex outward
        const center = this.calculatePolygonCenter(polygon);
        return polygon.map(vertex => {
            const dx = vertex.x - center.x;
            const dy = vertex.y - center.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len === 0) return vertex;
            
            const normalizedDx = dx / len;
            const normalizedDy = dy / len;
            
            return {
                x: vertex.x + normalizedDx * margin,
                y: vertex.y + normalizedDy * margin
            };
        });
    }
    
    calculatePolygonCenter(polygon) {
        let cx = 0, cy = 0;
        for (const vertex of polygon) {
            cx += vertex.x;
            cy += vertex.y;
        }
        return { x: cx / polygon.length, y: cy / polygon.length };
    }
    
    getConvexHull() {
        const visibleVertices = this.vertices.filter(v => v.visible);
        if (visibleVertices.length < 3) return visibleVertices;
        
        // Find bottom-most point (and leftmost if tie)
        let start = 0;
        for (let i = 1; i < visibleVertices.length; i++) {
            if (visibleVertices[i].y > visibleVertices[start].y || 
                (visibleVertices[i].y === visibleVertices[start].y && visibleVertices[i].x < visibleVertices[start].x)) {
                start = i;
            }
        }
        
        // Sort points by polar angle with respect to start point
        const startPoint = visibleVertices[start];
        const sortedPoints = visibleVertices.filter((_, i) => i !== start).sort((a, b) => {
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
        const hull = this.getConvexHull();
        this.periphery = hull.map(vertex => this.vertices.findIndex(v => v === vertex));
        this.ensureClockwiseOrder();
    }
    
    ensureClockwiseOrder() {
        if (this.periphery.length < 3) return;
        
        let area = 0;
        for (let i = 0; i < this.periphery.length; i++) {
            const j = (i + 1) % this.periphery.length;
            const vi = this.vertices[this.periphery[i]];
            const vj = this.vertices[this.periphery[j]];
            area += (vj.x - vi.x) * (vj.y + vi.y);
        }
        
        if (area < 0) {
            this.periphery.reverse();
        }
    }
    
    addRandomSegment() {
        if (this.periphery.length < 2) {
            return { success: false, message: "Need at least 2 periphery vertices" };
        }
        
        // Select random segment size (2-6 vertices, but not more than periphery)
        const maxSegmentSize = Math.min(6, this.periphery.length);
        const segmentSize = Math.max(2, Math.floor(Math.random() * (maxSegmentSize - 1)) + 2);
        
        // Select random starting position
        const startIdx = Math.floor(Math.random() * this.periphery.length);
        const endIdx = (startIdx + segmentSize - 1) % this.periphery.length;
        
        // Set up the segment
        this.selectedVertices = [this.periphery[startIdx], this.periphery[endIdx]];
        
        // Process the segment selection
        const result = this.processSegmentSelection();
        
        // Clear the temporary selection regardless of result
        this.selectedVertices = [];
        this.segmentVertices = [];
        
        return result;
    }
}

class GraphRenderer {
    constructor(canvas, graph) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.graph = graph;
        
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        
        this.colors = {
            vertex: '#3498db',          // Regular vertices
            periphery: '#e74c3c',       // Periphery vertices  
            segmentEndpoint: '#9b59b6',  // Selected segment endpoints
            segmentIntermediate: '#f39c12', // Intermediate vertices in segment
            hover: '#1abc9c',           // Hovered vertex
            edge: '#2c3e50',           // Regular edges
            peripheryEdge: '#f39c12',   // Periphery outline
            segmentHighlight: '#8e44ad',  // Segment highlight
            previewVertex: 'rgba(231, 76, 60, 0.7)', // Preview vertex
            previewEdge: 'rgba(231, 76, 60, 0.5)'     // Preview edges
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
        
        ctx.clearRect(0, 0, width, height);
        
        this.drawEdges();
        this.drawPeripheryOutline();
        this.drawSegmentHighlight();
        this.renderIntersectionPreview();
        this.drawVertices();
    }
    
    // VISUAL INTERSECTION PREVIEW
    renderIntersectionPreview() {
        if (this.graph.manualMode && this.graph.selectedVertices.length === 2) {
            const [v1Idx, v2Idx] = this.graph.selectedVertices;
            const p1Idx = this.graph.periphery.indexOf(v1Idx);
            const p2Idx = this.graph.periphery.indexOf(v2Idx);
            
            if (p1Idx !== -1 && p2Idx !== -1) {
                const segmentVertices = this.graph.getPeripherySegment(p1Idx, p2Idx);
                const previewPosition = this.graph.findNonIntersectingPosition(segmentVertices);
                
                if (previewPosition) {
                    const ctx = this.ctx;
                    
                    // Draw preview vertex
                    ctx.fillStyle = this.colors.previewVertex;
                    ctx.beginPath();
                    const previewScreen = this.worldToScreen(previewPosition.x, previewPosition.y);
                    const radius = Math.max(10, this.zoom * 15);
                    ctx.arc(previewScreen.x, previewScreen.y, radius, 0, Math.PI * 2);
                    ctx.fill();
                    
                    // Draw preview edges
                    ctx.strokeStyle = this.colors.previewEdge;
                    ctx.lineWidth = Math.max(2, this.zoom * 2);
                    ctx.setLineDash([5, 5]);
                    for (const vIdx of segmentVertices) {
                        const vertex = this.graph.vertices[vIdx];
                        const vertexScreen = this.worldToScreen(vertex.x, vertex.y);
                        ctx.beginPath();
                        ctx.moveTo(previewScreen.x, previewScreen.y);
                        ctx.lineTo(vertexScreen.x, vertexScreen.y);
                        ctx.stroke();
                    }
                    ctx.setLineDash([]);
                }
            }
        }
    }
    
    drawEdges() {
        const ctx = this.ctx;
        
        for (const [i, j] of this.graph.edges) {
            const v1 = this.graph.vertices[i];
            const v2 = this.graph.vertices[j];
            
            if (!v1.visible || !v2.visible) continue;
            
            const p1 = this.worldToScreen(v1.x, v1.y);
            const p2 = this.worldToScreen(v2.x, v2.y);
            
            ctx.strokeStyle = this.colors.edge;
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
        ctx.setLineDash([8, 4]);
        
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
    
    drawSegmentHighlight() {
        if (this.graph.selectedVertices.length !== 2) return;
        
        const [v1Idx, v2Idx] = this.graph.selectedVertices;
        const p1Idx = this.graph.periphery.indexOf(v1Idx);
        const p2Idx = this.graph.periphery.indexOf(v2Idx);
        
        if (p1Idx === -1 || p2Idx === -1) return;
        
        const segmentVertices = this.graph.getPeripherySegment(p1Idx, p2Idx);
        
        const ctx = this.ctx;
        ctx.strokeStyle = this.colors.segmentHighlight;
        ctx.lineWidth = Math.max(4, this.zoom * 4);
        ctx.setLineDash([12, 6]);
        
        ctx.beginPath();
        for (let i = 0; i < segmentVertices.length; i++) {
            const vertex = this.graph.vertices[segmentVertices[i]];
            if (!vertex.visible) continue;
            
            const p = this.worldToScreen(vertex.x, vertex.y);
            if (i === 0) {
                ctx.moveTo(p.x, p.y);
            } else {
                ctx.lineTo(p.x, p.y);
            }
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }
    
    drawVertices() {
        const ctx = this.ctx;
        const radius = Math.max(10, this.zoom * 15);
        
        for (let i = 0; i < this.graph.vertices.length; i++) {
            const vertex = this.graph.vertices[i];
            if (!vertex.visible) continue;
            
            const p = this.worldToScreen(vertex.x, vertex.y);
            
            // Determine color based on state
            let color = this.colors.vertex;
            if (i === this.graph.hoveredVertex) {
                color = this.colors.hover;
            } else if (this.graph.selectedVertices.includes(i)) {
                color = this.colors.segmentEndpoint;
            } else if (this.graph.segmentVertices.includes(i)) {
                color = this.colors.segmentIntermediate;
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
                ctx.font = `bold ${Math.max(11, this.zoom * 13)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(vertex.id.toString(), p.x, p.y);
            }
        }
    }
    
    centerAndFit() {
        const visibleVertices = this.graph.vertices.filter(v => v.visible);
        if (visibleVertices.length === 0) return;
        
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        for (const vertex of visibleVertices) {
            minX = Math.min(minX, vertex.x);
            maxX = Math.max(maxX, vertex.x);
            minY = Math.min(minY, vertex.y);
            maxY = Math.max(maxY, vertex.y);
        }
        
        this.panX = -(minX + maxX) / 2;
        this.panY = -(minY + maxY) / 2;
        
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
        const radius = Math.max(18, this.zoom * 25) / this.zoom;
        
        for (let i = 0; i < this.graph.vertices.length; i++) {
            const vertex = this.graph.vertices[i];
            if (!vertex.visible) continue;
            
            const dist = this.graph.distance(worldPos, vertex);
            if (dist <= radius) {
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
        this.showMessage('Enhanced Graph App: ABSOLUTE edge crossing prevention enforced', 'info');
    }
    
    initializeUI() {
        const canvas = document.getElementById('graphCanvas');
        this.renderer = new GraphRenderer(canvas, this.graph);
        this.renderer.centerAndFit();
        this.updateUI();
    }
    
    setupEventListeners() {
        // Button listeners
        document.getElementById('startTriangle').addEventListener('click', (e) => {
            e.preventDefault(); this.startTriangle();
        });
        
        document.getElementById('addRandom').addEventListener('click', (e) => {
            e.preventDefault(); this.addRandomSegment();
        });
        
        document.getElementById('manualMode').addEventListener('click', (e) => {
            e.preventDefault(); this.toggleManualMode();
        });
        
        document.getElementById('centerGraph').addEventListener('click', (e) => {
            e.preventDefault(); this.centerGraph();
        });
        
        document.getElementById('zoomIn').addEventListener('click', (e) => {
            e.preventDefault(); this.zoom(1.2);
        });
        
        document.getElementById('zoomOut').addEventListener('click', (e) => {
            e.preventDefault(); this.zoom(0.8);
        });
        
        document.getElementById('toggleDisplay').addEventListener('click', (e) => {
            e.preventDefault(); this.toggleDisplay();
        });
        
        document.getElementById('redrawOptimize').addEventListener('click', (e) => {
            e.preventDefault(); this.redrawOptimize();
        });
        
        document.getElementById('goToBtn').addEventListener('click', (e) => {
            e.preventDefault(); this.goToVertex();
        });
        
        document.getElementById('clearSelection').addEventListener('click', (e) => {
            e.preventDefault(); this.clearSelection();
        });
        
        // Canvas listeners
        const canvas = document.getElementById('graphCanvas');
        canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Keyboard listeners
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
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
        this.showMessage('Triangle reset - planarity guaranteed', 'success');
    }
    
    addRandomSegment() {
        const result = this.graph.addRandomSegment();
        this.showDetailedMessage(result.message, result.success ? 'success' : 'error');
        this.renderer.render();
        this.updateUI();
    }
    
    toggleManualMode() {
        this.graph.manualMode = !this.graph.manualMode;
        if (!this.graph.manualMode) {
            // Clear selections when leaving manual mode
            this.graph.selectedVertices = [];
            this.graph.segmentVertices = [];
        }
        this.updateManualModeUI();
        this.updateUI();
        
        if (this.graph.manualMode) {
            this.showMessage('Manual segment mode: Click two periphery vertices - preview shows potential placement', 'info');
        } else {
            this.showMessage('Manual segment mode disabled', 'info');
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
        const integrityCheck = this.graph.validateGraphIntegrity();
        this.renderer.render();
        this.updateUI();
        
        if (integrityCheck.valid) {
            this.showMessage('Graph optimized - planarity confirmed', 'success');
        } else {
            this.showMessage(`Graph optimization: ${integrityCheck.message}`, 'error');
        }
    }
    
    goToVertex() {
        const input = document.getElementById('goToVertex');
        const vertexNum = parseInt(input.value);
        
        if (isNaN(vertexNum) || vertexNum < 1) {
            this.showMessage('Please enter a valid vertex number', 'error');
            return;
        }
        
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
            if (this.graph.selectedVertices.includes(vertexIndex)) {
                // Deselect
                this.graph.selectedVertices = this.graph.selectedVertices.filter(i => i !== vertexIndex);
            } else if (this.graph.selectedVertices.length < 2) {
                // Select
                this.graph.selectedVertices.push(vertexIndex);
                const vertex = this.graph.vertices[vertexIndex];
                this.showMessage(`Selected vertex V${vertex.id}`, 'info');
            }
            
            // Update segment visualization
            this.updateSegmentVisualization();
            
            // If we have 2 selected vertices, try to add new vertex
            if (this.graph.selectedVertices.length === 2) {
                const result = this.graph.processSegmentSelection();
                this.showDetailedMessage(result.message, result.success ? 'success' : 'error');
                
                // Don't disable manual mode - keep it active for next operation
                this.updateUI();
            }
            
            this.renderer.render();
        } else {
            // Start dragging
            this.isDragging = true;
            this.lastMousePos = { x, y };
            e.target.style.cursor = 'grabbing';
        }
    }
    
    updateSegmentVisualization() {
        if (this.graph.selectedVertices.length === 2) {
            const [v1Idx, v2Idx] = this.graph.selectedVertices;
            const p1Idx = this.graph.periphery.indexOf(v1Idx);
            const p2Idx = this.graph.periphery.indexOf(v2Idx);
            
            if (p1Idx !== -1 && p2Idx !== -1) {
                const segmentVertices = this.graph.getPeripherySegment(p1Idx, p2Idx);
                this.graph.segmentVertices = segmentVertices;
                
                const v1 = this.graph.vertices[v1Idx];
                const v2 = this.graph.vertices[v2Idx];
                const segmentInfo = `Segment: V${v1.id} → V${v2.id} (${segmentVertices.length} vertices)`;
                
                document.getElementById('segmentStatus').textContent = segmentInfo;
                document.getElementById('segmentVertices').textContent = 
                    segmentVertices.map(idx => `V${this.graph.vertices[idx].id}`).join(' → ');
                document.querySelector('.segment-info').classList.add('active');
                
                // Update preview status
                const hasValidPreview = this.graph.findNonIntersectingPosition(segmentVertices) !== null;
                document.getElementById('intersectionPreview').textContent = 
                    hasValidPreview ? 'Valid placement found' : 'No valid placement available';
            }
        } else {
            this.graph.segmentVertices = [];
            document.getElementById('segmentStatus').textContent = 'No segment selected';
            document.getElementById('segmentVertices').textContent = 'Select two periphery vertices';
            document.getElementById('intersectionPreview').textContent = 'Preview shows valid placement';
            document.querySelector('.segment-info').classList.remove('active');
        }
    }
    
    handleMouseMove(e) {
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (this.isDragging) {
            const dx = x - this.lastMousePos.x;
            const dy = y - this.lastMousePos.y;
            
            this.renderer.panX += dx / this.renderer.zoom;
            this.renderer.panY += dy / this.renderer.zoom;
            
            this.lastMousePos = { x, y };
            this.renderer.render();
        } else {
            const vertexIndex = this.renderer.getVertexAt(x, y);
            if (vertexIndex !== this.graph.hoveredVertex) {
                this.graph.hoveredVertex = vertexIndex;
                this.renderer.render();
            }
            
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
        if (e.target.tagName === 'INPUT') return;
        
        switch (e.key.toLowerCase()) {
            case 's': e.preventDefault(); this.startTriangle(); break;
            case 'r': e.preventDefault(); this.addRandomSegment(); break;
            case 'a': e.preventDefault(); this.toggleManualMode(); break;
            case 'c': e.preventDefault(); this.centerGraph(); break;
            case 't': e.preventDefault(); this.toggleDisplay(); break;
            case '+': case '=': e.preventDefault(); this.zoom(1.2); break;
            case '-': e.preventDefault(); this.zoom(0.8); break;
        }
    }
    
    updateUI() {
        const visibleVertices = this.graph.vertices.filter(v => v.visible).length;
        document.getElementById('vertexCount').textContent = visibleVertices;
        document.getElementById('edgeCount').textContent = this.graph.edges.length;
        document.getElementById('peripheryCount').textContent = this.graph.periphery.length;
        
        // Update planarity status
        const integrityCheck = this.graph.validateGraphIntegrity();
        const planarityStatus = document.getElementById('planarityStatus');
        if (integrityCheck.valid) {
            planarityStatus.textContent = '✓ Confirmed';
            planarityStatus.className = 'status status--success';
        } else {
            planarityStatus.textContent = '✗ Violated';
            planarityStatus.className = 'status status--error';
        }
        
        const mode = this.graph.manualMode ? 
            `Manual Segment Mode (${this.graph.selectedVertices.length}/2 selected)` : 'Normal Mode';
        document.getElementById('currentMode').textContent = mode;
        
        document.getElementById('zoomLevel').textContent = `Zoom: ${Math.round(this.renderer.zoom * 100)}%`;
        
        this.updateSegmentVisualization();
    }
    
    showMessage(text, type = 'info') {
        const container = document.getElementById('messageContainer');
        const message = document.createElement('div');
        message.className = `message message--${type}`;
        message.textContent = text;
        
        container.appendChild(message);
        
        setTimeout(() => {
            if (message && message.parentNode) {
                message.parentNode.removeChild(message);
            }
        }, 5000);
    }
    
    showDetailedMessage(text, type = 'info') {
        // For crossing-related errors, show more detailed information
        if (type === 'error' && text.includes('intersect')) {
            const details = [
                'CROSSING PREVENTION ACTIVE:',
                text,
                'All edges must remain planar (no crossings allowed)',
                'Try selecting a different segment or wait for better positioning'
            ];
            
            details.forEach((detail, index) => {
                setTimeout(() => this.showMessage(detail, type), index * 300);
            });
        } else {
            this.showMessage(text, type);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.graphApp = new GraphApp();
});