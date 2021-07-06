import * as PIXI from 'pixi.js';
import { gsap } from 'gsap';

import { compare } from './types';
import defaults from './defaults';
import { pop, merge, processGraph, nullSettings, validate } from './data';
import { loadRemote } from './load';
import Panel from './panel';


export default function () {
    let filename;
    let output;
    let element;
    let normalize;
    let broker;
    let ratio;
    let app;

    function warn(object) {
        if (typeof object === 'string') {
            output.innerHTML = object;
        } else {
            output.innerHTML = 'Internal script error';
            console.error(object);
        }
    }

    function destroy() {
        app.destroy(true, {
            children: true,
            texture: true,
            baseTexture: true,
        });
    }

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
                settings = validate.configuration(settings, props);
            },
            (data, props) => {
                const id = validate.receivedId(data);
                validate.notDuplicateVertex(id, vertices);
                const x = validate.receivedX(props);
                if (x !== null) {
                    if (minX > x) {
                        minX = x;
                    }
                    if (maxX < x) {
                        maxX = x;
                    }
                }
                const y = validate.receivedY(props);
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
        let rect;
        let width;
        let height;

        let zoom = 100;

        let hoveredVertex = null;
        let draggedVertex = null;
        let dragging = false;

        let mouseX;
        let mouseY;

        let pivotX;
        let pivotY;

        function resize() {
            rect = element.getBoundingClientRect();
            if (width !== rect.width) {
                width = rect.width;
                height = width / ratio;
                app.renderer.resize(width, height);
            }
        }

        function drawVertex(props) {
            const graphics = new PIXI.Graphics()
                .beginFill(props.color, 1)
                .drawCircle(0, 0, vertexScale * props.size)
                .endFill();
            return app.renderer.generateTexture(graphics);
        }

        function drawEdges(u) {
            const graphics = areas[u].graphics;
            graphics.clear();
            for (const [v, neighbor] of Object.entries(areas[u].neighbors)) {
                let source;
                let target;
                if (neighbor.reversed) {
                    source = v;
                    target = u;
                } else {
                    source = u;
                    target = v;
                }
                const sourceVisible = vertices[source].visibleX && vertices[source].visibleY;
                const targetVisible = vertices[target].visibleX && vertices[target].visibleY;
                if (sourceVisible || targetVisible) {
                    const sx = vertices[source].sprite.position.x;
                    const sy = vertices[source].sprite.position.y;
                    const tx = vertices[target].sprite.position.x;
                    const ty = vertices[target].sprite.position.y;
                    if (compare(sx, tx) !== 0 || compare(sy, ty) !== 0) {
                        const props = merge(settings.edge, neighbor.props);
                        let alpha = props.alpha * vertices[source].alpha * vertices[target].alpha;
                        if (!sourceVisible || !targetVisible) {
                            alpha *= settings.graph.edgeFade;
                        }
                        graphics.lineStyle({
                            width: edgeScale * props.width,
                            color: props.color,
                            alpha: Math.min(alpha, 1),
                        });
                        graphics.moveTo(sx, sy);
                        const c1 = props.curve1;
                        const c2 = props.curve2;
                        if (compare(c1, 0) !== 0 || compare(c2, 0) !== 0) {
                            const dx = 0.2 * (tx - sx);
                            const dy = 0.2 * (ty - sy);
                            const nx = -dy;
                            const ny = dx;
                            const x1 = sx + dx + c1 * nx;
                            const y1 = sy + dy + c1 * ny;
                            const x2 = tx - dx + c2 * nx;
                            const y2 = ty - dy + c2 * ny;
                            graphics.bezierCurveTo(x1, y1, x2, y2, tx, ty);
                        } else {
                            graphics.lineTo(tx, ty);
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

        function updateSprite(vertex) {
            const props = merge(settings.vertex, vertex.props);
            if (props === settings.vertex) {
                vertex.sprite.texture = defaultTexture;
            } else {
                vertex.sprite.texture = drawVertex(props);
            }
        }

        function updateVisibilityX(leaders, i) {
            const vertex = vertices[idsX[i]];
            vertex.visibleX = !vertex.visibleX;
            for (const u of vertex.leaders) {
                leaders.add(u);
            }
        }

        function updateVisibilityY(leaders, i) {
            const vertex = vertices[idsY[i]];
            vertex.visibleY = !vertex.visibleY;
            for (const u of vertex.leaders) {
                leaders.add(u);
            }
        }

        function updateVisibility() {
            const leaders = new Set();
            const left = app.stage.pivot.x;
            while (leftX > 0 && compare(vertices[idsX[leftX - 1]].sprite.position.x, left) > 0) {
                leftX--;
                updateVisibilityX(leaders, leftX);
            }
            while (leftX < n && compare(vertices[idsX[leftX]].sprite.position.x, left) < 0) {
                updateVisibilityX(leaders, leftX);
                leftX++;
            }
            const right = left + width;
            while (rightX > 0 && compare(vertices[idsX[rightX - 1]].sprite.position.x, right) > 0) {
                rightX--;
                updateVisibilityX(leaders, rightX);
            }
            while (rightX < n && compare(vertices[idsX[rightX]].sprite.position.x, right) < 0) {
                updateVisibilityX(leaders, rightX);
                rightX++;
            }
            const top = app.stage.pivot.y;
            while (leftY > 0 && compare(vertices[idsY[leftY - 1]].sprite.position.y, top) > 0) {
                leftY--;
                updateVisibilityY(leaders, leftY);
            }
            while (leftY < n && compare(vertices[idsY[leftY]].sprite.position.y, top) < 0) {
                updateVisibilityY(leaders, leftY);
                leftY++;
            }
            const bottom = top + height;
            while (rightY > 0 && compare(vertices[idsY[rightY - 1]].sprite.position.y, bottom) > 0) {
                rightY--;
                updateVisibilityY(leaders, rightY);
            }
            while (rightY < n && compare(vertices[idsY[rightY]].sprite.position.y, bottom) < 0) {
                updateVisibilityY(leaders, rightY);
                rightY++;
            }
            return leaders;
        }

        function updateVisibleAreas() {
            const leaders = updateVisibility();
            for (const u of leaders) {
                drawEdges(u);
            }
        }

        function updateNeighborAreas(vertex) {
            for (const u of vertex.leaders) {
                drawEdges(u);
            }
        }

        function buildSprite(vertex) {
            vertex.x = settings.graph.borderX + vertex.x * (width - 2 * settings.graph.borderX);
            vertex.y = settings.graph.borderY + vertex.y * (height - 2 * settings.graph.borderY);
            delete vertex.degree;
            vertex.visibleX = true;
            vertex.visibleY = true;
            vertex.alpha = 1;
            vertex.sprite = new PIXI.Sprite();
            vertex.sprite.anchor.x = 0.5;
            vertex.sprite.anchor.y = 0.5;
            vertex.sprite.position.x = vertex.x;
            vertex.sprite.position.y = vertex.y;
            vertex.sprite.interactive = true;
            vertex.move = (x, y) => {
                vertex.sprite.position.x = x;
                vertex.sprite.position.y = y;
                updateNeighborAreas(vertex);
            };
            vertex.stop = () => {
                const scale = zoom / 100;
                vertex.x = vertex.sprite.position.x / scale;
                vertex.y = vertex.sprite.position.y / scale;
                if (n > 0) {
                    let i;
                    let j;
                    let id;
                    i = vertex.indexX;
                    id = idsX[i];
                    for (j = i; j > 0; j--) {
                        if (compare(vertex.x, vertices[idsX[j - 1]].x) >= 0) {
                            break;
                        }
                        idsX[j] = idsX[j - 1];
                    }
                    i = j;
                    for (j = i; j < n - 1; j++) {
                        if (compare(vertex.x, vertices[idsX[j + 1]].x) <= 0) {
                            break;
                        }
                        idsX[j] = idsX[j + 1];
                    }
                    i = j;
                    idsX[i] = id;
                    vertex.indexX = i;
                    i = vertex.indexY;
                    id = idsY[i];
                    for (j = i; j > 0; j--) {
                        if (compare(vertex.y, vertices[idsY[j - 1]].y) >= 0) {
                            break;
                        }
                        idsY[j] = idsY[j - 1];
                    }
                    i = j;
                    for (j = i; j < n - 1; j++) {
                        if (compare(vertex.y, vertices[idsY[j + 1]].y) <= 0) {
                            break;
                        }
                        idsY[j] = idsY[j + 1];
                    }
                    i = j;
                    idsY[i] = id;
                    vertex.indexY = i;
                }
                draggedVertex = null;
            };
            vertex.sprite.on('mousedown', () => {
                draggedVertex = vertex;
            });
            vertex.sprite.on('mouseup', () => {
                vertex.stop();
            });
            vertex.sprite.on('mouseover', () => {
                if (hoveredVertex === null) {
                    hoveredVertex = vertex;
                    updatePanel.fadeToggle(true);
                    updatePanel.fadeChange(vertex);
                }
            });
            vertex.sprite.on('mouseout', () => {
                if (hoveredVertex === vertex) {
                    updatePanel.fadeToggle(false);
                    hoveredVertex = null;
                }
            });
            app.stage.addChild(vertex.sprite);
            updateSprite(vertex);
        }

        if (settings === null) {
            settings = nullSettings;
        }
        settings.graph = merge(defaults.graph, settings.graph);
        settings.vertex = merge(defaults.vertex, settings.vertex);
        settings.edge = merge(defaults.edge, settings.edge);

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

        let edgeScale = 1;
        let vertexScale = 1;
        let defaultTexture = drawVertex(settings.vertex);

        resize();

        const idsX = Object.keys(vertices);
        let leftX = 0;
        let rightX = n;

        const idsY = idsX.slice();
        let leftY = leftX;
        let rightY = rightX;

        if (n > 0) {
            if (n === 1) {
                const vertex = vertices[idsX[0]];
                if (vertex.x === null) {
                    vertex.x = Math.random();
                } else {
                    if (normalize) {
                        vertex.x = 0.5;
                    }
                }
                if (vertex.y === null) {
                    vertex.y = Math.random();
                } else {
                    if (normalize) {
                        vertex.y = 0.5;
                    }
                }
                buildSprite(vertex);
                vertex.indexX = 0;
                vertex.indexY = 0;
            } else {
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
                for (const id of idsX) {
                    const vertex = vertices[id];
                    if (vertex.x === null) {
                        vertex.x = Math.random();
                    } else {
                        if (normalize) {
                            if (difX === 0) {
                                vertex.x = 0.5;
                            } else {
                                vertex.x = (vertex.x - minX) / difX;
                            }
                        }
                    }
                    if (vertex.y === null) {
                        vertex.y = Math.random();
                    } else {
                        if (normalize) {
                            if (difY === 0) {
                                vertex.y = 0.5;
                            } else {
                                vertex.y = (vertex.y - minY) / difY;
                            }
                        }
                    }
                    buildSprite(vertex);
                }
                idsX.sort((a, b) => compare(vertices[a].x, vertices[b].x));
                idsY.sort((a, b) => compare(vertices[a].y, vertices[b].y));
                for (let i = 0; i < n; i++) {
                    vertices[idsX[i]].indexX = i;
                    vertices[idsY[i]].indexY = i;
                }
            }
        }

        const resizeObserver = new ResizeObserver(() => {
            resize();
            updateVisibleAreas();
        });
        resizeObserver.observe(element);

        const mutationObserver = new MutationObserver(() => {
            if (!document.body.contains(element)) {
                mutationObserver.disconnect();
                resizeObserver.disconnect();
                destroy();
            }
        });
        mutationObserver.observe(document.body, { childList: true, subtree: true });

        const main = document.createElement('div');

        const refresh = {
            background() {
                app.renderer.backgroundColor = settings.graph.color;
                app.renderer.backgroundAlpha = settings.graph.alpha;
            },
            sprite(scale, vertex) {
                vertex.sprite.position.x = scale * vertex.x;
                vertex.sprite.position.y = scale * vertex.y;
                updateSprite(vertex);
            },
            edges() {
                updateVisibility();
                drawAreas();
            },
        };

        const [updatePanel, topPanel, bottomPanel] = Panel(filename, app, settings, vertices, areas, refresh, main, warn);

        main.grab = (event) => {
            if (draggedVertex === null) {
                dragging = true;
                mouseX = event.offsetX;
                mouseY = event.offsetY;
                pivotX = app.stage.pivot.x;
                pivotY = app.stage.pivot.y;
            }
        };
        main.release = () => {
            dragging = false;
            if (draggedVertex !== null) {
                draggedVertex.stop();
            }
        };
        main.addEventListener('mousedown', (event) => {
            event.preventDefault();
            main.grab(event);
        });
        main.addEventListener('mouseup', (event) => {
            event.preventDefault();
            main.release();
        });
        main.addEventListener('mouseenter', (event) => {
            event.preventDefault();
            if (event.buttons === 1) {
                main.grab(event);
            } else {
                main.release();
            }
        });
        main.addEventListener('mousemove', (event) => {
            event.preventDefault();
            if (draggedVertex === null) {
                if (dragging) {
                    app.stage.pivot.x = pivotX - (event.offsetX - mouseX);
                    app.stage.pivot.y = pivotY - (event.offsetY - mouseY);
                    updateVisibleAreas();
                }
            } else {
                const x = app.stage.pivot.x + event.offsetX;
                const y = app.stage.pivot.y + event.offsetY;
                draggedVertex.move(x, y);
            }
        });

        main.addEventListener('wheel', (event) => {
            event.preventDefault();
            const result = compare(event.deltaY, 0);
            if (result !== 0) {
                if (hoveredVertex === null) {
                    if (result === -1 || (result === 1 && zoom > 10)) {
                        const shift = -result * Math.round(zoom / 10);
                        const error = (zoom + shift) / zoom - 1;
                        app.stage.pivot.x += error * (app.stage.pivot.x + event.offsetX);
                        app.stage.pivot.y += error * (app.stage.pivot.y + event.offsetY);
                        zoom += shift;
                        const delta = zoom - 100;
                        edgeScale = 1 + (delta * settings.graph.edgeScale) / 100;
                        vertexScale = 1 + (delta * settings.graph.vertexScale) / 100;
                        defaultTexture = drawVertex(settings.vertex);
                        const scale = zoom / 100;
                        for (const vertex of Object.values(vertices)) {
                            refresh.sprite(scale, vertex);
                        }
                        refresh.edges();
                        updatePanel.scale(zoom);
                    }
                } else {
                    let fade = Math.round(100 * hoveredVertex.alpha);
                    if (result === -1 || (result === 1 && fade > 10)) {
                        fade -= result * Math.round(fade / 10);
                        hoveredVertex.alpha = fade / 100;
                        updateNeighborAreas(hoveredVertex);
                        updatePanel.fadeChange(hoveredVertex);
                    }
                }
            }
        });
        main.addEventListener('dblclick', (event) => {
            event.preventDefault();
            if (hoveredVertex === null) {
                let moved = false;
                if (compare(app.stage.pivot.x, 0) !== 0) {
                    app.stage.pivot.x = 0;
                    moved = true;
                }
                if (compare(app.stage.pivot.y, 0) !== 0) {
                    app.stage.pivot.y = 0;
                    moved = true;
                }
                if (zoom !== 100) {
                    zoom = 100;
                    edgeScale = 1;
                    vertexScale = 1;
                    defaultTexture = drawVertex(settings.vertex);
                    for (const vertex of Object.values(vertices)) {
                        vertex.sprite.position.x = vertex.x;
                        vertex.sprite.position.y = vertex.y;
                        updateSprite(vertex);
                    }
                    refresh.edges();
                    updatePanel.scale(zoom);
                } else {
                    if (moved) {
                        updateVisibleAreas();
                    }
                }
            } else {
                if (compare(hoveredVertex.alpha, 1) !== 0) {
                    hoveredVertex.alpha = 1;
                    updateNeighborAreas(hoveredVertex);
                    updatePanel.fadeChange(hoveredVertex);
                }
            }
        });

        element.appendChild(topPanel);
        element.appendChild(main);
        element.appendChild(bottomPanel);

        refresh.background();
        drawAreas();
        updatePanel.scale(zoom);

        main.appendChild(app.view);
    }

    return function (path, horizontal, vertical, normalizePY, brokerPY, uid) {
        filename = path.slice(path.lastIndexOf('/') + 1);

        output = document.createElement('p');
        output.style.margin = '.5em';
        output.style.color = '#ff0000';
        output.style.userSelect = 'none';
        output.addEventListener('click', () => {
            output.innerHTML = '';
        });

        element = document.getElementById(uid);
        element.appendChild(output);

        normalize = JSON.parse(normalizePY.toLowerCase());

        broker = JSON.parse(brokerPY.toLowerCase());

        ratio = horizontal / vertical;

        app = new PIXI.Application({
            autoDensity: true,
            antialias: true,
            resolution: 2,
        });

        const start = Date.now();
        initialize();
        loadRemote(path, process)
            .then(() => {
                console.log(`${n} vertices, ${m} edges`);
                finalize();
                console.log(`Loaded in ${(Date.now() - start) / 1000} seconds`);
            })
            .catch((error) => {
                warn(error);
                destroy();
            });
    };
}
