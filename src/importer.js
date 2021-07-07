import { overwrite, union, processGraph, validate } from './data';
import { loadLocal } from './load';


function importProperties(settings, vertices, areas, refresh, scale, initialize) {
    let overSettings;
    let overVertices;
    let overEdges;

    function process(d) {
        processGraph(d,
            (props) => {
                overSettings = validate.configuration(overSettings, props);
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
        if (overSettings !== null) {
            overwrite(settings.graph, overSettings.graph);
            overwrite(settings.vertex, overSettings.vertex);
            overwrite(settings.edge, overSettings.edge);
            refresh.background();
        }

        for (const [id, overVertex] of Object.entries(overVertices)) {
            const vertex = vertices[id];
            if (overVertex.x !== null) {
                vertex.x = overVertex.x;
            }
            if (overVertex.y !== null) {
                vertex.y = overVertex.y;
            }
            vertex.props = union(vertex.props, overVertex.props);
            refresh.sprite(vertex, scale);
        }

        for (const source in overEdges) {
            for (const target in overEdges[source]) {
                let neighbor;
                if (vertices[target].leaders.has(source)) {
                    neighbor = areas[source].neighbors[target];
                } else {
                    neighbor = areas[target].neighbors[source];
                }
                neighbor.props = union(neighbor.props, overEdges[source][target]);
            }
        }
        refresh.edges();
    }

    return loadLocal(() => {
        initialize();
        overSettings = null;
        overVertices = {};
        overEdges = {};
    }, process)
        .then(finalize);
}


function importAnimation(initialize) {
    function process(data) {
        console.log(data);
    }
    return loadLocal(initialize, process);
}


export { importProperties, importAnimation };
