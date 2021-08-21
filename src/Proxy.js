import atob from 'atob';

import { compare, isFinite, isString } from './types';
import { pop, overwrite, union, processGraph, validate } from './data';


export default function (cell, graph, animation, panel) {
    const {
        settings,
        vertices,
        areas,
        selected,
        drawEdges,
        drawAreas,
        drawNeighborAreas,
        updateBackground,
        updateTexture,
        updatePosition,
        updateSprite,
        updateGeometry,
    } = graph;

    function deleteGraph(d) {
        processGraph(d,
            () => {
                throw 'unknown delete';
            },
            (data, props) => {
                const src = validate.receivedSrc(props);
                const leaders = [];
                for (const vertex of Object.values(vertices)) {
                    switch (src) {
                        case '_key':
                            vertex.key = '';
                            updateSprite(vertex);
                            updateGeometry(vertex);
                            break;
                        case '_value':
                            vertex.value = '';
                            updateSprite(vertex);
                            break;
                        default:
                            if (vertex.props !== null && src in vertex.props) {
                                delete vertex.props[src];
                                updateSprite(vertex);
                                updateGeometry(vertex);
                                for (const u of vertex.leaders) {
                                    leaders.push(u);
                                }
                            }
                            break;
                    }
                }
                for (const u of leaders) {
                    drawEdges(u);
                }
            },
            (data, props) => {
                const src = validate.receivedSrc(props);
                for (const [u, area] of Object.entries(areas)) {
                    let changed = false;
                    for (const neighbor of Object.values(area.neighbors)) {
                        if (src === '_label') {
                            neighbor.label = '';
                            changed = true;
                        } else {
                            if (neighbor.props !== null && src in neighbor.props) {
                                delete neighbor.props[src];
                                changed = true;
                            }
                        }
                    }
                    if (changed) {
                        drawEdges(u);
                    }
                }
            });
    }

    function copyGraph(d) {
        processGraph(d,
            () => {
                throw 'unknown copy';
            },
            (data, props) => {
                const src = validate.receivedSrc(props);
                const dst = validate.receivedDst(props, src);
                const leaders = [];
                for (const vertex of Object.values(vertices)) {
                    let changed = false;
                    if (vertex.props !== null) {
                        if (src in vertex.props) {
                            vertex.props[dst] = vertex.props[src];
                            changed = true;
                        } else {
                            if (dst in vertex.props) {
                                delete vertex.props[dst];
                                changed = true;
                            }
                        }
                    }
                    if (changed) {
                        updateSprite(vertex);
                        updateGeometry(vertex);
                        for (const u of vertex.leaders) {
                            leaders.push(u);
                        }
                    }
                }
                for (const u of leaders) {
                    drawEdges(u);
                }
            },
            (data, props) => {
                const src = validate.receivedSrc(props);
                const dst = validate.receivedDst(props, src);
                for (const [u, area] of Object.entries(areas)) {
                    let changed = false;
                    for (const neighbor of Object.values(area.neighbors)) {
                        if (neighbor.props !== null) {
                            if (src in neighbor.props) {
                                neighbor.props[dst] = neighbor.props[src];
                                changed = true;
                            } else {
                                if (dst in neighbor.props) {
                                    delete neighbor.props[dst];
                                    changed = true;
                                }
                            }
                        }
                    }
                    if (changed) {
                        drawEdges(u);
                    }
                }
            });
    }

    function setGraph(d) {
        processGraph(d,
            () => {
                throw 'unknown set';
            },
            (data, props) => {
                const src = validate.receivedSrc(props);
                const dst = validate.receivedDst(props, src);
                if (dst !== '_key' && dst !== '_value') {
                    throw 'dst must be _key or _value';
                }
                for (const [id, vertex] of Object.entries(vertices)) {
                    let value = '';
                    if (src === 'id') {
                        value = id;
                    } else {
                        if (vertex.props !== null && src in vertex.props && vertex.props[src] !== null) {
                            value = vertex.props[src];
                        }
                    }
                    if (typeof value === 'string') {
                        vertex[dst.slice(1)] = value;
                    } else {
                        vertex[dst.slice(1)] = value.toString();
                    }
                    updateSprite(vertex);
                    if (dst === '_key') {
                        updateGeometry(vertex);
                    }
                }
            },
            (data, props) => {
                const src = validate.receivedSrc(props);
                for (const [u, area] of Object.entries(areas)) {
                    for (const neighbor of Object.values(area.neighbors)) {
                        let value = '';
                        if (neighbor.props !== null && src in neighbor.props && neighbor.props[src] !== null) {
                            value = neighbor.props[src];
                        }
                        if (typeof value === 'string') {
                            neighbor.label = value;
                        } else {
                            neighbor.label = value.toString();
                        }
                    }
                    drawEdges(u);
                }
            });
    }

    function normalizeGraph(d) {
        processGraph(d,
            () => {
                throw 'unknown normalize';
            },
            (data, props) => {
                const src = validate.receivedSrc(props);
                const newMin = validate.receivedMin(props);
                const newMax = validate.receivedMax(props, newMin);
                let oldMin = Number.POSITIVE_INFINITY;
                let oldMax = Number.NEGATIVE_INFINITY;
                for (const [id, vertex] of Object.entries(vertices)) {
                    let value;
                    if (vertex.props !== null && src in vertex.props) {
                        value = vertex.props[src];
                    } else {
                        if (src in settings.vertex) {
                            value = settings.vertex[src];
                        } else {
                            throw `vertex with id ${id} does not have ${src}`;
                        }
                    }
                    if (isFinite(value)) {
                        if (compare(oldMin, value) > 0) {
                            oldMin = value;
                        }
                        if (compare(oldMax, value) < 0) {
                            oldMax = value;
                        }
                    } else {
                        throw `vertex with id ${id} has non-numeric ${src}`;
                    }
                }
                let newDif;
                let oldDif;
                if (compare(oldMin, oldMax) === 0) {
                    newDif = (newMin + newMax) / 2;
                    oldDif = 0;
                } else {
                    newDif = newMax - newMin;
                    oldDif = oldMax - oldMin;
                }
                for (const vertex of Object.values(vertices)) {
                    if (vertex.props === null) {
                        vertex.props = {};
                    }
                    if (oldDif === 0) {
                        vertex.props[src] = newDif;
                    } else {
                        let value;
                        if (src in vertex.props) {
                            value = vertex.props[src];
                        } else {
                            value = settings.vertex[src];
                        }
                        vertex.props[src] = newMin + newDif * (value - oldMin) / oldDif;
                    }
                    updateSprite(vertex);
                    updateGeometry(vertex);
                }
                drawAreas();
            },
            (data, props) => {
                const src = validate.receivedSrc(props);
                const newMin = validate.receivedMin(props);
                const newMax = validate.receivedMax(props, newMin);
                let oldMin = Number.POSITIVE_INFINITY;
                let oldMax = Number.NEGATIVE_INFINITY;
                for (const [u, area] of Object.entries(areas)) {
                    for (const [v, neighbor] of Object.entries(area.neighbors)) {
                        let source;
                        let target;
                        if (neighbor.reversed) {
                            source = v;
                            target = u;
                        } else {
                            source = u;
                            target = v;
                        }
                        let value;
                        if (neighbor.props !== null && src in neighbor.props) {
                            value = neighbor.props[src];
                        } else {
                            if (src in settings.edge) {
                                value = settings.edge[src];
                            } else {
                                throw `edge with source ${source} and target ${target} does not have ${src}`;
                            }
                        }
                        if (isFinite(value)) {
                            if (compare(oldMin, value) > 0) {
                                oldMin = value;
                            }
                            if (compare(oldMax, value) < 0) {
                                oldMax = value;
                            }
                        } else {
                            throw `edge with source ${source} and target ${target} has non-numeric ${src}`;
                        }
                    }
                }
                let newDif;
                let oldDif;
                if (compare(oldMin, oldMax) === 0) {
                    newDif = (newMin + newMax) / 2;
                    oldDif = 0;
                } else {
                    newDif = newMax - newMin;
                    oldDif = oldMax - oldMin;
                }
                for (const area of Object.values(areas)) {
                    for (const neighbor of Object.values(area.neighbors)) {
                        if (neighbor.props === null) {
                            neighbor.props = {};
                        }
                        if (oldDif === 0) {
                            neighbor.props[src] = newDif;
                        } else {
                            let value;
                            if (src in neighbor.props) {
                                value = neighbor.props[src];
                            } else {
                                value = settings.edge[src];
                            }
                            neighbor.props[src] = newMin + newDif * (value - oldMin) / oldDif;
                        }
                    }
                }
                drawAreas();
            });
    }

    function changeGraph(d) {
        if (!validate.isFrame(d)) {
            processGraph(d,
                (props) => {
                    const overSettings = validate.receivedSettings(props);
                    validate.missingDirected(settings.graph, overSettings.graph);
                    overwrite(settings.graph, overSettings.graph);
                    overwrite(settings.vertex, overSettings.vertex);
                    overwrite(settings.edge, overSettings.edge);
                    settings.props = union(settings.props, overSettings.props);
                    updateBackground();
                    updateTexture();
                    for (const vertex of Object.values(vertices)) {
                        updateSprite(vertex);
                        updateGeometry(vertex);
                    }
                    drawAreas();
                },
                (data, props) => {
                    const id = validate.receivedId(data);
                    validate.notMissingVertex(id, vertices);
                    const x = validate.receivedX(props);
                    const y = validate.receivedY(props);
                    const key = validate.receivedKey(props);
                    const value = validate.receivedValue(props);
                    let moved = false;
                    const vertex = vertices[id];
                    if (x !== null) {
                        if (compare(vertex.x, x) !== 0) {
                            vertex.x = x;
                            moved = true;
                        }
                    }
                    if (y !== null) {
                        if (compare(vertex.y, y) !== 0) {
                            vertex.y = y;
                            moved = true;
                        }
                    }
                    if (key !== null) {
                        vertex.key = key;
                    }
                    if (value !== null) {
                        vertex.value = value;
                    }
                    vertex.props = union(vertex.props, props);
                    if (moved) {
                        updatePosition(vertex);
                    }
                    updateSprite(vertex);
                    updateGeometry(vertex);
                    drawNeighborAreas(vertex);
                },
                (data, props) => {
                    let source = validate.receivedSource(data, vertices);
                    let target = validate.receivedTarget(data, vertices, source);
                    [source, target] = validate.notMissingEdge(settings, source, target, vertices, areas);
                    const label = validate.receivedLabel(props);
                    let neighbor;
                    let u;
                    if (vertices[target].leaders.has(source)) {
                        neighbor = areas[source].neighbors[target];
                        u = source;
                    } else {
                        neighbor = areas[target].neighbors[source];
                        u = target;
                    }
                    if (label !== null) {
                        neighbor.label = label;
                    }
                    neighbor.props = union(neighbor.props, props);
                    drawEdges(u);
                });
        } else {
            const [props, frame] = validate.receivedFrame(d);

            if (props !== null) {
                const overGraph = pop(props, 'graph');
                if (overGraph !== null) {
                    validate.receivedGraph(frame.graph, overGraph);
                }

                const overVertices = pop(props, 'vertices');
                if (overVertices !== null) {
                    for (const overVertex of overVertices) {
                        const vertex = {};
                        vertex.id = validate.receivedId(overVertex);
                        validate.notMissingVertex(vertex.id, vertices);
                        const x = validate.receivedX(overVertex);
                        const y = validate.receivedY(overVertex);
                        if (x !== null) {
                            vertex.x = x;
                        }
                        if (y !== null) {
                            vertex.y = y;
                        }
                        validate.receivedVertex(vertex, overVertex);
                        frame.vertices.push(vertex);
                    }
                }

                const overEdges = pop(props, 'edges');
                if (overEdges !== null) {
                    for (const overEdge in overEdges) {
                        const edge = {};
                        edge.source = validate.receivedSource(overEdge, vertices);
                        edge.target = validate.receivedTarget(overEdge, vertices, edge.source);
                        [edge.source, edge.target] = validate.notMissingEdge(settings, edge.source, edge.target, vertices, areas);
                        validate.receivedEdge(edge, overEdge);
                        frame.edges.push(edge);
                    }
                }
            }

            animation.insert(frame);

            panel.toggleAnimation();
        }
    }

    function changeSelection(d) {
        processGraph(d,
            () => {
                throw 'unknown selection';
            },
            (data, props) => {
                pop(props, '_x');
                pop(props, '_y');
                const key = validate.receivedKey(props);
                const value = validate.receivedValue(props);
                const leaders = new Set();
                for (const vertex of selected) {
                    if (key !== null) {
                        vertex.key = key;
                    }
                    if (value !== null) {
                        vertex.value = value;
                    }
                    vertex.props = union(vertex.props, props);
                    updateSprite(vertex);
                    updateGeometry(vertex);
                    for (const u of vertex.leaders) {
                        leaders.add(u);
                    }
                }
                for (const u of leaders) {
                    drawEdges(u);
                }
            },
            (data, props) => {
                const label = validate.receivedLabel(props);
                const leaders = new Set();
                for (const vertex of selected) {
                    for (const u of vertex.leaders) {
                        if (selected.has(vertices[u])) {
                            leaders.add(u);
                        }
                    }
                }
                for (const u of leaders) {
                    let changed = false;
                    for (const [v, neighbor] of Object.entries(areas[u].neighbors)) {
                        if (selected.has(vertices[v])) {
                            if (label !== null) {
                                neighbor.label = label;
                            }
                            neighbor.props = union(neighbor.props, props);
                            changed = true;
                        }
                    }
                    if (changed) {
                        drawEdges(u);
                    }
                }
            });
    }

    return function (name, code) {
        const actions = {
            deleteGraph,
            copyGraph,
            setGraph,
            normalizeGraph,
            changeGraph,
            changeSelection,
        };
        if (panel.isDisabled()) {
            return;
        }
        panel.disable();
        try {
            actions[name](JSON.parse(atob(code)));
        } catch (error) {
            if (isString(error)) {
                cell.warn(`Proxy error: ${error}`);
            } else {
                cell.warn(error);
            }
        } finally {
            panel.enable();
        }
    };
}
