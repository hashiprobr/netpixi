import numpy as np
import graph_tool as gt

from warnings import filterwarnings, resetwarnings

filterwarnings('ignore')
from graph_tool import draw as draw_gt
resetwarnings

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
        for key, map in g.gp.items():
            if map.value_type() == 'python::object':
                if not serializable(map[g]):
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
        s = set()
        for e in g.edges():
            key = [g.vertex_index[e.source()], g.vertex_index[e.target()]]
            if not g.is_directed():
                key.sort()
            key = (key[0], key[1])
            if key in s:
                raise ValueError('Parallel edges not allowed')
            else:
                s.add(key)
        for v in g.vertices():
            if 'id' in g.vp:
                id = g.vp.id[v]
            else:
                id = g.vertex_index[v]
            for key, map in g.vp.items():
                if key != 'id':
                    if map.value_type() == 'python::object':
                        if not serializable(map[v]):
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
            if source == target:
                raise ValueError('Self-loops not allowed')
            for key, map in g.ep.items():
                if map.value_type() == 'python::object':
                    if not serializable(map[e]):
                        raise ValueError(f'Property {key} of edge with source {source} and target {target} must be serializable')

    def settings(self, g):
        props = {}
        for key, map in g.gp.items():
            type = map.value_type()
            if type == 'python::object':
                if map[g] is not None:
                    props[key] = map[g]
            else:
                if type.startswith('vector'):
                    props[key] = [value for value in map[g]]
                else:
                    props[key] = map[g]
        if 'edge' in props and isinstance(props['edge'], dict):
            edge = props.pop('edge')
        else:
            edge = {}
        if 'vertex' in props and isinstance(props['vertex'], dict):
            vertex = props.pop('vertex')
        else:
            vertex = {}
        if 'graph' in props and isinstance(props['graph'], dict) and len(props) == 1:
            graph = props.pop('graph')
        else:
            graph = props
            props = {}
        if 'directed' not in graph and g.is_directed():
            graph['directed'] = True
        if graph:
            props['graph'] = graph
        if vertex:
            props['vertex'] = vertex
        if edge:
            props['edge'] = edge
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
            props = {}
            for key, map in g.vp.items():
                if key != 'id':
                    type = map.value_type()
                    if type == 'python::object':
                        if map[v] is not None:
                            props[key] = map[v]
                    else:
                        if type.startswith('vector'):
                            props[key] = [value for value in map[v]]
                        else:
                            props[key] = map[v]
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
            props = {}
            for key, map in g.ep.items():
                type = map.value_type()
                if type == 'python::object':
                    if map[e] is not None:
                        props[key] = map[e]
                else:
                    if type.startswith('vector'):
                        props[key] = [value for value in map[e]]
                    else:
                        props[key] = map[e]
            yield data, props


def load_gt(path):
    return load(GTLoader, path)


def save_gt(g, path):
    save(GTSaver, g, path)


def render_gt(g, path='temp_gt.net.gz', **kwargs):
    save_gt(g, path)
    return render(path, **kwargs)


def gprop_gt(g, key, value):
    if key in g.gp:
        del g.gp[key]
    g.gp[key] = g.new_gp('object')
    g.gp[key] = value


def vprop_gt(g, key, m):
    g.vp[key] = m


def eprop_gt(g, key, m):
    g.ep[key] = m


def move_gt(g, layout):
    g.vp['_x'] = g.new_vp('object')
    g.vp['_y'] = g.new_vp('object')
    for v in g.vertices():
        x, y = layout[v]
        g.vp._x[v] = x
        g.vp._y[v] = y


__all__ = [
    'draw_gt',
    'load_gt',
    'save_gt',
    'render_gt',
    'gprop_gt',
    'vprop_gt',
    'eprop_gt',
    'move_gt',
]
