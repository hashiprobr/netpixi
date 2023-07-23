import * as ponyfill from 'web-streams-polyfill/ponyfill';
import streamSaver from 'streamsaver';
import * as PIXI from 'pixi.js';

import { compare, differences } from './types';
import { merge } from './data';

if (!streamSaver.WritableStream) {
    streamSaver.WritableStream = ponyfill.WritableStream;
}

function exportPng(app, graph, filename) {
    const {
        settings,
        vertices,
        getScale,
        setExporting,
        drawAreas,
        updateSelected,
        updateSprite,
        updateGeometry,
    } = graph;

    return new Promise((resolve, reject) => {
        setExporting(true);
        for (const vertex of Object.values(vertices)) {
            updateSelected(vertex);
            updateSprite(vertex);
            updateGeometry(vertex);
        }
        drawAreas();

        const clear = false;

        const bounds = app.stage.getBounds();
        const scale = getScale();

        const width = bounds.width + 2 * scale * settings.graph.hborder;
        const height = bounds.height + 2 * scale * settings.graph.vborder;

        const renderTexture = PIXI.RenderTexture.create({ width, height });

        const graphics = new PIXI.Graphics()
            .beginFill(settings.graph.color, settings.graph.alpha)
            .drawRect(-1, -1, width + 2, height + 2)
            .endFill();
        app.renderer.render(graphics, { renderTexture, clear });
        graphics.destroy();

        const tx = scale * settings.graph.hborder - bounds.x;
        const ty = scale * settings.graph.vborder - bounds.y;
        const transform = new PIXI.Matrix(1, 0, 0, 1, tx, ty);
        app.renderer.render(app.stage, { renderTexture, clear, transform });

        const canvas = app.renderer.extract.canvas(renderTexture);

        renderTexture.destroy();

        canvas.toBlob((blob) => {
            const stream = streamSaver.createWriteStream(`${filename}.png`);
            const writer = stream.getWriter();

            window.addEventListener('unload', () => {
                writer.abort();
            });

            blob.arrayBuffer()
                .then((buffer) => {
                    writer.write(new Uint8Array(buffer));
                    resolve();
                })
                .catch(reject)
                .finally(() => {
                    writer.close();
                    setExporting(false);
                    for (const vertex of Object.values(vertices)) {
                        updateSelected(vertex);
                        updateSprite(vertex);
                        updateGeometry(vertex);
                    }
                    drawAreas();
                });
        });
    });
}

