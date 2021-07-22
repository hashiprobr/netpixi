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

        function getInfinite() {
            return infinite;
        }

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

        function calculateTextVisibility(x, y, rectangleWidth, rectangleHeight) {
            const radiusX = rectangleWidth / 2;
            const radiusY = rectangleHeight / 2;
            return x >= left - radiusX && x < right + radiusX && y >= top - radiusY && y < bottom + radiusY;
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

        function drawGeometry(graphics, color, shape, radius) {
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

        function drawGraphics(props, radius, bwidth) {
            const graphics = new PIXI.Graphics();
            if (props.shape !== 'circle') {
                graphics.beginFill(props.color, 0);
                graphics.drawCircle(0, 0, radius);
                graphics.endFill();
            }
            if (compare(bwidth, 0) > 0) {
                drawGeometry(graphics, props.bcolor, props.shape, radius);
                drawGeometry(graphics, props.color, props.shape, radius - bwidth);
            } else {
                drawGeometry(graphics, props.color, props.shape, radius);
            }
            return graphics;
        }

        function drawTexture(vertex, props) {
            const graphics = drawGraphics(props, vertex.sprite.radius, vertex.sprite.bwidth);
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
            if (vertex.key !== '') {
                keyText.text = vertex.key;
                keyText.style.fontSize = vertex.keyStyle.fontSize;
                keyText.style.fontFamily = vertex.keyStyle.fontFamily;
                keyText.style.strokeThickness = vertex.keyStyle.strokeThickness;
                keyText.style.fill = props.color;
                keyText.style.stroke = props.bcolor;
                vertex.keySprite.texture.resize(vertex.keyWidth, vertex.keyHeight);
                app.renderer.render(keyText, {
                    renderTexture: vertex.keySprite.texture,
                });
            }
            if (vertex.value !== '') {
                valueText.text = vertex.value;
                valueText.style.fontSize = vertex.valueStyle.fontSize;
                if (vertex.sprite.texture === defaultTexture) {
                    drawTexture(vertex, props);
                }
                matrix.tx = vertex.valueX;
                matrix.ty = vertex.valueY;
                app.renderer.render(valueText, {
                    renderTexture: vertex.sprite.texture,
                    clear: false,
                    transform: matrix,
                });
            }
            vertex.dirty = false;
        }

        function drawLabelSprite(neighbor) {
            const radius = neighbor.style.fontSize / 2;
            neighbor.sprite.texture.resize(neighbor.width, neighbor.height);
            labelBackground.clear();
            labelBackground.beginFill(neighbor.color, neighbor.alpha);
            labelBackground.drawRoundedRect(0, 0, neighbor.width, neighbor.height, radius);
            labelBackground.endFill();
            app.renderer.render(labelBackground, {
                renderTexture: neighbor.sprite.texture,
            });
            labelText.text = neighbor.label;
            labelText.style.fontSize = neighbor.style.fontSize;
            matrix.tx = radius;
            matrix.ty = radius;
            app.renderer.render(labelText, {
                renderTexture: neighbor.sprite.texture,
                clear: false,
                transform: matrix,
            });
            neighbor.dirty = false;
        }

        function drawEdges(u) {
            const graphics = areas[u].graphics;
            graphics.clear();
            for (const [v, neighbor] of Object.entries(areas[u].neighbors)) {
                let destroy = true;
                neighbor.head = null;
                neighbor.body = null;
                let s;
                let t;
                if (neighbor.reversed) {
                    s = vertices[v];
                    t = vertices[u];
                } else {
                    s = vertices[u];
                    t = vertices[v];
                }
                let sx;
                let sy;
                let tx;
                let ty;
                if (infinite) {
                    sx = s.sprite.position.x;
                    sy = s.sprite.position.y;
                    tx = t.sprite.position.x;
                    ty = t.sprite.position.y;
                } else {
                    sx = s.x;
                    sy = s.y;
                    tx = t.x;
                    ty = t.y;
                }
                let dx = tx - sx;
                let dy = ty - sy;
                const distance = Math.sqrt(dx * dx + dy * dy) - (s.radius + t.radius);
                if (compare(distance, 0) > 0) {
                    const props = merge(settings.edge, neighbor.props, differences.edge);
                    let alpha = props.alpha * s.alpha * t.alpha;
                    if (selected.size > 0) {
                        if (s.selected) {
                            if (!t.selected) {
                                alpha *= settings.graph.alpha1;
                            }
                        } else {
                            alpha *= settings.graph.alpha1;
                            if (!t.selected) {
                                alpha *= settings.graph.alpha2;
                            }
                        }
                    }
                    if (compare(alpha, 0) > 0) {
                        alpha = Math.min(alpha, 1);
                        let size = Math.min(props.width, s.radius, t.radius);
                        let close = false;
                        const minimum = 21 * size;
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
                        let vertexShape;
                        const radius = size / 2;
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
                        let visible = !infinite;
                        if (!visible) {
                            visible = calculateVisibility(fx, fy, radius) || calculateVisibility(gx, gy, radius);
                            if (!visible) {
                                const boundsShape = formatRectangle(radius);
                                const intersect = Intersection.intersect(edgeShape, boundsShape);
                                if (intersect.points.length > 0) {
                                    visible = true;
                                }
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
                                neighbor.body = { straight, fx, fy, gx, gy };
                            } else {
                                graphics.bezierCurveTo(x3, y3, x4, y4, gx, gy);
                                neighbor.body = { straight, fx, fy, x3, y3, x4, y4, gx, gy };
                            }
                            if (settings.graph.directed) {
                                if (straight) {
                                    edgeShape = formatLine(sx, sy, tx, ty);
                                } else {
                                    edgeShape = formatCurve(sx, sy, x1, y1, x2, y2, tx, ty);
                                }
                                const [hx, hy] = calculateIntersection(edgeShape, t.shape);
                                dx = 4 * (hx - gx);
                                dy = 4 * (hy - gy);
                                nx = -dy;
                                ny = dx;
                                graphics.moveTo(gx, gy);
                                graphics.lineTo(gx - 3 * dx + nx, gy - 3 * dy + ny);
                                graphics.moveTo(gx, gy);
                                graphics.lineTo(gx - 3 * dx - nx, gy - 3 * dy - ny);
                                neighbor.head = { dx, dy, nx, ny };
                            }
                            if (neighbor.label !== '') {
                                if (!('sprite' in neighbor)) {
                                    neighbors.add(neighbor);
                                    neighbor.sprite = new PIXI.Sprite(new PIXI.RenderTexture.create());
                                    neighbor.sprite.anchor.x = 0.5;
                                    neighbor.sprite.anchor.y = 0.5;
                                    app.stage.addChild(neighbor.sprite);
                                }
                                const a = props.lparam;
                                const b = (1 - a);
                                if (straight) {
                                    neighbor.x = b * fx + a * gx;
                                    neighbor.y = b * fy + a * gy;
                                } else {
                                    neighbor.x = b * b * b * fx + 3 * b * b * a * x3 + 3 * b * a * a * x4 + a * a * a * gx;
                                    neighbor.y = b * b * b * fy + 3 * b * b * a * y3 + 3 * b * a * a * y4 + a * a * a * gy;
                                }
                                if (infinite) {
                                    neighbor.x /= scale;
                                    neighbor.y /= scale;
                                }
                                neighbor.size = size;
                                neighbor.color = props.color;
                                neighbor.alpha = alpha;
                                updateLabelPosition(neighbor);
                                updateLabelSprite(neighbor);
                                destroy = false;
                            }
                        }
                    }
                }
                if (destroy) {
                    if ('sprite' in neighbor) {
                        neighbor.sprite.destroy();
                        delete neighbor.sprite;
                        neighbors.delete(neighbor);
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
            let radius;
            let bwidth;
            if (infinite) {
                radius = settings.vertex.size;
                bwidth = settings.vertex.bwidth;
            } else {
                radius = scale * settings.vertex.size;
                bwidth = scale * settings.vertex.bwidth;
            }
            defaultTexture.resize(radius, radius);
            radius /= 2;
            bwidth = Math.min(bwidth, radius / 2);
            const graphics = drawGraphics(settings.vertex, radius, bwidth);
            matrix.tx = radius;
            matrix.ty = radius;
            app.renderer.render(graphics, {
                renderTexture: defaultTexture,
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

        function updateSelected(vertex) {
            let alpha;
            if (selected.size === 0 || vertex.selected) {
                alpha = 1;
            } else {
                alpha = settings.graph.alpha0;
            }
            vertex.sprite.alpha = alpha;
            if (vertex.key !== '') {
                vertex.keySprite.alpha = alpha;
            }
        }

        function updatePosition(vertex) {
            vertex.sprite.position.x = scale * vertex.x;
            vertex.sprite.position.y = scale * vertex.y;
        }

        function updateVisible(vertex) {
            let wronglyVisible = calculateVisibility(vertex.sprite.position.x, vertex.sprite.position.y, vertex.sprite.width / 2);
            let rightlyVisible = calculateVisibility(vertex.sprite.position.x, vertex.sprite.position.y, vertex.sprite.radius);
            vertex.sprite.visible = wronglyVisible || rightlyVisible || exporting;
            if (vertex.key !== '') {
                if (!vertex.sprite.visible) {
                    wronglyVisible = calculateTextVisibility(vertex.keySprite.position.x, vertex.keySprite.position.y, vertex.keySprite.width, vertex.keySprite.height);
                    rightlyVisible = calculateTextVisibility(vertex.keySprite.position.x, vertex.keySprite.position.y, vertex.keyWidth, vertex.keyHeight);
                    vertex.sprite.visible = wronglyVisible || rightlyVisible;
                }
                vertex.keySprite.visible = vertex.sprite.visible;
            }
        }

        function updateSprite(vertex) {
            const props = merge(settings.vertex, vertex.props, differences.vertex);
            vertex.radius = props.size / 2;
            if (infinite) {
                vertex.sprite.radius = vertex.radius;
                vertex.sprite.bwidth = props.bwidth;
            } else {
                vertex.sprite.radius = scale * vertex.radius;
                vertex.sprite.bwidth = scale * props.bwidth;
            }
            vertex.sprite.bwidth = Math.min(vertex.sprite.bwidth, vertex.sprite.radius / 2);
            if (vertex.key === '') {
                if ('keySprite' in vertex) {
                    vertex.keySprite.destroy();
                    delete vertex.keySprite;
                }
            } else {
                if (!('keySprite' in vertex)) {
                    vertex.keySprite = new PIXI.Sprite(new PIXI.RenderTexture.create());
                    vertex.keySprite.anchor.x = 0.5;
                    vertex.keySprite.anchor.y = 0.5;
                    app.stage.addChild(vertex.keySprite);
                }
                vertex.keyStyle = {
                    fontSize: settings.graph.kscale * vertex.sprite.radius,
                    fontFamily: props.kfamily,
                    strokeThickness: vertex.sprite.bwidth / 2,
                };
                keyText.text = vertex.key;
                keyText.style.fontSize = vertex.keyStyle.fontSize;
                keyText.style.fontFamily = vertex.keyStyle.fontFamily;
                keyText.style.strokeThickness = vertex.keyStyle.strokeThickness;
                vertex.keyWidth = keyText.width;
                vertex.keyHeight = keyText.height;
            }
            if (vertex.value !== '') {
                vertex.valueStyle = {
                    fontSize: settings.graph.vscale * vertex.sprite.radius,
                };
                valueText.text = vertex.value;
                valueText.style.fontSize = vertex.valueStyle.fontSize;
                vertex.valueX = vertex.sprite.radius - valueText.width / 2;
                vertex.valueY = vertex.sprite.radius - valueText.height / 2;
            }
            updateVisible(vertex);
            vertex.dirty = true;
            if (vertex.sprite.visible) {
                drawSprite(vertex, props);
            }
        }

        function updateSpriteStyle(vertex) {
            updateVisible(vertex);
            if (vertex.dirty && vertex.sprite.visible) {
                const props = merge(settings.vertex, vertex.props, differences.vertex);
                drawSprite(vertex, props);
            }
        }

        function updateGeometry(vertex) {
            if (infinite) {
                vertex.shape.args[0].x = vertex.sprite.position.x;
                vertex.shape.args[0].y = vertex.sprite.position.y;
            } else {
                vertex.shape.args[0].x = vertex.x;
                vertex.shape.args[0].y = vertex.y;
            }
            vertex.shape.args[1] = vertex.radius;
            if (vertex.key !== '') {
                vertex.keySprite.position.x = vertex.sprite.position.x;
                vertex.keySprite.position.y = vertex.sprite.position.y - vertex.sprite.radius - vertex.keyHeight / 2;
            }
        }

        function updateLabelPosition(neighbor) {
            neighbor.sprite.position.x = scale * neighbor.x;
            neighbor.sprite.position.y = scale * neighbor.y;
        }

        function updateLabelVisible(neighbor) {
            const wronglyVisible = calculateTextVisibility(neighbor.sprite.position.x, neighbor.sprite.position.y, neighbor.sprite.width, neighbor.sprite.height);
            const rightlyVisible = calculateTextVisibility(neighbor.sprite.position.x, neighbor.sprite.position.y, neighbor.width, neighbor.height);
            neighbor.sprite.visible = wronglyVisible || rightlyVisible || exporting;
        }

        function updateLabelSprite(neighbor) {
            if (infinite) {
                neighbor.style = {
                    fontSize: settings.graph.lshift + 2 * neighbor.size,
                };
            } else {
                neighbor.style = {
                    fontSize: scale * (settings.graph.lshift + 2 * neighbor.size),
                };
            }
            labelText.text = neighbor.label;
            labelText.style.fontSize = neighbor.style.fontSize;
            neighbor.width = labelText.width + neighbor.style.fontSize;
            neighbor.height = labelText.height + neighbor.style.fontSize;
            updateLabelVisible(neighbor);
            neighbor.dirty = true;
            if (neighbor.sprite.visible) {
                drawLabelSprite(neighbor);
            }
        }

        function updateLabelSpriteStyle(neighbor) {
            updateLabelVisible(neighbor);
            if (neighbor.dirty && neighbor.sprite.visible) {
                drawLabelSprite(neighbor);
            }
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
                        vertex.x = vertex.sprite.position.x / scale;
                        vertex.y = vertex.sprite.position.y / scale;
                        updateGeometry(vertex);
                        drawNeighborAreas(vertex);
                    };
                    vertex.sprite.stop = () => {
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
                                updateSpriteStyle(vertex);
                            }
                            if (infinite) {
                                drawAreas();
                            } else {
                                for (const neighbor of neighbors) {
                                    updateLabelSpriteStyle(neighbor);
                                }
                            }
                            dragging = false;
                        }
                    } else {
                        draggedVertex.sprite.stop();
                    }
                };
                app.view.addEventListener('mousedown', (event) => {
                    event.preventDefault();
                    if (event.shiftKey) {
                        if (draggedVertex === null) {
                            if (selected.size > 0) {
                                for (const vertex of selected) {
                                    vertex.selected = false;
                                }
                                selected.clear();
                                for (const vertex of Object.values(vertices)) {
                                    updateSelected(vertex);
                                }
                                drawAreas();
                            }
                        } else {
                            if (draggedVertex.selected) {
                                selected.delete(draggedVertex);
                                draggedVertex.selected = false;
                            } else {
                                draggedVertex.selected = true;
                                selected.add(draggedVertex);
                            }
                            if (selected.size === 0 || selected.size === 1) {
                                for (const vertex of Object.values(vertices)) {
                                    updateSelected(vertex);
                                }
                                drawAreas();
                            } else {
                                updateSelected(draggedVertex);
                                drawNeighborAreas(draggedVertex);
                            }
                        }
                    } else {
                        app.view.grab(event);
                    }
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
                                    if (infinite) {
                                        drawAreas();
                                    } else {
                                        for (const area of Object.values(areas)) {
                                            area.graphics.scale.x = scale;
                                            area.graphics.scale.y = scale;
                                        }
                                        for (const neighbor of neighbors) {
                                            updateLabelPosition(neighbor);
                                            updateLabelSprite(neighbor);
                                        }
                                    }
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
                            if (infinite) {
                                drawAreas();
                            } else {
                                for (const area of Object.values(areas)) {
                                    area.graphics.scale.x = 1;
                                    area.graphics.scale.y = 1;
                                }
                                for (const neighbor of neighbors) {
                                    updateLabelPosition(neighbor);
                                    updateLabelSprite(neighbor);
                                }
                            }
                            panel.updateZoom();
                        } else {
                            if (moved) {
                                updateBounds();
                                for (const vertex of Object.values(vertices)) {
                                    updateSpriteStyle(vertex);
                                }
                                if (infinite) {
                                    drawAreas();
                                } else {
                                    for (const neighbor of neighbors) {
                                        updateLabelSpriteStyle(neighbor);
                                    }
                                }
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
            labelBackground.destroy();
            labelText.destroy();
            valueText.destroy();
            keyText.destroy();
        }

        if (settings === null) {
            settings = nullSettings;
        }
        settings.graph = merge({ ...defaults.graph }, settings.graph, differences.graph);
        settings.vertex = merge({ ...defaults.vertex }, settings.vertex, differences.vertex);
        settings.edge = merge({ ...defaults.edge }, settings.edge, differences.edge);

        const areas = {};

        const selected = new Set();

        const neighbors = new Set();

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
                    vertices[u].leaders.add(u);
                    areas[u] = { neighbors, graphics };
                    app.stage.addChild(graphics);
                }
                vertices[v].leaders.add(u);
                areas[u].neighbors[v] = { reversed, label, props };
            }
            delete edges[source];
        }

        const matrix = new PIXI.Matrix(1, 0, 0, 1, 0, 0);
        const keyText = new PIXI.Text();
        const valueText = new PIXI.Text();
        const labelText = new PIXI.Text();
        const labelBackground = new PIXI.Graphics();

        updateSize();
        initializeScale();
        updateBackground();
        initializeTexture();
        updateBounds();
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
            vertex.selected = false;
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

        drawAreas();

        const [connectMouseToSprites, connectMouseToView] = connectMouse();

        return {
            settings,
            vertices,
            areas,
            getInfinite,
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
