import { compare, isFinite, isPositive, isNonNegativeInteger, isString, isObject, conditions } from './types';

function get(props, name) {
    if (name in props) {
        return props[name];
    }
    return null;
}

function pop(object, name) {
    if (name in object) {
        const value = object[name];
        delete object[name];
        return value;
    }
    return null;
}

function popProps(data) {
    const props = pop(data, 'props');
    if (isObject(props)) {
        return props;
    }
    throw 'props must be an object';
}

function loosePop(props, name) {
    if (props !== null) {
        return pop(props, name);
    }
    return null;
}

function loosePopNum(props, name) {
    const value = loosePop(props, name);
    if (isPositive(value)) {
        return value;
    }
    throw `${name} must be a positive number`;
}

function loosePopStr(props, name) {
    const value = loosePop(props, name);
    if (isString(value)) {
        return value;
    }
    throw `${name} must be a string`;
}

function loosePopNulNum(props, name) {
    const value = loosePop(props, name);
    if (value === null || isFinite(value)) {
        return value;
    }
    throw `${name} must be null or a finite number`;
}

function loosePopNulStr(props, name) {
    const value = loosePop(props, name);
    if (value === null || isString(value)) {
        return value;
    }
    throw `${name} must be null or a string`;
}

function tightPop(data, name) {
    if (name in data) {
        const value = data[name];
        delete data[name];
        return value;
    }
    throw `missing ${name}`;
}

function tightPopInt(data, name) {
    const value = tightPop(data, name);
    if (isNonNegativeInteger(value)) {
        return value;
    }
    throw `${name} must be a non-negative integer`;
}

function tightPopIntStr(data, name) {
    const value = tightPop(data, name);
    if (Number.isInteger(value)) {
        return value.toString();
    }
    if (isString(value)) {
        return value;
    }
    throw `${name} must be an integer or a string`;
}

function clean(over, cond) {
    if (over !== null) {
        for (const name in cond) {
            if (name in over && !cond[name](over[name])) {
                throw `invalid ${name}`;
            }
        }
    }
    return over;
}

function overwrite(base, over) {
    if (over === null) {
        return;
    }
    for (const name in base) {
        if (name in over) {
            base[name] = over[name];
        }
    }
}

function merge(base, over, diff) {
    if (over === null) {
        return base;
    }
    const temp = {};
    let same = true;
    for (const name in base) {
        if (name in over && diff[name](base[name], over[name])) {
            temp[name] = over[name];
            same = false;
        } else {
            temp[name] = base[name];
        }
    }
    if (same) {
        return base;
    }
    return temp;
}

function union(base, over) {
    if (base === null) {
        return over;
    }
    if (over !== null) {
        for (const name in over) {
            base[name] = over[name];
        }
    }
    return base;
}

function processGraph(data, processSettings, processVertex, processEdge) {
    const props = popProps(data);
    switch (data.type) {
        case 'settings':
            processSettings(clean(props, conditions.settings));
            break;
        case 'vertex':
            processVertex(data, clean(props, conditions.vertex));
            break;
        case 'edge':
            processEdge(data, clean(props, conditions.edge));
            break;
        default:
            throw 'unknown type';
    }
}

