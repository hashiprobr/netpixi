import { compare, conditions } from './types';
import { get, clean, overwrite, union, processGraph, validate } from './data';


export default function (settings, vertices, areas, updates, warn) {
    const {
        drawEdges,
        drawAreas,
        updateBackground,
        updateSingleSprite,
        updateSinglePositionAndSprite,
        updateNeighborAreas,
        buildVisibility,
    } = updates;

    function send(d) {
        try {
            processGraph(d,
                (props) => {
                    if (props !== null) {
                        overwrite(settings.graph, clean(get(props, 'graph'), conditions.graph));
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
                        buildVisibility();
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
        } catch (error) {
            warn(error);
        }
    }
    return { send };
}
