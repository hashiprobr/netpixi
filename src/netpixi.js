import * as PIXI from 'pixi.js';
import { gsap } from 'gsap';

import { compare, isNumber, conditions } from './types';
import defaults from './defaults';
import Panel from './panel';
import load from './load';


export default function () {
    let filename;
    let output;
    let element;
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

    function exit(object) {
        warn(object);
        destroy();
    }

    function pop(object, name) {
        if (name in object) {
            const value = object[name];
            delete object[name];
            return value;
        }
        return null;
    }

    function merge(base, cond, over) {
        if (over === null) {
            return base;
        }
        let equal = true;
        const props = {};
        for (const key in base) {
            if (key in over && base[key] !== over[key] && cond[key](over[key])) {
                equal = false;
                props[key] = over[key];
            } else {
                props[key] = base[key];
            }
        }
        if (equal) {
            return base;
        }
        return props;
    }

    let line;

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
        line = 0;

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

    function configure() {
        for (const name of ['graph', 'vertex', 'edge']) {
            settings[name] = defaults[name];
        }
    }

    function process(value) {
        line++;

        function fail(message) {
            throw `Line ${line}: ${message}`;
        }

        function loosePop(props, name) {
            if (props !== null) {
                return pop(props, name);
            }
            return null;
        }

        function tightPop(data, name) {
            if (name in data) {
                const value = data[name];
                if (typeof value === 'string' || Number.isInteger(value)) {
                    delete data[name];
                    return value;
                }
                fail(`invalid ${data.type} ${name}`);
            }
            fail(`missing ${data.type} ${name}`);
        }

        let data;
        try {
            data = JSON.parse(value);
        } catch (error) {
            fail(error.message);
        }
        if (typeof data !== 'object') {
            fail('must be an object');
        }
        if (data === null) {
            fail('cannot be null');
        }

        const props = pop(data, 'props');
        if (typeof props !== 'object') {
            fail('props must be an object');
        }

        switch (data.type) {
            case 'settings':
                if (settings === null) {
                    settings = { props };
                    if (props === null) {
                        configure();
                    } else {
                        for (const name of ['graph', 'vertex', 'edge']) {
                            const value = pop(props, name);
                            if (typeof value !== 'object') {
                                fail(`${name} settings must be an object`);
                            }
                            settings[name] = merge(defaults[name], conditions[name], value);
                        }
                    }
                } else {
                    fail('duplicate settings');
                }
                break;

            case 'vertex':
                const id = tightPop(data, 'id');
                if (id in vertices) {
                    fail(`duplicate vertex with id ${id}`);
                }
                let x = loosePop(props, 'x');
                if (x !== null) {
                    if (isNumber(x)) {
                        if (minX > x) {
                            minX = x;
                        }
                        if (maxX < x) {
                            maxX = x;
                        }
                    } else {
                        x = null;
                    }
                }
                let y = loosePop(props, 'y');
                if (y !== null) {
                    if (isNumber(y)) {
                        if (minY > y) {
                            minY = y;
                        }
                        if (maxY < y) {
                            maxY = y;
                        }
                    } else {
                        y = null;
                    }
                }
                const degree = 0;
                const leaders = [];
                vertices[id] = { x, y, degree, leaders, props };
                n++;
                break;

            case 'edge':
                const source = tightPop(data, 'source');
                if (!(source in vertices)) {
                    fail(`missing source with id ${source}`);
                }
                const target = tightPop(data, 'target');
                if (!(target in vertices)) {
                    fail(`missing target with id ${target}`);
                }
                if (source === target) {
                    fail('source and target with same id');
                }
                if (!(source in edges)) {
                    edges[source] = {};
                }
                if (target in edges[source]) {
                    fail(`duplicate edge with source ${source} and target ${target}`);
                }
                if (settings === null) {
                    fail('missing settings');
                }
                if (!settings.graph.directed && target in edges && source && edges[target]) {
                    fail(`existing edge with source ${target} and target ${source} but graph is not directed`);
                }
                vertices[source].degree++;
                vertices[target].degree++;
                edges[source][target] = props;
                m++;
                break;

            default:
                fail('unknown type');
        }
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

        function drawBackground() {
            app.renderer.backgroundColor = settings.graph.color;
            app.renderer.backgroundAlpha = settings.graph.alpha;
        }

        function drawVertex(props) {
            const graphics = new PIXI.Graphics()
                .beginFill(props.color, props.alpha)
                .drawCircle(0, 0, vertexScale * props.size)
                .endFill();
            return app.renderer.generateTexture(graphics);
        }

        function drawEdges(u) {
            const graphics = areas[u].graphics;
            graphics.clear();
            for (const neighbor of Object.values(areas[u].neighbors)) {
                let source;
                let target;
                if (neighbor.reversed) {
                    source = neighbor.v;
                    target = u;
                } else {
                    source = u;
                    target = neighbor.v;
                }
                const sourceVisible = vertices[source].visibleX && vertices[source].visibleY;
                const targetVisible = vertices[target].visibleX && vertices[target].visibleY;
                if (sourceVisible || targetVisible) {
                    const sx = vertices[source].sprite.position.x;
                    const sy = vertices[source].sprite.position.y;
                    const tx = vertices[target].sprite.position.x;
                    const ty = vertices[target].sprite.position.y;
                    if (compare(sx, tx) !== 0 || compare(sy, ty) !== 0) {
                        const props = merge(settings.edge, conditions.edge, neighbor.props);
                        let alpha = props.alpha * vertices[source].alpha * vertices[target].alpha;
                        if (!sourceVisible || !targetVisible) {
                            alpha *= settings.graph.edgeFade;
                        }
                        graphics.lineStyle({
                            width: edgeScale * props.width,
                            color: props.color,
                            alpha: alpha,
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
            const props = merge(settings.vertex, conditions.vertex, vertex.props);
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
                for (const u of vertex.leaders) {
                    drawEdges(u);
                }
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
                }
            });
            vertex.sprite.on('mouseout', () => {
                if (hoveredVertex === vertex) {
                    hoveredVertex = null;
                }
            });
            app.stage.addChild(vertex.sprite);
            updateSprite(vertex);
        }

        if (settings === null) {
            settings = { props: null };
            configure();
        }

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
                    const neighbors = [];
                    const graphics = new PIXI.Graphics();
                    areas[u] = { neighbors, graphics };
                    vertices[u].leaders.push(u);
                    app.stage.addChild(graphics);
                }
                areas[u].neighbors.push({ v, reversed, props });
                vertices[v].leaders.push(u);
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
                vertex.x = 0.5;
                vertex.y = 0.5;
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
                        if (difX === 0) {
                            vertex.x = 0.5;
                        } else {
                            vertex.x = (vertex.x - minX) / difX;
                        }
                    }
                    if (vertex.y === null) {
                        vertex.y = Math.random();
                    } else {
                        if (difY === 0) {
                            vertex.y = 0.5;
                        } else {
                            vertex.y = (vertex.y - minY) / difY;
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
            const leaders = updateVisibility();
            for (const u of leaders) {
                drawEdges(u);
            }
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

        const [topPanel, bottomPanel, updatePanel] = Panel(filename, settings, vertices, areas, main, app, warn);

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
                    const leaders = updateVisibility();
                    for (const u of leaders) {
                        drawEdges(u);
                    }
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
                            vertex.sprite.position.x = scale * vertex.x;
                            vertex.sprite.position.y = scale * vertex.y;
                            updateSprite(vertex);
                        }
                        updateVisibility();
                        drawAreas();
                        updatePanel(zoom);
                    }
                } else {
                    if (result === -1) {
                        if (compare(hoveredVertex.alpha, 1) < 0) {
                            hoveredVertex.alpha += 0.1;
                            for (const u of hoveredVertex.leaders) {
                                drawEdges(u);
                            }
                        }
                    } else {
                        if (compare(hoveredVertex.alpha, 0.1) > 0) {
                            hoveredVertex.alpha -= 0.1;
                            for (const u of hoveredVertex.leaders) {
                                drawEdges(u);
                            }
                        }
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
                    updateVisibility();
                    drawAreas();
                    updatePanel(zoom);
                } else {
                    if (moved) {
                        const leaders = updateVisibility();
                        for (const u of leaders) {
                            drawEdges(u);
                        }
                    }
                }
            } else {
                if (compare(hoveredVertex.alpha, 1) !== 0) {
                    hoveredVertex.alpha = 1;
                    for (const u of hoveredVertex.leaders) {
                        drawEdges(u);
                    }
                }
            }
        });

        element.appendChild(topPanel);
        element.appendChild(main);
        element.appendChild(bottomPanel);

        drawBackground();
        drawAreas();
        updatePanel(zoom);

        main.appendChild(app.view);

        console.log(`${n} vertices\n${m} edges`);
    }

    return function (path, horizontal, vertical, brokerPY, uid) {
        filename = path.slice(path.lastIndexOf('/') + 1);

        output = document.createElement('p');
        output.style.margin = '.5rem';
        output.style.fontSize = '11px';
        output.style.fontFamily = 'Helvetica Neue, Helvetica, Arial, sans-serif';
        output.style.lineHeight = 1;
        output.style.color = '#ff0000';

        element = document.getElementById(uid);
        element.appendChild(output);

        broker = JSON.parse(brokerPY.toLowerCase());

        ratio = horizontal / vertical;

        app = new PIXI.Application({
            autoDensity: true,
            antialias: true,
            resolution: 2,
        });

        load(path, initialize, process, finalize, exit);
    };
}