const validate = {
    notDuplicateSettings(object) {
        if (object !== null) {
            throw 'duplicate settings';
        }
    },
    receivedSettings(props) {
        if (props === null) {
            return nullSettings;
        } else {
            return {
                graph: clean(get(props, 'graph'), conditions.graph),
                vertex: clean(get(props, 'vertex'), conditions.vertex),
                edge: clean(get(props, 'edge'), conditions.edge),
                props: props,
            };
        }
    },
    missingDirected(graph, overGraph) {
        if (overGraph !== null && 'directed' in overGraph && overGraph.directed !== graph.directed) {
            throw 'cannot change graph direction';
        }
    },
    receivedId(data) {
        return tightPopIntStr(data, 'id');
    },
    notMissingVertex(id, vertices) {
        if (!(id in vertices)) {
            throw `missing vertex with id ${id}`;
        }
    },
    notDuplicateVertex(id, object) {
        if (id in object) {
            throw `duplicate vertex with id ${id}`;
        }
    },
    receivedX(props) {
        return loosePopNulNum(props, '_x');
    },
    receivedY(props) {
        return loosePopNulNum(props, '_y');
    },
    receivedKey(props) {
        return loosePopNulStr(props, '_key');
    },
    receivedValue(props) {
        return loosePopNulStr(props, '_value');
    },
    receivedSource(data, vertices) {
        const source = tightPopIntStr(data, 'source');
        if (!(source in vertices)) {
            throw `missing source with id ${source}`;
        }
        return source;
    },
    receivedTarget(data, vertices) {
        const target = tightPopIntStr(data, 'target');
        if (!(target in vertices)) {
            throw `missing target with id ${target}`;
        }
        return target;
    },
    receivedIndex(data) {
        const name = 'index';
        if (name in data) {
            const index = data[name];
            delete data[name];
            if (isNonNegativeInteger(index)) {
                return index;
            }
            throw `${name} must be a non-negative integer`;
        }
        return 0;
    },
    notMissingEdge(settings, source, target, index, vertices, areas) {
        let neighbor;
        let numEdges = 0;
        if (vertices[target].leaders.has(source)) {
            for (neighbor of areas[source].neighbors[target]) {
                if (!settings.graph.directed || !neighbor.reversed) {
                    numEdges++;
                }
            }
        } else if (vertices[source].leaders.has(target)) {
            for (neighbor of areas[target].neighbors[source]) {
                if (!settings.graph.directed || neighbor.reversed) {
                    numEdges++;
                }
            }
        }
        if (index < numEdges) {
            return;
        }
        throw `missing edge with source ${source}, target ${target}, and index ${index}`;
    },
    receivedLabel(props) {
        return loosePopNulStr(props, '_label');
    },
    isFrame(data) {
        return data.type === 'frame';
    },
    receivedFrame(data) {
        const props = clean(popProps(data), conditions.frame);
        const frame = {
            duration: tightPopInt(data, 'duration'),
            graph: {},
            vertices: [],
            edges: [],
        };
        return [props, frame];
    },
    receivedGraph(graph, overGraph) {
        for (const name in conditions.graph) {
            if (name in overGraph) {
                if (conditions.graph[name](overGraph[name])) {
                    graph[name] = overGraph[name];
                } else {
                    throw `graph has invalid ${name}`;
                }
            }
        }
    },
    receivedVertex(vertex, overVertex) {
        for (const name in conditions.vertex) {
            if (name in overVertex) {
                if (conditions.vertex[name](overVertex[name])) {
                    vertex[name] = overVertex[name];
                } else {
                    throw `vertex with id ${vertex.id} has invalid ${name}`;
                }
            }
        }
    },
    receivedEdge(edge, overEdge) {
        for (const name in conditions.edge) {
            if (name in overEdge) {
                if (conditions.edge[name](overEdge[name])) {
                    edge[name] = overEdge[name];
                } else {
                    throw `edge with source ${edge.source}, target ${edge.target}, and index ${edge.index} has invalid ${name}`;
                }
            }
        }
    },
    receivedSrc(props) {
        return loosePopStr(props, 'src');
    },
    receivedDst(props, src) {
        const dst = loosePopStr(props, 'dst');
        if (src === dst) {
            throw 'src and dst must be different';
        }
        return dst;
    },
    receivedMin(props) {
        return loosePopNum(props, 'min');
    },
    receivedMax(props, min) {
        const max = loosePopNum(props, 'max');
        if (compare(min, max) >= 0) {
            throw 'min must be less than max';
        }
        return max;
    },
};

const nullSettings = {
    graph: null,
    vertex: null,
    edge: null,
    props: null,
};

export { pop, overwrite, merge, union, processGraph, validate, nullSettings };
