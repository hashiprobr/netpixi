import { isFinite, isNonNegativeInteger, isString, isObject, conditions } from './types';


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


function propsPop(data) {
    const props = pop(data, 'props');
    if (!isObject(props)) {
        throw 'props must be an object';
    }
    return props;
}


function loosePop(props, name) {
    if (props !== null) {
        const value = pop(props, name);
        if (value !== null) {
            if (isFinite(value)) {
                return value;
            }
            throw `${name} must be null or a finite number`;
        }
    }
    return null;
}


function tightPop(data, name) {
    if (name in data) {
        const value = data[name];
        delete data[name];
        return value;
    }
    throw `missing ${name}`;
}


function tightPopStr(data, name) {
    const value = tightPop(data, name);
    if (isString(value)) {
        return value;
    }
    throw `${name} must be a string`;
}


function tightPopInt(data, name) {
    const value = tightPop(data, name);
    if (isNonNegativeInteger(value)) {
        return value;
    }
    throw `${name} must be a non-negative integer`;
}


function clean(over, cond) {
    if (over === null) {
        return null;
    }
    for (const name in cond) {
        if (name in over && !cond[name](over[name])) {
            throw `invalid ${name}`;
        }
    }
    return over;
}


function merge(base, over) {
    if (over === null) {
        return { ...base };
    }
    const props = {};
    for (const name in base) {
        if (name in over) {
            props[name] = over[name];
        } else {
            props[name] = base[name];
        }
    }
    return props;
}


function overwrite(base, over) {
    if (over === null) {
        return;
    }
    for (const name in over) {
        if (name in base) {
            base[name] = over[name];
        }
    }
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
    let props = propsPop(data);
    switch (data.type) {
        case 'settings':
            props = clean(props, conditions.settings);
            processSettings(props);
            break;
        case 'vertex':
            props = clean(props, conditions.vertex);
            processVertex(data, props);
            break;
        case 'edge':
            props = clean(props, conditions.edge);
            processEdge(data, props);
            break;
        default:
            throw 'unknown type';
    }
}


const nullSettings = {
    graph: null,
    vertex: null,
    edge: null,
    props: null,
};


const validate = {
    configuration(object, props) {
        if (object !== null) {
            throw 'duplicate settings';
        }
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
    missingDirected(settings, object) {
        if (object !== null && 'directed' in object && object.directed !== settings.graph.directed) {
            throw 'cannot change graph direction';
        }
    },
    receivedId(data) {
        return tightPopStr(data, 'id');
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
        return loosePop(props, 'x');
    },
    receivedY(props) {
        return loosePop(props, 'y');
    },
    receivedSource(data, vertices) {
        const source = tightPopStr(data, 'source');
        if (!(source in vertices)) {
            throw `missing source with id ${source}`;
        }
        return source;
    },
    receivedTarget(data, vertices, source) {
        const target = tightPopStr(data, 'target');
        if (!(target in vertices)) {
            throw `missing target with id ${target}`;
        }
        if (source === target) {
            throw 'source and target with same id';
        }
        return target;
    },
    notMissingEdge(source, target, vertices, areas) {
        const hasStraight = vertices[target].leaders.has(source) && !areas[source].neighbors[target].reversed;
        const hasInverted = vertices[source].leaders.has(target) && areas[target].neighbors[source].reversed;
        if (!hasStraight && !hasInverted) {
            throw `missing edge with source ${source} and target ${target}`;
        }
    },
    notDuplicateEdge(source, target, object) {
        if (source in object) {
            if (target in object[source]) {
                throw `duplicate edge with source ${source} and target ${target}`;
            }
        } else {
            object[source] = {};
        }
    },
    notReversedEdge(settings, source, target, edges) {
        if (settings === null) {
            throw 'missing settings';
        }
        if (!settings.graph.directed && target in edges && source && edges[target]) {
            throw `existing edge with source ${target} and target ${source} but graph is not directed`;
        }
    },
    receivedDuration(object) {
        return tightPopInt(object, 'duration');
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
                    throw `edge with source ${edge.source} and target ${edge.target} has invalid ${name}`;
                }
            }
        }
    },
};


export { get, pop, propsPop, clean, merge, overwrite, union, processGraph, nullSettings, validate };
