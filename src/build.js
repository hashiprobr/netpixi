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
                const key = validate.receivedKey(props);
                const value = validate.receivedValue(props);
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
                vertices[id] = { x, y, key, value, degree, leaders, props };
                n++;
            },
            (data, props) => {
                const source = validate.receivedSource(data, vertices);
                const target = validate.receivedTarget(data, vertices, source);
                validate.notDuplicateEdge(source, target, edges);
                validate.notReversedEdge(settings, source, target, edges);
                const label = validate.receivedLabel(props);
                vertices[source].degree++;
                vertices[target].degree++;
                edges[source][target] = { label, props };
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

        function setExporting(value) {
            exporting = value;
        }

        function formatRectangle(radius) {
            rectangleShape.args[0].x = left - radius;
            rectangleShape.args[0].y = top - radius;
            rectangleShape.args[1].x = right + radius;
            rectangleShape.args[1].y = bottom + radius;
            return rectangleShape;
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

        function calculateVisibility(x, y, radius) {
            return x >= left - radius && x < right + radius && y >= top - radius && y < bottom + radius;
        }

        function calculateIntersection(edgeShape, shape) {
            const intersect = Intersection.intersect(edgeShape, shape);
            const x = intersect.points[0].x;
            const y = intersect.points[0].y;
            return [x, y];
        }

        function normalizeHorizontal(x) {
            return settings.graph.hborder + x * (width - 2 * settings.graph.hborder);
        }

        function normalizeVertical(y) {
            return settings.graph.vborder + y * (height - 2 * settings.graph.vborder);
        }

        function initializeScale() {
            scale = 1;
        }

        function initializeTexture() {
            defaultTexture = new PIXI.RenderTexture.create();
            updateTexture();
        }

        function initializePosition(vertex) {
            vertex.sprite.position.x = vertex.x;
            vertex.sprite.position.y = vertex.y;
        }

        function initializeAlpha(vertex) {
            vertex.alpha = 1;
        }

        function fillTexture(color, shape, graphics, radius) {
            graphics.beginFill(color, 1);
            switch (shape) {
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
        }

        function drawGraphics(props, outerRadius, bwidth) {
            const graphics = new PIXI.Graphics();
            if (compare(props.bwidth, 0) > 0) {
                fillTexture(props.bcolor, props.shape, graphics, outerRadius);
                const innerRadius = outerRadius - Math.min(bwidth, outerRadius / 2);
                fillTexture(props.color, props.shape, graphics, innerRadius);
            } else {
                fillTexture(props.color, props.shape, graphics, outerRadius);
            }
            return graphics;
        }

        function drawTexture(vertex, props) {
            const graphics = drawGraphics(props, vertex.radius, vertex.bwidth);
            vertex.sprite.texture = app.renderer.generateTexture(graphics);
            graphics.destroy();
        }

        function drawSprite(vertex, props) {
            if (vertex.sprite.texture === defaultTexture) {
                if (props !== settings.vertex) {
                    drawTexture(vertex, props);
                }
            }
            else {
                const texture = vertex.sprite.texture;
                if (props === settings.vertex) {
                    vertex.sprite.texture = defaultTexture;
                } else {
                    drawTexture(vertex, props);
                }
                texture.destroy();
            }
            if (vertex.key === '') {
                if ('keySprite' in vertex) {
                    const keySprite = vertex.keySprite;
                    delete vertex.keySprite;
                    keySprite.destroy();
                }
            } else {
                keyText.text = vertex.key;
                keyText.style.fill = props.color;
                keyText.style.stroke = props.bcolor;
                keyText.style.strokeThickness = vertex.bwidth / 2;
                keyText.style.fontSize = settings.graph.kscale * vertex.radius;
                keyText.style.fontFamily = props.kfamily;
                if (!('keySprite' in vertex)) {
                    vertex.keySprite = new PIXI.Sprite(new PIXI.RenderTexture.create());
                    vertex.keySprite.anchor.x = 0.5;
                    vertex.keySprite.anchor.y = 0.5;
                    app.stage.addChild(vertex.keySprite);
                }
                vertex.keySprite.texture.resize(keyText.width, keyText.height);
                app.renderer.render(keyText, {
                    renderTexture: vertex.keySprite.texture,
                });
            }
            if (vertex.value !== '') {
                valueText.text = vertex.value;
                valueText.style.fontSize = settings.graph.vscale * vertex.radius;
                matrix.tx = vertex.radius - valueText.width / 2;
                matrix.ty = vertex.radius - valueText.height / 2;
                app.renderer.render(valueText, {
                    renderTexture: vertex.sprite.texture,
                    clear: false,
                    transform: matrix,
                });
            }
            vertex.dirty = false;
        }

        function drawEdges(u) {
            const graphics = areas[u].graphics;
            graphics.clear();
            for (const [v, neighbor] of Object.entries(areas[u].neighbors)) {
                if ('sprite' in neighbor) {
                    neighbor.sprite.alpha = 0;
                }
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
                const distance = Math.sqrt(dx * dx + dy * dy) - (s.radius + t.radius);
                if (compare(distance, 0) > 0 || exporting) {
                    const props = merge(settings.edge, neighbor.props, differences.edge);
                    let alpha = props.alpha * s.alpha * t.alpha;
                    if (s.sprite.visible) {
                        if (!t.sprite.visible) {
                            alpha *= settings.graph.alpha1;
                        }
                    } else {
                        alpha *= settings.graph.alpha1;
                        if (!t.sprite.visible) {
                            alpha *= settings.graph.alpha2;
                        }
                    }
                    if (compare(alpha, 0) > 0 || exporting) {
                        alpha = Math.min(alpha, 1);
                        let size = props.width;
                        if (!infinite) {
                            size *= scale;
                        }
                        size = Math.min(size, s.radius, t.radius);
                        let close = false;
                        const minimum = 9 * size;
                        if (compare(distance, minimum) < 0) {
                            size *= distance / minimum;
                            close = true;
                        }
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
                        if (close || (compare(c1, 0) === 0 && compare(c2, 0) === 0)) {
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
                        const radius = size / 2;
                        let vertexShape;
                        vertexShape = formatCircle(sx, sy, s.radius + radius);
                        const [fx, fy] = calculateIntersection(edgeShape, vertexShape);
                        vertexShape = formatCircle(tx, ty, t.radius + radius);
                        const [gx, gy] = calculateIntersection(edgeShape, vertexShape);
                        let x3;
                        let y3;
                        let x4;
                        let y4;
                        if (straight) {
                            edgeShape = formatLine(fx, fy, gx, gy);
                        } else {
                            dx = 0.2 * (gx - fx);
                            dy = 0.2 * (gy - fy);
                            nx = -dy;
                            ny = dx;
                            x3 = fx + dx + c1 * nx;
                            y3 = fy + dy + c1 * ny;
                            x4 = gx - dx + c2 * nx;
                            y4 = gy - dy + c2 * ny;
                            edgeShape = formatCurve(fx, fy, x3, y3, x4, y4, gx, gy);
                        }
                        let visible = calculateVisibility(fx, fy, radius) || calculateVisibility(gx, gy, radius);
                        if (!visible) {
                            const boundsShape = formatRectangle(radius);
                            const intersect = Intersection.intersect(edgeShape, boundsShape);
                            if (intersect.points.length > 0) {
                                visible = true;
                            }
                        }
                        if (visible || exporting) {
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
                                graphics.bezierCurveTo(x3, y3, x4, y4, gx, gy);
                            }
                            if (settings.graph.directed) {
                                if (straight) {
                                    edgeShape = formatLine(sx, sy, tx, ty);
                                } else {
                                    edgeShape = formatCurve(sx, sy, x1, y1, x2, y2, tx, ty);
                                }
                                const [hx, hy] = calculateIntersection(edgeShape, t.shape);
                                dx = 2 * (hx - gx);
                                dy = 2 * (hy - gy);
                                nx = -dy;
                                ny = dx;
                                graphics.moveTo(gx, gy);
                                graphics.lineTo(gx - 2 * dx + nx, gy - 2 * dy + ny);
                                graphics.moveTo(gx, gy);
                                graphics.lineTo(gx - 2 * dx - nx, gy - 2 * dy - ny);
                            }
                            if (neighbor.label === '') {
                                if ('sprite' in neighbor) {
                                    const sprite = neighbor.sprite;
                                    delete neighbor.sprite;
                                    sprite.destroy();
                                }
                            } else {
                                labelText.text = neighbor.label;
                                labelText.style.fontSize = settings.graph.lscale * size;
                                if ('sprite' in neighbor) {
                                    neighbor.sprite.alpha = 1;
                                } else {
                                    neighbor.sprite = new PIXI.Sprite(new PIXI.RenderTexture.create());
                                    neighbor.sprite.anchor.x = 0.5;
                                    neighbor.sprite.anchor.y = 0.5;
                                    app.stage.addChild(neighbor.sprite);
                                }
                                const labelWidth = labelText.width + size;
                                const labelHeight = labelText.height + size;
                                neighbor.sprite.texture.resize(labelWidth, labelHeight);
                                tag.clear();
                                tag.beginFill(props.color, alpha);
                                tag.drawRoundedRect(0, 0, labelWidth, labelHeight, radius);
                                tag.endFill();
                                app.renderer.render(tag, {
                                    renderTexture: neighbor.sprite.texture,
                                });
                                matrix.tx = radius;
                                matrix.ty = radius;
                                app.renderer.render(labelText, {
                                    renderTexture: neighbor.sprite.texture,
                                    clear: false,
                                    transform: matrix,
                                });
                                const a = props.lparam;
                                const b = (1 - a);
                                let mx;
                                let my;
                                if (straight) {
                                    mx = b * fx + a * gx;
                                    my = b * fy + a * gy;
                                } else {
                                    mx = b * b * b * fx + 3 * b * b * a * x3 + 3 * b * a * a * x4 + a * a * a * gx;
                                    my = b * b * b * fy + 3 * b * b * a * y3 + 3 * b * a * a * y4 + a * a * a * gy;
                                }
                                neighbor.sprite.position.x = mx;
                                neighbor.sprite.position.y = my;
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
            valueText.style.fill = settings.graph.color;
            valueText.style.fontFamily = settings.graph.vfamily;
            labelText.style.fill = settings.graph.color;
            labelText.style.fontFamily = settings.graph.lfamily;
        }

        function updateTexture() {
            let radius = settings.vertex.size;
            if (!infinite) {
                radius *= scale;
            }
            defaultTexture.resize(radius, radius);
            radius /= 2;
            let bwidth = settings.vertex.bwidth;
            if (!infinite) {
                bwidth *= scale;
            }
            const graphics = drawGraphics(settings.vertex, radius, bwidth);
            const matrix = new PIXI.Matrix(1, 0, 0, 1, radius, radius);
            app.renderer.render(graphics, {
                renderTexture: defaultTexture,
                clear: true,
                transform: matrix,
            });
            graphics.destroy();
        }

        function updateBounds() {
            left = -app.stage.position.x;
            top = -app.stage.position.y;
            right = left + width;
            bottom = top + height;
        }

        function updatePosition(vertex) {
            vertex.sprite.position.x = scale * vertex.x;
            vertex.sprite.position.y = scale * vertex.y;
        }

        function updateVisible(vertex) {
            const radius = vertex.sprite.width / 2;
            const pseudoVisible = calculateVisibility(vertex.sprite.position.x, vertex.sprite.position.y, radius);
            const reallyVisible = calculateVisibility(vertex.sprite.position.x, vertex.sprite.position.y, vertex.radius);
            vertex.sprite.visible = pseudoVisible || reallyVisible;
            if ('keySprite' in vertex) {
                vertex.keySprite.visible = vertex.sprite.visible;
            }
        }

        function updateSprite(vertex) {
            const props = merge(settings.vertex, vertex.props, differences.vertex);
            vertex.radius = props.size / 2;
            if (!infinite) {
                vertex.radius *= scale;
            }
            vertex.bwidth = props.bwidth;
            if (!infinite) {
                vertex.bwidth *= scale;
            }
            vertex.bwidth = Math.min(vertex.bwidth, vertex.radius / 2);
            vertex.dirty = true;
            updateVisible(vertex);
            if (vertex.sprite.visible || exporting) {
                drawSprite(vertex, props);
            }
        }

        function updateSpriteStyle(vertex) {
            updateVisible(vertex);
            if (vertex.dirty && vertex.sprite.visible) {
                const props = merge(settings.vertex, vertex.props, differences.vertex);
                drawSprite(vertex, props);
                return true;
            }
            return false;
        }

        function updateKey(vertex) {
            if ('keySprite' in vertex) {
                vertex.keySprite.position.x = vertex.sprite.position.x;
                vertex.keySprite.position.y = vertex.sprite.position.y - vertex.radius - vertex.keySprite.height / 2;
            }
        }

        function updateGeometry(vertex) {
            vertex.shape.args[0].x = vertex.sprite.position.x;
            vertex.shape.args[0].y = vertex.sprite.position.y;
            vertex.shape.args[1] = vertex.radius;
            updateKey(vertex);
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
                        updateGeometry(vertex);
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
                            updateBounds();
                            for (const vertex of Object.values(vertices)) {
                                if (updateSpriteStyle(vertex)) {
                                    updateKey(vertex);
                                }
                            }
                            drawAreas();
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
                                    if (!infinite) {
                                        updateTexture();
                                    }
                                    updateBounds();
                                    for (const vertex of Object.values(vertices)) {
                                        updatePosition(vertex);
                                        if (infinite) {
                                            updateSpriteStyle(vertex);
                                        } else {
                                            updateSprite(vertex);
                                        }
                                        updateGeometry(vertex);
                                    }
                                    drawAreas();
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
                            if (!infinite) {
                                updateTexture();
                            }
                            updateBounds();
                            for (const vertex of Object.values(vertices)) {
                                initializePosition(vertex);
                                if (infinite) {
                                    updateSpriteStyle(vertex);
                                } else {
                                    updateSprite(vertex);
                                }
                                updateGeometry(vertex);
                            }
                            drawAreas();
                            panel.updateZoom();
                        } else {
                            if (moved) {
                                updateBounds();
                                for (const vertex of Object.values(vertices)) {
                                    if (updateSpriteStyle(vertex)) {
                                        updateKey(vertex);
                                    }
                                }
                                drawAreas();
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
            labelText.destroy();
            valueText.destroy();
            keyText.destroy();
            tag.destroy();
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
                if (edges[source][target].label === null) {
                    edges[source][target].label = '';
                }
                const { label, props } = pop(edges[source], target);
                if (!(u in areas)) {
                    const neighbors = {};
                    const graphics = new PIXI.Graphics();
                    areas[u] = { neighbors, graphics };
                    vertices[u].leaders.add(u);
                    app.stage.addChild(graphics);
                }
                areas[u].neighbors[v] = { reversed, label, props };
                vertices[v].leaders.add(u);
            }
            delete edges[source];
        }

        const matrix = new PIXI.Matrix(1, 0, 0, 1, 0, 0);
        const tag = new PIXI.Graphics();
        const keyText = new PIXI.Text();
        const valueText = new PIXI.Text();
        const labelText = new PIXI.Text();

        updateSize();
        initializeScale();
        updateBackground();
        initializeTexture();
        updateBounds();

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
            if (vertex.key === null) {
                vertex.key = '';
            }
            if (vertex.value === null) {
                vertex.value = '';
            }
            delete vertex.degree;
            vertex.sprite = new PIXI.Sprite();
            vertex.sprite.anchor.x = 0.5;
            vertex.sprite.anchor.y = 0.5;
            vertex.sprite.texture = defaultTexture;
            vertex.shape = ShapeInfo.circle(0, 0, 0);
            initializePosition(vertex);
            updateSprite(vertex);
            updateGeometry(vertex);
            initializeAlpha(vertex);
            app.stage.addChild(vertex.sprite);
        }

        const rectangleShape = ShapeInfo.rectangle(0, 0, 0, 0);
        const circleShape = ShapeInfo.circle(0, 0, 0);
        const lineShape = ShapeInfo.line(0, 0, 0, 0);
        const curveShape = ShapeInfo.cubicBezier(0, 0, 0, 0, 0, 0, 0, 0);

        setExporting(false);

        drawAreas();

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
            updateBackground,
            updateTexture,
            updateBounds,
            updatePosition,
            updateSprite,
            updateGeometry,
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
