import { isFinite, isString, isObject, conditions } from './types';


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


function tightPop(data, name) {
    if (name in data) {
        const value = data[name];
        if (isString(value)) {
            delete data[name];
            return value;
        }
        throw `${name} must be a string`;
    }
    throw `missing ${name}`;
}


function loosePop(props, name) {
    if (props !== null) {
        const value = pop(props, name);
        if (isFinite(value)) {
            return value;
        }
        throw `${name} must be a finite number`;
    }
    return null;
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
    let props = pop(data, 'props');
    if (!isObject(props)) {
        throw 'props must be an object';
    }
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
    receivedId(data) {
        return tightPop(data, 'id');
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
        const source = tightPop(data, 'source');
        if (!(source in vertices)) {
            throw `missing source with id ${source}`;
        }
        return source;
    },
    receivedTarget(data, vertices, source) {
        const target = tightPop(data, 'target');
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
};


export { pop, clean, merge, overwrite, union, processGraph, nullSettings, validate };