import pako from 'pako';
import * as PIXI from 'pixi.js';
import { gsap } from 'gsap';

import { isNumber, conditions } from './types.js';
import defaults from './defaults.js';


function NetPixi() {
    let element;
    let app;

    function exit(error) {
        app.destroy(true, {
            children: true,
            texture: true,
            baseTexture: true,
        });
        if (typeof error === 'string') {
            element.innerHTML = error;
        } else {
            element.innerHTML = error.message;
        }
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

    function initialize() {
        line = 0;

        minX = Number.POSITIVE_INFINITY;
        maxX = Number.NEGATIVE_INFINITY;

        minY = Number.POSITIVE_INFINITY;
        maxY = Number.NEGATIVE_INFINITY;

        settings = null;
        vertices = {};
        edges = {};
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
                    settings = {
                        graph: merge(defaults.graph, conditions.graph, loosePop(props, 'graph')),
                        vertex: merge(defaults.vertex, conditions.vertex, loosePop(props, 'vertex')),
                        edge: merge(defaults.edge, conditions.edge, loosePop(props, 'edge')),
                    };
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
                break;

            case 'edge':
                const source = tightPop(data, 'source');
                if (!(source in vertices)) {
                    fail(`missing source with id ${source}`);
                }
                const target = tightPop(data, 'target');
                if (source === target) {
                    fail('source and target with same id');
                }
                if (!(target in vertices)) {
                    fail(`missing target with id ${target}`);
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
                if (!settings.graph.directed && target in edges && source in edges[target]) {
                    fail(`existing edge with source ${target} and target ${source} but graph is not directed`);
                }
                vertices[source].degree++;
                vertices[target].degree++;
                edges[source][target] = props;
                break;

            default:
                fail('unknown type');
        }
    }

    function finalize(ratio, fine) {
        function compare(a, b) {
            if (Math.abs(a - b) < 0.000001) {
                return 0;
            }
            if (a < b) {
                return -1;
            }
            return 1;
        }

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
                .beginFill(props.color, props.alpha)
                .drawCircle(0, 0, props.size)
                .endFill();
            return app.renderer.generateTexture(graphics);
        }

        function drawSprite(vertex) {
            const props = merge(settings.vertex, conditions.vertex, vertex.props);
            if (props === settings.vertex) {
                vertex.sprite.texture = defaultTexture;
            } else {
                vertex.sprite.texture = drawVertex(props);
            }
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
                const sx = vertices[source].sprite.position.x;
                const sy = vertices[source].sprite.position.y;
                const tx = vertices[target].sprite.position.x;
                const ty = vertices[target].sprite.position.y;
                if (compare(sx, tx) !== 0 || compare(sy, ty) !== 0) {
                    const props = merge(settings.edge, conditions.edge, neighbor.props);
                    graphics.lineStyle({
                        width: props.width,
                        color: props.color,
                        alpha: props.alpha,
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

        function drawAreas() {
            for (const u in areas) {
                drawEdges(u);
            }
        }

        function buildSprite(vertex) {
            vertex.x = settings.graph.borderX + vertex.x * (width - 2 * settings.graph.borderX);
            vertex.y = settings.graph.borderY + vertex.y * (height - 2 * settings.graph.borderY);
            delete vertex.degree;
            vertex.sprite = new PIXI.Sprite();
            vertex.sprite.anchor.x = 0.5;
            vertex.sprite.anchor.y = 0.5;
            vertex.sprite.position.x = vertex.x;
            vertex.sprite.position.y = vertex.y;
            vertex.sprite.interactive = true;
            vertex.sprite.on('mousedown', () => {
                draggedVertex = vertex;
            });
            vertex.sprite.on('mouseup', () => {
                draggedVertex = null;
            });
            vertex.move = (x, y) => {
                vertex.sprite.position.x = x;
                vertex.sprite.position.y = y;
                for (const u of vertex.leaders) {
                    drawEdges(u);
                }
            };
            drawSprite(vertex);
            app.stage.addChild(vertex.sprite);
        }

        if (settings === null) {
            settings = defaults;
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
                if (fine) {
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
                    vertices[u].leaders.push(u);
                    const neighbors = [];
                    const graphics = new PIXI.Graphics();
                    app.stage.addChild(graphics);
                    areas[u] = { neighbors, graphics };
                }
                vertices[v].leaders.push(u);
                areas[u].neighbors.push({ v, reversed, props });
            }
            delete edges[source];
        }

        let rect;
        let width;
        let height;

        resize();

        const defaultTexture = drawVertex(settings.vertex);

        if (Object.keys(vertices).length > 0) {
            const values = Object.values(vertices);
            if (values.length === 1) {
                const vertex = values[0];
                vertex.x = 0.5;
                vertex.y = 0.5;
                buildSprite(vertex);
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
                for (const vertex of values) {
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
            }
        }

        const observer = new ResizeObserver(() => {
            resize();
        });
        observer.observe(element);

        let draggedVertex;
        let dragging;

        let mouseX;
        let mouseY;

        let pivotX;
        let pivotY;

        function grab(event) {
            if (draggedVertex === null) {
                dragging = true;
                mouseX = event.offsetX;
                mouseY = event.offsetY;
                pivotX = app.stage.pivot.x;
                pivotY = app.stage.pivot.y;
            }
        }
        function release() {
            dragging = false;
            draggedVertex = null;
        }
        element.addEventListener('mousedown', (event) => {
            event.preventDefault();
            grab(event);
        });
        element.addEventListener('mouseup', (event) => {
            event.preventDefault();
            release();
        });
        element.addEventListener('mouseenter', (event) => {
            event.preventDefault();
            if (event.buttons === 1) {
                grab(event);
            } else {
                release();
            }
        });
        element.addEventListener('mousemove', (event) => {
            event.preventDefault();
            if (draggedVertex === null) {
                if (dragging) {
                    app.stage.pivot.x = pivotX - (event.offsetX - mouseX);
                    app.stage.pivot.y = pivotY - (event.offsetY - mouseY);
                }
            } else {
                const x = app.stage.pivot.x + event.offsetX;
                const y = app.stage.pivot.y + event.offsetY;
                draggedVertex.move(x, y);
            }
        });
        release();

        let zoom = 100;

        element.addEventListener('wheel', (event) => {
            event.preventDefault();
            const result = compare(event.deltaY, 0);
            if (result === -1 || (result === 1 && zoom > 10)) {
                const shift = -result * Math.round(zoom / 10);
                const error = (zoom + shift) / zoom - 1;
                app.stage.pivot.x += error * (app.stage.pivot.x + event.offsetX);
                app.stage.pivot.y += error * (app.stage.pivot.y + event.offsetY);
                zoom += shift;
                const scale = zoom / 100;
                for (const vertex of Object.values(vertices)) {
                    vertex.sprite.position.x = scale * vertex.x;
                    vertex.sprite.position.y = scale * vertex.y;
                }
                drawAreas();
            }
        });
        element.addEventListener('dblclick', (event) => {
            event.preventDefault();
            if (zoom !== 100) {
                zoom = 100;
                app.stage.pivot.x = 0;
                app.stage.pivot.y = 0;
                for (const vertex of Object.values(vertices)) {
                    vertex.sprite.position.x = vertex.x;
                    vertex.sprite.position.y = vertex.y;
                }
                drawAreas();
            }
        });

        drawAreas();

        element.appendChild(app.view);
    }

    return function (uid, path, horizontal, vertical, fine) {
        element = document.getElementById(uid);

        app = new PIXI.Application({
            autoDensity: true,
            antialias: true,
            resolution: 2,
        });

        const uri = window.location.pathname;
        const left = uri.indexOf('/', 1);
        const right = uri.lastIndexOf('/') + 1;
        const prefix = uri.slice(left, right);

        fetch(`/files${prefix}${path}`)
            .then((response) => {
                if (!response.ok) {
                    throw response.statusText;
                }
                initialize();
                let buffer = '';
                const inflate = new pako.Inflate({ to: 'string' });
                inflate.onData = (chunk) => {
                    buffer += chunk;
                    let begin = 0;
                    let index;
                    while ((index = buffer.indexOf('\n', begin)) !== -1) {
                        process(buffer.slice(begin, index));
                        begin = index + 1;
                    }
                    buffer = buffer.slice(begin);
                };
                inflate.onEnd = (status) => {
                    if (status !== 0) {
                        throw inflate.err;
                    }
                    if (buffer.length > 0) {
                        process(buffer);
                    }
                    finalize(horizontal / vertical, fine);
                };
                const reader = response.body.getReader();
                function pipe({ done, value }) {
                    if (done) {
                        inflate.push(null, true);
                        return;
                    }
                    inflate.push(value, false);
                    reader.read().then(pipe).catch(exit);
                }
                reader.read().then(pipe).catch(exit);
            })
            .catch(exit);
    };
}


window.netpixi = NetPixi();
