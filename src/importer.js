import { compare } from './types';
import { overwrite, union, processGraph, validate } from './data';
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


function importAnimation(disable) {
    function process(data) {
        console.log(data);
    }
    return loadLocal(disable, process);
}


export { importProperties, importAnimation };
