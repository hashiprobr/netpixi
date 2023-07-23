import { compare } from './types';
import { pop, overwrite, union, processGraph, validate } from './data';
import { loadLocal } from './load';

function importProperties(graph, disable) {
    const {
        settings,
        vertices,
        areas,
        drawEdges,
        updateBackground,
        updateTexture,
        updatePosition,
        updateSprite,
        updateGeometry,
    } = graph;

    let overSettings;
    let overVertices;
    let overEdges;

    function initialize() {
        disable();
        overSettings = null;
        overVertices = {};
        overEdges = {};
    }

    function process(d) {
        processGraph(d,
            (props) => {
                validate.notDuplicateSettings(overSettings);
                overSettings = validate.receivedSettings(props);
                validate.missingDirected(settings.graph, overSettings.graph);
            },
            (data, props) => {
                const id = validate.receivedId(data);
                validate.notMissingVertex(id, vertices);
                validate.notDuplicateVertex(id, overVertices);
                const x = validate.receivedX(props);
                const y = validate.receivedY(props);
                const key = validate.receivedKey(props);
                const value = validate.receivedValue(props);
                overVertices[id] = { x, y, key, value, props };
            },
            (data, props) => {
                const source = validate.receivedSource(data, vertices);
                const target = validate.receivedTarget(data, vertices);
                const index = validate.receivedIndex(data);
                validate.notMissingEdge(settings, source, target, index, vertices, areas);
                const label = validate.receivedLabel(props);
                if (!(source in overEdges)) {
                    overEdges[source] = {};
                }
                if (!(target in overEdges[source])) {
                    overEdges[source][target] = [];
                }
                overEdges[source][target].push({ index, label, props });
            });
    }

    function finalize() {
        let ids;
        let leaders;

        if (overSettings === null) {
            ids = new Set();
            leaders = new Set();
        } else {
            overwrite(settings.graph, overSettings.graph);
            overwrite(settings.vertex, overSettings.vertex);
            overwrite(settings.edge, overSettings.edge);
            settings.props = union(settings.props, overSettings.props);
            updateBackground();
            updateTexture();
            ids = new Set(Object.keys(vertices));
            leaders = new Set(Object.keys(areas));
        }

        const moved = Set();

        for (const [id, overVertex] of Object.entries(overVertices)) {
            const vertex = vertices[id];
            if (overVertex.x !== null) {
                if (compare(vertex.x, overVertex.x) !== 0) {
                    vertex.x = overVertex.x;
                    moved.add(id);
                }
            }
            if (overVertex.y !== null) {
                if (compare(vertex.y, overVertex.y) !== 0) {
                    vertex.y = overVertex.y;
                    moved.add(id);
                }
            }
            if (overVertex.key !== null) {
                vertex.key = overVertex.key;
            }
            if (overVertex.value !== null) {
                vertex.value = overVertex.value;
            }
            vertex.props = union(vertex.props, overVertex.props);
            ids.add(id);
            for (const u of vertex.leaders) {
                leaders.add(u);
            }
        }

        for (const source in overEdges) {
            for (const target in overEdges[source]) {
                const { index, label, props } = overEdges[source][target];
                let neighbor;
                const neighborList = [];
                if (vertices[target].leaders.has(source)) {
                    for (neighbor of areas[source].neighbors[target]) {
                        if (!settings.graph.directed || !neighbor.reversed) {
                            neighborList.push(neighbor);
                        }
                    }
                    leaders.add(source);
                } else if (vertices[source].leaders.has(target)) {
                    for (neighbor of areas[target].neighbors[source]) {
                        if (!settings.graph.directed || neighbor.reversed) {
                            neighborList.push(neighbor);
                        }
                    }
                    leaders.add(target);
                }
                neighbor = neighborList[index];
                if (label !== null) {
                    neighbor.label = label;
                }
                neighbor.props = union(neighbor.props, props);
            }
        }

        for (const id of ids) {
            if (moved.has(id)) {
                updatePosition(vertices[id]);
            }
            updateSprite(vertices[id]);
            updateGeometry(vertices[id]);
        }
        for (const u of leaders) {
            drawEdges(u);
        }
    }

    return loadLocal(initialize, process)
        .then(finalize);
}

function importAnimation(graph, animation, disable) {
    const {
        settings,
        vertices,
        areas,
    } = graph;

    let ids;
    let edges;
    let frames;

    function initialize() {
        disable();
        ids = new Set();
        edges = {};
        frames = [];
    }

    function process(data) {
        if (!validate.isFrame(data)) {
            throw 'type must be frame';
        }

        const [props, frame] = validate.receivedFrame(data);

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
                    if (ids.has(vertex.id)) {
                        throw `duplicate vertex with id ${vertex.id}`;
                    } else {
                        ids.add(vertex.id);
                    }
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
                    edge.target = validate.receivedTarget(overEdge, vertices);
                    edge.index = validate.receivedIndex(overEdge);
                    validate.notMissingEdge(settings, edge.source, edge.target, edge.index, vertices, areas);
                    if (!(edge.source in edges)) {
                        edges[edge.source] = {};
                    }
                    if (!(edge.target in edges[edge.source])) {
                        edges[edge.source][edge.target] = new Set();
                    }
                    if (edges[edge.source][edge.target].has(edge.index)) {
                        throw `duplicate edge with source ${edge.source}, target ${edge.target}, and index ${edge.index}`;
                    } else {
                        edges[edge.source][edge.target].add(edge.index);
                    }
                    validate.receivedEdge(edge, overEdge);
                    frame.edges.push(edge);
                }
            }
        }

        frames.push(frame);
    }

    function finalize() {
        animation.initialize(frames);
    }

    return loadLocal(initialize, process)
        .then(finalize);
}

export { importProperties, importAnimation };
