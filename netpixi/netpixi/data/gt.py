import graph_tool as gt

from .. import render
from ..util import serializable
from . import Loader, Saver, load, save


class GTLoader(Loader):
    def process_settings(self, directed, props):
        g = gt.Graph(directed=directed)
        if props is not None:
            for key, value in props.items():
                g.gp[key] = g.new_gp('object')
                g.gp[key] = value
        g.vp.id = g.new_vp('object')
        self.vertices = {}
        return g

    def process_vertex(self, g, id, props):
        v = g.add_vertex()
        if props is not None:
            if 'id' in props:
                self._raise(ValueError, 'vertex properties cannot have id')
            for key, value in props.items():
                if value is None:
                    self._raise(ValueError, 'vertex properties cannot be null')
                if key not in g.vp:
                    g.vp[key] = g.new_vp('object')
                g.vp[key][v] = value
        g.vp.id[v] = id
        self.vertices[id] = v

    def process_edge(self, g, source, target, props):
        u = self.vertices[source]
        v = self.vertices[target]
        e = g.add_edge(u, v)
        if props is not None:
            for key, value in props.items():
                if value is None:
                    self._raise(ValueError, 'edge properties cannot be null')
                if key not in g.ep:
                    g.ep[key] = g.new_ep('object')
                g.ep[key][e] = value


class GTSaver(Saver):
    def validate(self, g):
        if 'directed' in g.gp:
            directed = g.gp['directed']
            if not isinstance(directed, bool):
                raise TypeError('Property directed of graph must be a boolean')
            if directed is not g.is_directed():
                raise ValueError(f'Property directed of graph must be {not directed}')
        for key, value in g.gp.items():
            if not serializable(value[g]):
                raise ValueError(f'Property {key} of graph must be serializable')
        if 'id' in g.vp:
            s = set()
            for id in g.vp.id:
                if not isinstance(id, (int, str)):
                    raise TypeError('Vertex ids must be integers or strings')
                if id in s:
                    raise ValueError('Vertex ids must be unique')
                else:
                    s.add(id)
        for v in g.vertices():
            if 'id' in g.vp:
                id = g.vp.id[v]
            else:
                id = g.vertex_index[v]
            for key, value in g.vp.items():
                if key != 'id':
                    if not serializable(value[v]):
                        raise ValueError(f'Property {key} of vertex with id {id} must be serializable')
        for e in g.edges():
            u = e.source()
            v = e.target()
            if 'id' in g.vp:
                source = g.vp.id[u]
                target = g.vp.id[v]
            else:
                source = g.vertex_index[u]
                target = g.vertex_index[v]
            for key, value in g.ep.items():
                if not serializable(value[e]):
                    raise ValueError(f'Property {key} of edge with source {source} and target {target} must be serializable')

    def settings(self, g):
        props = {key: value[g] for key, value in g.gp.items() if value[g] is not None}
        if 'directed' not in props and g.is_directed():
            props['directed'] = True
        return {}, props

    def vertices(self, g):
        for v in g.vertices():
            if 'id' in g.vp:
                id = g.vp.id[v]
            else:
                id = g.vertex_index[v]
            data = {
                'id': id,
            }
            props = {key: value[v] for key, value in g.vp.items() if key != 'id' and value[v] is not None}
            yield data, props

    def edges(self, g):
        for e in g.edges():
            u = e.source()
            v = e.target()
            if 'id' in g.vp:
                source = g.vp.id[u]
                target = g.vp.id[v]
            else:
                source = g.vertex_index[u]
                target = g.vertex_index[v]
            data = {
                'source': source,
                'target': target,
            }
            props = {key: value[e] for key, value in g.ep.items() if value[e] is not None}
            yield data, props


def load_gt(path):
    return load(GTLoader, path)


def save_gt(g, path):
    save(GTSaver, g, path)


def render_gt(g, path='temp_gt.net.gz', **kwargs):
    save_gt(g, path)
    render(path, **kwargs)
