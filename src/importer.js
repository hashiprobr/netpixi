import { compare, conditions } from './types';
import { pop, propsPop, clean, overwrite, union, processGraph, validate } from './data';
import { loadLocal } from './load';


function importProperties(settings, vertices, areas, updates, disable) {
    const {
        updateBackground,
        updateMultipleSprites,
        updateMultiplePositionsAndSprites,
        updateMultipleAreas,
        initializeVisibility,
    } = updates;

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
                overSettings = validate.configuration(overSettings, props);
                validate.missingDirected(settings, overSettings.graph);
            },
            (data, props) => {
                const id = validate.receivedId(data);
                validate.notMissingVertex(id, vertices);
                validate.notDuplicateVertex(id, overVertices);
                const x = validate.receivedX(props);
                const y = validate.receivedY(props);
                overVertices[id] = { x, y, props };
            },
            (data, props) => {
                const source = validate.receivedSource(data, vertices);
                const target = validate.receivedTarget(data, vertices, source);
                validate.notMissingEdge(source, target, vertices, areas);
                validate.notDuplicateEdge(source, target, overEdges);
                overEdges[source][target] = props;
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
            ids = new Set(Object.keys(vertices));
            leaders = new Set(Object.keys(areas));
        }

        let moved = false;

        for (const [id, overVertex] of Object.entries(overVertices)) {
            const vertex = vertices[id];
            if (overVertex.x !== null) {
                if (compare(vertex.x, overVertex.x) !== 0) {
                    vertex.x = overVertex.x;
                    moved = true;
                }
            }
            if (overVertex.y !== null) {
                if (compare(vertex.y, overVertex.y) !== 0) {
                    vertex.y = overVertex.y;
                    moved = true;
                }
            }
            vertex.props = union(vertex.props, overVertex.props);
            ids.add(id);
            for (const u of vertex.leaders) {
                leaders.add(u);
            }
        }

        for (const source in overEdges) {
            for (const target in overEdges[source]) {
                let neighbor;
                if (vertices[target].leaders.has(source)) {
                    neighbor = areas[source].neighbors[target];
                    leaders.add(source);
                } else {
                    neighbor = areas[target].neighbors[source];
                    leaders.add(target);
                }
                neighbor.props = union(neighbor.props, overEdges[source][target]);
            }
        }

        if (moved) {
            updateMultiplePositionsAndSprites(ids);
            initializeVisibility();
        } else {
            updateMultipleSprites(ids);
            updateMultipleAreas(leaders);
        }
    }

    return loadLocal(initialize, process)
        .then(finalize);
}


function importAnimation(vertices, areas, animation, disable) {
    let ids;
    let edges;
    let overFrames;

    function initialize() {
        disable();
        ids = new Set();
        edges = {};
        overFrames = [];
    }

    function process(data) {
        if (data.type !== 'frame') {
            throw 'type must be frame';
        }
        let props = propsPop(data);
        props = clean(props, conditions.frame);

        const duration = validate.receivedDuration(data);

        const frame = {
            duration: duration,
            graph: {},
            vertices: [],
            edges: [],
        };

        if (props !== null) {
            const overGraph = pop(props, 'graph');
            if (overGraph !== null) {
                validate.receivedGraph(frame.graph, props);
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
                    if (x !== null) {
                        vertex.x = x;
                    }
                    const y = validate.receivedY(overVertex);
                    if (y !== null) {
                        vertex.y = y;
                    }
                    validate.receivedVertex(vertex, overVertex);
                }
            }

            const overEdges = pop(props, 'edges');
            if (overEdges !== null) {
                for (const overEdge in overEdges) {
                    const edge = {};
                    edge.source = validate.receivedSource(overEdge, vertices);
                    edge.target = validate.receivedTarget(overEdge, vertices, edge.source);
                    validate.notMissingEdge(edge.source, edge.target, vertices, areas);
                    if (!(edge.source in edges)) {
                        edges[edge.source] = new Set();
                    }
                    if (edges[edge.source].has(edge.target)) {
                        throw `duplicate edge with source ${edge.source} and target ${edge.target}`;
                    } else {
                        edges[edge.source].add(edge.target);
                    }
                    validate.receivedEdge(edge, overEdge);
                }
            }
        }

        overFrames.push(frame);
    }

    function finalize() {
        animation.frames.splice(0, animation.frames.length, ...overFrames);
    }

    return loadLocal(initialize, process)
        .then(finalize);
}


export { importProperties, importAnimation };
