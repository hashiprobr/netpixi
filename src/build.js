import { ShapeInfo, Intersection } from 'kld-intersections';
import * as PIXI from 'pixi.js';
import '@pixi/graphics-extras';

import { compare, differences } from './types';
import defaults from './defaults';
import { pop, merge, processGraph, validate, nullSettings } from './data';
import { loadRemote } from './load';


export default function (path, aspect, normalize, infinite, broker, app, cell) {
    let minX;
    let maxX;

    let minY;
    let maxY;

    let settings;
    let vertices;
    let edges;

    let n;
    let m;

    function initialize() {
        minX = Number.POSITIVE_INFINITY;
        maxX = Number.NEGATIVE_INFINITY;

        minY = Number.POSITIVE_INFINITY;
        maxY = Number.NEGATIVE_INFINITY;

        settings = null;
        vertices = {};
        edges = {};

        n = 0;
        m = 0;
    }

    function process(d) {
        processGraph(d,
            (props) => {
                validate.notDuplicateSettings(settings);
                settings = validate.receivedSettings(props);
            },
            (data, props) => {
                const id = validate.receivedId(data);
                validate.notDuplicateVertex(id, vertices);
                const x = validate.receivedX(props);
                const y = validate.receivedY(props);
                if (x !== null) {
                    if (minX > x) {
                        minX = x;
                    }
                    if (maxX < x) {
                        maxX = x;
                    }
                }
                if (y !== null) {
                    if (minY > y) {
                        minY = y;
                    }
                    if (maxY < y) {
                        maxY = y;
                    }
                }
                const degree = 0;
                const leaders = new Set();
                vertices[id] = { x, y, degree, leaders, props };
                n++;
            },
            (data, props) => {
                const source = validate.receivedSource(data, vertices);
                const target = validate.receivedTarget(data, vertices, source);
                validate.notDuplicateEdge(source, target, edges);
                validate.notReversedEdge(settings, source, target, edges);
                vertices[source].degree++;
                vertices[target].degree++;
                edges[source][target] = props;
                m++;
            });
    }

    function finalize() {
        let width;
        let height;

        let scale;

        let defaultTexture;

        let left;
        let right;
        let top;
        let bottom;

        let exporting;

        function getScale() {
            return scale;
        }

        function getRed(color) {
            return (color & 0xff0000) >> 16;
        }

        function getGreen(color) {
            return (color & 0x00ff00) >> 8;
        }

        function getBlue(color) {
            return color & 0x0000ff;
        }

        function setExporting(value) {
            exporting = value;
        }

        function calculateBlend(a, b, alpha) {
            return Math.round(alpha * a + (1 - alpha) * b);
        }

        function calculateIntersection(edgeShape, shape) {
            const intersect = Intersection.intersect(edgeShape, shape);
            const x = intersect.points[0].x;
            const y = intersect.points[0].y;
            return [x, y];
        }

        function formatCircle(tx, ty, radius) {
            circleShape.args[0].x = tx;
            circleShape.args[0].y = ty;
            circleShape.args[1] = radius;
            return circleShape;
        }

        function formatLine(sx, sy, tx, ty) {
            lineShape.args[0].x = sx;
            lineShape.args[0].y = sy;
            lineShape.args[1].x = tx;
            lineShape.args[1].y = ty;
            return lineShape;
        }

        function formatCurve(sx, sy, x1, y1, x2, y2, tx, ty) {
            curveShape.args[0].x = sx;
            curveShape.args[0].y = sy;
            curveShape.args[1].x = x1;
            curveShape.args[1].y = y1;
            curveShape.args[2].x = x2;
            curveShape.args[2].y = y2;
            curveShape.args[3].x = tx;
            curveShape.args[3].y = ty;
            return curveShape;
        }

        function normalizeHorizontal(x) {
            return settings.graph.borderX + x * (width - 2 * settings.graph.borderX);
        }

        function normalizeVertical(y) {
            return settings.graph.borderY + y * (height - 2 * settings.graph.borderY);
        }

        function drawTexture(props) {
            let radius = props.size / 2;
            if (!infinite) {
                radius *= scale;
            }
            const graphics = new PIXI.Graphics();
            graphics.beginFill(props.color, 1);
            switch (props.shape) {
                case 'downtriangle':
                    graphics.drawRegularPolygon(0, 0, radius, 3, Math.PI);
                    break;
                case 'uptriangle':
                    graphics.drawRegularPolygon(0, 0, radius, 3);
                    break;
                case 'diamond':
                    graphics.drawRegularPolygon(0, 0, radius, 4);
                    break;
                case 'square':
                    graphics.drawRegularPolygon(0, 0, radius, 4, Math.PI / 4);
                    break;
                case 'star':
                    graphics.drawStar(0, 0, 5, radius);
                    break;
                default:
                    graphics.drawCircle(0, 0, radius);
            }
            graphics.endFill();
            const texture = app.renderer.generateTexture(graphics);
            texture.radius = radius;
            return texture;
        }

        function drawEdges(u) {
            const graphics = areas[u].graphics;
            graphics.clear();
            for (const [v, neighbor] of Object.entries(areas[u].neighbors)) {
                let s;
                let t;
                if (neighbor.reversed) {
                    s = vertices[v];
                    t = vertices[u];
                } else {
                    s = vertices[u];
                    t = vertices[v];
                }
                const sx = s.sprite.position.x;
                const sy = s.sprite.position.y;
                const tx = t.sprite.position.x;
                const ty = t.sprite.position.y;
                let dx = tx - sx;
                let dy = ty - sy;
                const distance = Math.sqrt(dx * dx + dy * dy) - (s.sprite.texture.radius + t.sprite.texture.radius);
                if (compare(distance, 0) > 0 || exporting) {
                    const props = merge(settings.edge, neighbor.props, differences.edge);
                    const sourceVisible = sx >= left && sx < right && sy >= top && sy < bottom;
                    const targetVisible = tx >= left && tx < right && ty >= top && ty < bottom;
                    let alpha = props.alpha * s.alpha * t.alpha;
                    if (sourceVisible) {
                        if (!targetVisible) {
                            alpha *= settings.graph.alpha1;
                        }
                    } else {
                        alpha *= settings.graph.alpha1;
                        if (!targetVisible) {
                            alpha *= settings.graph.alpha2;
                        }
                    }
                    if (compare(alpha, 0) > 0 || exporting) {
                        alpha = Math.min(alpha, 1);
                        let size = props.width;
                        if (!infinite) {
                            size *= scale;
                        }
                        size = Math.min(size, s.sprite.texture.radius, t.sprite.texture.radius);
                        const minimum = 9 * size;
                        const c1 = props.curve1;
                        const c2 = props.curve2;
                        let nx;
                        let ny;
                        let x1;
                        let y1;
                        let x2;
                        let y2;
                        let straight;
                        let edgeShape;
                        if (compare(distance, minimum) < 0 || (compare(c1, 0) === 0 && compare(c2, 0) === 0)) {
                            straight = true;
                            edgeShape = formatLine(sx, sy, tx, ty);
                        } else {
                            dx *= 0.2;
                            dy *= 0.2;
                            nx = -dy;
                            ny = dx;
                            x1 = sx + dx + c1 * nx;
                            y1 = sy + dy + c1 * ny;
                            x2 = tx - dx + c2 * nx;
                            y2 = ty - dy + c2 * ny;
                            straight = false;
                            edgeShape = formatCurve(sx, sy, x1, y1, x2, y2, tx, ty);
                        }
                        const intersect = Intersection.intersect(edgeShape, boundsShape);
                        if (sourceVisible || targetVisible || intersect.points.length > 0 || exporting) {
                            if (compare(distance, minimum) < 0) {
                                size *= distance / minimum;
                            }
                            const sourceShape = formatCircle(sx, sy, s.sprite.texture.radius + size / 2);
                            const [fx, fy] = calculateIntersection(edgeShape, sourceShape);
                            const targetShape = formatCircle(tx, ty, t.sprite.texture.radius + size / 2);
                            const [gx, gy] = calculateIntersection(edgeShape, targetShape);
                            graphics.lineStyle({
                                width: size,
                                color: props.color,
                                alpha: alpha,
                                cap: PIXI.LINE_CAP.ROUND,
                            });
                            graphics.moveTo(fx, fy);
                            if (straight) {
                                graphics.lineTo(gx, gy);
                            } else {
                                graphics.bezierCurveTo(x1, y1, x2, y2, gx, gy);
                            }
                            if (settings.graph.directed) {
                                const r = calculateBlend(getRed(props.color), getRed(settings.graph.color), alpha);
                                const g = calculateBlend(getGreen(props.color), getGreen(settings.graph.color), alpha);
                                const b = calculateBlend(getBlue(props.color), getBlue(settings.graph.color), alpha);
                                const [hx, hy] = calculateIntersection(edgeShape, t.shape);
                                dx = 2 * (hx - gx);
                                dy = 2 * (hy - gy);
                                nx = -dy;
                                ny = dx;
                                graphics.lineStyle({
                                    ...graphics.line,
                                    color: (r << 16) + (g << 8) + b,
                                    alpha: 1,
                                    join: PIXI.LINE_JOIN.ROUND,
                                });
                                graphics.lineTo(gx - 2 * dx + nx, gy - 2 * dy + ny);
                                graphics.lineTo(gx - dx, gy - dy);
                                graphics.lineTo(gx - 2 * dx - nx, gy - 2 * dy - ny);
                                graphics.lineTo(gx, gy);
                            }
                        }
                    }
                }
            }
        }

        function drawAreas() {
            for (const u in areas) {
                drawEdges(u);
            }
        }

        function drawNeighborAreas(vertex) {
            for (const u of vertex.leaders) {
                drawEdges(u);
            }
        }

        function updateSize() {
            const rect = cell.getRect();
            if (width !== rect.width) {
                width = rect.width;
                height = width / aspect;
                app.renderer.resize(width, height);
            }
        }

        function updateBackground() {
            app.renderer.backgroundColor = settings.graph.color;
            app.renderer.backgroundAlpha = settings.graph.alpha;
        }

        function updateTexture() {
            defaultTexture.destroy();
            initializeTexture();
        }

        function updateBackgroundAndTexture() {
            updateBackground();
            updateTexture();
        }

        function updateShape(vertex) {
            vertex.shape.args[0].x = vertex.sprite.position.x;
            vertex.shape.args[0].y = vertex.sprite.position.y;
            vertex.shape.args[1] = vertex.sprite.texture.radius;
        }

        function updateSpriteAndShape(vertex) {
            const props = merge(settings.vertex, vertex.props, differences.vertex);
            if (vertex.sprite.texture === defaultTexture) {
                if (props !== settings.vertex) {
                    vertex.sprite.texture = drawTexture(props);
                }
            }
            else {
                vertex.sprite.texture.destroy();
                if (props === settings.vertex) {
                    vertex.sprite.texture = defaultTexture;
                } else {
                    vertex.sprite.texture = drawTexture(props);
                }
            }
            updateShape(vertex);
        }

        function updatePositionAndSpriteAndShape(vertex) {
            vertex.sprite.position.x = scale * vertex.x;
            vertex.sprite.position.y = scale * vertex.y;
            updateSpriteAndShape(vertex);
        }

        function updateBoundsAndDrawAreas() {
            boundsShape.args[0].x = left = -app.stage.position.x;
            boundsShape.args[0].y = top = -app.stage.position.y;
            boundsShape.args[1].x = right = left + width;
            boundsShape.args[1].y = bottom = top + height;
            drawAreas();
        }

        function initializeScale() {
            scale = 1;
        }

        function initializeTexture() {
            defaultTexture = drawTexture(settings.vertex);
        }

        function initializeAlpha(vertex) {
            vertex.alpha = 1;
        }

        function initializePositionAndUpdateSpriteAndShape(vertex) {
            vertex.sprite.position.x = vertex.x;
            vertex.sprite.position.y = vertex.y;
            updateSpriteAndShape(vertex);
        }

        function connectMouse() {
            let hoveredVertex = null;
            let draggedVertex = null;

            let dragging = false;
            let zoomId = null;

            let mouseX;
            let mouseY;

            let stageX;
            let stageY;

            function toSprites(panel) {
                for (const vertex of Object.values(vertices)) {
                    vertex.sprite.interactive = true;
                    vertex.sprite.move = (event) => {
                        vertex.sprite.position.x = event.offsetX - app.stage.position.x;
                        vertex.sprite.position.y = event.offsetY - app.stage.position.y;
                        updateShape(vertex);
                        drawNeighborAreas(vertex);
                    };
                    vertex.sprite.stop = () => {
                        vertex.x = vertex.sprite.position.x / scale;
                        vertex.y = vertex.sprite.position.y / scale;
                        draggedVertex = null;
                    };
                    vertex.sprite.on('mousedown', () => {
                        draggedVertex = vertex;
                    });
                    vertex.sprite.on('mouseover', () => {
                        if (hoveredVertex === null) {
                            hoveredVertex = vertex;
                            panel.updateOpacity(vertex);
                            panel.showOpacity();
                        }
                    });
                    vertex.sprite.on('mouseout', () => {
                        if (hoveredVertex === vertex) {
                            panel.hideOpacity();
                            hoveredVertex = null;
                        }
                    });
                }
            }

            function toView(panel) {
                app.view.grab = (event) => {
                    if (draggedVertex === null) {
                        dragging = true;
                        mouseX = event.offsetX;
                        mouseY = event.offsetY;
                        stageX = app.stage.position.x;
                        stageY = app.stage.position.y;
                    }
                };
                app.view.release = () => {
                    if (draggedVertex === null) {
                        if (dragging) {
                            updateBoundsAndDrawAreas();
                            dragging = false;
                        }
                    } else {
                        draggedVertex.sprite.stop();
                    }
                };
                app.view.addEventListener('mousedown', (event) => {
                    event.preventDefault();
                    app.view.grab(event);
                });
                app.view.addEventListener('mouseup', (event) => {
                    event.preventDefault();
                    app.view.release();
                });
                app.view.addEventListener('mouseenter', (event) => {
                    event.preventDefault();
                    if (event.buttons === 1) {
                        app.view.grab(event);
                    } else {
                        app.view.release();
                    }
                });
                app.view.addEventListener('mousemove', (event) => {
                    event.preventDefault();
                    if (draggedVertex === null) {
                        if (dragging) {
                            app.stage.position.x = stageX + (event.offsetX - mouseX);
                            app.stage.position.y = stageY + (event.offsetY - mouseY);
                        }
                    } else {
                        draggedVertex.sprite.move(event);
                    }
                });
                app.view.addEventListener('wheel', (event) => {
                    event.preventDefault();
                    const result = compare(event.deltaY, 0);
                    if (result !== 0) {
                        if (hoveredVertex === null) {
                            let zoom = Math.round(100 * scale);
                            if (result === -1 || (result === 1 && zoom > 10)) {
                                const shift = -result * Math.round(zoom / 10);
                                const ratio = (zoom + shift) / zoom;
                                app.stage.scale.x *= ratio;
                                app.stage.scale.y *= ratio;
                                const error = ratio - 1;
                                app.stage.position.x -= error * (event.offsetX - app.stage.position.x);
                                app.stage.position.y -= error * (event.offsetY - app.stage.position.y);
                                zoom += shift;
                                scale = zoom / 100;
                                panel.updateZoom();
                                if (zoomId !== null) {
                                    clearTimeout(zoomId);
                                }
                                zoomId = setTimeout(() => {
                                    zoomId = null;
                                    app.stage.scale.x = 1;
                                    app.stage.scale.y = 1;
                                    updateTexture();
                                    for (const vertex of Object.values(vertices)) {
                                        updatePositionAndSpriteAndShape(vertex);
                                    }
                                    updateBoundsAndDrawAreas();
                                }, 100);
                            }
                        } else {
                            let opacity = Math.round(100 * hoveredVertex.alpha);
                            if (result === -1 || (result === 1 && opacity > 10)) {
                                opacity -= result * Math.round(opacity / 10);
                                hoveredVertex.alpha = opacity / 100;
                                drawNeighborAreas(hoveredVertex);
                                panel.updateOpacity(hoveredVertex);
                            }
                        }
                    }
                });
                app.view.addEventListener('dblclick', (event) => {
                    event.preventDefault();
                    if (hoveredVertex === null) {
                        let moved = false;
                        if (compare(app.stage.position.x, 0) !== 0) {
                            app.stage.position.x = 0;
                            moved = true;
                        }
                        if (compare(app.stage.position.y, 0) !== 0) {
                            app.stage.position.y = 0;
                            moved = true;
                        }
                        if (compare(scale, 1) !== 0) {
                            initializeScale();
                            updateTexture();
                            for (const vertex of Object.values(vertices)) {
                                initializePositionAndUpdateSpriteAndShape(vertex);
                            }
                            updateBoundsAndDrawAreas();
                            panel.updateZoom();
                        } else {
                            if (moved) {
                                updateBoundsAndDrawAreas();
                            }
                        }
                    } else {
                        if (compare(hoveredVertex.alpha, 1) !== 0) {
                            initializeAlpha(hoveredVertex);
                            drawNeighborAreas(hoveredVertex);
                            panel.updateOpacity(hoveredVertex);
                        }
                    }
                });
            }

            return [toSprites, toView];
        }

        function finalize() {
            defaultTexture.destroy();
        }

        if (settings === null) {
            settings = nullSettings;
        }
        settings.graph = merge({ ...defaults.graph }, settings.graph, differences.graph);
        settings.vertex = merge({ ...defaults.vertex }, settings.vertex, differences.vertex);
        settings.edge = merge({ ...defaults.edge }, settings.edge, differences.edge);

        const areas = {};

        for (const source of Object.keys(edges)) {
            const sd = vertices[source].degree;
            for (const target of Object.keys(edges[source])) {
                const td = vertices[target].degree;
                let reversed;
                if (sd === td) {
                    if (source < target) {
                        reversed = true;
                    } else {
                        reversed = false;
                    }
                } else {
                    if (sd < td) {
                        reversed = true;
                    } else {
                        reversed = false;
                    }
                }
                if (broker) {
                    reversed = !reversed;
                }
                let u;
                let v;
                if (reversed) {
                    u = target;
                    v = source;
                } else {
                    u = source;
                    v = target;
                }
                const props = pop(edges[source], 'target');
                if (!(u in areas)) {
                    const neighbors = {};
                    const graphics = new PIXI.Graphics();
                    areas[u] = { neighbors, graphics };
                    vertices[u].leaders.add(u);
                    app.stage.addChild(graphics);
                }
                areas[u].neighbors[v] = { reversed, props };
                vertices[v].leaders.add(u);
            }
            delete edges[source];
        }

        updateSize();
        initializeScale();
        updateBackground();
        initializeTexture();
        setExporting(false);

        let difX;
        if (Number.isFinite(minX) && Number.isFinite(maxX) && compare(minX, maxX) !== 0) {
            difX = maxX - minX;
        } else {
            difX = 0;
        }
        let difY;
        if (Number.isFinite(minY) && Number.isFinite(maxY) && compare(minY, maxY) !== 0) {
            difY = maxY - minY;
        } else {
            difY = 0;
        }
        for (const vertex of Object.values(vertices)) {
            if (vertex.x === null) {
                vertex.x = normalizeHorizontal(Math.random());
            } else {
                if (normalize) {
                    let x;
                    if (difX === 0) {
                        x = 0.5;
                    } else {
                        x = (vertex.x - minX) / difX;
                    }
                    vertex.x = normalizeHorizontal(x);
                }
            }
            if (vertex.y === null) {
                vertex.y = normalizeVertical(Math.random());
            } else {
                if (normalize) {
                    let y;
                    if (difY === 0) {
                        y = 0.5;
                    } else {
                        y = (vertex.y - minY) / difY;
                    }
                    vertex.y = normalizeVertical(y);
                }
            }
            delete vertex.degree;
            initializeAlpha(vertex);
            vertex.sprite = new PIXI.Sprite();
            vertex.sprite.anchor.x = 0.5;
            vertex.sprite.anchor.y = 0.5;
            vertex.sprite.texture = defaultTexture;
            vertex.shape = ShapeInfo.circle(0, 0, 0);
            initializePositionAndUpdateSpriteAndShape(vertex);
            app.stage.addChild(vertex.sprite);
        }

        const boundsShape = ShapeInfo.rectangle(0, 0, 0, 0);
        const circleShape = ShapeInfo.circle(0, 0, 0);
        const lineShape = ShapeInfo.line(0, 0, 0, 0);
        const curveShape = ShapeInfo.cubicBezier(0, 0, 0, 0, 0, 0, 0, 0);

        updateBoundsAndDrawAreas();

        const [connectMouseToSprites, connectMouseToView] = connectMouse();

        return {
            settings,
            vertices,
            areas,
            getScale,
            setExporting,
            drawEdges,
            drawAreas,
            drawNeighborAreas,
            updateSize,
            updateBackgroundAndTexture,
            updateSpriteAndShape,
            updatePositionAndSpriteAndShape,
            updateBoundsAndDrawAreas,
            connectMouseToSprites,
            connectMouseToView,
            finalize,
        };
    }

    const start = Date.now();
    initialize();
    return loadRemote(path, process)
        .then(() => {
            console.log(`Network with ${n} vertices and ${m} edges`);
            const graph = finalize();
            console.log(`Loaded in ${(Date.now() - start) / 1000} seconds`);
            return Promise.resolve(graph);
        });
}
