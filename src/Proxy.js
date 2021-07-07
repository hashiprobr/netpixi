import { conditions } from './types';
import { pop, clean, overwrite, union, processGraph, validate } from './data';


export default function (settings, vertices, areas, refresh) {
    function send(d) {
        processGraph(d,
            (props) => {
                if (props !== null) {
                    overwrite(settings.graph, clean(pop(props, 'graph'), conditions.graph));
                    overwrite(settings.vertex, clean(pop(props, 'vertex'), conditions.vertex));
                    overwrite(settings.edge, clean(pop(props, 'edge'), conditions.edge));
                    refresh.background();
                }
            },
            (data, props) => {
                const id = validate.receivedId(data);
                validate.notMissingVertex(id, vertices);
                const x = validate.receivedX(props);
                const y = validate.receivedY(props);
                const vertex = vertices[id];
                if (x !== null) {
                    vertex.x = x;
                }
                if (y !== null) {
                    vertex.y = y;
                }
                vertex.props = union(vertex.props, props);
                refresh.sprite(vertex, null);
            },
            (data, props) => {
                const source = validate.receivedSource(data, vertices);
                const target = validate.receivedTarget(data, vertices, source);
                validate.notMissingEdge(source, target, vertices, areas);
                let neighbor;
                if (vertices[target].leaders.has(source)) {
                    neighbor = areas[source].neighbors[target];
                } else {
                    neighbor = areas[target].neighbors[source];
                }
                neighbor.props = union(neighbor.props, props);
                refresh.edges();
            });
    }
    return { send };
}