function exportSvg(app, graph, filename) {
    const {
        settings,
        vertices,
        areas,
        getInfinite,
        getScale,
        setExporting,
        drawAreas,
        updateSelected,
        updateSprite,
        updateGeometry,
    } = graph;

    return new Promise((resolve, reject) => {
        const encoder = new TextEncoder();

        const stream = streamSaver.createWriteStream(`${filename}.svg`);
        const writer = stream.getWriter();

        window.addEventListener('unload', () => {
            writer.abort();
        });

        function hex(d) {
            const h = d.toString(16);
            if (d < 16) {
                return `0${h}`;
            }
            return h;
        }

        function css(color) {
            const r = (color & 0xff0000) >> 16;
            const g = (color & 0x00ff00) >> 8;
            const b = color & 0x0000ff;
            return `#${hex(r)}${hex(g)}${hex(b)}`;
        }

        function convertPoint(x, y, radius, rotation) {
            const cos = Math.cos(rotation);
            const sin = Math.sin(rotation);
            return `${x + radius * cos},${y + radius * sin}`;
        }

        function convertAttrs(props) {
            const attrs = [];
            for (const [key, value] of Object.entries(props)) {
                attrs.push(`${key}="${value}"`);
            }
            return attrs.join(' ');
        }

        function write(line) {
            writer.write(encoder.encode(`${line}\n`));
        }

        function writeTag(name, props) {
            write(`<${name} ${convertAttrs(props)}/>`);
        }

        function writeContentTag(name, content, props) {
            write(`<${name} ${convertAttrs(props)}>${content}</${name}>`);
        }

        function writePolygon(styleProps, points) {
            writeTag('polygon', {
                ...styleProps,
                points: points.join(' '),
            });
        }

        function writeRegularPolygon(styleProps, x, y, radius, sides, rotation) {
            const points = [];
            const step = 2 * Math.PI / sides;
            for (let i = 0; i < sides; i++) {
                points.push(convertPoint(x, y, radius, rotation));
                rotation += step;
            }
            writePolygon(styleProps, points);
        }

        function writeShape(styleProps, x, y, shape, radius) {
            switch (shape) {
                case 'downtriangle':
                    writeRegularPolygon(styleProps, x, y, radius, 3, Math.PI / 2);
                    break;
                case 'uptriangle':
                    writeRegularPolygon(styleProps, x, y, radius, 3, -Math.PI / 2);
                    break;
                case 'diamond':
                    writeRegularPolygon(styleProps, x, y, radius, 4, 0);
                    break;
                case 'square':
                    writeRegularPolygon(styleProps, x, y, radius, 4, Math.PI / 4);
                    break;
                case 'star': {
                    const half = radius / 2;
                    let rotation = -Math.PI / 2;
                    const points = [];
                    const step = Math.PI / 5;
                    for (let i = 0; i < 5; i++) {
                        points.push(convertPoint(x, y, radius, rotation));
                        rotation += step;
                        points.push(convertPoint(x, y, half, rotation));
                        rotation += step;
                    }
                    writePolygon(styleProps, points);
                    break;
                }
                default:
                    writeTag('circle', {
                        ...styleProps,
                        cx: x,
                        cy: y,
                        r: radius,
                    });
            }
        }

        try {
            setExporting(true);
            for (const vertex of Object.values(vertices)) {
                updateSelected(vertex);
                updateSprite(vertex);
                updateGeometry(vertex);
            }
            drawAreas();

            write('<?xml version="1.0" encoding="UTF-8" standalone="no"?>');

            const bounds = app.stage.getBounds();
            const scale = getScale();

            const width = bounds.width + 2 * scale * settings.graph.hborder;
            const height = bounds.height + 2 * scale * settings.graph.vborder;

            write(`<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${width}" height="${height}">`);

            writeTag('rect', {
                'x': -1,
                'y': -1,
                'width': width + 2,
                'height': height + 2,
                'stroke-width': 0,
                'fill': css(settings.graph.color),
                'fill-opacity': settings.graph.alpha,
            });

            const infinite = getInfinite();

            const tx = scale * settings.graph.hborder + app.stage.position.x - bounds.x;
            const ty = scale * settings.graph.vborder + app.stage.position.y - bounds.y;

            let styleProps;

            for (const area of Object.values(areas)) {
                for (const neighborList of Object.values(area.neighbors)) {
                    for (const neighbor of neighborList) {
                        if (neighbor.body !== null) {
                            styleProps = {
                                'stroke': css(neighbor.color),
                                'stroke-opacity': neighbor.alpha,
                                'stroke-linecap': 'round',
                                'fill-opacity': 0,
                            };
                            let fx;
                            let fy;
                            let gx;
                            let gy;
                            if (infinite) {
                                styleProps['stroke-width'] = neighbor.size;
                                fx = neighbor.body.fx + tx;
                                fy = neighbor.body.fy + ty;
                                gx = neighbor.body.gx + tx;
                                gy = neighbor.body.gy + ty;
                            } else {
                                styleProps['stroke-width'] = scale * neighbor.size;
                                fx = scale * neighbor.body.fx + tx;
                                fy = scale * neighbor.body.fy + ty;
                                gx = scale * neighbor.body.gx + tx;
                                gy = scale * neighbor.body.gy + ty;
                            }
                            let name;
                            let props;
                            if (neighbor.body.straight) {
                                name = 'line';
                                props = {
                                    x1: fx,
                                    y1: fy,
                                    x2: gx,
                                    y2: gy,
                                };
                            } else {
                                let x3;
                                let y3;
                                let x4;
                                let y4;
                                if (infinite) {
                                    x3 = neighbor.body.x3 + tx;
                                    y3 = neighbor.body.y3 + ty;
                                    x4 = neighbor.body.x4 + tx;
                                    y4 = neighbor.body.y4 + ty;
                                } else {
                                    x3 = scale * neighbor.body.x3 + tx;
                                    y3 = scale * neighbor.body.y3 + ty;
                                    x4 = scale * neighbor.body.x4 + tx;
                                    y4 = scale * neighbor.body.y4 + ty;
                                }
                                name = 'path';
                                props = {
                                    d: `M ${fx} ${fy} C ${x3} ${y3} ${x4} ${y4} ${gx} ${gy}`,
                                };
                            }
                            writeTag(name, { ...styleProps, ...props });
                            if (neighbor.head !== null) {
                                let dx;
                                let dy;
                                let nx;
                                let ny;
                                if (infinite) {
                                    dx = neighbor.head.dx;
                                    dy = neighbor.head.dy;
                                    nx = neighbor.head.nx;
                                    ny = neighbor.head.ny;
                                } else {
                                    dx = scale * neighbor.head.dx;
                                    dy = scale * neighbor.head.dy;
                                    nx = scale * neighbor.head.nx;
                                    ny = scale * neighbor.head.ny;
                                }
                                props = {
                                    x1: gx,
                                    y1: gy,
                                    x2: gx - 3 * dx + nx,
                                    y2: gy - 3 * dy + ny,
                                };
                                writeTag('line', { ...styleProps, ...props });
                                props = {
                                    x1: gx,
                                    y1: gy,
                                    x2: gx - 3 * dx - nx,
                                    y2: gy - 3 * dy - ny,
                                };
                                writeTag('line', { ...styleProps, ...props });
                            }
                        }
                    }
                }
            }

            for (const vertex of Object.values(vertices)) {
                const props = merge(settings.vertex, vertex.props, differences.vertex);
                const x = vertex.sprite.x + tx;
                const y = vertex.sprite.y + ty;
                styleProps = {
                    'stroke-width': 0,
                    'fill-opacity': vertex.sprite.alpha,
                };
                if (compare(vertex.sprite.bwidth, 0) > 0) {
                    styleProps.fill = css(props.bcolor);
                    writeShape(styleProps, x, y, props.shape, vertex.sprite.radius);
                    styleProps.fill = css(props.color);
                    writeShape(styleProps, x, y, props.shape, vertex.sprite.radius - vertex.sprite.bwidth);
                } else {
                    styleProps.fill = css(props.color);
                    writeShape(styleProps, x, y, props.shape, vertex.sprite.radius);
                }
                if (vertex.key !== '') {
                    writeContentTag('text', vertex.key, {
                        'x': vertex.keySprite.position.x + tx,
                        'y': vertex.keySprite.position.y + ty,
                        'text-anchor': 'middle',
                        'dy': vertex.keyStyle.fontSize / 3,
                        'font-size': vertex.keyStyle.fontSize,
                        'font-family': vertex.keyStyle.fontFamily,
                        'stroke-width': vertex.keyStyle.strokeThickness,
                        'stroke': css(props.bcolor),
                        'fill': css(props.color),
                        'fill-opacity': vertex.sprite.alpha,
                    });
                }
                if (vertex.value !== '') {
                    writeContentTag('text', vertex.value, {
                        'x': x,
                        'y': y,
                        'text-anchor': 'middle',
                        'dy': vertex.valueStyle.fontSize / 3,
                        'font-size': vertex.valueStyle.fontSize,
                        'font-family': settings.graph.vfamily,
                        'stroke-width': 0,
                        'fill': css(settings.graph.color),
                        'fill-opacity': vertex.sprite.alpha,
                    });
                }
            }

            for (const area of Object.values(areas)) {
                for (const neighborList of Object.values(area.neighbors)) {
                    for (const neighbor of neighborList) {
                        if (neighbor.body !== null && neighbor.label !== '') {
                            const x = neighbor.sprite.x + tx;
                            const y = neighbor.sprite.y + ty;
                            const radius = neighbor.style.fontSize / 2;
                            writeTag('rect', {
                                'x': x - neighbor.width / 2,
                                'y': y - neighbor.height / 2,
                                'width': neighbor.width,
                                'height': neighbor.height,
                                'rx': radius,
                                'ry': radius,
                                'stroke-width': 0,
                                'fill': css(neighbor.color),
                                'fill-opacity': neighbor.alpha,
                            });
                            writeContentTag('text', neighbor.label, {
                                'x': x,
                                'y': y,
                                'text-anchor': 'middle',
                                'dy': neighbor.style.fontSize / 3,
                                'font-size': neighbor.style.fontSize,
                                'font-family': settings.graph.lfamily,
                                'stroke-width': 0,
                                'fill': css(settings.graph.color),
                            });
                        }
                    }
                }
            }
            write('</svg>');
            resolve();
        } catch (error) {
            reject(error);
        } finally {
            writer.close();
            setExporting(false);
            for (const vertex of Object.values(vertices)) {
                updateSelected(vertex);
                updateSprite(vertex);
                updateGeometry(vertex);
            }
            drawAreas();
        }
    });
}

function exportVideo() {
    return new Promise((resolve) => {
        resolve();
    });
}

export { exportPng, exportSvg, exportVideo };
