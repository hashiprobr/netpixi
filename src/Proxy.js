import { compare, isString } from './types';
import { pop, overwrite, union, processGraph, validate } from './data';


export default function (cell, graph, animation, panel) {
    const {
        settings,
        vertices,
        areas,
        drawEdges,
        drawAreas,
        drawNeighborAreas,
        updateBackground,
        updateTexture,
        updatePosition,
        updateSprite,
        updateGeometry,
    } = graph;

    function send(d) {
        if (panel.isDisabled()) {
            return;
        }
        panel.disable();
        try {
            if (!validate.isFrame(d)) {
                processGraph(d,
                    (props) => {
                        if (props !== null) {
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
                        }
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
        } catch (error) {
            if (isString(error)) {
                cell.warn(`Proxy error: ${error}`);
            } else {
                cell.warn(error);
            }
        } finally {
            panel.enable();
        }
    }
    return { send };
}
