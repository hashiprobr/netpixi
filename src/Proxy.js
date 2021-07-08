import { compare, isString, conditions } from './types';
import { get, pop, propsPop, clean, overwrite, union, processGraph, validate } from './data';


export default function (settings, vertices, areas, updates, warn) {
    const {
        drawEdges,
        drawAreas,
        updateBackground,
        updateSingleSprite,
        updateSinglePositionAndSprite,
        updateNeighborAreas,
        initializeVisibility,
    } = updates;

    function send(d) {
        try {
            if (d.type === 'frame') {
                let props = propsPop(d);
                props = clean(props, conditions.frame);

                const duration = validate.receivedDuration(d);

                const frame = {
                    duration: duration,
                    graph: {},
                    vertices: [],
                    edges: [],
                };

                if (props === null) {
                    return;
                }

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
                        validate.receivedEdge(edge, overEdge);
                    }
                }
            } else {
                processGraph(d,
                    (props) => {
                        if (props !== null) {
                            const overGraph = get(props, 'graph');
                            validate.missingDirected(settings, overGraph);
                            overwrite(settings.graph, clean(overGraph, conditions.graph));
                            overwrite(settings.vertex, clean(get(props, 'vertex'), conditions.vertex));
                            overwrite(settings.edge, clean(get(props, 'edge'), conditions.edge));
                            settings.props = union(settings.props, props);
                            updateBackground();
                            for (const vertex of Object.values(vertices)) {
                                updateSingleSprite(vertex);
                            }
                            drawAreas();
                        }
                    },
                    (data, props) => {
                        const id = validate.receivedId(data);
                        validate.notMissingVertex(id, vertices);
                        const x = validate.receivedX(props);
                        const y = validate.receivedY(props);
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
                        vertex.props = union(vertex.props, props);
                        if (moved) {
                            updateSinglePositionAndSprite(vertex);
                            initializeVisibility();
                        } else {
                            updateSingleSprite(vertex);
                            updateNeighborAreas(vertex);
                        }
                    },
                    (data, props) => {
                        const source = validate.receivedSource(data, vertices);
                        const target = validate.receivedTarget(data, vertices, source);
                        validate.notMissingEdge(source, target, vertices, areas);
                        let neighbor;
                        let u;
                        if (vertices[target].leaders.has(source)) {
                            neighbor = areas[source].neighbors[target];
                            u = source;
                        } else {
                            neighbor = areas[target].neighbors[source];
                            u = target;
                        }
                        neighbor.props = union(neighbor.props, props);
                        drawEdges(u);
                    });
            }
        } catch (error) {
            if (isString(error)) {
                warn(`Proxy error: ${error}`);
            } else {
                warn(error);
            }
        }
    }
    return { send };
}
